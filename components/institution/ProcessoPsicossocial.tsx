'use client'

// components/institution/ProcessoPsicossocial.tsx
// ═══════════════════════════════════════════════════════════════════════════
// O PROCESSO DE UMA PESSOA — o que a psicóloga abre quando se senta a trabalhar
// ═══════════════════════════════════════════════════════════════════════════
//
// Quatro separadores, e a ordem não é arbitrária:
//
//   1. O PROCESSO — quem a pessoa é. Abre primeiro porque é o que se lê antes
//      de qualquer sessão, e porque é o que falta em quase todas as casas.
//   2. AS SESSÕES — o que se fez, por ordem inversa. A última em cima.
//   3. OS INSTRUMENTOS — as escalas aplicadas, com a comparação entre elas.
//      Uma GDS sozinha diz pouco; duas com seis meses de intervalo dizem tudo.
//   4. OS DOCUMENTOS — os relatórios e as autorizações. Não vivem aqui: vivem
//      na pasta da pessoa, que já existe. Daqui aponta-se para lá, porque ter
//      duas pastas de documentos da mesma pessoa é garantir que metade fica
//      numa e metade na outra.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { ptDate } from '@/lib/ptTime'
import { reportError } from '@/lib/clientError'
import { registar, ACOES } from '@/lib/registo'
import {
  TIPOS_DE_SESSAO, tipoDeSessao, HUMOR, INSTRUMENTOS, instrumentoPorId,
  pontuar, interpretar, semTabelaPsi,
} from '@/lib/psicossocial'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import {
  Painel, Cabecalho, Botao, Seletor, Folha, Campo, Vazio, Aviso, Codigo,
  CAIXA, CAIXA_TEXTO, MONO, ROTULO,
} from '@/components/ui/mesa'

type Aba = 'processo' | 'sessoes' | 'instrumentos'

