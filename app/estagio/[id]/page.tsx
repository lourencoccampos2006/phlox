'use client'

// /estagio/[id] — Página completa do estágio com tabs:
//   1. Dashboard (resumo + horas + objectivos)
//   2. Doentes (lista + ficha de cada)
//   3. Diário (log de turnos)
//   4. Objectivos (checklist com nível)
//   5. Procedimentos (logbook)
//   6. Casos (apresentações)
//   7. Relatórios (gera com IA)
//   8. Reflexões (modelo Gibbs)
//   9. Avaliações (supervisor)

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import Icon from '@/components/Icon'

const ACCENT = 'var(--green)'

type Tab = 'coach'|'dashboard'|'doentes'|'diario'|'objectivos'|'procedimentos'|'casos'|'relatorios'|'reflexoes'|'avaliacoes'|'horas'|'ferramentas'

interface Patient {
  id: string; initials: string|null; age: number|null; sex: string|null
  diagnosis: string|null; chief_complaint: string|null; status: string
  admission_date: string|null; discharge_date: string|null
}
interface LogEntry {
  id: string; entry_date: string; shift: string|null; hours: number|null
  what_was_done: string|null; learning: string|null; highlights: string|null
  difficulties: string|null; mood: number|null; questions?: string|null; patients_seen?: number|null
}
interface Objective {
  id: string; category: string|null; title: string; level: string; status: string; required: boolean
}
interface Procedure {
  id: string; procedure_name: string; level: string; performed_at: string; patient_id: string|null
  supervisor: string|null; outcome: string|null
}
interface Case {
  id: string; title: string; presentation_date: string|null; final_diagnosis: string|null; ai_assisted: boolean
  history?: string|null; exam_findings?: string|null; investigations?: string|null
  differential?: string|null; management?: string|null; outcome?: string|null
  discussion?: string|null; references_text?: string|null
}
interface Report {
  id: string; kind: string; title: string; ai_assisted: boolean; created_at: string; body?: string|null
}

export default function EstagioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, supabase } = useAuth() as any
  const largo = useLargo()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // Resultado IA mostrado em modal legível (ex: DDx, caso)
  const [aiResult, setAiResult] = useState<{ title: string; ddx?: any; text?: string } | null>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const headers = await auth()
    const r = await fetch(`/api/internship/${id}`, { headers })
    const j = await r.json()
    setData(j)
    setLoading(false)
  }, [id, user, auth])

  useEffect(() => { load() }, [load])

  if (loading || !data?.internship) return <main style={{ padding: 24 }}><p style={{ color: 'var(--ink-4)' }}>A carregar…</p></main>
  const { internship: it, patients, log, objectives, procedures, cases, reports, reflections, evaluations, hours } = data

  const objCompleted = objectives.filter((o: Objective) => o.status === 'completed' || o.status === 'validated').length
  const objPct = objectives.length > 0 ? Math.round(100 * objCompleted / objectives.length) : 0
  const hoursPct = it.hours_required > 0 ? Math.min(100, Math.round(100 * it.hours_done / it.hours_required)) : 0

  async function addRow(table: string, row: any) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/internship/resource', { method: 'POST', headers, body: JSON.stringify({ table, data: { ...row, internship_id: id } }) })
    setBusy(false)
    if (r.ok) load()
  }

  async function updateRow(table: string, rowId: string, row: any) {
    const headers = await auth()
    await fetch('/api/internship/resource', { method: 'PATCH', headers, body: JSON.stringify({ table, id: rowId, data: row }) })
    load()
  }

  async function delRow(table: string, rowId: string) {
    const headers = await auth()
    await fetch(`/api/internship/resource?table=${table}&id=${rowId}`, { method: 'DELETE', headers })
    load()
  }

  async function aiAction(action: string, payload: any) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/internship/ai', { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) })
    const j = await r.json()
    setBusy(false)
    return j
  }

  /* REFEITA 2026-10-08 — era a página com mais emoji da aplicação: 82.

     DOZE SEPARADORES COM DOZE EMOJI (📊 👥 📝 ✅ ⚙️ 📋 📄 💭 ⭐ ⏱ 🛠 ✦).
     Um emoji por separador não distingue nada — distingue a palavra que
     está ao lado. E numa fila que já rola de lado, cada um custa uns 22px:
     doze são 260px, precisamente o que falta para os doze caberem sem
     arrastar.

     TRÊS EMOJI A FAZER DE RÓTULO (📍 instituição, 👤 tutor, 📅 datas).
     Estes são os piores do género: «📍 Hospital de Aveiro» obriga a
     adivinhar o que o pino quer dizer; «LOCAL Hospital de Aveiro» não.

     E 90px de cabeçalho antes do primeiro separador. O nome do estágio sobe
     para a barra, onde se vê nos doze separadores em vez de desaparecer. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <Link href="/estagio" style={{ ...MONO, textDecoration: 'none', color: 'var(--ink-4)' }}>← ESTÁGIOS</Link>

          <span style={{
            fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: largo ? 230 : '100%',
          }} title={it.name}>{it.name}</span>

          <Seletor
            opcoes={([
              ['coach', 'Coach'],
              ['dashboard', 'Painel'],
              ['doentes', `Doentes ${patients.length}`],
              ['diario', `Diário ${log.length}`],
              ['objectivos', `Objetivos ${objCompleted}/${objectives.length}`],
              ['procedimentos', `Procedimentos ${procedures.length}`],
              ['casos', `Casos ${cases.length}`],
              ['relatorios', `Relatórios ${reports.length}`],
              ['reflexoes', `Reflexões ${reflections.length}`],
              ['avaliacoes', `Avaliações ${evaluations.length}`],
              ['horas', 'Horas'],
              ['ferramentas', 'Ferramentas'],
            ] as [Tab, string][]).map(([id, rotulo]) => ({ id, rotulo }))}
            ativa={tab} aoMudar={setTab} />
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          {it.institution && (
            <span style={MONO}>
              <span style={{ color: 'var(--ink-5)' }}>LOCAL </span>
              {it.institution}{it.ward && ` · ${it.ward}`}
            </span>
          )}
          {it.supervisor && (
            <span style={MONO}><span style={{ color: 'var(--ink-5)' }}>TUTOR </span>{it.supervisor}</span>
          )}
          <span style={MONO}>
            <span style={{ color: 'var(--ink-5)' }}>DE </span>
            {new Date(it.start_date).toLocaleDateString('pt-PT')}
            <span style={{ color: 'var(--ink-5)' }}> A </span>
            {new Date(it.end_date).toLocaleDateString('pt-PT')}
          </span>
        </BarraDeEstado>
      }
    >

      {/* Tab content */}
      {tab === 'coach' && (
        <CoachTab internshipId={id} supabase={supabase} patientCount={patients.length} />
      )}
      {tab === 'dashboard' && (
        <DashboardTab it={it} objPct={objPct} objCompleted={objCompleted} objTotal={objectives.length} hoursPct={hoursPct} log={log} patients={patients} procedures={procedures} />
      )}
      {tab === 'doentes' && (
        <PatientsTab patients={patients} onAdd={(row: any) => addRow('internship_patients', row)} onUpdate={(rid: string, row: any) => updateRow('internship_patients', rid, row)} onDel={(rid: string) => delRow('internship_patients', rid)}
          onAiCase={async (pid: string) => { const r = await aiAction('generate_case', { patient_id: pid }); if (r.error) alert(r.error); else { await load(); setAiResult({ title: 'Caso clínico gerado', text: r.case_markdown || r.markdown || r.text || 'Caso criado — vê a tab Casos.' }) } }}
          onAiDdx={async (pid: string) => { const r = await aiAction('suggest_diagnosis', { patient_id: pid }); if (r.error) alert(r.error); else setAiResult({ title: 'Diagnóstico diferencial', ddx: r }) }}
          busy={busy} internshipId={id} />
      )}
      {tab === 'diario' && (
        <LogTab log={log} onAdd={(row: any) => addRow('internship_log_entries', row)} onUpdate={(rid: string, row: any) => updateRow('internship_log_entries', rid, row)} onDel={(rid: string) => delRow('internship_log_entries', rid)} busy={busy} internshipId={id} />
      )}
      {tab === 'objectivos' && (
        <ObjectivesTab
          objectives={objectives}
          onUpdate={(rid: string, row: any) => updateRow('internship_objectives', rid, row)}
          onAdd={(row: any) => addRow('internship_objectives', row)}
          onDel={(rid: string) => delRow('internship_objectives', rid)}
          internshipId={id}
          onAi={aiAction}
          onReload={load}
        />
      )}
      {tab === 'procedimentos' && (
        <ProceduresTab procedures={procedures} patients={patients} onAdd={(row: any) => addRow('internship_procedures', row)} onDel={(rid: string) => delRow('internship_procedures', rid)} />
      )}
      {tab === 'casos' && (
        <CasesTab cases={cases} />
      )}
      {tab === 'relatorios' && (
        <ReportsTab reports={reports} onGenerate={async (kind: string) => { setBusy(true); await aiAction('generate_report', { internship_id: id, kind }); setBusy(false); load() }} busy={busy} />
      )}
      {tab === 'reflexoes' && (
        <ReflectionsTab reflections={reflections} onAdd={(row: any) => addRow('internship_reflections', row)} onDel={(rid: string) => delRow('internship_reflections', rid)} />
      )}
      {tab === 'avaliacoes' && (
        <EvaluationsTab evaluations={evaluations} internshipId={id} supabase={supabase} onReload={load} />
      )}
      {tab === 'horas' && (
        <HoursTab hours={hours} required={it.hours_required} done={it.hours_done} pct={hoursPct} onAdd={(row: any) => addRow('internship_hours', row)} onDel={(rid: string) => delRow('internship_hours', rid)} />
      )}
      {tab === 'ferramentas' && (
        <ToolsTab internshipId={id} patients={patients} onAi={aiAction} onReload={load} />
      )}

      {/* Resultado IA legível (DDx, caso) */}
      {aiResult && (
        <div onClick={() => setAiResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 22, maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 'var(--t-destaque)' }}>{aiResult.title}</h3>
              <button aria-label="Fechar" onClick={() => setAiResult(null)} style={{ border: 'none', background: 'none', fontSize: 'var(--t-destaque)', cursor: 'pointer', color: 'var(--ink-5)' }}>×</button>            </div>
            {aiResult.ddx ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {(aiResult.ddx.differential || []).map((d: any, i: number) => {
                  const c = d.probability === 'alta' ? 'var(--red)' : d.probability === 'média' ? 'var(--amber)' : 'var(--ink-4)'
                  return (
                    <div key={i} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>{d.dx}</span>
                        <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: c, textTransform: 'uppercase' }}>{d.probability}</span>
                      </div>
                      <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', marginTop: 2 }}>{d.reason}</div>
                    </div>
                  )
                })}
                {aiResult.ddx.next_steps?.length > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--bg-3)' }}>
                    <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Próximos passos</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.7 }}>
                      {aiResult.ddx.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', lineHeight: 1.6 }}><MarkdownLike text={aiResult.text || ''} /></div>
            )}
          </div>
        </div>
      )}
    </Mesa>
  )
}

