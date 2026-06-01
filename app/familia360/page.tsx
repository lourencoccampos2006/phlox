'use client'

// /familia360 — Hub para cuidador familiar. Integra:
//   • Inbox do dia (último que aconteceu em cada familiar)
//   • Auditor de duplicações cruzadas (mesmo DCI em 2 familiares)
//   • Reconciliação de medicação (antes vs depois)
//   • Avaliação Zarit-12 da sobrecarga do cuidador
//   • Atalho para o Cofre / share codes

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import { ZARIT12_QUESTIONS, ZARIT12_OPTIONS, ZARIT12_BAND_META, zarit12Band, reconcile, type MedItem } from '@/lib/caregiverScales'

type Tab = 'inbox' | 'reconcile' | 'audit' | 'burden' | 'vault'

export default function Familia360Page() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('inbox')
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)' }}>Família 360°</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          O hub do cuidador familiar — inbox, reconciliação, auditoria de duplicações, avaliação de sobrecarga e cofre partilhado.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#b45309', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Cuidador · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Família 360°</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>O painel do cuidador. Tudo num só sítio.</p>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 16, overflowX: 'auto' }}>
          {([
            ['inbox',     '📥 Inbox do dia'],
            ['reconcile', '🔁 Reconciliar receitas'],
            ['audit',     '🔍 Auditor cruzado'],
            ['burden',    '💛 Sobrecarga (Zarit)'],
            ['vault',     '🔒 Cofre & partilhas'],
          ] as [Tab, string][]).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '10px 14px', background: tab === id ? '#fffbeb' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#b45309' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#b45309' : '#475569', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'inbox' && <InboxTab />}
        {tab === 'reconcile' && <ReconcileTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'burden' && <BurdenTab />}
        {tab === 'vault' && <VaultTab />}
      </div>
    </div>
  )
}

// ─── Inbox ────────────────────────────────────────────────────────────────────
function InboxTab() {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: profs } = await supabase.from('family_profiles').select('id, name, relationship').eq('user_id', user.id)
      const list = profs || []
      setProfiles(list)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const ev: Record<string, any[]> = {}
      await Promise.all(list.map(async (p: any) => {
        const [m, v, c] = await Promise.all([
          supabase.from('med_logs').select('taken_at, med_name, status').eq('user_id', user.id).gte('taken_at', today.toISOString()).limit(20),
          supabase.from('vital_signs').select('measured_at, systolic, diastolic, pulse, weight').eq('user_id', user.id).gte('measured_at', today.toISOString()).limit(10),
          supabase.from('cal_events').select('id, title, starts_at').eq('user_id', user.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
        ])
        ev[p.id] = [
          ...(m.data || []).map((r: any) => ({ kind: 'med', when: r.taken_at, text: `${r.med_name || 'medicamento'} · ${r.status}` })),
          ...(v.data || []).map((r: any) => ({ kind: 'vital', when: r.measured_at, text: `TA ${r.systolic ?? '—'}/${r.diastolic ?? '—'} · FC ${r.pulse ?? '—'}` })),
          ...(c.data || []).map((r: any) => ({ kind: 'event', when: r.starts_at, text: `Próximo: ${r.title}` })),
        ].sort((a, b) => b.when.localeCompare(a.when))
      }))
      setEvents(ev)
    })()
  }, [user?.id])

  if (profiles.length === 0) return <Empty msg="Sem perfis familiares ainda. Cria perfis em /perfis ou /familia." />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
      {profiles.map(p => {
        const evs = events[p.id] || []
        return (
          <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{p.relationship || ''}</div>
              </div>
              <Link href={`/familia?p=${p.id}`} style={{ fontSize: 11, color: '#b45309', textDecoration: 'none', fontWeight: 700 }}>Abrir →</Link>
            </div>
            {evs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>Sem atividade hoje</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evs.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: '#475569', padding: '4px 0' }}>
                    <span style={{ width: 16, color: e.kind === 'med' ? '#0d6e42' : e.kind === 'vital' ? '#1d4ed8' : '#b45309' }}>{e.kind === 'med' ? '💊' : e.kind === 'vital' ? '❤' : '📅'}</span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{e.text}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontSize: 10 }}>{new Date(e.when).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Reconcile ────────────────────────────────────────────────────────────────
function ReconcileTab() {
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')

  function parse(txt: string): MedItem[] {
    return txt.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      // formato livre: "Ramipril 5mg 1x dia"
      const m = line.match(/^([^\d]+?)\s*([\d.,]+\s*mg|[\d.,]+\s*mcg|[\d.,]+\s*g)?\s*(.*)$/i)
      return { name: (m?.[1] || line).trim(), dose: (m?.[2] || '').trim(), frequency: (m?.[3] || '').trim() }
    })
  }
  const diff = useMemo(() => reconcile(parse(beforeText), parse(afterText)), [beforeText, afterText])

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
        Cola a lista <strong>antes</strong> e <strong>depois</strong> (ex: antes vs depois do internamento). Um medicamento por linha — formato livre.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <Label>Antes</Label>
          <textarea value={beforeText} onChange={e => setBeforeText(e.target.value)} rows={8}
            placeholder="Ramipril 5mg manhã&#10;Bisoprolol 2,5mg manhã&#10;…"
            style={textarea()} />
        </div>
        <div>
          <Label>Depois</Label>
          <textarea value={afterText} onChange={e => setAfterText(e.target.value)} rows={8}
            placeholder="Ramipril 10mg manhã&#10;Bisoprolol 5mg manhã&#10;Furosemida 20mg manhã&#10;…"
            style={textarea()} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
        <DiffBlock title="✚ Novos" color="#0d6e42" items={diff.added.map(m => `${m.name} ${m.dose || ''} ${m.frequency || ''}`.trim())} />
        <DiffBlock title="✕ Removidos" color="#dc2626" items={diff.removed.map(m => `${m.name} ${m.dose || ''} ${m.frequency || ''}`.trim())} />
        <DiffBlock title="↻ Alterados" color="#d97706" items={diff.changed.map(c => `${c.name} — ${c.what.join('; ')}`)} />
        <DiffBlock title="= Mantidos" color="#94a3b8" items={diff.unchanged.map(m => `${m.name} ${m.dose || ''}`.trim())} muted />
      </div>
    </div>
  )
}

