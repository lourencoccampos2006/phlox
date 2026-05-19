'use client'

// app/consult-prep/page.tsx — Preparar Consulta com AI
// Gera um briefing estruturado para levar à próxima consulta:
// medicação actual, análises recentes, sintomas, e as perguntas certas.
// Para profissionais: briefing clínico do doente antes da ronda.
// Para famílias: resumo para a consulta do familiar.

import { useState, useEffect } from 'react'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import type { ActiveProfile } from '@/lib/profileContext'

interface Briefing {
  patient_summary: string
  consultation_reason: string
  medications_summary: string[]
  recent_labs: { name: string; value: string; status: string; date: string }[]
  active_concerns: string[]
  questions_to_ask: string[]
  things_to_mention: string[]
  red_flags: string[]
  medication_questions: string[]
  next_steps: string[]
}

export default function ConsultPrepPage() {
  const { user, supabase } = useAuth()
  const [profile, setProfile] = useState<ActiveProfile | null>(null)
  const [reason, setReason] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [concerns, setConcerns] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const SPECIALTIES = ['Médico de Família', 'Cardiologia', 'Endocrinologia', 'Pneumologia', 'Neurologia', 'Gastrenterologia', 'Nefrologia', 'Oncologia', 'Psiquiatria', 'Reumatologia', 'Outra']

  const generate = async () => {
    if (!user) return
    setLoading(true); setError(''); setBriefing(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const res = await fetch('/api/consult-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          profile_id: profile?.type === 'self' ? null : profile?.id,
          reason, symptoms, concerns, specialty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBriefing(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!briefing) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8">
    <title>Preparação de Consulta — Phlox</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#111;padding:28px;max-width:780px;margin:0 auto}
      h1{font-family:Georgia,serif;font-size:20px;font-weight:400;margin:0 0 4px;border-bottom:2px solid #111;padding-bottom:8px}
      h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#666;margin:18px 0 6px}
      li{margin-bottom:3px}
      .red{color:#dc2626;font-weight:600}
      .footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:9px;color:#aaa;display:flex;justify-content:space-between}
      @media print{body{padding:12px}}
    </style></head><body>
    <p style="font-size:9px;color:#aaa;font-family:monospace;margin-bottom:6px">PREPARAÇÃO DE CONSULTA — ${specialty || 'Consulta'} — Phlox Clinical</p>
    <h1>Preparação de Consulta</h1>
    <p style="font-size:12px;color:#555;margin:4px 0 16px">${new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
    <p><strong>Motivo:</strong> ${briefing.consultation_reason}</p>
    <p>${briefing.patient_summary}</p>
    ${briefing.red_flags?.length ? `<h2 style="color:#dc2626">Avisos importantes</h2><ul>${briefing.red_flags.map(r=>`<li class="red">${r}</li>`).join('')}</ul>` : ''}
    <h2>Medicação actual</h2><ul>${briefing.medications_summary?.map(m=>`<li>${m}</li>`).join('') || '<li>Sem medicação registada</li>'}</ul>
    ${briefing.recent_labs?.length ? `<h2>Análises recentes</h2><ul>${briefing.recent_labs.map(l=>`<li>${l.name}: ${l.value} (${l.date})</li>`).join('')}</ul>` : ''}
    <h2>Perguntas para fazer ao médico</h2><ol>${briefing.questions_to_ask?.map(q=>`<li>${q}</li>`).join('')}</ol>
    ${briefing.medication_questions?.length ? `<h2>Perguntas sobre medicação</h2><ol>${briefing.medication_questions.map(q=>`<li>${q}</li>`).join('')}</ol>` : ''}
    <h2>O que mencionar</h2><ul>${briefing.things_to_mention?.map(t=>`<li>${t}</li>`).join('')}</ul>
    <div class="footer"><span>Gerado por Phlox Clinical · phlox-pi.vercel.app</span><span>Leva este documento à consulta</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }
  const ta: React.CSSProperties = { ...inp, resize: 'vertical', lineHeight: 1.6 }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 740 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta de apoio</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>Preparar Consulta</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 540 }}>
            A AI analisa a tua medicação e análises e gera um briefing estruturado para levar à consulta — com as perguntas certas, o que mencionar, e os sinais de alerta.
          </p>
        </div>

        {!briefing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {user && <div><ProfileSelector onChange={setProfile} /></div>}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Tipo de consulta / especialidade</label>
                  <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={inp}>
                    <option value="">— Seleccionar —</option>
                    {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Motivo principal da consulta</label>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Controlo da diabetes, dores nas costas há 3 semanas, renovar receitas..." style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Sintomas ou queixas actuais (opcional)</label>
                <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={3} placeholder="Descreve os sintomas — quando começaram, o que os agrava, o que alivia..." style={ta} />
              </div>
              <div>
                <label style={lbl}>Preocupações ou dúvidas que queres esclarecer (opcional)</label>
                <textarea value={concerns} onChange={e => setConcerns(e.target.value)} rows={2} placeholder="Ex: Tenho dúvidas sobre um efeito adverso, quero saber se posso reduzir a dose de..." style={ta} />
              </div>
            </div>

            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>{error}</div>}

            <button onClick={generate} disabled={loading || !reason.trim()}
              style={{ padding: '14px', background: loading || !reason.trim() ? 'var(--bg-3)' : 'var(--green)', color: loading || !reason.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading || !reason.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A preparar briefing...</> : 'Gerar briefing de consulta →'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => setBriefing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Editar dados
              </button>
              <button onClick={handlePrint} style={{ padding: '9px 18px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir briefing
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Summary */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Resumo</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, marginBottom: 4 }}>{briefing.consultation_reason}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>{briefing.patient_summary}</div>
              </div>

              {/* Red flags */}
              {briefing.red_flags?.length > 0 && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderLeft: '3px solid #dc2626', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Avisos importantes — menciona ao médico</div>
                  {briefing.red_flags.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < briefing.red_flags.length - 1 ? 6 : 0 }}>
                      <span style={{ color: '#dc2626', flexShrink: 0 }}>!</span>
                      <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 600, lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Meds */}
              {briefing.medications_summary?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Medicação actual ({briefing.medications_summary.length})</span>
                  </div>
                  <div style={{ padding: '12px 18px' }}>
                    {briefing.medications_summary.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < briefing.medications_summary.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, marginTop: 7 }} />
                        <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Labs */}
              {briefing.recent_labs?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Análises recentes</span>
                  </div>
                  <div>
                    {briefing.recent_labs.map((l, i) => {
                      const sc = l.status === 'CRITICO_ALTO' || l.status === 'CRITICO_BAIXO' ? '#dc2626' : l.status === 'ALTO' || l.status === 'BAIXO' ? '#d97706' : '#0d6e42'
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 18px', borderBottom: i < briefing.recent_labs.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{l.name}</span>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: sc }}>{l.value}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)' }}>{l.date}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Questions */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '3px solid #1d4ed8', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Perguntas para fazer ao médico</div>
                <ol style={{ paddingLeft: 18, margin: 0 }}>
                  {briefing.questions_to_ask?.map((q, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.7, marginBottom: 4 }}>{q}</li>
                  ))}
                </ol>
              </div>

              {/* Med questions */}
              {briefing.medication_questions?.length > 0 && (
                <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderLeft: '3px solid #7c3aed', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Perguntas sobre medicação</div>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    {briefing.medication_questions.map((q, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.7, marginBottom: 4 }}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Things to mention */}
              {briefing.things_to_mention?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>O que mencionar ao médico</div>
                  {briefing.things_to_mention.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < briefing.things_to_mention.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}