// ════════════════════════════════════════════════════════════════════════
// COACH TAB — IA interpreta o estágio específico e maximiza a performance
// ════════════════════════════════════════════════════════════════════════

function CoachTab({ internshipId, supabase, patientCount }: any) {
  const [view, setView] = useState<'curriculo' | 'debrief' | 'prep' | 'tools'>('curriculo')

  async function headers() {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }
  async function call(action: string, extra: any = {}) {
    try {
      const r = await fetch('/api/internship/coach', { method: 'POST', headers: await headers(), body: JSON.stringify({ action, internship_id: internshipId, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return { error: j.error || j.hint || `Erro ${r.status}` }
      return j
    } catch (e: any) { return { error: e?.message || 'Falha de ligação' } }
  }

  if (patientCount === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)' }}>
        <div style={{ fontSize: 'var(--t-numero)', marginBottom: 8 }}>✦</div>
        <h3 style={{ margin: '0 0 6px' }}>O Coach precisa de te conhecer</h3>
        <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-corpo)', maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
          Regista os primeiros doentes na tab <b>Doentes</b>. Depois o Coach interpreta a tua casuística e gera estudo, debrief e ferramentas à medida deste estágio.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(0deg,var(--bg),var(--roxo-claro))', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-xl)', padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', color: 'var(--roxo)' }}>Coach do Estágio</div>
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2 }}>A IA lê tudo o que registas neste estágio e trabalha para a TUA performance — não é só um caderno.</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['curriculo', 'Currículo dos teus doentes'], ['debrief', 'Debrief do dia'], ['prep', 'Preparar turno'], ['tools', 'Ferramentas à medida']] as [typeof view, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '7px 12px', borderRadius: 999, border: '1px solid ' + (view === v ? 'var(--roxo)' : 'var(--border)'),
            background: view === v ? 'var(--roxo)' : 'white', color: view === v ? 'white' : 'var(--ink-3)',
            cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any,
          }}>{l}</button>
        ))}
      </div>

      {view === 'curriculo' && <CurriculoView call={call} internshipId={internshipId} headers={headers} />}
      {view === 'debrief' && <DebriefView call={call} />}
      {view === 'prep' && <PrepView call={call} />}
      {view === 'tools' && <CoachToolsView call={call} internshipId={internshipId} headers={headers} />}
    </div>
  )
}

