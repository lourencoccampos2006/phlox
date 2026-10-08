'use client'

// app/auditoria/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TRAIL — refeito de raiz na linguagem da mesa (2026-10-07).
//
// Cada acção sensível fica registada e encadeada por hash SHA-256. Daqui vê-se,
// verifica-se a integridade da cadeia e exporta-se (RGPD: portabilidade).
//
// ── UM ACHADO: ISTO NÃO ESTAVA LIGADO A NADA ───────────────────────────────
// A rota /auditoria redireciona para `/documentos?tab=auditoria` desde a fusão
// — mas a /documentos nunca teve uma aba `auditoria`. Tinha «Modelos» e
// «Guardados», e o `?tab=` desconhecido caía na primeira.
//
// Resultado: quem clicasse em «Auditoria» aterrava nos modelos de documentos
// sem perceber porquê, e as 130 linhas do `AuditoriaTool` eram código morto a
// ser mantido por ninguém. Não se apaga uma ferramenta — liga-se: a
// /documentos passa a ter a terceira vista, e o redireccionamento acerta.
//
// ── ESTE REGISTO É DA PESSOA, NÃO DA CASA ──────────────────────────────────
// Ao contrário da /conformidade e dos /consentimentos, aqui o `user_id` está
// certo: a cadeia de hash é POR CONTA, e é isso que torna possível verificar
// a sua integridade e exportá-la ao abrigo do direito à portabilidade. Juntar
// contas na mesma cadeia partia as duas coisas.
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. SETE CORES POR CATEGORIA (var(--roxo), var(--green), var(--amber)…), nenhuma delas
//     nos tokens. Uma categoria de evento não é um estado.
//  2. SEIS INDICADORES no topo, um por categoria, antes do primeiro evento.
//  3. CADA EVENTO ERA UM `<details>` com fundo branco e raio. Quinhentos
//     eventos são quinhentos cartões.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { actionLabel, categoryLabel, verifyChain, type AuditCategory } from '@/lib/audit'
import { isSetupError } from '@/lib/clientError'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Ev {
  id: string; at: string; action: string; category: AuditCategory
  resource?: string | null; resource_id?: string | null
  ip?: string | null; user_agent?: string | null
  detail?: any; prev_hash?: string | null; event_hash: string; seq: number
  user_id: string
}

/* O CÓDIGO DE UMA CATEGORIA (2026-10-07)
   Eram sete cores — roxo, azul-petróleo, mostarda — nenhuma delas nos tokens.
   Uma categoria de evento é um FACTO: lê-se em quatro letras, e a cor fica
   livre para o que importa aqui, que é a cadeia estar íntegra ou partida. */
const CAT_CODIGO: Record<string, string> = {
  clinical: 'CLIN', billing: 'FATU', auth: 'ACES',
  settings: 'DEFS', data: 'DADO', integration: 'INTE', general: 'GERAL',
}

// Fundido em "Documentos" como terceira vista — ver o comentário no topo.
export default function AuditoriaRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/documentos?tab=auditoria') }, [r])
  return null
}

