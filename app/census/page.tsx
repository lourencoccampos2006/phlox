'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Patient {
  id: string
  name: string
  age?: number
  sex?: string
  room_number?: string
  admission_date?: string
  conditions?: string
}

interface Room {
  number: string
  capacity: number
  resident?: Patient
  status: 'occupied' | 'available' | 'maintenance' | 'reserved'
}

const STATUS_CFG = {
  occupied:    { label: 'Ocupado',      color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  available:   { label: 'Disponível',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  maintenance: { label: 'Manutenção',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  reserved:    { label: 'Reservado',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}

export default function CensusPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'map' | 'list' | 'admissions'>('map')
  const [filter, setFilter] = useState<'all' | 'occupied' | 'available'>('all')

  // Room config — persisted locally per device
  const [totalBeds, setTotalBeds] = useState(30)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('phlox-total-beds')
    if (stored) { const n = parseInt(stored); if (!isNaN(n)) setTotalBeds(n) }
  }, [])
  const updateTotalBeds = (n: number) => {
    setTotalBeds(n)
    try { localStorage.setItem('phlox-total-beds', String(n)) } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
    setPatients(data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  // Normalize room number for comparison: "q3", "Q3", "3", "03" all → "3"
  const normalizeRoom = (r: string) => r.replace(/^[qQ]/, '').replace(/^0+/, '') || r

  // Build room map
  const occupiedRooms = new Set(patients.filter(p => p.room_number).map(p => normalizeRoom(p.room_number!)))
  const patientByRoom: Record<string, Patient> = {}
  patients.forEach(p => { if (p.room_number) patientByRoom[normalizeRoom(p.room_number)] = p })

  // Generate room grid (1..totalBeds) OR use actual room numbers from patients if they don't fit the numeric range
  const rooms: Room[] = Array.from({ length: totalBeds }, (_, i) => {
    const num = String(i + 1)
    const resident = patientByRoom[num]
    return {
      number: num,
      capacity: 1,
      resident,
      status: resident ? 'occupied' : 'available',
    }
  })

  // Add rooms for patients whose room_number doesn't fit in the numeric grid
  const extraPatients = patients.filter(p => {
    if (!p.room_number) return false
    const n = parseInt(normalizeRoom(p.room_number))
    return isNaN(n) || n > totalBeds
  })
  const extraRooms: Room[] = extraPatients.map(p => ({
    number: p.room_number!,
    capacity: 1,
    resident: p,
    status: 'occupied' as const,
  }))

  const stats = {
    total: totalBeds,
    occupied: occupiedRooms.size,
    available: totalBeds - occupiedRooms.size,
    occupancyPct: totalBeds > 0 ? Math.round((occupiedRooms.size / totalBeds) * 100) : 0,
    withoutRoom: patients.filter(p => !p.room_number).length,
    totalResidents: patients.length,
  }

  const allRooms = [...rooms, ...extraRooms]
  const filtered = filter === 'all' ? allRooms : filter === 'occupied' ? allRooms.filter(r => r.status === 'occupied') : allRooms.filter(r => r.status === 'available')

  // Admissions sorted by date
  const recentAdmissions = [...patients].filter(p => p.admission_date).sort((a, b) => (b.admission_date || '').localeCompare(a.admission_date || ''))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Lar</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Ocupação e Censo</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowConfig(!showConfig)} style={{ padding: '9px 14px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              Configurar
            </button>
            <Link href="/patients" style={{ padding: '9px 16px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              + Admitir residente
            </Link>
          </div>
        </div>

        {showConfig && (
          <div style={{ background: 'white', border: '1.5px solid #3b82f6', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total de camas/quartos</div>
            <input type="number" value={totalBeds} onChange={e => updateTotalBeds(parseInt(e.target.value) || 30)} min={1} max={500}
              style={{ width: 80, border: '1.5px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Guardado neste dispositivo.</span>
            <button onClick={() => setShowConfig(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-4)', marginLeft: 'auto' }}>×</button>
          </div>
        )}

        {/* Occupancy bar */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Taxa de Ocupação</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: stats.occupancyPct >= 90 ? '#dc2626' : stats.occupancyPct >= 70 ? '#d97706' : '#16a34a', lineHeight: 1 }}>{stats.occupancyPct}%</span>
                <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{stats.occupied}/{stats.total} camas</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { v: stats.occupied, l: 'Ocupadas', c: '#1d4ed8', bg: '#eff6ff' },
                { v: stats.available, l: 'Disponíveis', c: '#16a34a', bg: '#f0fdf4' },
                { v: stats.withoutRoom, l: 'Sem quarto', c: '#d97706', bg: '#fffbeb' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center', background: s.bg, borderRadius: 8, padding: '8px 14px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 12, background: 'var(--bg-2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stats.occupancyPct}%`, background: stats.occupancyPct >= 90 ? '#dc2626' : stats.occupancyPct >= 70 ? '#f59e0b' : '#22c55e', borderRadius: 6, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['map', 'list', 'admissions'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '7px 14px', borderRadius: 7, border: `1.5px solid ${view === v ? '#1d4ed8' : 'var(--border)'}`, background: view === v ? '#eff6ff' : 'white', color: view === v ? '#1d4ed8' : 'var(--ink-4)', fontSize: 12, fontWeight: view === v ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {v === 'map' ? 'Mapa de Quartos' : v === 'list' ? 'Lista de Residentes' : 'Admissões'}
            </button>
          ))}
          {view === 'map' && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              {(['all', 'occupied', 'available'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${filter === f ? '#1d4ed8' : 'var(--border)'}`, background: filter === f ? '#eff6ff' : 'white', color: filter === f ? '#1d4ed8' : 'var(--ink-4)', fontSize: 11, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {f === 'all' ? 'Todos' : f === 'occupied' ? 'Ocupados' : 'Livres'}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
          </div>
        ) : view === 'map' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
            {filtered.map(room => {
              const sc = STATUS_CFG[room.status]
              return (
                <div key={room.number} style={{ background: sc.bg, border: `1.5px solid ${sc.border}`, borderRadius: 10, padding: '10px 12px', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sc.color }}>Q{room.number}</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                  </div>
                  {room.resident ? (
                    <div>
                      <Link href={`/patients/${room.resident.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{room.resident.name}</div>
                      </Link>
                      {room.resident.age && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', marginTop: 2 }}>{room.resident.age}a</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: sc.color, fontWeight: 500 }}>{sc.label}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {patients.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🏠</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Sem residentes registados</div>
                <Link href="/patients" style={{ fontSize: 13, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>Adicionar primeiro residente →</Link>
              </div>
            ) : patients.map(p => (
              <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                      {p.age ? `${p.age} anos` : ''}
                      {p.room_number ? ` · Q${p.room_number}` : ' · Sem quarto'}
                      {p.conditions ? ` · ${p.conditions.split(',')[0].trim()}` : ''}
                    </div>
                  </div>
                  {p.room_number ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 5 }}>Q{p.room_number}</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 9px', borderRadius: 5 }}>Sem quarto</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Admissions timeline */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {recentAdmissions.length} residentes com data de admissão registada
            </div>
            {recentAdmissions.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sem datas de admissão registadas. Edita os residentes para adicionar.</div>
              </div>
            ) : recentAdmissions.map(p => {
              const admDate = p.admission_date ? new Date(p.admission_date + 'T12:00:00') : null
              const days = admDate ? Math.floor((Date.now() - admDate.getTime()) / 86400000) : null
              return (
                <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
                        {p.room_number ? `Q${p.room_number}` : 'Sem quarto'}{p.age ? ` · ${p.age}a` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                        {admDate ? admDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      {days !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 1 }}>{days}d internado</div>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