export default function ProcessoPsicossocial({ pid, nome, podeEditar }: {
  pid: string
  nome: string
  podeEditar: boolean
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()

  const [aba, setAba] = useState<Aba>('processo')
  const [processo, setProcesso] = useState<any | null>(null)
  const [sessoes, setSessoes] = useState<any[]>([])
  const [instrumentos, setInstrumentos] = useState<any[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [semSetup, setSemSetup] = useState(false)
  const [naoLeu, setNaoLeu] = useState(false)

  const [aEditarProcesso, setAEditarProcesso] = useState(false)
  const [aSessao, setASessao] = useState(false)
  const [aAplicar, setAAplicar] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pid) return
    setACarregar(true); setNaoLeu(false)
    const [pr, se, inst] = await Promise.all([
      scope.filter(supabase.from('psi_processo').select('*').eq('patient_id', pid)),
      scope.filter(supabase.from('psi_sessoes').select('*').eq('patient_id', pid)).order('data', { ascending: false }),
      scope.filter(supabase.from('psi_instrumentos').select('*').eq('patient_id', pid)).order('data', { ascending: false }),
    ])

    const erro = (pr as any).error || (se as any).error || (inst as any).error
    if (erro) {
      if (semTabelaPsi(erro)) { setSemSetup(true); setACarregar(false); return }
      console.error('[phlox:psicossocial]', erro)
      /* Uma leitura falhada NÃO é «esta pessoa não tem processo». A diferença
         importa: a segunda convida a escrever um novo por cima do que já lá
         está, e perde-se o trabalho de um ano. */
      setNaoLeu(true); setACarregar(false)
      return
    }
    setSemSetup(false)
    setProcesso(((pr as any).data || [])[0] || null)
    setSessoes((se as any).data || [])
    setInstrumentos((inst as any).data || [])
    setACarregar(false)
  }, [pid, supabase, scope.filter])

  useEffect(() => { carregar() }, [carregar])

  if (semSetup) {
    return (
      <AvisoDeSetup codigo="PHX-C9"
        oQue="O processo psicossocial ainda não está disponível nesta conta." />
    )
  }
  if (naoLeu) {
    return (
      <Aviso tom="atencao" titulo="Não foi possível ler o processo">
        Não quer dizer que não exista — quer dizer que não conseguimos ler.
        Recarregue a página antes de escrever seja o que for.
      </Aviso>
    )
  }
  if (aCarregar) {
    return <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>A abrir o processo…</p>
  }

  const ultimas = new Map<string, any>()
  for (const i of instrumentos) if (!ultimas.has(i.instrumento)) ultimas.set(i.instrumento, i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Seletor<Aba>
          opcoes={[
            { id: 'processo', rotulo: 'O processo' },
            { id: 'sessoes', rotulo: `Sessões ${sessoes.length || ''}`.trim() },
            { id: 'instrumentos', rotulo: `Escalas ${instrumentos.length || ''}`.trim() },
          ]}
          ativa={aba} aoMudar={setAba} />

        <span style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {podeEditar && <Botao feitio="principal" onClick={() => setASessao(true)}>+ SESSÃO</Botao>}
          {/* Os documentos vivem na pasta da pessoa. Ter duas pastas da mesma
              pessoa é garantir que metade fica numa e metade na outra. */}
          <Link href={`/patients/${pid}?aba=documentos`} style={{ textDecoration: 'none' }}>
            <Botao titulo="Relatórios, autorizações e o resto — na pasta da pessoa">DOCUMENTOS</Botao>
          </Link>
        </span>
      </div>

      {aba === 'processo' && (
        <OProcesso p={processo} nome={nome} podeEditar={podeEditar}
          aoEditar={() => setAEditarProcesso(true)} />
      )}

      {aba === 'sessoes' && (
        <AsSessoes sessoes={sessoes} podeEditar={podeEditar} aoNova={() => setASessao(true)} />
      )}

      {aba === 'instrumentos' && (
        <OsInstrumentos lista={instrumentos} ultimas={ultimas}
          podeEditar={podeEditar} aoAplicar={setAAplicar} />
      )}

      {aEditarProcesso && (
        <EditarProcesso p={processo} pid={pid} nome={nome}
          aoFechar={() => setAEditarProcesso(false)}
          aoGravado={() => { setAEditarProcesso(false); carregar() }} />
      )}

      {aSessao && (
        <NovaSessao pid={pid} nome={nome}
          aoFechar={() => setASessao(false)}
          aoGravado={() => { setASessao(false); setAba('sessoes'); carregar() }} />
      )}

      {aAplicar && (
        <AplicarInstrumento id={aAplicar} pid={pid} nome={nome}
          aoFechar={() => setAAplicar(null)}
          aoGravado={() => { setAAplicar(null); carregar() }} />
      )}
    </div>
  )

  // ═════════════════════════════════════════════════════════════════════════
  // Os formulários ficam aqui dentro: precisam do `supabase`, do `scope` e do
  // `user`, e passá-los por propriedade a três componentes dava nove
  // argumentos para dizer a mesma coisa.
  // ═════════════════════════════════════════════════════════════════════════

  function EditarProcesso({ p, pid, nome, aoFechar, aoGravado }: {
    p: any | null; pid: string; nome: string; aoFechar: () => void; aoGravado: () => void
  }) {
    const [f, setF] = useState({
      avaliacao: p?.avaliacao || '',
      rede_apoio: p?.rede_apoio || '',
      historia: p?.historia || '',
      plano: p?.plano || '',
      objetivos: (Array.isArray(p?.objetivos) ? p.objetivos.join('\n') : ''),
    })
    const [aGravar, setAGravar] = useState(false)

    async function gravar() {
      setAGravar(true)
      try {
        const corpo = {
          avaliacao: f.avaliacao.trim() || null,
          rede_apoio: f.rede_apoio.trim() || null,
          historia: f.historia.trim() || null,
          plano: f.plano.trim() || null,
          objetivos: f.objetivos.split('\n').map((x: string) => x.trim()).filter(Boolean),
          revisto_em: ptDate(),
          revisto_por: user?.name || user?.email?.split('@')[0] || null,
        }
        const { error } = p?.id
          ? await supabase.from('psi_processo').update(corpo).eq('id', p.id)
          : await supabase.from('psi_processo')
              .insert(scope.stamp({ ...corpo, patient_id: pid, user_id: user?.id }))
        if (error) throw error
        registar({ supabase, scope, user }, {
          ...ACOES.psiProcesso(nome, !p?.id),
          subjectId: pid, subjectName: nome,
        })
        toast.success(p?.id ? 'Processo revisto.' : 'Processo criado.')
        aoGravado()
      } catch (e) {
        toast.error('Não foi possível guardar',
          reportError('psi-processo', e, 'O que escreveste não se perdeu.'))
      } finally { setAGravar(false) }
    }

    return (
      <Folha titulo={`Processo de ${nome}`} aoFechar={aoFechar}>
        <Campo rotulo="Avaliação inicial" para="psi-av"
          ajuda="Como a pessoa chegou, o que a trouxe, o que se percebeu nas primeiras conversas.">
          <textarea id="psi-av" rows={4} value={f.avaliacao}
            onChange={e => setF(x => ({ ...x, avaliacao: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        {/* A rede de apoio é o campo que mais importa — ver a nota no
            sprint186. O isolamento mede-se por quem aparece. */}
        <Campo rotulo="Rede de apoio" para="psi-rede"
          ajuda="Quem visita e de quanto em quanto tempo, quem telefona, quem decide. É o campo que mais diz sobre o isolamento desta pessoa.">
          <textarea id="psi-rede" rows={3} value={f.rede_apoio}
            onChange={e => setF(x => ({ ...x, rede_apoio: e.target.value }))}
            placeholder="A filha vem ao sábado. O filho vive no estrangeiro e telefona ao domingo. Decide a filha."
            style={CAIXA_TEXTO} />
        </Campo>

        <Campo rotulo="História" para="psi-hist"
          ajuda="O que foi a vida, o trabalho, as perdas, o que ainda dá gosto.">
          <textarea id="psi-hist" rows={4} value={f.historia}
            onChange={e => setF(x => ({ ...x, historia: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        <Campo rotulo="Plano de intervenção" para="psi-plano">
          <textarea id="psi-plano" rows={3} value={f.plano}
            onChange={e => setF(x => ({ ...x, plano: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        <Campo rotulo="Objetivos" para="psi-obj" ajuda="Um por linha. São o que se dá por atingido ou não.">
          <textarea id="psi-obj" rows={3} value={f.objetivos}
            onChange={e => setF(x => ({ ...x, objetivos: e.target.value }))}
            placeholder={'Participar numa atividade de grupo por semana\nRetomar o contacto com a irmã'}
            style={CAIXA_TEXTO} />
        </Campo>

        <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
          <Botao feitio="principal" onClick={gravar} esperando={aGravar}>GUARDAR</Botao>
          <Botao onClick={aoFechar}>CANCELAR</Botao>
        </div>
      </Folha>
    )
  }

  function NovaSessao({ pid, nome, aoFechar, aoGravado }: {
    pid: string; nome: string; aoFechar: () => void; aoGravado: () => void
  }) {
    const [f, setF] = useState({
      data: ptDate(), tipo: 'individual', duracao_min: '', onde: '',
      trabalhado: '', observado: '', plano_proxima: '',
      humor: null as number | null, so_tecnico: false,
    })
    const [aGravar, setAGravar] = useState(false)

    const vazia = !f.trabalhado.trim() && !f.observado.trim()

    async function gravar() {
      if (vazia) return
      setAGravar(true)
      try {
        const { error } = await supabase.from('psi_sessoes').insert(scope.stamp({
          patient_id: pid, user_id: user?.id,
          data: f.data, tipo: f.tipo,
          duracao_min: f.duracao_min ? parseInt(f.duracao_min) : null,
          onde: f.onde.trim() || null,
          trabalhado: f.trabalhado.trim() || null,
          observado: f.observado.trim() || null,
          plano_proxima: f.plano_proxima.trim() || null,
          humor: f.humor, so_tecnico: f.so_tecnico,
        }))
        if (error) throw error
        registar({ supabase, scope, user }, {
          ...ACOES.psiSessao(nome, tipoDeSessao(f.tipo).rotulo),
          subjectId: pid, subjectName: nome,
        })
        aoGravado()
      } catch (e) {
        toast.error('Não foi possível guardar a sessão',
          reportError('psi-sessao', e, 'O que escreveste não se perdeu.'))
      } finally { setAGravar(false) }
    }

    return (
      <Folha titulo={`Sessão — ${nome}`} aoFechar={aoFechar}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Quando" para="ps-data">
            <input id="ps-data" type="date" value={f.data} max={ptDate()}
              onChange={e => setF(x => ({ ...x, data: e.target.value }))} style={CAIXA} />
          </Campo>
          <Campo rotulo="Quanto tempo (min)" para="ps-dur">
            <input id="ps-dur" inputMode="numeric" value={f.duracao_min}
              onChange={e => setF(x => ({ ...x, duracao_min: e.target.value.replace(/\D/g, '') }))}
              placeholder="45" style={CAIXA} />
          </Campo>
        </div>

        <Campo rotulo="Que tipo" ajuda={tipoDeSessao(f.tipo).oQue}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
            {TIPOS_DE_SESSAO.map(t => {
              const on = f.tipo === t.id
              return (
                <button key={t.id} type="button" onClick={() => setF(x => ({ ...x, tipo: t.id }))}
                  aria-pressed={on} className="mesa-botao"
                  style={{
                    padding: '0 11px', cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                    background: on ? 'var(--green)' : 'transparent',
                    color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                    border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                  }}>{t.rotulo}</button>
              )
            })}
          </div>
        </Campo>

        <Campo rotulo="O que se trabalhou" para="ps-trab"
          ajuda="O que a sessão fez. É o que se lê daqui a seis meses para saber o que já se tentou.">
          <textarea id="ps-trab" rows={4} value={f.trabalhado} autoFocus
            onChange={e => setF(x => ({ ...x, trabalhado: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        <Campo rotulo="O que se observou" para="ps-obs"
          ajuda="O que se viu, separado do que se fez. Como estava, o que disse, o que mudou desde a última vez.">
          <textarea id="ps-obs" rows={3} value={f.observado}
            onChange={e => setF(x => ({ ...x, observado: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        <Campo rotulo="Como estava">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 2 }}>
            {HUMOR.map(h => {
              const on = f.humor === h.valor
              return (
                <button key={h.valor} type="button"
                  onClick={() => setF(x => ({ ...x, humor: on ? null : h.valor }))}
                  aria-pressed={on} className="mesa-botao"
                  style={{
                    padding: '0 11px', cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                    background: on ? h.cor : 'transparent',
                    color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                    border: `1px solid ${on ? h.cor : 'var(--border-2)'}`,
                  }}>{h.rotulo}</button>
              )
            })}
          </div>
        </Campo>

        <Campo rotulo="Para a próxima" para="ps-prox"
          ajuda="O que fica combinado. É isto que liga uma sessão à seguinte em vez de serem notas soltas.">
          <textarea id="ps-prox" rows={2} value={f.plano_proxima}
            onChange={e => setF(x => ({ ...x, plano_proxima: e.target.value }))} style={CAIXA_TEXTO} />
        </Campo>

        {/* ── A NOTA RESERVADA ──────────────────────────────────────────────
            O que alguém conta a uma psicóloga sobre o filho que não a visita
            não pertence ao turno da tarde. A base de dados fecha mesmo esta
            linha a quem não acompanha — ver a política no sprint186. */}
        <div style={{
          marginTop: 14, padding: '9px 11px', borderRadius: 'var(--r-md)',
          border: `1px solid ${f.so_tecnico ? 'var(--amber)' : 'var(--border-2)'}`,
          background: f.so_tecnico ? 'var(--badge-amber-bg)' : 'var(--bg)',
        }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.so_tecnico}
              onChange={e => setF(x => ({ ...x, so_tecnico: e.target.checked }))}
              style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0, accentColor: 'var(--amber)' }} />
            <span>
              <span style={{ display: 'block', fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>
                Nota reservada a quem acompanha
              </span>
              <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1, lineHeight: 1.45 }}>
                O resto da equipa deixa de ver esta sessão. Use para o que a pessoa
                contou em confiança — e não para o que a equipa precisa de saber
                para cuidar dela.
              </span>
            </span>
          </label>
        </div>

        {vazia && (
          <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '10px 0 0' }}>
            Escreva o que se trabalhou ou o que se observou — uma sessão sem nenhum
            dos dois não diz nada a quem a ler depois.
          </p>
        )}

        <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
          <Botao feitio="principal" onClick={gravar} esperando={aGravar} disabled={vazia}>GUARDAR</Botao>
          <Botao onClick={aoFechar}>CANCELAR</Botao>
        </div>
      </Folha>
    )
  }

  function AplicarInstrumento({ id, pid, nome, aoFechar, aoGravado }: {
    id: string; pid: string; nome: string; aoFechar: () => void; aoGravado: () => void
  }) {
    const inst = instrumentoPorId(id)
    const [respostas, setRespostas] = useState<Record<string, boolean | null>>({})
    const [notas, setNotas] = useState('')
    const [data, setData] = useState(ptDate())
    const [aGravar, setAGravar] = useState(false)
    if (!inst) return null

    const { pontos, respondidas, completo } = pontuar(inst, respostas)
    const nivel = interpretar(inst, pontos)

    async function gravar() {
      if (!inst) return
      setAGravar(true)
      try {
        const { error } = await supabase.from('psi_instrumentos').insert(scope.stamp({
          patient_id: pid, user_id: user?.id,
          instrumento: inst.id, data,
          respostas, pontuacao: pontos,
          interpretacao: nivel.rotulo,
          notas: notas.trim() || null,
        }))
        if (error) throw error
        registar({ supabase, scope, user }, {
          ...ACOES.psiInstrumento(nome, inst.sigla, pontos, inst.max),
          subjectId: pid, subjectName: nome,
        })
        toast.success(`${inst.sigla} registada.`)
        aoGravado()
      } catch (e) {
        toast.error('Não foi possível guardar',
          reportError('psi-instrumento', e, 'As respostas não se perderam.'))
      } finally { setAGravar(false) }
    }

    return (
      <Folha titulo={`${inst.sigla} — ${nome}`} aoFechar={aoFechar}>
        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '12px 0 0' }}>
          {inst.oQue} As perguntas referem-se à <strong>última semana</strong> — diga-o
          em voz alta antes de começar.
        </p>

        <Campo rotulo="Quando" para="pi-data">
          <input id="pi-data" type="date" value={data} max={ptDate()}
            onChange={e => setData(e.target.value)} style={{ ...CAIXA, maxWidth: 200 }} />
        </Campo>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 14 }}>
          {inst.itens.map((item, i) => {
            const r = respostas[item.id]
            return (
              <div key={item.id} style={{
                padding: '9px 10px', borderBottom: '1px solid var(--bg-2)',
                background: r === null || r === undefined ? 'var(--bg)' : 'var(--bg-2)',
              }}>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)', lineHeight: 1.45, marginBottom: 6 }}>
                  <span style={{ ...MONO, color: 'var(--ink-5)', marginRight: 6 }}>{i + 1}</span>
                  {item.texto}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[['sim', true], ['não', false]].map(([rot, v]) => {
                    const on = r === v
                    return (
                      <button key={String(rot)} type="button"
                        onClick={() => setRespostas(x => ({ ...x, [item.id]: on ? null : (v as boolean) }))}
                        aria-pressed={on} className="mesa-botao"
                        style={{
                          minWidth: 76, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                          textTransform: 'uppercase', letterSpacing: '.06em',
                          background: on ? 'var(--ink)' : 'transparent',
                          color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                          border: `1px solid ${on ? 'var(--ink)' : 'var(--border-2)'}`,
                        }}>{rot}</button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* O resultado aparece à medida, e diz sempre quantas faltam. Um total
            parcial mostrado como se fosse final é a forma mais fácil de
            registar uma pontuação errada. */}
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 'var(--r-md)',
          border: `1px solid ${completo ? nivel.cor : 'var(--border-2)'}`,
          background: completo ? 'var(--bg-2)' : 'var(--bg)',
        }}>
          <div style={{ ...ROTULO, color: 'var(--ink-4)' }}>
            {completo ? 'Resultado' : `${respondidas} de ${inst.itens.length} respondidas`}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--t-destaque)',
            color: completo ? nivel.cor : 'var(--ink-4)', marginTop: 4,
            fontWeight: 'var(--peso-forte)' as any,
          }}>
            {pontos} / {inst.max}
          </div>
          {completo && (
            <>
              <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', marginTop: 4 }}>{nivel.rotulo}</div>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.55 }}>
                {nivel.oQueFazer}
              </div>
            </>
          )}
        </div>

        <Campo rotulo="Notas" para="pi-notas"
          ajuda="O que não cabe numa resposta de sim ou não: como respondeu, o que acrescentou, se foi preciso repetir perguntas.">
          <textarea id="pi-notas" rows={3} value={notas}
            onChange={e => setNotas(e.target.value)} style={CAIXA_TEXTO} />
        </Campo>

        <div style={{
          marginTop: 12, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.6,
        }}>
          <div style={{ ...MONO, color: 'var(--ink-4)', marginBottom: 3 }}>O que isto não é</div>
          {inst.limite}
          <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 6 }}>
            {inst.fonte}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
          <Botao feitio="principal" onClick={gravar} esperando={aGravar} disabled={!respondidas}>
            GUARDAR
          </Botao>
          <Botao onClick={aoFechar}>CANCELAR</Botao>
        </div>
        {!completo && respondidas > 0 && (
          <p style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)', margin: '8px 0 0' }}>
            Faltam {inst.itens.length - respondidas}. Pode guardar assim — fica
            registado que a escala ficou incompleta, e o total não se compara com
            uma completa.
          </p>
        )}
      </Folha>
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AS TRÊS VISTAS
// ═══════════════════════════════════════════════════════════════════════════

function OProcesso({ p, nome, podeEditar, aoEditar }: {
  p: any | null; nome: string; podeEditar: boolean; aoEditar: () => void
}) {
  if (!p) {
    return (
      <Vazio titulo={`${nome} ainda não tem processo psicossocial.`}
        oQueFazer="O processo é o que se lê antes de qualquer sessão: quem a pessoa é, quem a visita, e o que se está a tentar."
        acao={podeEditar ? <Botao feitio="principal" onClick={aoEditar}>COMEÇAR O PROCESSO</Botao> : undefined} />
    )
  }

  const campos: [string, string | null][] = [
    ['Avaliação inicial', p.avaliacao],
    ['Rede de apoio', p.rede_apoio],
    ['História', p.historia],
    ['Plano de intervenção', p.plano],
  ]
  const objetivos: string[] = Array.isArray(p.objetivos) ? p.objetivos : []

  return (
    <Painel cabeca={
      <Cabecalho>
        <span style={{ ...ROTULO, flex: 1 }}>O processo</span>
        {p.revisto_em && (
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
            REVISTO {String(p.revisto_em).split('-').reverse().join('/')}
            {p.revisto_por ? ` · ${p.revisto_por}` : ''}
          </span>
        )}
        {podeEditar && <Botao onClick={aoEditar}>REVER</Botao>}
      </Cabecalho>
    }>
      <div style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-9)' }}>
        {objetivos.length > 0 && (
          <div>
            <div style={{ ...ROTULO, color: 'var(--green)', marginBottom: 6 }}>Objetivos</div>
            {objetivos.map((o, i) => (
              <div key={i} style={{
                fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.55,
                paddingLeft: 9, borderLeft: '2px solid var(--green)', marginBottom: 5,
              }}>{o}</div>
            ))}
          </div>
        )}

        {campos.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <div style={{ ...ROTULO, marginBottom: 4 }}>{rotulo}</div>
            <div style={{
              fontSize: 'var(--t-corpo)', lineHeight: 1.65, whiteSpace: 'pre-wrap',
              color: valor ? 'var(--ink-2)' : 'var(--ink-5)',
            }}>{valor || 'Por escrever.'}</div>
          </div>
        ))}
      </div>
    </Painel>
  )
}

function AsSessoes({ sessoes, podeEditar, aoNova }: {
  sessoes: any[]; podeEditar: boolean; aoNova: () => void
}) {
  if (!sessoes.length) {
    return (
      <Vazio titulo="Ainda não há sessões registadas."
        oQueFazer="Uma sessão não é só uma conversa longa — uma observação à mesa ou um telefonema à filha também contam, e é a sequência delas que mostra se algo está a mudar."
        acao={podeEditar ? <Botao feitio="principal" onClick={aoNova}>REGISTAR A PRIMEIRA</Botao> : undefined} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {sessoes.map(s => {
        const t = tipoDeSessao(s.tipo)
        const h = HUMOR.find(x => x.valor === s.humor)
        return (
          <div key={s.id} style={{
            padding: 'var(--space-7)', borderBottom: '1px solid var(--bg-2)',
            borderLeft: `3px solid ${s.so_tecnico ? 'var(--amber)' : 'transparent'}`,
            background: 'var(--bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-dado)',
                color: 'var(--ink)', fontWeight: 'var(--peso-forte)' as any,
              }}>{String(s.data).split('-').reverse().join('/')}</span>
              <Codigo texto={t.codigo} titulo={t.rotulo} />
              {s.duracao_min ? (
                <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                  {s.duracao_min} MIN
                </span>
              ) : null}
              {h && <span style={{ fontSize: 'var(--t-meta)', color: h.cor }}>{h.rotulo}</span>}
              {s.so_tecnico && (
                <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--amber)' }}>RESERVADA</span>
              )}
            </div>

            {s.trabalhado && (
              <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)', lineHeight: 1.6, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
                {s.trabalhado}
              </p>
            )}
            {s.observado && (
              <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
                <span style={{ ...MONO, marginRight: 6 }}>Observou</span>{s.observado}
              </p>
            )}
            {s.plano_proxima && (
              <p style={{ fontSize: 'var(--t-dado)', color: 'var(--green)', lineHeight: 1.55, margin: '6px 0 0' }}>
                <span style={{ ...MONO, color: 'var(--green)', marginRight: 6 }}>Para a próxima</span>
                {s.plano_proxima}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OsInstrumentos({ lista, ultimas, podeEditar, aoAplicar }: {
  lista: any[]
  ultimas: Map<string, any>
  podeEditar: boolean
  aoAplicar: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      {INSTRUMENTOS.map(inst => {
        const minhas = lista.filter(l => l.instrumento === inst.id)
        const ultima = ultimas.get(inst.id)
        const nivel = ultima ? interpretar(inst, ultima.pontuacao ?? 0) : null

        /* A comparação com a anterior é a razão de ser disto. Uma GDS de 7
           isolada diz pouco; uma GDS de 7 que era 3 em março diz tudo. */
        const anterior = minhas[1]
        const delta = ultima && anterior && ultima.pontuacao != null && anterior.pontuacao != null
          ? ultima.pontuacao - anterior.pontuacao : null

        return (
          <Painel key={inst.id} cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>{inst.sigla}</span>
              <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                {minhas.length ? `${minhas.length}×` : 'nunca aplicada'}
              </span>
              {podeEditar && <Botao onClick={() => aoAplicar(inst.id)}>APLICAR</Botao>}
            </Cabecalho>
          }>
            <div style={{ padding: 'var(--space-7)' }}>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
                {inst.oQue}
              </div>

              {ultima && nivel && (
                <div style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--t-numero)',
                    color: nivel.cor, fontWeight: 'var(--peso-forte)' as any, lineHeight: 1,
                  }}>{ultima.pontuacao}</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>/ {inst.max}</span>
                  <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>{nivel.rotulo}</span>
                  {delta !== null && delta !== 0 && (
                    <span style={{
                      ...MONO, fontSize: 'var(--t-micro)',
                      // Em ambas as escalas, mais pontos é pior.
                      color: delta > 0 ? 'var(--red)' : 'var(--green)',
                    }}>
                      {delta > 0 ? `+${delta}` : delta} desde {String(anterior.data).split('-').reverse().join('/')}
                    </span>
                  )}
                </div>
              )}

              {minhas.length > 1 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
                  {minhas.slice(0, 8).map(m => (
                    <span key={m.id} style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                      {String(m.data).slice(2).split('-').reverse().join('/')} · {m.pontuacao}
                    </span>
                  ))}
                </div>
              )}

              {ultima?.notas && (
                <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 'var(--space-6)' }}>
                  {ultima.notas}
                </p>
              )}
            </div>
          </Painel>
        )
      })}
    </div>
  )
}