export function AuditoriaTool() {
  const { user, supabase } = useAuth() as any
  const largo = useLargo()
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [procura, setProcura] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [verify, setVerify] = useState<null | { ok: boolean; checked: number; reason?: string }>(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // `user_id` está certo aqui, ao contrário da conformidade: a cadeia de
    // hash é POR CONTA, e é isso que a torna verificável e exportável.
    const { data, error } = await supabase.from('audit_events').select('*')
      .eq('user_id', user.id).order('seq', { ascending: false }).limit(500)
    if (error) { if (isSetupError(error)) setMissing(true); setEvents([]) }
    else { setMissing(false); setEvents(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const shown = events.filter(e => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    const t = procura.trim().toLowerCase()
    if (!t) return true
    return actionLabel(e.action).toLowerCase().includes(t)
      || (e.resource || '').toLowerCase().includes(t)
      || e.action.toLowerCase().includes(t)
  })

  async function runVerify() {
    setVerifying(true); setVerify(null)
    // Tem de verificar a cadeia TODA, por ordem ascendente.
    const r = await verifyChain(events as any)
    setVerify(r.ok
      ? { ok: true, checked: r.checked }
      : { ok: false, checked: r.checked, reason: r.firstBreak?.reason })
    setVerifying(false)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phlox-auditoria-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cats: string[] = Array.from(new Set(events.map(e => e.category)))

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Auditoria</span>

          <input value={procura} onChange={e => setProcura(e.target.value)}
            placeholder="Procurar uma acção…" aria-label="Procurar"
            style={{ ...CAIXA, width: 220 }} />

          {cats.length > 1 && (
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              aria-label="Categoria" style={{ ...CAIXA, width: 170 }}>
              <option value="all">Todas as categorias</option>
              {cats.map(c => (
                <option key={c} value={c}>{categoryLabel(c as AuditCategory)}</option>
              ))}
            </select>
          )}

          {!loading && !missing && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {events.length} EVENTO{events.length === 1 ? '' : 'S'}
              {events.length >= 500 ? ' (OS 500 MAIS RECENTES)' : ''}
            </span>
          )}

          {verify && (
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
              color: verify.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {verify.ok
                ? `CADEIA ÍNTEGRA · ${verify.checked} VERIFICADOS`
                : `CADEIA PARTIDA NO Nº ${verify.checked + 1}`}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={exportJson} disabled={!events.length}>EXPORTAR JSON</Botao>
            <Botao feitio="principal" onClick={runVerify} esperando={verifying} disabled={!events.length}>
              VERIFICAR A CADEIA
            </Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Cada acção leva o hash da anterior — mudar uma parte a cadeia</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Só de leitura: as inserções acontecem do lado do servidor, para a cadeia não poder ser reescrita
          </span>
        </BarraDeEstado>
      }
    >
      {verify && !verify.ok && (
        <Aviso tom="mau" titulo={`A cadeia está partida no evento nº ${verify.checked + 1}`}>
          {verify.reason}. Isto quer dizer que um registo foi alterado ou apagado
          depois de escrito. Guarde a exportação em JSON antes de mais nada.
        </Aviso>
      )}

      {missing ? (
        <Painel>
          <Vazio titulo="A auditoria ainda não está disponível nesta conta."
            oQueFazer="Falta um passo de configuração. Assim que estiver feito, cada acção sensível passa a ficar registada e encadeada." />
        </Painel>
      ) : (
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Nº</span>
              <span style={{ ...ROTULO, width: 52 }}>Tipo</span>
              <span style={{ ...ROTULO, flex: 1 }}>O que aconteceu</span>
              <span style={{ ...ROTULO, width: 120, textAlign: 'right' }}>Quando</span>
            </Cabecalho>
          }
          rodape={
            <>
              <span style={MONO}>{shown.length} de {events.length}</span>
              <span style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
                <Link href="/seguranca" style={{ color: 'var(--green)', textDecoration: 'none' }}>
                  COMO FUNCIONA A CADEIA →
                </Link>
              </span>
            </>
          }
        >
          {loading ? (
            <ACarregar oQue="A ler o registo…" />
          ) : shown.length === 0 ? (
            <Vazio
              titulo={events.length === 0 ? 'Ainda não há eventos registados.' : 'Nada corresponde ao filtro.'}
              oQueFazer={events.length === 0
                ? 'As acções sensíveis — entrar, mudar dados clínicos, exportar — ficam aqui à medida que acontecem, cada uma com o hash da anterior.'
                : 'Experimente limpar a pesquisa ou escolher outra categoria.'} />
          ) : shown.map(e => {
            const on = aberto === e.id
            return (
              <div key={e.id} style={{
                borderBottom: '1px solid var(--border)',
                borderLeft: `3px solid ${on ? 'var(--green)' : 'transparent'}`,
                background: on ? 'var(--green-light)' : 'transparent',
              }}>
                <button type="button" onClick={() => setAberto(on ? null : e.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  textAlign: 'left', padding: '6px 12px', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit', color: 'var(--ink)',
                }}>
                  <span style={{
                    ...MONO, fontSize: 'var(--t-meta)', width: 56, textAlign: 'right',
                    flexShrink: 0, color: 'var(--ink-5)',
                  }}>{e.seq}</span>

                  <span style={{ width: 52, flexShrink: 0 }}>
                    <Codigo texto={CAT_CODIGO[e.category] || 'GERAL'} />
                  </span>

                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--t-dado)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {actionLabel(e.action)}
                    {e.resource && (
                      <span style={{ color: 'var(--ink-5)' }}> · {e.resource}</span>
                    )}
                  </span>

                  <span style={{
                    ...MONO, fontSize: 'var(--t-meta)', width: 120, textAlign: 'right',
                    flexShrink: 0, color: 'var(--ink-4)',
                  }}>
                    {new Date(e.at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </button>

                {on && (
                  <div style={{
                    padding: '0 12px 10px 69px', ...MONO, fontSize: 'var(--t-meta)',
                    color: 'var(--ink-3)', lineHeight: 1.65, wordBreak: 'break-all',
                  }}>
                    <div><span style={ROTULO}>acção</span> {e.action}</div>
                    {e.resource_id && <div><span style={ROTULO}>id</span> {e.resource_id}</div>}
                    {e.ip && <div><span style={ROTULO}>ip</span> {e.ip}</div>}
                    {e.user_agent && <div><span style={ROTULO}>origem</span> {e.user_agent}</div>}
                    {e.detail && Object.keys(e.detail).length > 0 && (
                      <div><span style={ROTULO}>detalhe</span> {JSON.stringify(e.detail)}</div>
                    )}
                    <div style={{
                      marginTop: 7, paddingTop: 7, borderTop: '1px dashed var(--border-2)',
                    }}>
                      <span style={ROTULO}>hash anterior</span> {e.prev_hash || '—'}
                    </div>
                    <div><span style={ROTULO}>hash</span> {e.event_hash}</div>
                  </div>
                )}
              </div>
            )
          })}
        </Painel>
      )}
    </Mesa>
  )
}
