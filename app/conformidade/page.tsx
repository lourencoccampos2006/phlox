'use client'

// app/conformidade/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CONFORMIDADE — refeito de raiz na linguagem da mesa (2026-10-07).
//
// Checklist legal adaptado ao TIPO de instituição: RGPD, licenciamento,
// registos obrigatórios, segurança. Ferramenta de organização — não substitui
// aconselhamento jurídico.
//
// ── O DEFEITO DE FUNDO, E O QUE DELE SE CORRIGE AQUI ───────────────────────
// A checklist é DA CASA. Estava guardada POR PESSOA: a leitura era
// `.eq('user_id', user.id)` e a escrita fazia `onConflict: 'user_id,key'`.
//
// Consequência real: numa casa com uma Direção Técnica e um administrador, os
// dois abrem a mesma página e vêem checklists diferentes. Um marca o RGPD como
// conforme, o outro continua a ver «pendente» — e nenhum dos dois sabe que o
// outro já tratou. Numa auditoria isso é o pior dos mundos: o trabalho foi
// feito e não se consegue provar.
//
// O QUE SE CORRIGE SEM MIGRAÇÃO: a LEITURA passa a ser da casa (`scope.filter`),
// e quando há várias linhas para a mesma obrigação fica a mais recente. A
// escrita passa a carimbar `org_id`. A partir de agora os dois vêem o mesmo.
//
// O QUE FICA A FALTAR, E PORQUÊ: a restrição de unicidade da tabela ainda é
// `unique (user_id, key)` — cada pessoa continua a criar a sua própria linha
// em vez de actualizar a da casa. Isso precisa de uma migração, que está
// escrita em `supabase/sprint180_conformidade_da_casa.sql` e que o Fernando
// tem de correr. Até lá, a página mostra a verdade (a leitura mais recente),
// mas a tabela guarda uma linha por pessoa.
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. UM ANEL SVG DE 76px com a percentagem lá dentro. Um donut é decoração:
//     diz o mesmo que o número, ocupa 76px e não se compara com nada.
//  2. CADA OBRIGAÇÃO ERA UM CARTÃO de 90px com três botões de estado à
//     direita. A checklist de um lar tem ~40 itens: 3600px de rolar.
//  3. O 🖨 e o 📝.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs, INST_META } from '@/lib/useClinicPrefs'
import { checklistFor, SAD } from '@/lib/complianceChecklists'
import { printDoc } from '@/lib/print'
import { reportError, isSetupError } from '@/lib/clientError'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho,
  Botao, Seletor, Vazio, ACarregar, Aviso, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import RegistoDeTratamentos from '@/components/institution/RegistoDeTratamentos'

type Status = 'done' | 'pending' | 'na'
interface Stored { key: string; status: Status; note?: string | null; updated_at?: string }

const ST: Record<Status, { label: string; cor: string }> = {
  done:    { label: 'Conforme', cor: 'var(--green)' },
  pending: { label: 'Pendente', cor: 'var(--amber)' },
  na:      { label: 'N/A',      cor: 'var(--ink-5)' },
}

type Filtro = 'todos' | 'pendente' | 'conforme'

