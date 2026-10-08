'use client'

// /vigia — Vigia Clínico do Lar (institucional, Pro/Institucional).
// Painel inteligente que varre TODOS os residentes e prioriza por risco:
// vigilância farmacológica (interações/STOPP/dose), ronda do dia, e relatório.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import Link from 'next/link'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, Campo, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// Fallback só para o helper de markdown (fora do componente); no componente
// usa-se o acento do tipo de instituição.
const ACCENT = 'var(--green)'

interface Vig { risk_score: number; prev_risk_score?: number; alerts: any[]; flags: string[]; summary: string; analysed_at: string; auto_scanned_at?: string }
interface Patient { id: string; name: string; age: number|null; sex: string|null; room: string|null; risk_level: string|null; vigilance: Vig|null }

export default function VigiaPage() {
  const { user, supabase } = useAuth() as any
  // Vocabulário e acento do TIPO de instituição (centro de dia = "utentes" +
  // teal; lar = "residentes" + âmbar; etc.) — nada hardcoded a "Lar".
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const accent = blueprintFor(institution).accent
  const people = cfg.personNounPlural.toLowerCase()
  const personWord = (n: number) => `${n} ${n === 1 ? cfg.personNoun.toLowerCase() : people}`
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [report, setReport] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [gated, setGated] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [open, setOpen] = useState<Patient | null>(null)
  const largo = useLargo()

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const headers = await auth()
    const r = await fetch('/api/vigilancia', { headers })
    if (r.status === 403) { setGated(true); setLoading(false); return }
    const j = await r.json().catch(() => ({}))
    if (j.needs_migration) setNeedsMigration(true)
    setPatients(j.patients || []); setLoading(false)
  }, [auth])
  useEffect(() => { if (user) load() }, [user, load])

  async function scan() {
    setScanning(true); setReport(null)
    let offset = 0, total = 0, done = 0
    do {
      setScanMsg(`A analisar ${people}… ${done}${total ? '/' + total : ''}`)
      const headers = await auth()
      const r = await fetch('/api/vigilancia', { method: 'POST', headers, body: JSON.stringify({ action: 'scan', offset }) })
      const j = await r.json().catch(() => ({}))
      if (j.error) { setScanMsg(j.error); break }
      done = j.done; total = j.total; offset = j.done
      if (!j.has_more) break
    } while (offset < total && offset < 200)
    setScanMsg(''); setScanning(false); await load()
  }

  async function genReport() {
    setReportBusy(true)
    const headers = await auth()
    const r = await fetch('/api/vigilancia', { method: 'POST', headers, body: JSON.stringify({ action: 'report' }) })
    const j = await r.json().catch(() => ({}))
    setReport(j.report || j.error || 'Sem relatório.'); setReportBusy(false)
  }

  if (loading) {
    return <Mesa><Painel><ACarregar oQue="A ler a vigilância…" /></Painel></Mesa>
  }
  if (gated) {
    return (
      <Mesa>
        <Painel>
          <Vazio titulo="O vigia clínico faz parte do plano Institucional."
            oQueFazer={`Varre a medicação de todos os ${people} — interações graves, critérios STOPP e Beers, polimedicação — e ordena por risco, para a ronda começar por quem mais precisa.`}
            acao={<Link href="/pricing" style={{ textDecoration: 'none' }}>
              <Botao feitio="principal">VER O INSTITUCIONAL →</Botao>
            </Link>} />
        </Painel>
      </Mesa>
    )
  }

  const counts = {
    critico: patients.filter(p => (p.vigilance?.risk_score || 0) >= 60).length,
    alto: patients.filter(p => { const s = p.vigilance?.risk_score || 0; return s >= 35 && s < 60 }).length,
    semScan: patients.filter(p => !p.vigilance).length,
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     O detalhe era um modal a 9000 de camada, por cima da lista. Quem compara
     dois residentes tinha de abrir, ler, fechar e abrir o outro — e o modal
     escondia exactamente a lista que dava contexto ao número.

     E o risco era uma bola de 999px de raio com fundo colorido a 18%. Um
     risco é um número: lê-se em mono, alinhado, e compara-se de cima a baixo.
     ══════════════════════════════════════════════════════════════════════════ */
  const corDoRisco = (n: number) =>
    n >= 60 ? 'var(--red)' : n >= 35 ? 'var(--amber)' : n > 0 ? 'var(--ink-3)' : 'var(--ink-5)'

  /* Residentes que PIORARAM desde a última vigilância. É o sinal que uma
     varredura periódica serve para dar — e que um número absoluto não dá. */
  const piores = patients.filter(p =>
    p.vigilance && (p.vigilance.prev_risk_score ?? 0) > 0
    && p.vigilance.risk_score > (p.vigilance.prev_risk_score ?? 0) + 5)

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Vigia clínico</span>

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              {counts.critico > 0 && (
                <span style={{
                  ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)',
                  fontWeight: 'var(--peso-forte)' as any,
                }}>{counts.critico} EM RISCO CRÍTICO</span>
              )}
              {counts.alto > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
                  {counts.alto} EM RISCO ALTO
                </span>
              )}
              {counts.semScan > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                  {counts.semScan} POR ANALISAR
                </span>
              )}
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {personWord(patients.length).toUpperCase()}
              </span>
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={genReport} esperando={reportBusy} disabled={scanning}>
              RELATÓRIO CLÍNICO
            </Botao>
            <Botao feitio="principal" onClick={scan} esperando={scanning}>
              {scanning ? (scanMsg || 'A ANALISAR…') : 'ANALISAR TODOS'}
            </Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>60 ou mais — crítico</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>35 a 59 — alto</span>
          <span style={MONO}>A IA varre a medicação de todos e ordena por risco</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Apoio à decisão. A prescrição e a decisão são sempre do médico.
          </span>
        </BarraDeEstado>
      }
    >
      {needsMigration && (
        <Aviso tom="atencao">
          Esta funcionalidade está temporariamente indisponível. Tente novamente daqui a pouco.
        </Aviso>
      )}

      {/* Quem piorou desde a última vigilância. É o sinal que uma varredura
          periódica serve para dar — e que um número absoluto não dá. */}
      {piores.length > 0 && (
        <Aviso tom="mau" titulo={`${piores.length} ${piores.length === 1 ? 'piorou' : 'pioraram'} desde a última vigilância`}>
          {piores.map(p => `${p.name || cfg.personNoun} (${p.vigilance!.prev_risk_score} → ${p.vigilance!.risk_score})`).join(' · ')}
        </Aviso>
      )}

      {report && (
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>Relatório clínico</span>
              <Botao feitio="calmo" onClick={() => setReport(null)}>FECHAR</Botao>
            </Cabecalho>
          }
        >
          <div style={{ padding: 14, maxWidth: '74ch' }}><MarkdownLite text={report} /></div>
        </Painel>
      )}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo && open ? 'minmax(360px, 1fr) minmax(380px, 520px)' : '1fr',
      }}>
        {(largo || !open) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural} · por risco</span>
                <span style={{ ...ROTULO, width: 200 }}>O que a varredura encontrou</span>
                <span style={{ ...ROTULO, width: 64, textAlign: 'right' }}>Risco</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{patients.length} {people}</span>}
          >
            {loading ? (
              <ACarregar oQue="A ler a vigilância…" />
            ) : patients.length === 0 ? (
              <Vazio titulo={`Ainda não há ${people}.`}
                oQueFazer="Esta página varre a medicação de toda a gente e ordena por risco — sem fichas não há nada para varrer." />
            ) : patients.map(p => {
              const s2 = p.vigilance?.risk_score || 0
              const cor = corDoRisco(s2)
              return (
                <LinhaTabela key={p.id}
                  aoTocar={p.vigilance ? () => setOpen(p) : undefined}
                  ativa={open?.id === p.id}
                  filete={s2 >= 35 ? cor : undefined}
                  principal={p.name || cfg.personNoun}
                  secundaria={[
                    p.age ? `${p.age}a` : '', p.sex || '', p.room ? `· ${p.room}` : '',
                  ].filter(Boolean).join(' ') || undefined}
                  celulas={[
                    {
                      rotulo: 'O que encontrou', largura: 200,
                      valor: p.vigilance
                        ? (p.vigilance.flags?.length
                            ? p.vigilance.flags.join(' · ')
                            : (p.vigilance.summary || 'sem alertas'))
                        : 'por analisar',
                      cor: p.vigilance?.flags?.length ? 'var(--red)' : 'var(--ink-5)',
                    },
                    {
                      rotulo: 'Risco', largura: 64, direita: true, forte: true, cor,
                      valor: p.vigilance ? `${s2}/100` : '—',
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {/* ══ O QUE A VARREDURA ENCONTROU NESTA PESSOA ════════════════════ */}
        {open?.vigilance ? (
          <Painel
            cabeca={
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <Botao onClick={() => setOpen(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-destaque)',
                    fontWeight: 'var(--peso-corpo)' as any,
                  }}>{open.name}</span>
                  <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: corDoRisco(open.vigilance.risk_score) }}>
                    RISCO {open.vigilance.risk_score}/100
                    {open.vigilance.prev_risk_score != null
                      ? ` · ANTES ${open.vigilance.prev_risk_score}` : ''}
                  </span>
                </span>
              </div>
            }
            rodape={
              <span style={{ marginLeft: 'auto' }}>
                <Link href={`/patients/${open.id}`} style={{ textDecoration: 'none' }}>
                  <Botao>ABRIR A FICHA →</Botao>
                </Link>
              </span>
            }
          >
            <div style={{ padding: '0 14px 14px' }}>
              {open.vigilance.alerts.length === 0 ? (
                <Vazio titulo="Sem alertas farmacológicos relevantes."
                  oQueFazer="A varredura olhou para as interações, os critérios STOPP e as doses — e não encontrou nada que mereça mudança." />
              ) : open.vigilance.alerts.map((a, i) => {
                const ac = a.severity === 'grave' ? 'var(--red)'
                  : a.severity === 'moderada' ? 'var(--amber)' : 'var(--ink-4)'
                return (
                  <div key={i} style={{
                    padding: '9px 0 9px 11px', borderBottom: '1px solid var(--border)',
                    borderLeft: `3px solid ${ac}`,
                  }}>
                    <div style={{
                      ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.08em',
                      fontWeight: 'var(--peso-forte)' as any, color: ac, textTransform: 'uppercase',
                    }}>{a.severity} · {a.type}</div>
                    <div style={{
                      fontSize: 'var(--t-dado)', color: 'var(--ink)', marginTop: 3, lineHeight: 1.5,
                    }}>{a.message}</div>
                    {a.action && (
                      <div style={{
                        fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.5,
                      }}>→ {a.action}</div>
                    )}
                  </div>
                )
              })}

              {/* Gémeo Farmacológico — simular a mudança ANTES de prescrever. */}
              <Simulator patientId={open.id} auth={auth} />
            </div>
          </Painel>
        ) : largo && !report ? (
          <Painel>
            <Vazio titulo={`Escolha um ${cfg.personNoun.toLowerCase()}.`}
              oQueFazer="Abre aqui ao lado, com a lista sempre à vista — para se poder comparar o risco de dois sem perder nenhum dos dois." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
  )
}

// Gémeo Farmacológico: simula adicionar ou tirar um fármaco e mostra o
// impacto ANTES de prescrever. Era um bloco com dois emoji (🧪) e campos de
// 8px; passa às peças, sem perder nada do que faz.
function Simulator({ patientId, auth }: { patientId: string; auth: () => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState('')
  const [remove, setRemove] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<any>(null)

  async function run() {
    setBusy(true); setRes(null)
    const headers = await auth()
    const r = await fetch('/api/patients/simulate', {
      method: 'POST', headers,
      body: JSON.stringify({
        patient_id: patientId,
        changes: {
          add: add.split(',').map(s => s.trim()).filter(Boolean),
          remove: remove.split(',').map(s => s.trim()).filter(Boolean),
        },
      }),
    })
    const j = await r.json().catch(() => ({}))
    setRes(j.error ? { error: j.error } : j); setBusy(false)
  }

  const verdicto: Record<string, { label: string; cor: string }> = {
    seguro: { label: 'Seguro', cor: 'var(--green)' },
    cuidado: { label: 'Com cuidado', cor: 'var(--amber)' },
    nao_recomendado: { label: 'Não recomendado', cor: 'var(--red)' },
  }

  if (!open) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
        <Botao onClick={() => setOpen(true)}>SIMULAR UMA MUDANÇA DE MEDICAÇÃO</Botao>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
      <div style={{ ...ROTULO }}>Simular antes de prescrever</div>
      <p style={{
        margin: '3px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.55,
      }}>
        Vê-se o impacto ANTES de a receita sair. Separe os fármacos por vírgulas.
      </p>

      <Campo rotulo="Acrescentar" para="sim-add">
        <input id="sim-add" value={add} onChange={e => setAdd(e.target.value)}
          placeholder="Ex.: ibuprofeno, sertralina" style={{ ...CAIXA, width: '100%' }} />
      </Campo>
      <Campo rotulo="Tirar" para="sim-rm">
        <input id="sim-rm" value={remove} onChange={e => setRemove(e.target.value)}
          placeholder="Ex.: diazepam" style={{ ...CAIXA, width: '100%' }} />
      </Campo>

      <div style={{ marginTop: 12 }}>
        <Botao feitio="principal" onClick={run} esperando={busy}
          disabled={!add.trim() && !remove.trim()}>
          VER O IMPACTO
        </Botao>
      </div>

      {res?.error && <div style={{ marginTop: 10 }}><Aviso tom="mau">{res.error}</Aviso></div>}

      {res && !res.error && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
              textTransform: 'uppercase', fontWeight: 'var(--peso-forte)' as any,
              color: verdicto[res.verdict]?.cor || 'var(--ink-4)',
            }}>{verdicto[res.verdict]?.label || res.verdict}</span>
            <span style={{ ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>
              RISCO {res.risk_before} →{' '}
              <strong style={{ color: res.risk_after > res.risk_before ? 'var(--red)' : 'var(--green)' }}>
                {res.risk_after}
              </strong>
            </span>
          </div>

          {res.summary && (
            <p style={{
              margin: '8px 0 0', fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6,
            }}>{res.summary}</p>
          )}

          {res.new_problems?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ ...ROTULO, color: 'var(--red)' }}>O que passa a haver</div>
              {res.new_problems.map((p: any, i: number) => (
                <div key={i} style={{
                  fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5,
                }}>
                  <strong style={{ color: 'var(--red)' }}>{p.problem}</strong> — {p.detail}
                </div>
              ))}
            </div>
          )}

          {res.resolved_problems?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ ...ROTULO, color: 'var(--green)' }}>O que deixa de haver</div>
              {res.resolved_problems.map((p: string, i: number) => (
                <div key={i} style={{
                  fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 3,
                }}>{p}</div>
              ))}
            </div>
          )}

          {res.monitoring?.length > 0 && (
            <div style={{
              marginTop: 10, ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
            }}>A VIGIAR: {res.monitoring.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  )
}

function MarkdownLite({ text }: { text: string }) {
  // SEGURANÇA: o texto (gerado por IA) pode conter dados livres do utilizador —
  // escapar HTML antes de aplicar as transformações markdown, para não abrir XSS.
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const html = escaped
    .replace(/^### (.+)$/gm, '<h4 style="font-size:var(--t-corpo);font-weight:var(--peso-forte);margin:12px 0 4px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:var(--t-destaque);font-weight:var(--peso-forte);margin:16px 0 6px;color:var(--green)">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0;padding-left:20px">${m}</ul>`)
    .replace(/\n\n/g, '<br/>')
  return (
    <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', lineHeight: 1.7 }}
      dangerouslySetInnerHTML={{ __html: html }} />
  )
}
