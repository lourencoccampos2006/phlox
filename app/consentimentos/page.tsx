'use client'

// app/consentimentos/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CONSENTIMENTOS E RGPD — refeito de raiz na linguagem da mesa (2026-10-07).
//
// Gera, imprime e arquiva consentimentos adaptados ao tipo de instituição.
// Funciona para qualquer pessoa, mesmo sem conta Phlox: basta o nome.
//
// ── O MESMO DEFEITO DE FUNDO DA /conformidade ──────────────────────────────
// Um consentimento assinado é DA CASA. Estava guardado por pessoa: a leitura
// era `.eq('user_id', user.id)` e o `insert` não carimbava `org_id`.
//
// Consequência real: a auxiliar imprime e arquiva o consentimento de imagem de
// um residente; a Direção Técnica abre a mesma página e vê um arquivo vazio.
// Quando a família perguntar «assinaram o quê?», a resposta depende de quem
// está a olhar — e num processo individual isso não pode acontecer.
//
// Corrigido: a leitura passa por `scope.filter` e a escrita por `scope.stamp`.
// Ao contrário da conformidade, aqui não há restrição de unicidade por pessoa
// a desfazer — cada consentimento é uma linha própria. Não precisa de migração.
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. QUATRO TONS DE ROXO (var(--roxo), var(--roxo-claro), var(--roxo-meio), var(--roxo)) que não
//     existem nos tokens nem em mais nenhuma página institucional.
//  2. OS MODELOS ERAM SETE BOTÕES EMPILHADOS numa coluna de 300px, cada um
//     com um emoji à frente — uma coluna inteira gasta numa escolha.
//  3. O ARQUIVO VINHA POR BAIXO DE TUDO, fora do ecrã. É metade do valor
//     desta página: saber o que já está assinado e o que falta.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs, INST_META } from '@/lib/useClinicPrefs'
import { consentTemplatesFor, fillConsent, type ConsentTemplate } from '@/lib/consentTemplates'
import { printDoc } from '@/lib/print'
import { reportError, isSetupError } from '@/lib/clientError'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Consent {
  id: string; person_name: string; kind: string
  institution?: string | null; signed: boolean
  signed_at?: string | null; created_at: string
}