export default function ConformidadePage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const largo = useLargo()
  const [state, setState] = useState<Record<string, Stored>>({})
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [erro, setErro] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  /* ── DUAS COISAS NA MESMA PÁGINA, E DE PROPÓSITO ───────────────────────
     A checklist diz O QUE FALTA; o registo de atividades É um dos itens dela
     — o primeiro, e o que a CNPD pede primeiro. Pô-lo noutra página fazia a
     checklist mandar a pessoa para fora para resolver o item que ela própria
     levanta. Aqui o item e a resposta ao item estão a um toque um do outro. */
  const [vista, setVista] = useState<'checklist' | 'registo'>('checklist')

  /* ── A CASA FAZ APOIO DOMICILIÁRIO? ─────────────────────────────────────
     Não se pergunta: conta-se. Uma casa que tem planos de apoio domiciliário
     presta apoio domiciliário, e uma que não tem nenhum não presta — e
     perguntar-lhe num ecrã de conformidade era pedir-lhe que declarasse o que
     os seus próprios dados já dizem.

     Importa porque a Portaria n.º 38/2013 é outra lei: pôr os itens do SAD a
     uma casa que não o presta enche a checklist de pendências impossíveis, e
     uma checklist com pendências que não se podem resolver deixa de se ler. */
  const [temSAD, setTemSAD] = useState(false)

  /* Os itens do apoio domiciliário entram só quando a casa o presta — a
     Portaria n.º 38/2013 é outra lei, e não se exige a uma casa o que a lei
     não lhe exige. */
  const groups = useMemo(
    () => [...checklistFor(institution), ...(temSAD ? [SAD] : [])],
    [institution, temSAD])

  const allItems = useMemo(() => groups.flatMap(g => g.items), [groups])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // A CHECKLIST É DA CASA, não de quem a abre. Era `.eq('user_id', user.id)`
    // — e por isso dois gestores da mesma casa viam estados diferentes.
    const [{ data, error }, sad] = await Promise.all([
      scope.filter(supabase.from('compliance_items').select('key,status,note,updated_at')),
      /* `head: true` com `count`: só se quer saber SE há, não quais são.
         Trazer as linhas para contar um booleano é pedir dados de pessoas
         para não olhar para eles. */
      scope.filter(supabase.from('sad_planos').select('id', { count: 'exact', head: true }))
        .then((r: any) => r, () => ({ count: 0 })),
    ])
    /* Um erro aqui NÃO liga os itens do SAD. «Não sei» não é «não presta», mas
       entre acusar uma casa de ter cinco pendências que não lhe dizem respeito
       e não lhe mostrar cinco itens que lhe dizem, o segundo erro desfaz-se
       com um olhar à página e o primeiro mina a confiança na lista toda. */
    setTemSAD(((sad as any)?.count || 0) > 0)
    if (error) {
      if (isSetupError(error)) setMissing(true)
      else setErro(reportError('conformidade-ler', error, 'Não foi possível ler a checklist.'))
    } else {
      setMissing(false); setErro('')
      // Enquanto a unicidade da tabela for `(user_id, key)`, podem existir
      // várias linhas para a mesma obrigação — uma por pessoa que lhe mexeu.
      // Fica a mais recente, que é a verdade mais próxima do estado da casa.
      const map: Record<string, Stored> = {}
      ;(data || []).forEach((r: Stored) => {
        const atual = map[r.key]
        if (!atual || (r.updated_at || '') > (atual.updated_at || '')) map[r.key] = r
      })
      setState(map)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  async function setItem(key: string, patch: Partial<Stored>) {
    const agora = new Date().toISOString()
    const next = { ...state[key], key, ...patch, updated_at: agora } as Stored
    setState(s => ({ ...s, [key]: next }))
    const { error } = await supabase.from('compliance_items').upsert(scope.stamp({
      user_id: user.id, key, institution,
      status: next.status || 'pending', note: next.note ?? null,
      reviewed_at: agora, reviewed_by: user?.name || null, updated_at: agora,
    }), { onConflict: 'user_id,key' })
    if (error) setErro(reportError('conformidade-gravar', error, 'A alteração não ficou guardada.'))
    else setErro('')
  }

  const done = allItems.filter(i => state[i.key]?.status === 'done').length
  const na = allItems.filter(i => state[i.key]?.status === 'na').length
  const applicable = allItems.length - na
  const pct = applicable > 0 ? Math.round((done / applicable) * 100) : 0
  const pending = allItems.filter(i => (state[i.key]?.status || 'pending') === 'pending')
  const corProntidao = pct >= 90 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)'

  /** O que se mostra. Um filtro por «pendente» é o que torna 40 itens úteis. */
  const gruposVisiveis = useMemo(() => groups.map(g => ({
    group: g.group,
    nota: g.nota,
    items: g.items.filter(it => {
      const s = (state[it.key]?.status || 'pending') as Status
      if (filtro === 'pendente') return s === 'pending'
      if (filtro === 'conforme') return s === 'done'
      return true
    }),
  })).filter(g => g.items.length > 0), [groups, state, filtro])

  function exportPdf() {
    printDoc({
      docTitle: 'Relatório de Conformidade',
      docSubtitle: INST_META[institution].label,
      institution: user?.name || undefined,
      meta: [
        { label: 'Prontidão', value: `${pct}%` },
        { label: 'Conformes', value: `${done}/${applicable}` },
        { label: 'Pendentes', value: String(pending.length) },
        { label: 'Data', value: new Date().toLocaleDateString('pt-PT') },
      ],
      sections: groups.map(g => ({
        heading: g.group,
        records: g.items.map(it => {
          const s = (state[it.key]?.status || 'pending') as Status
          return {
            title: it.title,
            tags: [{ label: ST[s].label, color: ST[s].cor }],
            body: it.detail + (it.ref ? `  (${it.ref})` : ''),
            fields: state[it.key]?.note ? [{ label: 'Nota', value: state[it.key]!.note! }] : undefined,
          }
        }),
      })),
      footerNote: 'Ferramenta de organização interna Phlox. Não substitui aconselhamento jurídico.',
    })
  }

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Conformidade</span>

          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {INST_META[institution].label}
          </span>

          <Seletor<'checklist' | 'registo'>
            opcoes={[
              { id: 'checklist', rotulo: 'O que falta' },
              { id: 'registo', rotulo: 'Registo de tratamentos' },
            ]}
            ativa={vista} aoMudar={setVista} />

          {vista === 'checklist' && (
            <Seletor
              opcoes={[
                { id: 'todos', rotulo: `Tudo ${allItems.length}` },
                { id: 'pendente', rotulo: `Pendentes ${pending.length}` },
                { id: 'conforme', rotulo: `Conformes ${done}` },
              ]}
              ativa={filtro} aoMudar={f => setFiltro(f as Filtro)} />
          )}

          {/* A prontidão. Era um anel SVG de 76px com o número lá dentro —
              um donut diz o mesmo que o número e ocupa 76px. Fica o número,
              em mono, com uma linha fina a mostrar a proporção. */}
          {!loading && !missing && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{
                ...MONO, fontSize: 'var(--t-destaque)', lineHeight: 1,
                fontWeight: 'var(--peso-forte)' as any, color: corProntidao,
              }}>{pct}%</span>
              <span style={{
                width: 90, height: 4, background: 'var(--bg-3)',
                borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0,
              }}>
                <span style={{
                  display: 'block', height: '100%', width: `${pct}%`,
                  background: corProntidao,
                }} />
              </span>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {done} DE {applicable}{na > 0 ? ` · ${na} N/A` : ''}
              </span>
            </span>
          )}

          {!missing && (
            <div style={{ marginLeft: 'auto' }}>
              <Botao onClick={exportPdf}>RELATÓRIO PARA A AUDITORIA</Botao>
            </div>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>CONFORME</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>PENDENTE</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>N/A = não se aplica a esta casa</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Ferramenta de organização interna. Não substitui aconselhamento jurídico
            nem a regulamentação em vigor.
          </span>
        </BarraDeEstado>
      }
    >
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      {/* O registo de atividades não depende da tabela da checklist: é gerado
          do que o Phlox sabe de si próprio, e por isso funciona mesmo numa
          casa que ainda não marcou um único item. */}
      {vista === 'registo' ? (
        <RegistoDeTratamentos temSAD={temSAD} />
      ) : missing ? (
        <Painel>
          <Vazio titulo="A conformidade ainda não está disponível nesta conta."
            oQueFazer="Falta um passo de configuração desta casa. Assim que estiver feito, esta página traz a checklist já adaptada ao tipo de instituição." />
        </Painel>
      ) : loading ? (
        <Painel><ACarregar oQue="A ler a checklist…" /></Painel>
      ) : (
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>O que a lei pede</span>
              <span style={{ ...ROTULO, width: 310, textAlign: 'right' }}>Em que ponto está</span>
            </Cabecalho>
          }
          rodape={
            pending.length > 0 ? (
              <span style={{ ...MONO, color: 'var(--amber)' }}>
                A resolver primeiro: {pending.slice(0, 3).map(p => p.title).join(' · ')}
              </span>
            ) : (
              <span style={{ ...MONO, color: 'var(--green)' }}>
                Nada pendente. Vale a pena rever de seis em seis meses.
              </span>
            )
          }
        >
          {gruposVisiveis.length === 0 ? (
            <Vazio titulo={filtro === 'pendente' ? 'Nada pendente.' : 'Nada conforme ainda.'}
              oQueFazer={filtro === 'pendente'
                ? 'Toda a checklist está tratada ou marcada como não aplicável. Vale a pena rever de seis em seis meses — e sempre que a casa muda de resposta social.'
                : 'Marque como conforme o que já está feito. Cada item fica com a data e com quem o reviu.'} />
          ) : gruposVisiveis.map(g => (
            <div key={g.group}>
              <div style={{
                padding: '5px 12px', background: 'var(--bg-2)',
                borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                <span style={ROTULO}>{g.group}</span>
                {/* A nota diz o que este grupo responde — para quem está a
                    preparar uma visita e precisa de saber por onde começar. */}
                {g.nota && (
                  <span style={{
                    display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
                    marginTop: 2, lineHeight: 1.45,
                  }}>{g.nota}</span>
                )}
              </div>

              {g.items.map(it => {
                const s = (state[it.key]?.status || 'pending') as Status
                const note = state[it.key]?.note || ''
                return (
                  <div key={it.key} style={{
                    padding: '9px 12px', borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${s === 'pending' ? 'var(--amber)' : s === 'done' ? 'var(--green)' : 'transparent'}`,
                  }}>
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      flexDirection: largo ? 'row' : 'column',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                        }}>
                          {it.title}
                          {it.ref && (
                            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                              {' '}· {it.ref}
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.5,
                        }}>{it.detail}</div>
                        {/* ── ONDE É QUE ISTO SE RESOLVE ────────────────────
                            Uma checklist que diz «tenha um registo de
                            atividades de tratamento» é uma lista de trabalhos
                            de casa. Uma que diz onde se faz é uma ferramenta —
                            e metade destes itens resolvem-se dentro do Phlox,
                            em sítios que ninguém sabe que existem. */}
                        {it.onde && (
                          <div style={{
                            fontSize: 'var(--t-meta)', color: 'var(--green)', marginTop: 3,
                            lineHeight: 1.5, display: 'flex', gap: 5,
                          }}>
                            <span style={{ ...MONO, color: 'var(--green)', flexShrink: 0 }}>No Phlox</span>
                            <span>{it.onde}</span>
                          </div>
                        )}
                        {note && (
                          <div style={{
                            fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 5,
                            padding: '5px 9px', background: 'var(--bg-2)',
                            borderLeft: '2px solid var(--border-2)', lineHeight: 1.5,
                          }}>{note}</div>
                        )}
                      </div>

                      <div style={{
                        width: largo ? 310 : '100%', flexShrink: 0,
                        display: 'flex', gap: 5, justifyContent: largo ? 'flex-end' : 'flex-start',
                        flexWrap: 'wrap',
                      }}>
                        {(['done', 'pending', 'na'] as Status[]).map(opt => {
                          const on = s === opt
                          return (
                            <button key={opt} type="button" className="mesa-botao"
                              onClick={() => setItem(it.key, { status: opt })}
                              style={{
                                ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                                textTransform: 'uppercase', padding: '0 10px',
                                borderRadius: 'var(--r-md)', cursor: 'pointer',
                                border: `1px solid ${on ? ST[opt].cor : 'var(--border-2)'}`,
                                background: on ? ST[opt].cor : 'transparent',
                                color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                                fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                              }}>{ST[opt].label}</button>
                          )
                        })}
                        <Botao feitio="calmo"
                          onClick={() => setEditingNote(editingNote === it.key ? null : it.key)}>
                          {note ? 'MUDAR A NOTA' : '+ NOTA'}
                        </Botao>
                      </div>
                    </div>

                    {editingNote === it.key && (
                      <div style={{ marginTop: 8 }}>
                        <textarea defaultValue={note} rows={2} autoFocus
                          aria-label={`Nota sobre ${it.title}`}
                          placeholder="Onde está a prova, quem é o responsável, quando se revê."
                          onBlur={e => { setItem(it.key, { note: e.target.value }); setEditingNote(null) }}
                          style={{ ...CAIXA_TEXTO, width: '100%' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </Painel>
      )}
    </Mesa>
  )
}
