'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import Link from 'next/link'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Folha, Vazio, ACarregar, Aviso, Campo, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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
  occupied:    { label: 'Ocupado',      color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)' },
  available:   { label: 'Disponível',   color: 'var(--green)', bg: 'var(--badge-green-bg)', border: 'var(--badge-green-border)' },
  maintenance: { label: 'Manutenção',   color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
  reserved:    { label: 'Reservado',    color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)' },
}

export default function CensusPage() {
  const { user, supabase } = useAuth()
  const scope = useOrgScope()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'map' | 'list' | 'admissions'>('map')
  const [filter, setFilter] = useState<'all' | 'occupied' | 'available'>('all')

  // Room config — persisted locally per device
  const [totalBeds, setTotalBeds] = useState(30)
  const largo = useLargo()
  const [showConfig, setShowConfig] = useState(false)

  // Estado manual de quartos vazios (manutenção/reservado) — por dispositivo
  const [roomOverrides, setRoomOverrides] = useState<Record<string, 'maintenance' | 'reserved'>>({})

  useEffect(() => {
    const stored = localStorage.getItem('phlox-total-beds')
    if (stored) { const n = parseInt(stored); if (!isNaN(n)) setTotalBeds(n) }
    try { const o = localStorage.getItem('phlox-room-overrides'); if (o) setRoomOverrides(JSON.parse(o)) } catch { /* ignore */ }
  }, [])
  const updateTotalBeds = (n: number) => {
    setTotalBeds(n)
    try { localStorage.setItem('phlox-total-beds', String(n)) } catch { /* ignore */ }
  }
  // Ciclo: disponível → manutenção → reservado → disponível (só para quartos vazios)
  const cycleRoomStatus = (num: string) => {
    setRoomOverrides(prev => {
      const cur = prev[num]
      const next = { ...prev }
      if (!cur) next[num] = 'maintenance'
      else if (cur === 'maintenance') next[num] = 'reserved'
      else delete next[num]
      try { localStorage.setItem('phlox-room-overrides', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await scope
      .filter(supabase.from('patients').select('*'))
      .order('name', { ascending: true })
    setPatients(data || [])
    setLoading(false)
  }, [user, supabase, scope.orgId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      status: resident ? 'occupied' : (roomOverrides[num] || 'available'),
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

  // contar overrides apenas em quartos vazios dentro do range
  const emptyOverrides = Object.entries(roomOverrides).filter(([num]) => {
    const n = parseInt(num); return !isNaN(n) && n <= totalBeds && !occupiedRooms.has(num)
  })
  const blocked = emptyOverrides.length  // manutenção + reservado
  const stats = {
    total: totalBeds,
    occupied: occupiedRooms.size,
    available: Math.max(0, totalBeds - occupiedRooms.size - blocked),
    occupancyPct: totalBeds > 0 ? Math.round((occupiedRooms.size / totalBeds) * 100) : 0,
    withoutRoom: patients.filter(p => !p.room_number).length,
    totalResidents: patients.length,
    blocked,
  }

  const allRooms = [...rooms, ...extraRooms]
  const filtered = filter === 'all' ? allRooms : filter === 'occupied' ? allRooms.filter(r => r.status === 'occupied') : allRooms.filter(r => r.status === 'available')

  // Admissions sorted by date
  const recentAdmissions = [...patients].filter(p => p.admission_date).sort((a, b) => (b.admission_date || '').localeCompare(a.admission_date || ''))

  /* A MOLDURA — refeita (2026-10-08).

     Tinha uma migalha «GESTÃO · LAR» e «Ocupação e Censo» em serifa de 30px
     por cima dos números — e a barra lateral já diz onde se está.

     O «Configurar» abria um cartão que EMPURRAVA a página inteira para
     baixo. Mudar o número de camas faz-se uma vez; ler a ocupação faz-se
     todos os dias. O que se faz uma vez não mexe no que se lê sempre. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Ocupação</span>

          <span style={{
            ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
            color: stats.occupancyPct >= 90 ? 'var(--red)' : stats.occupancyPct >= 70 ? 'var(--amber)' : 'var(--green)',
          }}>{stats.occupied}/{stats.total} · {stats.occupancyPct}%</span>
          {stats.withoutRoom > 0 && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
              {stats.withoutRoom} SEM QUARTO
            </span>
          )}

          <Seletor
            opcoes={[
              { id: 'map', rotulo: 'Mapa' },
              { id: 'list', rotulo: `Residentes ${patients.length}` },
              { id: 'admissions', rotulo: 'Admissões' },
            ]}
            ativa={view} aoMudar={v => setView(v as typeof view)} />

          {view === 'map' && (
            <Seletor
              opcoes={[
                { id: 'all', rotulo: 'Todos' },
                { id: 'occupied', rotulo: 'Ocupados' },
                { id: 'available', rotulo: 'Livres' },
              ]}
              ativa={filter} aoMudar={v => setFilter(v as typeof filter)} />
          )}

          <span style={{ display: 'inline-flex', gap: 6, marginLeft: largo ? 'auto' : undefined }}>
            <Botao onClick={() => setShowConfig(true)}>CONFIGURAR</Botao>
            <Botao feitio="principal" onClick={() => { window.location.href = '/patients' }}>ADMITIR</Botao>
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>Disponível</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>Sem quarto atribuído</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Bloqueada</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Um quarto vazio alterna de estado ao toque
          </span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            O total de camas é desta conta, não sai da ficha de ninguém
          </span>
        </BarraDeEstado>
      }
    >
        {showConfig && (
          <Folha titulo="Quantas camas tem a casa" aoFechar={() => setShowConfig(false)}>
            <Campo rotulo="Total de camas ou quartos" para="census-camas"
              ajuda="Guardado neste dispositivo — é o denominador da taxa de ocupação, não um dado da casa partilhado com a equipa.">
              <input id="census-camas" type="number" value={totalBeds} min={1} max={500}
                onChange={e => updateTotalBeds(parseInt(e.target.value) || 30)}
                style={{ ...CAIXA, width: 120 }} />
            </Campo>
          </Folha>
        )}

        {/* A OCUPAÇÃO — o que sobra depois de a barra de trabalho já dizer
            os números. Era um painel de 190px com «TAXA DE OCUPAÇÃO 0%
            0/30 camas» e três mosaicos a repetir o que está lá em cima.

            Fica só a proporção desenhada, que é a única coisa aqui que um
            número não faz: vê-se se a casa está cheia sem ler nada. */}
        <div style={{
          height: 10, background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)', overflow: 'hidden', display: 'flex', marginBottom: 12,
        }}>
          <div style={{
            width: `${stats.occupancyPct}%`, transition: 'width .5s ease',
            background: stats.occupancyPct >= 90 ? 'var(--red)' : stats.occupancyPct >= 70 ? 'var(--amber)' : 'var(--green)',
          }} />
          {stats.blocked > 0 && (
            <div style={{ width: `${Math.round(stats.blocked / Math.max(1, stats.total) * 100)}%`, background: 'var(--red)', opacity: .35 }} />
          )}
        </div>

        {/* Os dois grupos de separadores subiram para a barra de trabalho. */}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
            {Array.from({ length: 30 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--r-sm)' }} />)}
          </div>
        ) : view === 'map' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: 5 }}>
            {filtered.map(room => {
              const sc = STATUS_CFG[room.status]
              const empty = !room.resident
              return (
                <div key={room.number}
                  onClick={empty ? () => cycleRoomStatus(room.number) : undefined}
                  onKeyDown={empty ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleRoomStatus(room.number) } } : undefined}
                  role={empty ? 'button' : undefined}
                  tabIndex={empty ? 0 : undefined}
                  aria-label={empty ? `Quarto ${room.number} — alternar estado` : undefined}
                  title={empty ? 'Tocar para alternar: Disponível → Manutenção → Reservado' : undefined}
                  /* ERA UM CARTÃO DE 120px a repetir «tocar p/ alterar» em cada
                     um dos trinta quartos. Um mapa de quartos é um MAPA: lê-se
                     de relance, por cor e por número. A instrução diz-se uma
                     vez, na barra de estado. */
                  style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 'var(--r-sm)', padding: '5px 7px', minHeight: 'var(--alvo)', display: 'flex', flexDirection: 'column', gap: 2, cursor: empty ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: sc.color }}>Q{room.number}</span>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                  </div>
                  {room.resident ? (
                    <Link href={`/patients/${room.resident.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                        lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                      }}>{room.resident.name}</div>
                    </Link>
                  ) : (
                    /* Um quarto disponível não precisa de dizer «disponível»:
                       a cor já o diz, e a legenda em baixo nomeia a cor. Só
                       manutenção e reserva — que são excepções — se escrevem. */
                    room.status !== 'available' && (
                      <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: sc.color }}>{sc.label}</div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {patients.length === 0 ? (
              <Painel>
                <Vazio titulo="Sem residentes registados."
                  oQueFazer="Enquanto não houver ninguém na casa, o mapa mostra todos os quartos livres."
                  acao={<Link href="/patients" style={{ textDecoration: 'none' }}><Botao feitio="principal">ADICIONAR O PRIMEIRO</Botao></Link>} />
              </Painel>
            ) : patients.map(p => (
              <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                      {p.age ? `${p.age} anos` : ''}
                      {p.room_number ? ` · Q${p.room_number}` : ' · Sem quarto'}
                      {p.conditions ? ` · ${p.conditions.split(',')[0].trim()}` : ''}
                    </div>
                  </div>
                  {p.room_number ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 'var(--r)' }}>Q{p.room_number}</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--amber)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', padding: '3px 9px', borderRadius: 'var(--r)' }}>Sem quarto</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Admissions timeline */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {recentAdmissions.length} residentes com data de admissão registada
            </div>
            {recentAdmissions.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>Sem datas de admissão registadas. Edita os residentes para adicionar.</div>
              </div>
            ) : recentAdmissions.map(p => {
              const admDate = p.admission_date ? new Date(p.admission_date + 'T12:00:00') : null
              const days = admDate ? Math.floor((Date.now() - admDate.getTime()) / 86400000) : null
              return (
                <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)', marginTop: 2 }}>
                        {p.room_number ? `Q${p.room_number}` : 'Sem quarto'}{p.age ? ` · ${p.age}a` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>
                        {admDate ? admDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      {days !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 1 }}>{days}d internado</div>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
    </Mesa>
  )
}