export default function ConsentimentosPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const largo = useLargo()
  const templates = consentTemplatesFor(institution)
  const instLabel = INST_META[institution].label

  const [tpl, setTpl] = useState<ConsentTemplate>(templates[0])
  const [name, setName] = useState('')
  const [history, setHistory] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [saved, setSaved] = useState('')
  const [aArquivar, setAArquivar] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // O ARQUIVO É DA CASA. Era `.eq('user_id', user.id)` — e por isso quem
    // arquivava era a única pessoa que depois via o consentimento.
    const { data, error } = await scope.filter(
      supabase.from('consents').select('id,person_name,kind,institution,signed,signed_at,created_at'))
      .order('created_at', { ascending: false }).limit(60)
    if (error) {
      if (isSetupError(error)) setMissing(true)
      setHistory([])
    } else {
      setMissing(false)
      setHistory(data || [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useEffect(() => { setTpl(templates[0]) }, [institution]) // eslint-disable-line react-hooks/exhaustive-deps

  const filled = fillConsent(tpl.body, name, instLabel)

  function doPrint(forSign = true) {
    printDoc({
      docTitle: `Consentimento — ${tpl.label}`,
      docSubtitle: instLabel,
      meta: [
        { label: 'Nome', value: name || '________________' },
        { label: 'Data', value: new Date().toLocaleDateString('pt-PT') },
      ],
      sections: [
        { heading: 'Declaração', records: [{ title: tpl.label, body: filled }] },
        ...(forSign ? [{ heading: 'Assinaturas', records: [{
          title: '',
          fields: [
            { label: 'Assinatura do titular / representante', value: '\n\n______________________________' },
            { label: 'Profissional / instituição', value: '\n\n______________________________' },
            { label: 'Data', value: '____ / ____ / ________' },
          ],
        }] }] : []),
      ],
      footerNote: 'Documento gerado pelo Phlox Clinical. Conserve cópia assinada no processo.',
    })
  }

  async function archive() {
    if (!name.trim()) { setSaved('Escreva o nome do titular antes de arquivar.'); return }
    setAArquivar(true)
    const { data, error } = await supabase.from('consents').insert(scope.stamp({
      user_id: user.id, person_name: name.trim(), kind: tpl.kind,
      institution: instLabel, body: filled, signed: false,
    })).select().single()
    setAArquivar(false)
    if (!error && data) {
      setHistory(p => [data, ...p])
      setSaved('Arquivado. Falta marcar como assinado quando o papel voltar.')
      setTimeout(() => setSaved(''), 4000)
    } else {
      setSaved(reportError('consentimentos-arquivar', error, 'Não foi possível arquivar.'))
    }
  }

  async function toggleSigned(c: Consent) {
    const signed = !c.signed
    const { error } = await supabase.from('consents')
      .update({ signed, signed_at: signed ? new Date().toISOString() : null }).eq('id', c.id)
    if (error) { setSaved(reportError('consentimentos-assinar', error, 'A alteração não ficou guardada.')); return }
    setHistory(p => p.map(x => x.id === c.id
      ? { ...x, signed, signed_at: signed ? new Date().toISOString() : null } : x))
  }

  async function del(id: string) {
    if (!confirm('Eliminar este consentimento do arquivo?')) return
    const { error } = await supabase.from('consents').delete().eq('id', id)
    if (error) { setSaved(reportError('consentimentos-apagar', error, 'Não foi possível eliminar.')); return }
    setHistory(p => p.filter(x => x.id !== id))
  }

  const tLabel = (k: string) => templates.find(t => t.kind === k)?.label || k
  const porAssinar = history.filter(c => !c.signed).length

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Consentimentos</span>

          {/* Os sete modelos eram sete botões empilhados numa coluna de 300px.
              Uma lista pendente é um alvo só, e devolve a coluna à página. */}
          <select value={tpl.kind}
            onChange={e => setTpl(templates.find(t => t.kind === e.target.value) || templates[0])}
            aria-label="Modelo de consentimento" style={{ ...CAIXA, width: 250 }}>
            {templates.map(t => <option key={t.kind} value={t.kind}>{t.label}</option>)}
          </select>

          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do titular ou de quem o representa"
            aria-label="Nome do titular" style={{ ...CAIXA, width: 280 }} />

          {!loading && !missing && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {history.length} NO ARQUIVO
              </span>
              {porAssinar > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                  {porAssinar} POR ASSINAR
                </span>
              )}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao feitio="principal" onClick={() => doPrint(true)}>IMPRIMIR PARA ASSINAR</Botao>
            {!missing && (
              <Botao onClick={archive} esperando={aArquivar} disabled={!name.trim()}>
                ARQUIVAR
              </Botao>
            )}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>ASSINADO = o papel voltou</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>POR ASSINAR = foi impresso e ainda não voltou</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Modelos orientadores. Adapte ao seu contexto e valide juridicamente quando necessário.
          </span>
        </BarraDeEstado>
      }
    >
      {missing && (
        <Aviso tom="atencao" titulo="O arquivo está indisponível de momento">
          Pode gerar e imprimir já — isso funciona. O que não funciona agora é guardar
          o consentimento no arquivo desta casa.
        </Aviso>
      )}
      {saved && (
        <Aviso tom={/Não foi possível|antes de arquivar/.test(saved) ? 'mau' : 'bom'}>{saved}</Aviso>
      )}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(420px, 1fr) minmax(320px, 440px)' : '1fr',
      }}>
        {/* ══ O DOCUMENTO ═══════════════════════════════════════════════════ */}
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>{tpl.label}</span>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {instLabel}
              </span>
            </Cabecalho>
          }
          rodape={
            name.trim() ? (
              <span style={MONO}>Em nome de {name.trim()}</span>
            ) : (
              <span style={{ ...MONO, color: 'var(--amber)' }}>
                Sem nome, imprime com uma linha em branco para preencher à mão
              </span>
            )
          }
        >
          <div style={{
            whiteSpace: 'pre-wrap', fontSize: 'var(--t-corpo)', color: 'var(--ink-2)',
            lineHeight: 1.7, padding: '14px 16px', maxWidth: '72ch',
          }}>{filled}</div>
        </Painel>

        {/* ══ O ARQUIVO ═════════════════════════════════════════════════════
            Estava por baixo de tudo, fora do ecrã — e é metade do valor desta
            página: saber o que já está assinado e o que ainda não voltou. */}
        {!missing && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>Arquivo desta casa</span>
                <span style={{ ...ROTULO, width: 110, textAlign: 'right' }}>Estado</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{history.length} consentimento{history.length === 1 ? '' : 's'}</span>}
          >
            {loading ? (
              <ACarregar oQue="A abrir o arquivo…" />
            ) : history.length === 0 ? (
              <Vazio titulo="Ainda não há consentimentos arquivados."
                oQueFazer="Escolha o modelo, escreva o nome e imprima. Ao arquivar, fica aqui com a data — e passa a ver-se, de relance, o que já foi assinado e o que ainda não voltou." />
            ) : history.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderBottom: '1px solid var(--border)',
                borderLeft: `3px solid ${c.signed ? 'transparent' : 'var(--amber)'}`,
              }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-dado)',
                    fontWeight: 'var(--peso-corpo)' as any,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.person_name}</span>
                  <span style={{
                    display: 'block', ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tLabel(c.kind)} · {new Date(c.created_at).toLocaleDateString('pt-PT')}
                    {c.signed && c.signed_at
                      ? ` · assinado ${new Date(c.signed_at).toLocaleDateString('pt-PT')}`
                      : ''}
                  </span>
                </span>

                <span style={{ width: 110, flexShrink: 0, display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                  <button type="button" className="mesa-botao" onClick={() => toggleSigned(c)}
                    style={{
                      ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                      textTransform: 'uppercase', padding: '0 9px',
                      borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${c.signed ? 'var(--green)' : 'var(--border-2)'}`,
                      background: c.signed ? 'var(--green)' : 'transparent',
                      color: c.signed ? 'var(--sobre-acento)' : 'var(--ink-4)',
                      fontWeight: (c.signed ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                      whiteSpace: 'nowrap',
                    }}>{c.signed ? 'Assinado' : 'Assinar'}</button>
                  <Botao feitio="calmo" onClick={() => del(c.id)}>×</Botao>
                </span>
              </div>
            ))}
          </Painel>
        )}
      </div>
    </Mesa>
  )
}
