'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

type Shift = 'manha' | 'tarde' | 'noite'

interface Patient {
  id: string; name: string; room_number?: string | null; age?: number | null
  risk_level?: string | null; fall_risk?: string | null; pressure_risk?: string | null
  admission_date?: string | null; active?: boolean
}
interface CareRec { patient_id: string; shift: Shift; date: string }
interface MarRec { patient_id: string; shift: Shift; date: string; status: string | null }
interface Incident { id: string; patient_id: string; type: string; severity: string; status: string; date: string }
interface TeamMember { id: string; name: string; role: string; status: string }

const INC_LABELS: Record<string, string> = {
  fall: 'Queda', medication_error: 'Erro med.', pressure_ulcer: 'Úlcera',
  behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Outro',
}
const ROLE_LABELS: Record<string, string> = {
  nurse: 'Enfermeiro(a)', caregiver: 'Ajudante', pharmacist: 'Farmacêutico(a)',
  doctor: 'Médico(a)', coordinator: 'Coordenador(a)', director: 'Diretor(a)', admin: 'Administrativo(a)',
}

function getToday() { return new Date().toISOString().slice(0, 10) }
function getShift(): Shift { const h = new Date().getHours(); if (h >= 7 && h < 14) return 'manha'; if (h >= 14 && h < 21) return 'tarde'; return 'noite' }
const SHIFT_LABEL: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const isHighRisk = (p: Patient) => ['CRITICO', 'ALTO'].includes((p.risk_level || '').toUpperCase()) || p.fall_risk === 'high' || p.pressure_risk === 'high'

function Ring({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const off = c - (Math.min(pct, 100) / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f3" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: color, fontFamily: 'var(--font-mono)' }}>{pct}%</text>
    </svg>
  )
}

export default function PainelPage() {
  const { user, supabase } = useAuth() as any
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [care, setCare] = useState<CareRec[]>([])
  const [mar, setMar] = useState<MarRec[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [totalBeds, setTotalBeds] = useState(30)

  const today = getToday()
  const shift = getShift()
  const month = today.slice(0, 7)

  useEffect(() => {
    const stored = localStorage.getItem('phlox-total-beds')
    if (stored) { const n = parseInt(stored); if (!isNaN(n)) setTotalBeds(n) }
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, c, m, i, t] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('care_records').select('patient_id,shift,date').eq('user_id', user.id).eq('date', today),
      supabase.from('mar_records').select('patient_id,shift,date,status').eq('user_id', user.id).eq('date', today),
      supabase.from('incidents').select('id,patient_id,type,severity,status,date').eq('user_id', user.id).neq('status', 'closed'),
      supabase.from('team_members').select('id,name,role,status').eq('user_id', user.id),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    setCare(c.data || [])
    setMar(m.data || [])
    setIncidents(i.data || [])
    setTeam(t.data || [])
    setLoading(false)
  }, [user, supabase, today])

  useEffect(() => { load() }, [load])

  const occupied = patients.filter(p => p.room_number).length
  const occupancyPct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0
  const onShift = team.filter(m => m.status === 'on_shift' || m.status === 'active').length
  const highRisk = patients.filter(isHighRisk)
  const careThisShift = new Set(care.filter(c => c.shift === shift).map(c => c.patient_id))
  const carePct = patients.length > 0 ? Math.round((careThisShift.size / patients.length) * 100) : 0
  const marAdministered = new Set(mar.filter(m => m.status === 'administered').map(m => m.patient_id))
  const marPct = patients.length > 0 ? Math.round((marAdministered.size / patients.length) * 100) : 0
  const admissionsMonth = patients.filter(p => (p.admission_date || '').slice(0, 7) === month).length
  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const roomOf = (id: string) => { const r = patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }

  const kpis = [
    { label: 'Ocupação', value: `${occupied}/${totalBeds}`, sub: `${occupancyPct}%`, color: occupancyPct >= 90 ? '#dc2626' : '#0d6e42', href: '/census' },
    { label: 'Equipa em serviço', value: onShift, sub: `de ${team.length}`, color: '#2563eb', href: '/schedule' },
    { label: 'Alto risco', value: highRisk.length, sub: 'residentes', color: highRisk.length > 0 ? '#dc2626' : '#16a34a', href: '/rounds' },
    { label: 'Ocorrências abertas', value: incidents.length, sub: 'por resolver', color: incidents.length > 0 ? '#dc2626' : '#16a34a', href: '/incidents' },
    { label: 'Admissões', value: admissionsMonth, sub: 'este mês', color: '#7c3aed', href: '/census' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Tempo real</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Painel do Lar</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: 'white', border: '1px solid var(--border)', borderRadius: 9 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Turno {SHIFT_LABEL[shift]}</span>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          {kpis.map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: k.color, lineHeight: 1 }}>{loading ? '—' : k.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{k.sub}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="painel-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Completion rings */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 16 }}>Conclusão do turno · {SHIFT_LABEL[shift]}</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <Ring pct={loading ? 0 : carePct} color="#2563eb" />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8 }}>Registos diários</div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{careThisShift.size}/{patients.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Ring pct={loading ? 0 : marPct} color="#0d6e42" />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8 }}>MAR administrado</div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{marAdministered.size}/{patients.length}</div>
              </div>
            </div>
          </div>

          {/* High risk */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Residentes de alto risco</span>
              <Link href="/rounds" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ronda →</Link>
            </div>
            {loading ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A carregar…</div>
              : highRisk.length === 0 ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>Nenhum residente sinalizado.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {highRisk.slice(0, 8).map(p => (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '6px 0', borderBottom: '1px solid #f6f7f9' }}>
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{roomOf(p.id)}</span>
                    </Link>
                  ))}
                </div>}
          </div>

          {/* Open incidents */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Ocorrências por resolver</span>
              <Link href="/incidents" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver →</Link>
            </div>
            {loading ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A carregar…</div>
              : incidents.length === 0 ? <div style={{ fontSize: 12, color: '#16a34a' }}>Sem ocorrências abertas.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {incidents.slice(0, 8).map(inc => (
                    <Link key={inc.id} href="/incidents" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', padding: '6px 0', borderBottom: '1px solid #f6f7f9' }}>
                      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{INC_LABELS[inc.type] || inc.type} · {nameOf(inc.patient_id)}</span>
                      <span style={{ fontSize: 11, color: inc.severity === 'critical' || inc.severity === 'major' ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                        {inc.severity === 'critical' ? 'Crítico' : inc.severity === 'major' ? 'Grave' : inc.severity === 'moderate' ? 'Moderado' : 'Ligeiro'}
                      </span>
                    </Link>
                  ))}
                </div>}
          </div>

          {/* Team on shift */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Equipa</span>
              <Link href="/schedule" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Escalas →</Link>
            </div>
            {loading ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A carregar…</div>
              : team.length === 0 ? <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>Sem equipa registada. <Link href="/schedule" style={{ color: '#2563eb' }}>Adicionar →</Link></div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {team.slice(0, 8).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f6f7f9' }}>
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{m.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{ROLE_LABELS[m.role] || m.role}</span>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 720px){ .painel-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
