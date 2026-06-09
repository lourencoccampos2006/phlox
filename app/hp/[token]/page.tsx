'use client'

// Phlox Health Pass — vista do PROFISSIONAL (sem conta). Abre via QR, introduz o PIN
// que o doente diz, e vê o resumo clínico partilhado. Pode registar a visita e devolver dados.

import { useState, useEffect, useCallback, use } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Data {
  profile: { name: string; blood_type?: string | null; emergency_contact?: string | null }
  sections: string[]
  sessionId: string
  allergies?: string | null
  conditions?: string | null
  meds?: { name: string; dose?: string; frequency?: string; indication?: string }[]
  symptoms?: { at: string; feeling?: number; symptoms?: string[]; pain?: number; temperature?: number; notes?: string }[]
  vitals?: { recorded_at: string; hr?: number; bp_sys?: number; bp_dia?: number; spo2?: number; temp?: number; glucose?: number; weight?: number }[]
  visits?: { at: string; professional_name?: string; institution?: string; reason?: string }[]
}

const FEELING: Record<number, string> = { 1: '😣 Muito mal', 2: '😕 Mal', 3: '😐 Assim-assim', 4: '🙂 Bem', 5: '😄 Ótimo' }

export default function HealthPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { user, supabase } = useAuth() as any
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'pin' | 'view' | 'gone'>('pin')
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [viewMode, setViewMode] = useState<'sections' | 'timeline'>('sections')
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<'ok' | 'gone' | 'loading'>('loading')

  // ações do profissional
  const [from, setFrom] = useState('')
  const [reason, setReason] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [done, setDone] = useState('')

  // Se o profissional já tem sessão Phlox, pré-preenche o nome
  useEffect(() => { if (user?.name && !from) setFrom(user.name) }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/health-pass?token=${encodeURIComponent(token)}`).then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
      .then(({ status, d }) => {
        if (status === 410) setMeta('gone')
        else if (d?.needsPin || status === 200) setMeta('ok')
        else setMeta('gone')
      }).catch(() => setMeta('gone'))
  }, [token])

  const unlock = useCallback(async () => {
    if (pin.length < 4) return
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/health-pass?token=${encodeURIComponent(token)}&pin=${encodeURIComponent(pin)}`)
      const d = await res.json()
      if (!res.ok) { setErr(d.error || 'Erro'); if (res.status === 410) setStep('gone'); return }
      setData(d); setStep('view')
    } catch { setErr('Falha de ligação.') }
    finally { setLoading(false) }
  }, [pin, token])

  async function action(kind: 'visit' | 'note', payload: any, label: string) {
    let staffToken = ''
    try { if (user) staffToken = (await supabase.auth.getSession()).data.session?.access_token || '' } catch { /* convidado */ }
    const res = await fetch('/api/health-pass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pin, kind, from, staffToken, patientName: data?.profile?.name, ...payload }),
    })
    if (res.ok) { setDone(label + (user ? ' (no teu Phlox também)' : '')); setTimeout(() => setDone(''), 3000) }
  }

  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui,-apple-system,sans-serif' }
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px' }
  const sect = (title: string, children: React.ReactNode) => <div style={card}><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>{children}</div>

  if (meta === 'gone' || step === 'gone') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...card, maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120', marginBottom: 6 }}>Partilha indisponível</div>
        <div style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>Esta partilha expirou ou foi terminada pelo doente. Peça ao doente para gerar um novo código no Phlox.</div>
      </div>
    </div>
  )

  if (step === 'pin') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...card, maxWidth: 380, width: '100%', padding: '30px 26px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Phlox · Health Pass</div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0b1120', margin: '0 0 6px' }}>Resumo de saúde do doente</h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 20px' }}>Peça ao doente o <strong>código de 4-6 dígitos</strong> que aparece no ecrã dele e introduza-o para ver o resumo.</p>
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="• • • •" maxLength={6}
          onKeyDown={e => e.key === 'Enter' && unlock()}
          style={{ width: '100%', padding: '14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center', boxSizing: 'border-box', outline: 'none' }} />
        {err && <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}
        <button onClick={unlock} disabled={pin.length < 4 || loading} style={{ width: '100%', marginTop: 16, padding: 14, background: pin.length >= 4 ? '#16a34a' : '#e5e7eb', color: pin.length >= 4 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: pin.length >= 4 ? 'pointer' : 'default' }}>{loading ? 'A abrir…' : 'Ver resumo'}</button>
        <div style={{ marginTop: 16, fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>Acesso temporário e autorizado pelo doente. Os dados não ficam guardados neste dispositivo.</div>
      </div>
    </div>
  )

  if (!data) return null
  const has = (s: string) => data.sections.includes(s)

  return (
    <div style={wrap}>
      <div className="hp-noprint" style={{ background: '#0f172a', color: '#fff', padding: '16px 18px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>Phlox · Health Pass</div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{data.profile.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              {data.profile.blood_type ? `Grupo ${data.profile.blood_type} · ` : ''}{data.profile.emergency_contact ? `Emergência: ${data.profile.emergency_contact}` : ''}
            </div>
          </div>
          <button onClick={() => window.print()} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🖨 Imprimir</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Banner: ligado à conta do médico OU convite */}
        <div className="hp-noprint" style={{ background: user ? '#f0fdf4' : '#eff6ff', border: `1px solid ${user ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: user ? '#15803d' : '#1d4ed8', lineHeight: 1.5 }}>
          {user
            ? <>✓ Sessão Phlox de <strong>{user.name}</strong> — ao registar a visita, ela fica também no teu histórico de atendimentos.</>
            : <>Também usas o Phlox? <a href="/login" style={{ color: '#1d4ed8', fontWeight: 700 }}>Inicia sessão</a> para registar esta visita no teu histórico e devolver dados ao doente.</>}
        </div>
        {/* Toggle: secções vs linha do tempo (vista cronológica para a consulta) */}
        <div className="hp-noprint" style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3, alignSelf: 'flex-start' }}>
          {(['sections', 'timeline'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: viewMode === m ? '#0f172a' : 'transparent', color: viewMode === m ? '#fff' : '#475569' }}>
              {m === 'sections' ? 'Secções' : '🕐 Linha do tempo'}
            </button>
          ))}
        </div>

        {/* Alergias — sempre visível (crítico), em ambas as vistas */}
        {has('allergies') && (
          <div style={{ ...card, borderColor: data.allergies ? '#fca5a5' : '#e5e7eb', background: data.allergies ? '#fef2f2' : '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: data.allergies ? '#b91c1c' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>⚠ Alergias</div>
            <div style={{ fontSize: 14, color: data.allergies ? '#991b1b' : '#64748b', fontWeight: data.allergies ? 700 : 400 }}>{data.allergies || 'Sem alergias conhecidas'}</div>
          </div>
        )}

        {/* VISTA LINHA DO TEMPO — funde tudo o que tem data, do mais recente ao + antigo */}
        {viewMode === 'timeline' && (() => {
          type Ev = { at: string; kind: string; color: string; title: string; detail: string }
          const events: Ev[] = []
          for (const v of (data.visits || [])) events.push({ at: v.at, kind: 'Consulta', color: '#1d4ed8', title: v.reason || 'Consulta', detail: [v.professional_name, v.institution].filter(Boolean).join(' · ') })
          for (const s of (data.symptoms || [])) events.push({ at: s.at, kind: 'Sintomas', color: '#b45309', title: (s.symptoms || []).join(', ') || 'Registo de sintomas', detail: [s.pain != null ? `dor ${s.pain}/10` : '', s.temperature ? `${s.temperature}ºC` : '', s.notes || ''].filter(Boolean).join(' · ') })
          for (const v of (data.vitals || [])) events.push({ at: v.recorded_at, kind: 'Sinais vitais', color: '#0d6e42', title: [v.bp_sys && v.bp_dia ? `TA ${v.bp_sys}/${v.bp_dia}` : '', v.hr ? `FC ${v.hr}` : '', v.spo2 ? `SpO2 ${v.spo2}%` : '', v.glucose ? `gli ${v.glucose}` : '', v.weight ? `${v.weight}kg` : ''].filter(Boolean).join(' · ') || 'Medição', detail: v.temp ? `${v.temp}ºC` : '' })
          events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          if (events.length === 0) return <div style={{ ...card, color: '#64748b', fontSize: 13 }}>Sem eventos datados partilhados.</div>
          return (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Linha do tempo de saúde</div>
              <div style={{ position: 'relative', paddingLeft: 18 }}>
                <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 2, background: '#e5e7eb' }} />
                {events.map((e, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -18, top: 3, width: 10, height: 10, borderRadius: '50%', background: e.color, border: '2px solid white' }} />
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{new Date(e.at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })} · <span style={{ color: e.color, fontWeight: 700 }}>{e.kind}</span></div>
                    <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, marginTop: 1 }}>{e.title}</div>
                    {e.detail && <div style={{ fontSize: 12.5, color: '#64748b' }}>{e.detail}</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {viewMode === 'sections' && has('conditions') && (
          <div style={{ ...card, borderColor: data.conditions ? '#fcd34d' : '#e5e7eb', background: data.conditions ? '#fffbeb' : '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: data.conditions ? '#b45309' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Condições / diagnósticos</div>
            <div style={{ fontSize: 14, color: data.conditions ? '#92400e' : '#94a3b8', fontWeight: data.conditions ? 600 : 400, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{data.conditions || 'Sem condições registadas'}</div>
          </div>
        )}

        {/* Medicação visível em ambas as vistas (sempre relevante numa consulta) */}
        {has('meds') && sect(`Medicação atual (${data.meds?.length || 0})`, (data.meds?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.meds.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: i < (data.meds!.length - 1) ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0b1120' }}>{m.name}{m.indication ? <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}> · {m.indication}</span> : ''}</span>
                <span style={{ fontSize: 12.5, color: '#475569', whiteSpace: 'nowrap' }}>{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem medicação registada.</div>))}

        {viewMode === 'sections' && has('symptoms') && sect('Sintomas recentes', (data.symptoms?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.symptoms.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#334155' }}>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(s.at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>
                {' · '}{s.feeling ? FEELING[s.feeling] : ''}{s.symptoms?.length ? ` · ${s.symptoms.join(', ')}` : ''}{s.pain ? ` · dor ${s.pain}/10` : ''}{s.temperature ? ` · ${s.temperature}°C` : ''}
                {s.notes && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{s.notes}</div>}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem registos.</div>))}

        {viewMode === 'sections' && has('vitals') && sect('Sinais vitais recentes', (data.vitals?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.vitals.map((v, i) => (
              <div key={i} style={{ fontSize: 13, color: '#334155' }}>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(v.recorded_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>{' · '}
                {[v.bp_sys && `TA ${v.bp_sys}/${v.bp_dia ?? '—'}`, v.hr && `FC ${v.hr}`, v.spo2 && `SpO₂ ${v.spo2}%`, v.temp && `${v.temp}°C`, v.glucose && `Gli ${v.glucose}`, v.weight && `${v.weight}kg`].filter(Boolean).join(' · ')}
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem registos.</div>))}

        {viewMode === 'sections' && has('visits') && sect('Visitas anteriores', (data.visits?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.visits.map((v, i) => (
              <div key={i} style={{ fontSize: 13, color: '#334155', display: 'flex', gap: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(v.at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                <span><strong>{v.reason || 'Consulta'}</strong>{v.institution ? ` · ${v.institution}` : ''}{v.professional_name ? ` · ${v.professional_name}` : ''}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem visitas registadas.</div>))}

        {/* Ações do profissional */}
        <div className="hp-noprint" style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Registar esta visita no Phlox do doente</div>
          <input value={from} onChange={e => setFrom(e.target.value)} placeholder="O seu nome / instituição" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1fae5', borderRadius: 9, fontSize: 13.5, boxSizing: 'border-box', outline: 'none', marginBottom: 8 }} />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da visita" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1fae5', borderRadius: 9, fontSize: 13.5, boxSizing: 'border-box', outline: 'none', marginBottom: 8 }} />
          <textarea value={returnNote} onChange={e => setReturnNote(e.target.value)} rows={2} placeholder="Nota / indicações para o doente (opcional)" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1fae5', borderRadius: 9, fontSize: 13.5, boxSizing: 'border-box', outline: 'none', resize: 'vertical', marginBottom: 10 }} />
          <button onClick={() => action('visit', { reason, note: returnNote }, 'Visita registada no Phlox do doente ✓')} disabled={!from.trim() || !reason.trim()}
            style={{ width: '100%', padding: 12, background: from.trim() && reason.trim() ? '#16a34a' : '#e5e7eb', color: from.trim() && reason.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: from.trim() && reason.trim() ? 'pointer' : 'default' }}>
            Registar visita
          </button>
          {done && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#15803d', textAlign: 'center' }}>{done}</div>}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>Fica guardado no histórico de saúde do doente. Se também usa o Phlox, entre na sua conta para devolver medicação e marcações.</div>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5, padding: '4px 0 20px' }}>Dados partilhados temporariamente pelo doente via Phlox · não os reproduza sem autorização.</div>
      </div>
      <style>{`@media print { .hp-noprint { display: none !important } body { background: #fff !important } }`}</style>
    </div>
  )
}