function DiffBlock({ title, color, items, muted }: { title: string; color: string; items: string[]; muted?: boolean }) {
  return (
    <div style={{ background: muted ? '#f8fafc' : 'white', border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{title} · {items.length}</div>
      {items.length === 0 ? <div style={{ fontSize: 11, color: '#94a3b8' }}>—</div> : items.map((t, i) => <div key={i} style={{ fontSize: 12, color: '#0b1120', lineHeight: 1.5, padding: '2px 0', borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>{t}</div>)}
    </div>
  )
}

// ─── Audit cruzado (duplicações entre familiares) ─────────────────────────────
function AuditTab() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<{ profile: string; name: string }[]>([])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: profs } = await supabase.from('family_profiles').select('id, name').eq('user_id', user.id)
      const list: { profile: string; name: string }[] = []
      await Promise.all((profs || []).map(async (p: any) => {
        const { data } = await supabase.from('personal_meds').select('name').eq('user_id', user.id)
        ;(data || []).forEach((m: any) => list.push({ profile: p.name, name: m.name }))
      }))
      setMeds(list)
    })()
  }, [user?.id])

  // Agrega por nome DCI
  const dupes = useMemo(() => {
    const map = new Map<string, Set<string>>()
    meds.forEach(m => {
      const k = (m.name || '').trim().toLowerCase().replace(/\s+\d.*$/, '')
      if (!k) return
      if (!map.has(k)) map.set(k, new Set())
      map.get(k)!.add(m.profile)
    })
    return Array.from(map.entries())
      .filter(([, s]) => s.size > 1)
      .map(([name, set]) => ({ name, profiles: Array.from(set) }))
      .sort((a, b) => b.profiles.length - a.profiles.length)
  }, [meds])

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 12 }}>
        Mostra fármacos que aparecem em mais do que um familiar. Útil para confirmar prescrições paralelas, evitar trocas acidentais entre familiares, e identificar oportunidades de partilha de informação clínica.
      </p>
      {dupes.length === 0 ? (
        <Empty msg="Nenhum medicamento aparece em múltiplos familiares com os dados atuais." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dupes.map((d, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{d.name}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Familiares: <strong>{d.profiles.join(', ')}</strong></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Burden (Zarit-12) ────────────────────────────────────────────────────────
function BurdenTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [caringFor, setCaringFor] = useState('')
  const [answers, setAnswers] = useState<number[]>(new Array(12).fill(-1))
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase.from('caregiver_burden').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }).limit(10)
      setHistory(data || [])
    })()
  }, [user?.id])

  const total = answers.filter(a => a >= 0).reduce((a, b) => a + b, 0)
  const complete = answers.every(a => a >= 0)
  const band = zarit12Band(total)
  const meta = ZARIT12_BAND_META[band]

  async function save() {
    if (!complete) { toast.error('Responde a todas as perguntas'); return }
    if (!caringFor.trim()) { toast.error('Indica o nome do familiar'); return }
    const ans: any = {}
    answers.forEach((a, i) => { ans[`q${i + 1}`] = a })
    const { error } = await supabase.from('caregiver_burden').insert({
      user_id: user!.id,
      caring_for: caringFor.trim(),
      answers: ans, total, band,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Avaliação guardada')
    setAnswers(new Array(12).fill(-1))
    const { data } = await supabase.from('caregiver_burden').select('*').eq('user_id', user!.id).order('measured_at', { ascending: false }).limit(10)
    setHistory(data || [])
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 14 }}>
        <strong>Zarit-12</strong> é a escala validada internacionalmente para medir a sobrecarga do cuidador familiar (Bedard 2001). Responde a estas 12 perguntas — leva ~3 min.
      </p>

      <Label>Cuido principalmente de:</Label>
      <input value={caringFor} onChange={e => setCaringFor(e.target.value)} placeholder="Ex: Mãe, Pai, Avó Maria…" style={input()} />

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ZARIT12_QUESTIONS.map((q, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 13, color: '#0b1120', marginBottom: 6, lineHeight: 1.45 }}><strong>{i + 1}.</strong> {q}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ZARIT12_OPTIONS.map(o => (
                <button key={o.v} onClick={() => setAnswers(p => p.map((x, j) => j === i ? o.v : x))}
                  style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${answers[i] === o.v ? '#b45309' : '#e5e7eb'}`, background: answers[i] === o.v ? '#fffbeb' : 'white', color: answers[i] === o.v ? '#b45309' : '#475569', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {complete && (
        <div style={{ marginTop: 14, background: meta.color + '14', border: `1px solid ${meta.color}40`, borderLeft: `4px solid ${meta.color}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: meta.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score {total}/48</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: meta.color, marginTop: 4 }}>{meta.label}</div>
          <div style={{ fontSize: 13, color: '#0b1120', marginTop: 6, lineHeight: 1.55 }}>{meta.advice}</div>
          <button onClick={save} style={{ marginTop: 10, padding: '9px 16px', background: meta.color, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Guardar avaliação</button>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Label>Histórico</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map(h => {
              const m = ZARIT12_BAND_META[h.band as keyof typeof ZARIT12_BAND_META]
              return (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7 }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>{new Date(h.measured_at).toLocaleDateString('pt-PT')} · {h.caring_for}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: m.color }}>{h.total}/48 · {m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vault tab ────────────────────────────────────────────────────────────────
function VaultTab() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.65, marginBottom: 14 }}>
        Como cuidador, podes precisar de mostrar documentos clínicos do teu familiar a um médico, farmacêutico ou serviço social — sem dar acesso ao Phlox. O cofre permite gerar um <strong>código temporário</strong> que mostra UM documento de cada vez, expira sozinho e tem limite de visualizações.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
        <Link href="/vault" style={{ display: 'block', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, textDecoration: 'none', color: '#0b1120' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🔒 Abrir cofre</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Adicionar, ver e partilhar documentos.</div>
        </Link>
        <Link href="/preparar-consulta" style={{ display: 'block', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, textDecoration: 'none', color: '#0b1120' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>📋 Preparar consulta</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>O que perguntar ao médico do familiar.</div>
        </Link>
        <Link href="/passport" style={{ display: 'block', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, textDecoration: 'none', color: '#0b1120' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>🆘 Passaporte de emergência</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Cartão com QR para emergências.</div>
        </Link>
      </div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{msg}</div>
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</div> }
function input(): React.CSSProperties { return { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' } }
function textarea(): React.CSSProperties { return { ...input(), fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55, resize: 'vertical' } }
