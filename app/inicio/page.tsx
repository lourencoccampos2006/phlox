'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MODE_QUICK_ACTIONS } from '@/lib/navigation'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}
function dateStr() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─── Tool card ────────────────────────────────────────────────────────────────
function ToolCard({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="ic-card">
      <div style={{
        background: 'white', borderRadius: 14, padding: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 96,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

// ─── Personal ─────────────────────────────────────────────────────────────────
function PersonalHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [meds, setMeds] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [vitals, setVitals] = useState<any[]>([])
  const [loadingMeds, setLoadingMeds] = useState(true)
  const firstName = user?.name?.split(' ')[0] || ''
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('personal_meds').select('id,name,dose,frequency,reminder_times').eq('user_id', user.id).order('name'),
      supabase.from('med_logs').select('med_id,status,logged_at').eq('user_id', user.id).eq('date', today),
      supabase.from('vitals').select('type,value,unit,measured_at').eq('user_id', user.id).order('measured_at', { ascending: false }).limit(4),
    ]).then(([{ data: m }, { data: l }, { data: v }]) => {
      setMeds(m ?? [])
      setLogs(l ?? [])
      setVitals(v ?? [])
      setLoadingMeds(false)
    })
  }, [user, supabase, today])

  const takenIds = new Set(logs.filter(l => l.status === 'taken').map(l => l.med_id))
  const totalSlots = meds.reduce((acc, m) => acc + (Array.isArray(m.reminder_times) ? m.reminder_times.length : 1), 0)
  const takenCount = meds.filter(m => takenIds.has(m.id)).length
  const pct = totalSlots > 0 ? Math.round(takenCount / totalSlots * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px' }}>

        {/* Medication tracking — real Supabase data */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Medicação hoje</div>
          {loadingMeds ? (
            <div style={{ background: 'white', borderRadius: 16, padding: '32px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#0d9488', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : meds.length === 0 ? (
            <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 16, padding: '32px 24px', border: '2px dashed #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💊</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Nenhum medicamento registado</div>
                <div style={{ fontSize: 13, color: '#0d9488', fontWeight: 600 }}>Adicionar medicamento →</div>
              </div>
            </Link>
          ) : (
            <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Adesão hoje</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                      {takenCount}<span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}> / {totalSlots} doses</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: pct === 100 ? '#059669' : '#0f172a', letterSpacing: '-0.03em' }}>{pct}%</div>
                </div>
                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#059669' : '#0d9488', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {meds.slice(0, 5).map(m => {
                    const taken = takenIds.has(m.id)
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: `2px solid ${taken ? '#059669' : '#e2e8f0'}`,
                          background: taken ? '#059669' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {taken && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                        </div>
                        <span style={{ fontSize: 13, color: taken ? '#94a3b8' : '#0f172a', fontWeight: taken ? 400 : 600, textDecoration: taken ? 'line-through' : 'none' }}>{m.name}</span>
                        {m.dose && <span style={{ fontSize: 12, color: '#94a3b8' }}>{m.dose}</span>}
                      </div>
                    )
                  })}
                  {meds.length > 5 && <div style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 30 }}>+{meds.length - 5} mais — ver todos</div>}
                </div>
              </div>
            </Link>
          )}
        </section>

        {/* Vitals — real Supabase data */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sinais vitais</div>
            <Link href="/vitals" style={{ fontSize: 12, color: '#e11d48', fontWeight: 600, textDecoration: 'none' }}>+ Registar</Link>
          </div>
          {vitals.length === 0 ? (
            <Link href="/vitals" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 14, padding: '22px', border: '2px dashed #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Sem medições registadas</div>
                <div style={{ fontSize: 13, color: '#e11d48', fontWeight: 600 }}>Registar primeira medição →</div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))', gap: 10 }}>
              {vitals.map((v, i) => (
                <Link key={i} href="/vitals" style={{ textDecoration: 'none' }} className="ic-card">
                  <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #f1f5f9', transition: 'transform 0.12s, box-shadow 0.12s' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{v.type || 'Medição'}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                      {v.value}
                      {v.unit && <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}> {v.unit}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>{new Date(v.measured_at).toLocaleDateString('pt-PT')}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Tools */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Ferramentas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.personal.map(a => <ToolCard key={a.href} {...a} color="#0d9488" />)}
          </div>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Caregiver ────────────────────────────────────────────────────────────────
function CaregiverHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const firstName = user?.name?.split(' ')[0] || ''

  useEffect(() => {
    if (!user?.id) return
    supabase.from('dependent_profiles').select('id,name,age,avatar').eq('caregiver_id', user.id).order('name')
      .then(({ data }) => { setProfiles(data ?? []); setLoading(false) })
  }, [user, supabase])

  return (
    <div style={{ minHeight: '100vh', background: '#fffbeb', paddingTop: 56 }}>
      <div style={{ background: 'white', borderBottom: '1px solid #fde68a', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#fef3c7' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b45309' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cuidador Familiar</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px' }}>

        {/* Family profiles — real Supabase data */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>A minha família</div>
            <Link href="/perfis" style={{ fontSize: 12, color: '#b45309', fontWeight: 600, textDecoration: 'none' }}>Gerir perfis →</Link>
          </div>
          {loading ? (
            <div style={{ background: 'white', borderRadius: 14, padding: '32px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fde68a', borderTopColor: '#b45309', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : profiles.length === 0 ? (
            <Link href="/perfis" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 16, padding: '32px 24px', border: '2px dashed #fde68a', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Nenhum familiar adicionado</div>
                <div style={{ fontSize: 13, color: '#b45309', fontWeight: 600 }}>Adicionar primeiro perfil →</div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
              {profiles.map(p => (
                <Link key={p.id} href={`/perfis/${p.id}`} style={{ textDecoration: 'none' }} className="ic-card">
                  <div style={{ background: 'white', borderRadius: 14, padding: '18px', border: '1px solid rgba(0,0,0,0.06)', transition: 'transform 0.12s, box-shadow 0.12s' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>
                      {p.avatar || '👤'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                    {p.age && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{p.age} anos</div>}
                  </div>
                </Link>
              ))}
              <Link href="/perfis" style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', borderRadius: 14, padding: '18px', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 112, cursor: 'pointer' }}>
                  <div style={{ fontSize: 24, color: '#94a3b8', marginBottom: 6 }}>+</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Adicionar</div>
                </div>
              </Link>
            </div>
          )}
        </section>

        {/* Tools */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Ferramentas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.caregiver.map(a => <ToolCard key={a.href} {...a} color="#b45309" />)}
          </div>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Clinical ─────────────────────────────────────────────────────────────────
function ClinicalHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const firstName = user?.name?.split(' ')[0] || ''
  const h = new Date().getHours()
  const shiftLabel = h < 8 ? 'Turno Noite (00:00–08:00)' : h < 20 ? 'Turno Dia (08:00–20:00)' : 'Turno Noite (20:00–08:00)'

  useEffect(() => {
    if (!user?.id) return
    const query = user.org_id
      ? supabase.from('patients').select('id,name,room,alerts_count').eq('org_id', user.org_id).order('name').limit(10)
      : supabase.from('patients').select('id,name,room,alerts_count').eq('created_by', user.id).order('name').limit(10)
    query.then(({ data }) => { setPatients(data ?? []); setLoading(false) })
  }, [user, supabase])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>
      {/* Dark shift banner */}
      <div style={{ background: '#0f172a', padding: '28px 24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{shiftLabel}</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px' }}>

        {/* Clinical tools — always visible */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Ferramentas clínicas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.clinical.map(a => <ToolCard key={a.href} {...a} color="#2563eb" />)}
          </div>
        </section>

        {/* Patients — real Supabase data */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Doentes</div>
            <Link href="/patients" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Ver todos →</Link>
          </div>
          {loading ? (
            <div style={{ background: 'white', borderRadius: 14, padding: '32px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : patients.length === 0 ? (
            <Link href="/patients" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 14, padding: '28px 24px', border: '2px dashed #dbeafe', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Nenhum doente registado</div>
                <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>Adicionar primeiro doente →</div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patients.map(p => (
                <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }} className="ic-card">
                  <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14, transition: 'transform 0.12s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                      {p.room && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Cama {p.room}</div>}
                    </div>
                    {p.alerts_count > 0 && (
                      <div style={{ background: '#fef2f2', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                        {p.alerts_count} alerta{p.alerts_count !== 1 ? 's' : ''}
                      </div>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </Link>
              ))}
              {patients.length >= 10 && (
                <Link href="/patients" style={{ textDecoration: 'none', textAlign: 'center', display: 'block', padding: '12px', fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                  Ver todos os doentes →
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .ic-card > div:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Student ──────────────────────────────────────────────────────────────────
// Flashcards are educational content, not user data — they are intentionally hardcoded.
const FLASHCARDS = [
  { q: 'Qual o mecanismo principal das estatinas?', a: 'Inibição competitiva da HMG-CoA redutase → ↓ síntese hepática de colesterol → ↑ expressão de LDL-R → ↓ LDL plasmático.' },
  { q: 'Porque é que a varfarina tem tantas interações?', a: 'Metabolizada pelo CYP2C9; inibe a vitamina K epóxido redutase. Qualquer indutor/inibidor do CYP2C9 ou alimento rico em vitamina K altera o INR.' },
  { q: 'O que é o efeito de primeira passagem?', a: 'Metabolismo pré-sistémico no intestino e fígado que reduz a biodisponibilidade oral. Ex: morfina oral tem biodisponibilidade ~25% vs 100% IV.' },
  { q: 'Para que serve o CKD-EPI?', a: 'Estima a taxa de filtração glomerular a partir da creatinina sérica, idade e sexo — usado para ajuste de dose em insuficiência renal.' },
  { q: 'O que é a janela terapêutica?', a: 'Intervalo entre dose mínima eficaz e dose mínima tóxica. Fármacos com janela estreita (varfarina, digoxina, lítio) requerem monitorização apertada.' },
  { q: 'O que são critérios STOPP/START?', a: 'STOPP = fármacos potencialmente inapropriados em idosos. START = fármacos que deveriam estar prescritos mas não estão. Ambos são ferramentas de otimização geriátrica.' },
  { q: 'O que significa semi-vida de eliminação?', a: 'Tempo necessário para que a concentração plasmática de um fármaco reduza 50%. Determina o intervalo de dosagem e o tempo para atingir estado de equilíbrio (~5 semividas).' },
]

function StudentHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const card = FLASHCARDS[new Date().getDate() % FLASHCARDS.length]
  const [revealed, setRevealed] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 4px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 🎓
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 72px' }}>

        {/* Flashcard — rotates daily, educational content */}
        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Flashcard do dia</div>
          <div style={{ background: 'white', borderRadius: 16, padding: '22px', border: '1px solid rgba(124,58,237,0.15)', boxShadow: '0 4px 16px rgba(124,58,237,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 18, lineHeight: 1.55 }}>{card.q}</div>
            {revealed ? (
              <div style={{ background: '#faf5ff', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#6d28d9', lineHeight: 1.7, borderLeft: '3px solid #7c3aed' }}>
                {card.a}
              </div>
            ) : (
              <button onClick={() => setRevealed(true)} style={{
                width: '100%', padding: '12px', background: '#7c3aed', border: 'none',
                borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Revelar resposta
              </button>
            )}
          </div>
        </section>

        {/* Study tools */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Ferramentas de estudo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.student.map(a => <ToolCard key={a.href} {...a} color="#7c3aed" />)}
          </div>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
      `}</style>
    </div>
  )
}

// ─── Auth guard ───────────────────────────────────────────────────────────────
function InicioContent() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!user.onboarded) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #e2e8f0', borderTopColor: '#0d6e42', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const mode = user.experience_mode || 'personal'
  if (mode === 'caregiver') return <CaregiverHome user={user} />
  if (mode === 'clinical')  return <ClinicalHome  user={user} />
  if (mode === 'student')   return <StudentHome   user={user} />
  return <PersonalHome user={user} />
}

export default function InicioPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <InicioContent />
    </Suspense>
  )
}