function CurriculoView({ call, internshipId, headers }: any) {
  const [caseload, setCaseload] = useState<any>(null)
  const [gaps, setGaps] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [cardMsg, setCardMsg] = useState('')
  const [err, setErr] = useState('')

  async function run(kind: 'caseload' | 'gaps') {
    setBusy(kind); setErr('')
    const r = await call(kind)
    if (r.error) { setErr(r.error); setBusy(''); return }
    if (kind === 'caseload') setCaseload(r.result); else setGaps(r.result)
    setBusy('')
  }

  async function makeCards() {
    setCardMsg('A gerar flashcards dos teus casos…')
    const r = await call('cards_from_cases')
    const cards = r.flashcards || []
    if (!cards.length) { setCardMsg('Sem cartões gerados.'); return }
    // cria uma nota com os casos e gera os cartões no sistema de memória
    const h = await headers()
    const body = cards.map((c: any) => `**${c.front}**\n${c.back}`).join('\n\n')
    const nr = await fetch('/api/study/notes', { method: 'POST', headers: h, body: JSON.stringify({ title: 'Casos do estágio', body, domain: 'clinico', source: 'estagio' }) })
    const nj = await nr.json()
    if (nj.note?.id) {
      await fetch('/api/study/cards', { method: 'POST', headers: h, body: JSON.stringify({ action: 'generate', note_id: nj.note.id, title: 'Casos do estágio', text: body }) })
      setCardMsg(`${cards.length} flashcards criados — vão aparecer na tua revisão (/study/notas).`)
    } else setCardMsg('Guardado, mas falhou a criação dos cartões.')
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {err && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: 10, borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)' }}>{err}</div>}
      {/* Casuística */}
      <section style={card}>
        <Head title="A tua casuística" sub="O que estás realmente a ver neste estágio" />
        {!caseload ? (
          <button onClick={() => run('caseload')} disabled={busy === 'caseload'} style={btn('primary')}>{busy === 'caseload' ? 'A analisar…' : 'Analisar os meus doentes'}</button>
        ) : (
          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px' }}>{caseload.summary}</p>
            {caseload.must_master?.length > 0 && <>
              <div style={lbl}>Tens de dominar</div>
              <ul style={ul}>{caseload.must_master.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
            </>}
            {caseload.exposure_balance && <p style={{ margin: '8px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{caseload.exposure_balance}</p>}
          </div>
        )}
      </section>

      {/* Lacunas */}
      <section style={card}>
        <Head title="Lacunas detetadas" sub="O que te falta, com plano de ação" />
        {!gaps ? (
          <button onClick={() => run('gaps')} disabled={busy === 'gaps'} style={btn('primary')}>{busy === 'gaps' ? 'A detetar…' : 'Detetar lacunas'}</button>
        ) : (
          <div>
            {gaps.next_best_action && <div style={{ background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', padding: 10, fontSize: 'var(--t-dado)', marginBottom: 10 }}><b>A seguir:</b> {gaps.next_best_action}</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {(gaps.gaps || []).map((g: any, i: number) => (
                <div key={i} style={{ borderLeft: `3px solid ${g.severity === 'alta' ? 'var(--red)' : g.severity === 'media' ? 'var(--amber)' : 'var(--ink-4)'}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-2)' }}>{g.gap}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{g.action} · <b>Estuda:</b> {g.study}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Flashcards dos casos → memória */}
      <section style={card}>
        <Head title="Transforma os teus casos em revisão" sub="A IA cria flashcards dos doentes que viste, que entram na tua revisão espaçada" />
        <button onClick={makeCards} style={{ ...btn('primary'), background: 'var(--roxo)' }}>Gerar flashcards dos meus casos</button>
        {cardMsg && <p style={{ fontSize: 'var(--t-meta)', color: 'var(--roxo)', marginTop: 8 }}>{cardMsg}</p>}
      </section>
    </div>
  )
}

function DebriefView({ call }: any) {
  const [notes, setNotes] = useState('')
  const [res, setRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})

  async function run() {
    setBusy(true); setRes(null); setErr('')
    const r = await call('debrief', { today_notes: notes })
    if (r.error) setErr(r.error); else setRes(r.result)
    setBusy(false)
  }

  return (
    <section style={card}>
      <Head title="Debrief do dia" sub="No fim do turno: consolida o que viste e testa-te" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="O que viste hoje? (opcional — se vazio, uso a tua casuística geral)" style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
      <button onClick={run} disabled={busy} style={btn('primary')}>{busy ? 'A preparar debrief…' : 'Fazer debrief'}</button>
      {err && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: 10, borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', marginTop: 8 }}>{err}</div>}
      {res && (
        <div style={{ marginTop: 12, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 10px' }}>{res.recap}</p>
          {(res.questions_detail || []).map((qd: any, i: number) => (
            <div key={i} style={{ borderTop: '1px solid var(--bg-3)', paddingTop: 8, marginTop: 8 }}>
              <div style={{ fontWeight: 'var(--peso-corpo)' as any }}>{i + 1}. {qd.q}</div>
              {revealed[i] ? <div style={{ color: 'var(--green)', marginTop: 4 }}>{qd.answer}</div>
                : <button onClick={() => setRevealed(r => ({ ...r, [i]: true }))} style={{ ...btn('ghost'), marginTop: 4, padding: '4px 10px', fontSize: 'var(--t-meta)' }}>Ver resposta</button>}
            </div>
          ))}
          {res.one_thing && <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-md)', padding: 10, marginTop: 12, fontSize: 'var(--t-dado)' }}><b>Esta noite, 5 minutos:</b> {res.one_thing}</div>}
        </div>
      )}
    </section>
  )
}

function PrepView({ call }: any) {
  const [expect, setExpect] = useState('')
  const [res, setRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function run() { setBusy(true); setRes(null); setErr(''); const r = await call('prep', { expectation: expect }); if (r.error) setErr(r.error); else setRes(r.result); setBusy(false) }
  const Block = ({ title, items, icon }: any) => items?.length > 0 ? (
    <div style={{ marginTop: 10 }}><div style={lbl}>{icon} {title}</div><ul style={ul}>{items.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
  ) : null
  return (
    <section style={card}>
      <Head title="Preparar o próximo turno" sub="Antes de ires: o que rever, o que o tutor pode perguntar, red flags" />
      <input value={expect} onChange={e => setExpect(e.target.value)} placeholder="O que esperas hoje? (ex: dia de admissões, bloco operatório…)" style={{ ...inputStyle, marginBottom: 8 }} />
      <button onClick={run} disabled={busy} style={btn('primary')}>{busy ? 'A preparar…' : 'Preparar-me'}</button>
      {err && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: 10, borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', marginTop: 8 }}>{err}</div>}
      {res && (
        <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>
          <Block title="Rever antes" items={res.review} />
          <Block title="O tutor pode perguntar" items={res.tutor_questions} />
          <Block title="Red flags a vigiar" items={res.red_flags} />
          <Block title="Competências a treinar" items={res.skills} />
        </div>
      )}
    </section>
  )
}

function CoachToolsView({ call, internshipId, headers }: any) {
  const [tools, setTools] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      const h = await headers()
      const r = await fetch(`/api/internship/coach?internship_id=${internshipId}`, { headers: h })
      const j = await r.json(); setTools(j.tools || []); setLoaded(true)
    })()
  }, [internshipId])

  async function generate() {
    setBusy(true)
    const r = await call('generate_tools')
    if (r.tools) {
      const h = await headers()
      const rr = await fetch(`/api/internship/coach?internship_id=${internshipId}`, { headers: h })
      const jj = await rr.json(); setTools(jj.tools || [])
    }
    setBusy(false)
  }

  return (
    <section style={card}>
      <Head title="Ferramentas geradas para ESTE estágio" sub="A IA propõe ferramentas práticas à medida do que tu realmente vês e precisas" />
      <button onClick={generate} disabled={busy} style={{ ...btn('primary'), background: 'var(--roxo)', marginBottom: 12 }}>{busy ? 'A gerar…' : tools.length ? 'Gerar mais ferramentas' : 'Gerar as minhas ferramentas'}</button>
      {loaded && tools.length === 0 && <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>Ainda sem ferramentas. Carrega no botão para a IA criar ferramentas adaptadas ao teu estágio.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {tools.map(t => <GeneratedTool key={t.id} tool={t} />)}
      </div>
    </section>
  )
}

function GeneratedTool({ tool }: any) {
  const [open, setOpen] = useState(false)
  /* Eram cinco emoji (☑️ 🎯 📌 🧮 🔀). Cinco desenhos que ninguém distingue de
   relance e que obrigam a adivinhar — um alvo e uma pioneta querem dizer o
   mesmo a quem não os conhece. Quatro letras dizem-no. */
const KIND: Record<string, string> = { checklist: 'LIST', drill: 'TREI', reference: 'REFE', calculator: 'CALC', protocol: 'PROT' }
  const items: string[] = tool.content?.items || []
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', padding: 12, background: 'white', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>
                      <Codigo texto={KIND[tool.kind] || 'OUTR'} />{tool.title}
                    </span>
          <span style={{ color: 'var(--ink-5)' }}>{open ? '−' : '+'}</span>
        </div>
        {tool.rationale && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 3 }}>{tool.rationale}</div>}
      </button>
      {open && items.length > 0 && (
        <div style={{ padding: '0 12px 12px' }}>
          {tool.kind === 'checklist' || tool.kind === 'protocol' ? (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.7 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.7 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  )
}

// helpers do Coach
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }
const lbl: React.CSSProperties = { fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '4px 0 4px' }
const ul: React.CSSProperties = { margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.7 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontFamily: 'inherit', boxSizing: 'border-box' }
function Head({ title, sub }: { title: string; sub: string }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>{title}</div><div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{sub}</div></div>
}

// ════════════════════════════════════════════════════════════════════════
// TOOLS TAB — funcionalidades revolucionárias para o estágio
// ════════════════════════════════════════════════════════════════════════

function ToolsTab({ internshipId, patients, onAi, onReload }: any) {
  const [tool, setTool] = useState<null | 'voice' | 'sbar' | 'shift' | 'ddx' | 'portfolio'>(null)

  const TOOLS = [
    { id: 'voice', icon: 'megaphone', title: 'Voz → SOAP', desc: 'Dita o que observaste e a IA estrutura como SOAP automaticamente.', color: 'var(--roxo)' },
    { id: 'sbar', icon: 'clipboard', title: 'Passagem de turno SBAR', desc: 'Gera passagem estruturada de todos os doentes seguidos com priorização.', color: 'var(--red)' },
    { id: 'shift', icon: 'chat', title: 'Companion de turno', desc: 'Tutor IA especializado na tua rotação para dúvidas em tempo real.', color: 'var(--green)' },
    { id: 'ddx', icon: 'spark', title: 'Diagnóstico diferencial', desc: 'Insere sintomas — recebe DDx ordenado por probabilidade com red flags.', color: 'var(--ink-2)' },
    { id: 'portfolio', icon: 'package', title: 'Exportar portefólio', desc: 'Bundle completo em markdown para submissão académica.', color: 'var(--amber)' },
  ] as const

  if (tool === 'voice') return <VoiceToSOAP internshipId={internshipId} patients={patients} onAi={onAi} onClose={() => { setTool(null); onReload() }} />
  if (tool === 'sbar') return <SBARGenerator internshipId={internshipId} patients={patients} onAi={onAi} onClose={() => setTool(null)} />
  if (tool === 'shift') return <ShiftCompanion internshipId={internshipId} onAi={onAi} onClose={() => setTool(null)} />
  if (tool === 'ddx') return <DDxAssistant onAi={onAi} onClose={() => setTool(null)} />
  if (tool === 'portfolio') return <PortfolioExport internshipId={internshipId} onAi={onAi} onClose={() => setTool(null)} />

  return (
    <div>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-corpo)', margin: '0 0 14px' }}>
        Ferramentas que poupam tempo durante o estágio. Tudo IA-powered e adaptado à tua rotação.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} style={{
            textAlign: 'left', padding: 16, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', cursor: 'pointer',
            transition: 'border-color 0.12s, transform 0.12s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ fontSize: 'var(--t-numero)', marginBottom: 8 }}><Icon name={t.icon} size={16} /></div>
            <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', color: 'var(--ink)', marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.45 }}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function VoiceToSOAP({ internshipId: _internshipId, patients, onAi, onClose }: any) {
  const [transcript, setTranscript] = useState('')
  const [patientId, setPatientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [recording, setRecording] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const r = new SR()
      r.lang = 'pt-PT'; r.continuous = true; r.interimResults = true
      r.onresult = (e: any) => {
        let final = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        }
        if (final) setTranscript(t => t + final)
      }
      r.onend = () => setRecording(false)
      setRecognition(r)
    }
  }, [])

  function toggleRecord() {
    if (!recognition) { alert('O teu browser não suporta reconhecimento de voz. Usa Chrome/Edge no telemóvel ou desktop.'); return }
    if (recording) { recognition.stop(); setRecording(false) } else { recognition.start(); setRecording(true) }
  }

  async function structure() {
    if (!transcript.trim()) return
    setBusy(true)
    const r = await onAi('voice_to_soap', { transcript, patient_id: patientId || null })
    setResult(r); setBusy(false)
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Voz → SOAP</h2>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: '0 0 14px' }}>
        Pressiona Gravar e descreve o doente naturalmente. A IA transcreve e estrutura como SOAP. Se associares a um doente, fica guardado como evolução.
      </p>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={toggleRecord} style={{
            padding: '10px 18px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontWeight: 'var(--peso-forte)' as any,
            background: recording ? 'var(--red)' : 'var(--roxo)', color: 'white',
          }}>
            {recording ? '⏹ Parar' : 'Gravar'}
          </button>
          <select value={patientId} onChange={e => setPatientId(e.target.value)} style={input}>
            <option value="">Sem doente associado</option>
            {patients.map((p: Patient) => <option key={p.id} value={p.id}>{p.initials} — {p.diagnosis || ''}</option>)}
          </select>
        </div>
        <textarea
          value={transcript} onChange={e => setTranscript(e.target.value)}
          placeholder="A transcrição aparece aqui à medida que falas. Podes também escrever directamente."
          rows={6}
          style={{ width: '100%', padding: 12, border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', fontFamily: 'inherit', fontSize: 'var(--t-corpo)', boxSizing: 'border-box', resize: 'vertical' }}
        />
        <button onClick={structure} disabled={busy || !transcript.trim()} style={{ ...btn('primary'), marginTop: 8 }}>
          {busy ? 'A estruturar…' : 'Estruturar como SOAP'}
        </button>
      </div>

      {result && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-destaque)' }}>Resultado SOAP {patientId && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>guardado como evolução</span>}</h3>
          {[['S', 'var(--ink-2)', result.subjective], ['O', 'var(--roxo)', result.objective], ['A', 'var(--amber)', result.assessment], ['P', 'var(--green)', result.plan]].map(([k, color, text]) => (
            <div key={k as string} style={{ marginBottom: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: color as string, marginBottom: 4 }}>{k} — {(k === 'S' ? 'Subjectivo' : k === 'O' ? 'Objectivo' : k === 'A' ? 'Avaliação' : 'Plano')}</div>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{text as string || '—'}</div>
            </div>
          ))}
          {result.vitals && Object.keys(result.vitals).length > 0 && (
            <div style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', marginBottom: 4 }}>SINAIS VITAIS</div>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>
                {Object.entries(result.vitals).map(([k, v]: any) => <span key={k} style={{ marginRight: 12 }}><b>{k.toUpperCase()}</b>: {v}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SBARGenerator({ internshipId, patients: _patients, onAi, onClose }: any) {
  const [busy, setBusy] = useState(false)
  const [handover, setHandover] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    const r = await onAi('handover', { internship_id: internshipId })
    setHandover(r.handover || ''); setBusy(false)
  }

  function copyAll() {
    if (handover) navigator.clipboard.writeText(handover).then(() => alert('Copiado!'))
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Passagem de turno SBAR</h2>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: '0 0 14px' }}>
        Gera passagem estruturada de todos os doentes activos com prioridade marcada e tarefas pendentes.
      </p>
      {!handover && (
        <button onClick={generate} disabled={busy} style={btn('primary')}>{busy ? 'A gerar…' : 'Gerar SBAR'}</button>
      )}
      {handover && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
            <button onClick={copyAll} style={btn('ghost')}>COPIAR TUDO</button>
            <button onClick={generate} disabled={busy} style={btn('ghost')}>↻ Regerar</button>
          </div>
          <div style={{ fontSize: 'var(--t-corpo)', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
            <MarkdownLike text={handover} />
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftCompanion({ internshipId, onAi, onClose }: any) {
  const [messages, setMessages] = useState<{ role: 'user'|'ai'; text: string }[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [context, setContext] = useState('')

  async function ask(q: string) {
    if (!q.trim() || busy) return
    setMessages(m => [...m, { role: 'user', text: q }])
    setDraft(''); setBusy(true)
    const r = await onAi('shift_question', { internship_id: internshipId, question: q, context })
    setMessages(m => [...m, { role: 'ai', text: r.answer || r.error || '' }])
    setBusy(false)
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Companion de turno</h2>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: '0 0 14px' }}>
        Tutor IA especializado na tua área. Faz qualquer pergunta prática.
      </p>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>+ Contexto do doente (opcional)</summary>
        <textarea value={context} onChange={e => setContext(e.target.value)} rows={2} placeholder="Ex: idoso 78a, IC, DRC, em IECA e furosemida..." style={{ ...input, marginTop: 6, resize: 'vertical' }} />
      </details>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14, minHeight: 300, marginBottom: 10 }}>
        {messages.length === 0 ? (
          <p style={{ color: 'var(--ink-5)', fontSize: 'var(--t-dado)', margin: 0 }}>Faz a primeira pergunta. Ex: "Quando suspender IECA pré-cirurgia?"</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: m.role === 'user' ? 'var(--green)' : 'var(--roxo)', marginBottom: 4 }}>
                {m.role === 'user' ? 'TU' : 'IA'}
              </div>
              <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                <MarkdownLike text={m.text} />
              </div>
            </div>
          ))
        )}
        {busy && <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)' }}>A IA está a pensar…</p>}
      </div>

      <form onSubmit={e => { e.preventDefault(); ask(draft) }} style={{ display: 'flex', gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Pergunta…" style={{ ...input, flex: 1, fontSize: 'var(--t-corpo)' }} />
        <button type="submit" disabled={busy || !draft.trim()} style={btn('primary')}>Perguntar</button>
      </form>
    </div>
  )
}

function DDxAssistant({ onAi, onClose }: any) {
  const [symptoms, setSymptoms] = useState('')
  const [demo, setDemo] = useState('')
  const [ctx, setCtx] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<any>(null)

  async function compute() {
    if (!symptoms.trim()) return
    setBusy(true)
    const r = await onAi('ddx_from_symptoms', { symptoms, demographics: demo, context: ctx })
    setRes(r); setBusy(false)
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Diagnóstico diferencial</h2>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: '0 0 14px' }}>
        Insere sintomas. IA constrói DDx ordenado por probabilidade com sinais distintivos, próximas investigações e red flags.
      </p>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14, marginBottom: 12 }}>
        <Field label="Sintomas / sinais"><textarea required value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={3} placeholder="Ex: dor torácica há 2h, dispneia, sudorese, irradia para braço esquerdo" style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <Field label="Demografia"><input value={demo} onChange={e => setDemo(e.target.value)} style={input} placeholder="68a, M, ex-fumador" /></Field>
          <Field label="Contexto"><input value={ctx} onChange={e => setCtx(e.target.value)} style={input} placeholder="HTA, DM2, dislipidemia" /></Field>
        </div>
        <button onClick={compute} disabled={busy || !symptoms.trim()} style={{ ...btn('primary'), marginTop: 10 }}>
          {busy ? 'A construir DDx…' : 'Gerar diagnóstico diferencial'}
        </button>
      </div>

      {res?.ddx && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-destaque)' }}>Diagnóstico diferencial</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {res.ddx.map((d: any, i: number) => (
              <div key={i} style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>{i + 1}. {d.dx}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 999, background: d.probability === 'alta' ? 'var(--badge-red-bg)' : d.probability === 'média' ? 'var(--badge-amber-bg)' : 'var(--badge-green-bg)', color: d.probability === 'alta' ? 'var(--red)' : d.probability === 'média' ? 'var(--amber)' : 'var(--green)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any }}>
                    {d.probability}
                  </span>
                </div>
                {d.key_features?.length > 0 && (
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginBottom: 4 }}>
                    <b>Pistas:</b> {d.key_features.join(' · ')}
                  </div>
                )}
                {d.rule_out && (
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                    <b>Como excluir:</b> {d.rule_out}
                  </div>
                )}
              </div>
            ))}
          </div>
          {res.investigations?.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', marginBottom: 4 }}>Investigações prioritárias</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}>
                {res.investigations.map((x: string, i: number) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          )}
          {res.red_flags?.length > 0 && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--badge-red-bg)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', marginBottom: 4 }}>Red flags</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--t-dado)', color: 'var(--red)' }}>
                {res.red_flags.map((x: string, i: number) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PortfolioExport({ internshipId, onAi, onClose }: any) {
  const [busy, setBusy] = useState(false)
  const [md, setMd] = useState('')
  const [filename, setFilename] = useState('')

  async function generate() {
    setBusy(true)
    const r = await onAi('portfolio_export', { internship_id: internshipId })
    setMd(r.markdown || ''); setFilename(r.filename || 'portfolio.md'); setBusy(false)
  }

  function download() {
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <button onClick={onClose} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar</button>
      <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Exportar portefólio</h2>
      <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: '0 0 14px' }}>
        Gera ficheiro markdown completo com objectivos, doentes, procedimentos, casos, diário, reflexões, avaliações e horas — pronto para submissão.
      </p>
      {!md && (
        <button onClick={generate} disabled={busy} style={btn('primary')}>{busy ? 'A montar portefólio…' : 'Gerar portefólio completo'}</button>
      )}
      {md && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={download} style={btn('primary')}>Descarregar {filename}</button>
            <button onClick={() => navigator.clipboard.writeText(md).then(() => alert('Copiado!'))} style={btn('ghost')}>Copiar</button>
            <button onClick={generate} disabled={busy} style={btn('ghost')}>↻ Regerar</button>
          </div>
          <pre style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, fontSize: 'var(--t-meta)', whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>{md}</pre>
        </div>
      )}
    </div>
  )
}

function MarkdownLike({ text }: { text: string }) {
  // SEGURANÇA: escapar HTML antes das transformações markdown (texto vem de IA
  // e pode ecoar conteúdo livre do utilizador) — evita XSS via dangerouslySetInnerHTML.
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const html = escaped
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px; font-weight:700; margin:14px 0 6px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:16px; font-weight:700; margin:18px 0 8px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:18px; font-weight:700; margin:18px 0 8px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="margin:6px 0; padding-left:20px">${m}</ul>`)
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

// ════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════

function DashboardTab({ it, objPct, objCompleted, objTotal, hoursPct, log, patients, procedures }: any) {
  const recentLog = log.slice(0, 5)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <KPI label="Objectivos" value={`${objCompleted}/${objTotal}`} pct={objPct} color={ACCENT} />
        <KPI label="Horas" value={`${it.hours_done || 0} / ${it.hours_required || 0}`} pct={hoursPct} color="var(--ink-2)" />
        <KPI label="Doentes seguidos" value={patients.length.toString()} color="var(--roxo)" />
        <KPI label="Procedimentos" value={procedures.length.toString()} color="var(--red)" />
      </div>

      <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>Últimas notas de diário</h3>
        {recentLog.length === 0 ? (
          <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-dado)', margin: 0 }}>Nenhum registo ainda. Vai à tab "Diário".</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {recentLog.map((l: LogEntry) => (
              <div key={l.id} style={{ background: 'var(--bg-2)', padding: 10, borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', marginBottom: 4 }}>
                  {new Date(l.entry_date).toLocaleDateString('pt-PT')} {l.shift && `· ${l.shift}`}
                </div>
                {l.what_was_done && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>{l.what_was_done}</div>}
                {l.learning && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--green)', marginTop: 4 }}><span style={{ ...ROTULO, color: 'var(--green)' }}>Aprendi </span>{l.learning}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function KPI({ label, value, pct, color }: { label: string; value: string; pct?: number; color: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14 }}>
      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginTop: 4 }}>{value}</div>
      {pct != null && (
        <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 'var(--r-sm)', marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

function PatientsTab({ patients, onAdd, onUpdate, onDel, onAiCase, onAiDdx, busy, internshipId }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Novo doente</button>
      </div>
      {patients.length === 0 ? (
        <Empty msg="Sem doentes ainda. Adiciona o primeiro doente que estás a seguir." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {patients.map((p: Patient) => (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{p.initials || '—'}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, background: p.status === 'active' ? 'var(--badge-green-bg)' : 'var(--bg-3)', color: p.status === 'active' ? 'var(--green)' : 'var(--ink-4)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any }}>{p.status}</span>
              </div>
              <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>{p.age ? `${p.age}a` : ''} {p.sex || ''}</div>
              {p.diagnosis && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)', fontWeight: 'var(--peso-corpo)' as any, marginTop: 6 }}>{p.diagnosis}</div>}
              {p.chief_complaint && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 4 }}>{p.chief_complaint}</div>}
              <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                <Link href={`/estagio/${internshipId}/doente/${p.id}`} style={{ ...btn('ghost'), fontSize: 'var(--t-meta)', padding: '4px 8px', textDecoration: 'none' }}>Abrir</Link>
                <button onClick={() => onAiDdx(p.id)} disabled={busy} style={{ ...btn('ghost'), fontSize: 'var(--t-meta)', padding: '4px 8px' }}>DDx IA</button>
                <button onClick={() => onAiCase(p.id)} disabled={busy} style={{ ...btn('ghost'), fontSize: 'var(--t-meta)', padding: '4px 8px' }}>Caso IA</button>
                <button onClick={() => { if (confirm('Eliminar?')) onDel(p.id) }} style={{ ...btn('ghost'), fontSize: 'var(--t-meta)', padding: '4px 8px', color: 'var(--red)' }}>Apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <PatientFormModal onClose={() => setShowAdd(false)} onSave={(r: any) => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function PatientFormModal({ patient, onClose, onSave }: { patient?: Patient; onClose: () => void; onSave: (r: any) => void }) {
  const [initials, setInitials] = useState(patient?.initials || '')
  const [age, setAge] = useState<number | ''>(patient?.age ?? '')
  const [sex, setSex] = useState(patient?.sex || '')
  const [diagnosis, setDiagnosis] = useState(patient?.diagnosis || '')
  const [chief, setChief] = useState(patient?.chief_complaint || '')
  const [background, setBackground] = useState('')
  const [comorbidities, setComorbidities] = useState('')
  const [allergies, setAllergies] = useState('')
  const [meds, setMeds] = useState('')
  const [learning, setLearning] = useState('')
  const toArr = (s: string) => s.split(/[,\n]/).map(x => x.trim()).filter(Boolean)
  return (
    <Modal title="Novo doente seguido (anónimo)" onClose={onClose} wide>
      <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '0 0 10px' }}>Apenas iniciais, idade, sexo. <b>Sem nome, sem SNS, sem PII.</b></p>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 8 }}>
          <Field label="Iniciais"><input value={initials} onChange={e => setInitials(e.target.value.slice(0, 5))} placeholder="M.S." style={input} /></Field>
          <Field label="Idade"><input type="number" value={age} onChange={e => setAge(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
          <Field label="Sexo">
            <select value={sex} onChange={e => setSex(e.target.value)} style={input}>
              <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="outro">Outro</option>
            </select>
          </Field>
        </div>
        <Field label="Queixa principal"><input value={chief} onChange={e => setChief(e.target.value)} style={input} placeholder="ex: dor torácica" /></Field>
        <Field label="Diagnóstico principal"><input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={input} placeholder="ex: STEMI inferior" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Comorbilidades (vírgulas)"><input value={comorbidities} onChange={e => setComorbidities(e.target.value)} style={input} placeholder="HTA, DM2, DPOC" /></Field>
          <Field label="Alergias (vírgulas)"><input value={allergies} onChange={e => setAllergies(e.target.value)} style={input} placeholder="penicilina" /></Field>
        </div>
        <Field label="Medicação actual"><input value={meds} onChange={e => setMeds(e.target.value)} style={input} placeholder="ramipril, AAS, atorvastatina" /></Field>
        <Field label="História breve"><textarea rows={2} value={background} onChange={e => setBackground(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Tabagismo activo, sedentário…" /></Field>
        <Field label="O que aprendi com este doente"><textarea rows={2} value={learning} onChange={e => setLearning(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Reconhecer supra-ST inferior, indicação de angioplastia primária…" /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ initials, age: age === '' ? null : age, sex: sex || null, diagnosis, chief_complaint: chief, background, comorbidities: toArr(comorbidities), allergies: toArr(allergies), current_meds: meds || null, learning_points: learning || null })} disabled={!initials} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

function LogTab({ log, onAdd, onUpdate, onDel, busy, internshipId }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Nota de turno</button>
      </div>
      {log.length === 0 ? <Empty msg="Sem notas. Regista o que aconteceu hoje." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {log.map((l: LogEntry) => (
            <div key={l.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>{new Date(l.entry_date).toLocaleDateString('pt-PT')} {l.shift && `· ${l.shift}`} {l.hours && `· ${l.hours}h`}</span>
                <button onClick={() => { if (confirm('Apagar?')) onDel(l.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 'var(--t-meta)' }}>Apagar</button>
              </div>
              {l.what_was_done && <p style={{ margin: '4px 0', fontSize: 'var(--t-dado)' }}><b>Actividades:</b> {l.what_was_done}</p>}
              {l.highlights && <p style={{ margin: '4px 0', fontSize: 'var(--t-dado)' }}><b>Destaques:</b> {l.highlights}</p>}
              {l.learning && <p style={{ margin: '4px 0', fontSize: 'var(--t-dado)', color: 'var(--green)' }}><b>Aprendi:</b> {l.learning}</p>}
              {l.questions && <p style={{ margin: '4px 0', fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}><b>A esclarecer:</b> {l.questions}</p>}
              {l.difficulties && <p style={{ margin: '4px 0', fontSize: 'var(--t-dado)', color: 'var(--red)' }}><b>Dificuldades:</b> {l.difficulties}</p>}
            </div>
          ))}
        </div>
      )}
      {showAdd && <LogFormModal onClose={() => setShowAdd(false)} onSave={(r: any) => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function LogFormModal({ onClose, onSave }: { onClose: () => void; onSave: (r: any) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [shift, setShift] = useState('manha')
  const [hours, setHours] = useState<number | ''>(8)
  const [seen, setSeen] = useState<number | ''>('')
  const [done, setDone] = useState('')
  const [learning, setLearning] = useState('')
  const [highlights, setHighlights] = useState('')
  const [difficulties, setDifficulties] = useState('')
  const [questions, setQuestions] = useState('')
  const [mood, setMood] = useState(3)
  const [fatigue, setFatigue] = useState(3)
  return (
    <Modal title="Nova nota de turno" onClose={onClose} wide>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
          <Field label="Turno">
            <select value={shift} onChange={e => setShift(e.target.value)} style={input}>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </select>
          </Field>
          <Field label="Horas"><input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value === '' ? '' : parseFloat(e.target.value))} style={input} /></Field>
          <Field label="Doentes vistos"><input type="number" value={seen} onChange={e => setSeen(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} /></Field>
        </div>
        <Field label="O que fizeste?"><textarea rows={3} value={done} onChange={e => setDone(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Acompanhei doentes na enfermaria, fiz colheitas..." /></Field>
        <Field label="Destaques / casos relevantes"><textarea rows={2} value={highlights} onChange={e => setHighlights(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <Field label="O que aprendeste?"><textarea rows={2} value={learning} onChange={e => setLearning(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <Field label="Dúvidas a esclarecer"><textarea rows={2} value={questions} onChange={e => setQuestions(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que ficaste sem perceber e queres perguntar ao tutor" /></Field>
        <Field label="Dificuldades"><textarea rows={2} value={difficulties} onChange={e => setDifficulties(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={`Como te sentiste (${mood}/5)`}><input type="range" min={1} max={5} value={mood} onChange={e => setMood(+e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label={`Cansaço (${fatigue}/5)`}><input type="range" min={1} max={5} value={fatigue} onChange={e => setFatigue(+e.target.value)} style={{ width: '100%' }} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ entry_date: date, shift, hours: hours === '' ? null : hours, patients_seen: seen === '' ? null : seen, what_was_done: done, learning, highlights, difficulties, questions, mood, fatigue })} style={btn('primary')}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

function ObjectivesTab({ objectives, onUpdate, onAdd, onDel, internshipId, onAi, onReload }: any) {
  const byCategory: Record<string, Objective[]> = {}
  for (const o of objectives) {
    const c = o.category || 'Outros'
    ;(byCategory[c] ||= []).push(o)
  }
  const [showInterview, setShowInterview] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {Object.keys(byCategory).length === 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 24 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 'var(--t-destaque)' }}>Define os teus objectivos</h2>
          <p style={{ color: 'var(--ink-4)', fontSize: 'var(--t-corpo)', margin: '0 0 16px' }}>
            Não há objectivos predefinidos. Personaliza o que queres aprender neste estágio em particular.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <button onClick={() => setShowInterview(true)} style={{
              padding: 14, background: 'linear-gradient(135deg, var(--green) 0%, var(--green) 100%)',
              color: 'white', border: 'none', borderRadius: 'var(--r-xl)', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', marginBottom: 4 }}>Entrevista IA (recomendado)</div>
              <div style={{ fontSize: 'var(--t-meta)', opacity: 0.9 }}>A IA pergunta sobre o teu nível, interesses e contexto. Cria objectivos SMART personalizados.</div>
            </button>
            <button onClick={() => setShowAdd(true)} style={{
              padding: 14, background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', marginBottom: 4 }}>Criar manualmente</div>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>Adicionas tu próprio cada objectivo.</div>
            </button>
          </div>
        </div>
      )}

      {Object.keys(byCategory).length > 0 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={() => setShowInterview(true)} style={btn('ghost')}>Refazer com IA</button>
          <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Novo objectivo</button>
        </div>
      )}

      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 12 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>{cat}</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {items.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: o.status === 'completed' || o.status === 'validated' ? 'var(--green-light)' : 'var(--bg-2)', borderRadius: 'var(--r)' }}>
                <select value={o.status} onChange={e => onUpdate(o.id, { status: e.target.value, completed_at: ['completed','validated'].includes(e.target.value) ? new Date().toISOString() : null })} style={{ ...input, padding: '3px 6px', fontSize: 'var(--t-meta)', width: 'auto' }}>
                  <option value="pending">Por fazer</option>
                  <option value="in_progress">A fazer</option>
                  <option value="completed">Concluído</option>
                  <option value="validated">Validado</option>
                </select>
                <span style={{ flex: 1, fontSize: 'var(--t-dado)', color: 'var(--ink)', textDecoration: o.status === 'completed' || o.status === 'validated' ? 'line-through' : 'none' }}>{o.title}</span>
                <span style={{ padding: '2px 6px', borderRadius: 'var(--r)', background: 'var(--bg-3)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>{o.level}</span>
                {o.required && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--red)' }}>obrigatório</span>}
                <button aria-label="Eliminar" onClick={() => { if (confirm('Apagar este objectivo?')) onDel(o.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 'var(--t-meta)' }}>×</button>              </div>
            ))}
          </div>
        </section>
      ))}

      {showInterview && (
        <InterviewModal internshipId={internshipId} onAi={onAi} onClose={() => setShowInterview(false)} onDone={() => { setShowInterview(false); onReload() }} />
      )}
      {showAdd && (
        <AddObjectiveModal onClose={() => setShowAdd(false)} onSave={(row: any) => { onAdd(row); setShowAdd(false) }} />
      )}
    </div>
  )
}

function InterviewModal({ internshipId, onAi, onClose, onDone }: any) {
  const [step, setStep] = useState<'loading'|'answer'|'generating'|'done'>('loading')
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await onAi('interview_questions', { internship_id: internshipId })
        if (r.error) { setErr(r.error); return }
        setQuestions(r.questions || [])
        setStep('answer')
      } catch (e: any) { setErr(e.message) }
    })()
  }, [])

  async function submit() {
    setStep('generating')
    try {
      const r = await onAi('generate_objectives', { internship_id: internshipId, answers })
      if (r.error) { setErr(r.error); setStep('answer'); return }
      setStep('done')
      setTimeout(onDone, 800)
    } catch (e: any) { setErr(e.message); setStep('answer') }
  }

  return (
    <Modal title="Entrevista personalizada" onClose={onClose} wide>
      {step === 'loading' && <p style={{ color: 'var(--ink-4)' }}>A preparar perguntas para o teu estágio…</p>}
      {step === 'generating' && <p style={{ color: 'var(--ink-4)' }}>A gerar objectivos personalizados…</p>}
      {step === 'done' && <p style={{ color: 'var(--green)' }}>Objectivos criados!</p>}
      {err && <div style={{ background: 'var(--badge-red-bg)', color: 'var(--red)', padding: 8, borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', marginBottom: 10 }}>{err}</div>}
      {step === 'answer' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: 0 }}>
            Responde para a IA criar objectivos adequados ao teu nível e ao que queres aprender.
          </p>
          {questions.map((q, i) => (
            <div key={q.id}>
              <label style={{ display: 'block', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 4 }}>
                <span style={{ color: ACCENT }}>{i + 1}.</span> {q.text}
              </label>
              {q.type === 'choice' && q.options ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {q.options.map((opt: string) => (
                    <button key={opt} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))} style={{
                      padding: '6px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any,
                      background: answers[q.id] === opt ? ACCENT : 'var(--bg-3)',
                      color: answers[q.id] === opt ? 'white' : 'var(--ink-3)',
                    }}>{opt}</button>
                  ))}
                </div>
              ) : q.type === 'long' ? (
                <textarea rows={3} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} style={{ ...input, resize: 'vertical' }} />
              ) : (
                <input value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} style={input} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
            <button onClick={submit} disabled={Object.keys(answers).length < questions.length / 2} style={btn('primary')}>
              Gerar objectivos
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddObjectiveModal({ onClose, onSave }: any) {
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('do')
  const [required, setRequired] = useState(true)
  return (
    <Modal title="Novo objectivo" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Categoria"><input value={category} onChange={e => setCategory(e.target.value)} placeholder="ex: Anamnese, Procedimentos" style={input} /></Field>
        <Field label="Título"><input required value={title} onChange={e => setTitle(e.target.value)} style={input} /></Field>
        <Field label="Descrição"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Nível">
            <select value={level} onChange={e => setLevel(e.target.value)} style={input}>
              <option value="see">Observar</option>
              <option value="assist">Ajudar</option>
              <option value="do">Fazer com supervisão</option>
              <option value="master">Autónomo</option>
            </select>
          </Field>
          <label style={{ display: 'flex', alignItems: 'flex-end', gap: 6, fontSize: 'var(--t-dado)' }}>
            <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Obrigatório
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ category: category || null, title, description, level, required, status: 'pending' })} disabled={!title} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

function ProceduresTab({ procedures, patients, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  // Conta por nível
  const byLevel: Record<string, number> = {}
  for (const p of procedures as Procedure[]) byLevel[p.level] = (byLevel[p.level] || 0) + 1
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['observed','assisted','performed_supervised','performed_alone'].map(l => (
            <span key={l} style={{ padding: '3px 10px', background: 'var(--bg-3)', borderRadius: 999, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)' }}>
              {l.replace('_', ' ')}: <b>{byLevel[l] || 0}</b>
            </span>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Procedimento</button>
      </div>
      {procedures.length === 0 ? <Empty msg="Sem procedimentos. Adiciona o primeiro." /> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {procedures.map((p: Procedure) => (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 'var(--peso-corpo)' as any }}>{p.procedure_name}</span>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--ink-2)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any }}>{p.level}</span>
              <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{new Date(p.performed_at).toLocaleDateString('pt-PT')}</span>
            </div>
          ))}
        </div>
      )}
      {showAdd && <ProcFormModal patients={patients} onClose={() => setShowAdd(false)} onSave={(r: any) => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function ProcFormModal({ patients, onClose, onSave }: any) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('observed')
  const [category, setCategory] = useState('')
  const [patientId, setPatientId] = useState('')
  const [outcome, setOutcome] = useState('')
  return (
    <Modal title="Registar procedimento" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Procedimento"><input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Cateterismo venoso periférico" style={input} /></Field>
        <Field label="Nível de participação">
          <select value={level} onChange={e => setLevel(e.target.value)} style={input}>
            <option value="observed">Observei</option>
            <option value="assisted">Ajudei</option>
            <option value="performed_supervised">Fiz com supervisão</option>
            <option value="performed_alone">Fiz sozinho</option>
          </select>
        </Field>
        <Field label="Categoria"><input value={category} onChange={e => setCategory(e.target.value)} placeholder="vascular, respiratorio, GI..." style={input} /></Field>
        <Field label="Doente associado (opcional)">
          <select value={patientId} onChange={e => setPatientId(e.target.value)} style={input}>
            <option value="">— Nenhum —</option>
            {patients.map((p: Patient) => <option key={p.id} value={p.id}>{p.initials} — {p.diagnosis || ''}</option>)}
          </select>
        </Field>
        <Field label="Outcome / observações"><textarea rows={2} value={outcome} onChange={e => setOutcome(e.target.value)} style={{ ...input, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ procedure_name: name, level, procedure_category: category || null, patient_id: patientId || null, outcome: outcome || null, performed_at: new Date().toISOString() })} disabled={!name} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

function CasesTab({ cases }: any) {
  const [open, setOpen] = useState<Case | null>(null)
  if (cases.length === 0) return <Empty msg="Sem casos. Na tab Doentes, clica em 'Caso IA' para gerar um caso clínico completo a partir do doente." />
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {cases.map((c: Case) => (
        <button key={c.id} onClick={() => setOpen(c)} style={{ textAlign: 'left', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>{c.title}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {c.ai_assisted && <span style={{ padding: '2px 8px', background: 'var(--roxo-claro)', color: 'var(--roxo)', borderRadius: 999, fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any }}>IA</span>}
              <span style={{ color: ACCENT, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any }}>Abrir →</span>
            </div>
          </div>
          {c.final_diagnosis && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', marginTop: 4 }}><span style={{ ...ROTULO }}>Diagnóstico </span>{c.final_diagnosis}</div>}
        </button>
      ))}

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 24, maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--t-destaque)', fontFamily: 'var(--font-serif,serif)' }}>{open.title}</h2>
              <button aria-label="Fechar" onClick={() => setOpen(null)} style={{ border: 'none', background: 'none', fontSize: 'var(--t-numero)', cursor: 'pointer', color: 'var(--ink-5)', lineHeight: 1 }}>×</button>            </div>
            {[
              ['História clínica', open.history],
              ['Exame físico', open.exam_findings],
              ['Exames complementares', open.investigations],
              ['Diagnóstico diferencial', open.differential],
              ['Diagnóstico final', open.final_diagnosis],
              ['Conduta', open.management],
              ['Evolução', open.outcome],
              ['Discussão', open.discussion],
              ['Referências', open.references_text],
            ].filter(([, v]) => v).map(([label, v]) => (
              <div key={label as string} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsTab({ reports, onGenerate, busy }: any) {
  const [open, setOpen] = useState<Report | null>(null)
  function download(r: Report) {
    const blob = new Blob([`# ${r.title}\n\n${r.body || ''}`], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${r.title.replace(/[^a-z0-9]+/gi, '_')}.md`; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => onGenerate('final')} disabled={busy} style={btn('primary')}>{busy ? 'A gerar…' : 'Gerar relatório final IA'}</button>
        <button onClick={() => onGenerate('weekly')} disabled={busy} style={btn('ghost')}>Relatório semanal</button>
        <button onClick={() => onGenerate('intermediate')} disabled={busy} style={btn('ghost')}>Relatório intermédio</button>
      </div>
      {reports.length === 0 ? <Empty msg="Sem relatórios. Clica num botão para gerar um relatório completo a partir de tudo o que registaste." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map((r: Report) => (
            <button key={r.id} onClick={() => setOpen(r)} style={{ textAlign: 'left', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>{r.title}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{new Date(r.created_at).toLocaleString('pt-PT')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {r.ai_assisted && <span style={{ padding: '2px 8px', background: 'var(--roxo-claro)', color: 'var(--roxo)', borderRadius: 999, fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any }}>IA</span>}
                  <span style={{ color: ACCENT, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any }}>Abrir →</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 24, maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--t-destaque)', fontFamily: 'var(--font-serif,serif)' }}>{open.title}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => download(open)} style={btn('ghost')}>↓ Descarregar</button>
                <button aria-label="Fechar" onClick={() => setOpen(null)} style={{ border: 'none', background: 'none', fontSize: 'var(--t-numero)', cursor: 'pointer', color: 'var(--ink-5)', lineHeight: 1 }}>×</button>              </div>
            </div>
            <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
              {open.body ? <MarkdownLike text={open.body} /> : <p style={{ color: 'var(--ink-5)' }}>(Relatório sem conteúdo)</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReflectionsTab({ reflections, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Reflexão</button>
      </div>
      {reflections.length === 0 ? <Empty msg="Sem reflexões. Usa o modelo Gibbs para reflectir sobre experiências." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reflections.map((r: any) => (
            <div key={r.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12 }}>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', marginBottom: 4 }}>{r.framework}</div>
              <div style={{ fontSize: 'var(--t-meta)' }}>{new Date(r.created_at).toLocaleDateString('pt-PT')}</div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <ReflectionFormModal onClose={() => setShowAdd(false)} onSave={(r: any) => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function ReflectionFormModal({ onClose, onSave }: any) {
  const [framework, setFramework] = useState('gibbs')
  const [description, setDescription] = useState('')
  const [feelings, setFeelings] = useState('')
  const [evaluation, setEvaluation] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [freeText, setFreeText] = useState('')
  return (
    <Modal title="Nova reflexão" onClose={onClose} wide>
      <Field label="Modelo">
        <select value={framework} onChange={e => setFramework(e.target.value)} style={input}>
          <option value="gibbs">Gibbs (estruturado)</option>
          <option value="driscoll">Driscoll (3 Qs)</option>
          <option value="free">Texto livre</option>
        </select>
      </Field>
      {framework === 'gibbs' && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <Field label="1. Descrição"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que aconteceu?" /></Field>
          <Field label="2. Sentimentos"><textarea rows={2} value={feelings} onChange={e => setFeelings(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que sentiste?" /></Field>
          <Field label="3. Avaliação"><textarea rows={2} value={evaluation} onChange={e => setEvaluation(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que foi bom/mau?" /></Field>
          <Field label="4. Análise"><textarea rows={2} value={analysis} onChange={e => setAnalysis(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Porquê? Que sentido fazes disto?" /></Field>
          <Field label="5. Conclusão"><textarea rows={2} value={conclusion} onChange={e => setConclusion(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="O que mais podias ter feito?" /></Field>
          <Field label="6. Plano de acção"><textarea rows={2} value={actionPlan} onChange={e => setActionPlan(e.target.value)} style={{ ...input, resize: 'vertical' }} placeholder="Se acontecer outra vez, o que vais fazer?" /></Field>
        </div>
      )}
      {framework === 'free' && (
        <Field label="Reflexão"><textarea rows={8} value={freeText} onChange={e => setFreeText(e.target.value)} style={{ ...input, resize: 'vertical', marginTop: 8 }} /></Field>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
        <button onClick={() => onSave({ framework, description, feelings, evaluation, analysis, conclusion, action_plan: actionPlan, free_text: freeText })} style={btn('primary')}>Guardar</button>
      </div>
    </Modal>
  )
}

function EvaluationsTab({ evaluations, internshipId, supabase, onReload }: any) {
  const [link, setLink] = useState('')
  const [portfolioLink, setPortfolioLink] = useState('')
  const [busy, setBusy] = useState('')
  const [evalKind, setEvalKind] = useState('formative')

  async function headers() {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function makeEvalLink() {
    setBusy('eval')
    const r = await fetch('/api/internship/links', { method: 'POST', headers: await headers(), body: JSON.stringify({ action: 'create_eval', internship_id: internshipId, kind: evalKind }) })
    const j = await r.json()
    if (j.evaluation?.share_token) { setLink(`${origin}/avaliar/${j.evaluation.share_token}`); onReload?.() }
    else alert(j.error || 'Erro')
    setBusy('')
  }
  async function makePortfolioLink() {
    setBusy('portfolio')
    const r = await fetch('/api/internship/links', { method: 'POST', headers: await headers(), body: JSON.stringify({ action: 'set_portfolio', internship_id: internshipId, public: true }) })
    const j = await r.json()
    if (j.token) setPortfolioLink(`${origin}/portfolio/${j.token}`)
    else alert(j.error || 'Erro')
    setBusy('')
  }
  function copy(t: string) { navigator.clipboard?.writeText(t); }

  return (
    <div>
      {/* Pedir avaliação por link */}
      <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>Pedir avaliação ao supervisor</div>
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 10 }}>Gera um link. O supervisor avalia-te sem precisar de conta — fica registado aqui.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={evalKind} onChange={e => setEvalKind(e.target.value)} style={input}>
            <option value="formative">Formativa</option>
            <option value="summative">Sumativa</option>
            <option value="mini_cex">Mini-CEX</option>
            <option value="dops">DOPS</option>
            <option value="cbd">CbD</option>
          </select>
          <button onClick={makeEvalLink} disabled={busy === 'eval'} style={btn('primary')}>{busy === 'eval' ? '…' : 'Gerar link de avaliação'}</button>
        </div>
        {link && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <input readOnly value={link} style={{ ...input, flex: 1, fontSize: 'var(--t-meta)' }} onFocus={e => e.target.select()} />
            <button onClick={() => copy(link)} style={btn('ghost')}>Copiar</button>
          </div>
        )}
      </section>

      {/* Partilhar portefólio */}
      <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)' }}>Partilhar portefólio</div>
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 10 }}>Link só-leitura com objetivos, procedimentos, casos e avaliações — para mostrar à escola/supervisor.</div>
        <button onClick={makePortfolioLink} disabled={busy === 'portfolio'} style={btn('primary')}>{busy === 'portfolio' ? '…' : 'Gerar link do portefólio'}</button>
        {portfolioLink && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <input readOnly value={portfolioLink} style={{ ...input, flex: 1, fontSize: 'var(--t-meta)' }} onFocus={e => e.target.select()} />
            <button onClick={() => copy(portfolioLink)} style={btn('ghost')}>Copiar</button>
          </div>
        )}
      </section>

      {/* Avaliações recebidas */}
      <div style={{ fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-corpo)', marginBottom: 8 }}>Avaliações recebidas</div>
      {evaluations.length === 0 ? <Empty msg="Ainda sem avaliações. Gera um link acima e envia ao teu supervisor." /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {evaluations.map((e: any) => (
            <div key={e.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 'var(--peso-forte)' as any }}>{e.evaluator_name || (e.submitted_at ? 'Supervisor' : 'A aguardar resposta…')} · {e.kind}</span>
                {e.overall_score
                  ? <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--badge-green-bg)', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>{e.overall_score}/5</span>
                  : <span style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>pendente</span>}
              </div>
              {(e.strengths || e.comments) && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 6 }}>{e.strengths || e.comments}</div>}
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 4 }}>{e.evaluation_date}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HoursTab({ hours, required, done, pct, onAdd, onDel }: any) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', fontWeight: 'var(--peso-corpo)' as any }}>Progresso</span>
          <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>{done} / {required} ({pct}%)</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: ACCENT }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => setShowAdd(true)} style={btn('primary')}>+ Registar horas</button>
      </div>
      {hours.length === 0 ? <Empty msg="Sem registos de horas." /> : (
        <div style={{ display: 'grid', gap: 4 }}>
          {hours.map((h: any) => (
            <div key={h.id} style={{ background: 'white', border: '1px solid var(--bg-3)', padding: 8, borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-dado)' }}>
              <span>{new Date(h.hours_date).toLocaleDateString('pt-PT')} {h.activity && `· ${h.activity}`}</span>
              <b>{h.hours}h</b>
            </div>
          ))}
        </div>
      )}
      {showAdd && <HoursFormModal onClose={() => setShowAdd(false)} onSave={(r: any) => { onAdd(r); setShowAdd(false) }} />}
    </div>
  )
}

function HoursFormModal({ onClose, onSave }: any) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [hours, setHours] = useState<number>(8)
  const [activity, setActivity] = useState('')
  return (
    <Modal title="Registar horas" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></Field>
        <Field label="Horas"><input type="number" step="0.5" value={hours} onChange={e => setHours(parseFloat(e.target.value) || 0)} style={input} /></Field>
        <Field label="Actividade (opcional)"><input value={activity} onChange={e => setActivity(e.target.value)} placeholder="enfermaria, OR, urgência..." style={input} /></Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => onSave({ hours_date: date, hours, activity })} style={btn('primary')}>Adicionar</button>
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════════

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 20, maxWidth: wide ? 640 : 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any }}>{title}</h3>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-5)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>{children}</label>
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed var(--border-2)', borderRadius: 'var(--r-xl)', padding: 24, textAlign: 'center', color: 'var(--ink-4)', fontSize: 'var(--t-dado)' }}>{msg}</div>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '7px 14px', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-dado)' }
  return { padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', background: 'white', color: 'var(--ink-3)', fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-dado)' }
}
