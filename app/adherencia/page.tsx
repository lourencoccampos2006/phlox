'use client'

// ─── NOVO: app/adherencia/page.tsx ─── Phlox Adherência
// Monitor de adesão à terapêutica.
// 50% dos doentes crónicos não tomam a medicação correctamente.
// Causa 200.000 mortes/ano na Europa. €125 mil milhões em custos evitáveis.
// Nenhuma app resolveu isto — porque todas usam lembretes de alarme que as pessoas desligam.
//
// A abordagem do Phlox é diferente:
// 1. Identifica POR QUÊ a pessoa não adere (custo? efeitos adversos? esquecimento? incompreensão?)
// 2. Registo de toma com verificação de padrões ao longo do tempo
// 3. Score de adesão semanal com feedback accionável
// 4. Detecção automática de padrões problemáticos
// 5. Sugestões de estratégias adaptadas à causa real de não-adesão

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Med { id: string; name: string; dose: string | null; frequency: string | null }
interface TakeRecord { med_id: string; med_name: string; date: string; scheduled_time: string; taken: boolean; reason_skipped?: string; notes?: string }
interface AdherenceStats { med_id: string; med_name: string; total_scheduled: number; total_taken: number; rate: number; pattern?: string; risk: 'low' | 'medium' | 'high' }

const SKIP_REASONS = [
  { id: 'forgot',      label: 'Esqueci-me',         icon: '🧠' },
  { id: 'side_effect', label: 'Efeito adverso',      icon: '😣' },
  { id: 'cost',        label: 'Custo / sem stock',   icon: '💰' },
  { id: 'felt_well',   label: 'Senti-me bem',        icon: '💪' },
  { id: 'felt_bad',    label: 'Senti-me mal',        icon: '🤒' },
  { id: 'no_rx',       label: 'Sem receita',         icon: '📋' },
  { id: 'other',       label: 'Outro motivo',        icon: '❓' },
]

const SCHEDULE_SLOTS = [
  { id: 'manha',  label: 'Manhã',  icon: '☀️', time: '08:00' },
  { id: 'almoco', label: 'Almoço', icon: '🌤',  time: '13:00' },
  { id: 'jantar', label: 'Jantar', icon: '🌆', time: '19:00' },
  { id: 'deitar', label: 'Deitar', icon: '🌙', time: '22:00' },
]

function AdherenceBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#0d6e42' : rate >= 60 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{rate}%</span>
    </div>
  )
}

function WeekCalendar({ records, medId }: { records: TakeRecord[]; medId: string }) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayRecords = records.filter(r => r.med_id === medId && r.date === dateStr)
    const taken = dayRecords.filter(r => r.taken).length
    const skipped = dayRecords.filter(r => !r.taken).length
    days.push({ date: dateStr, label: d.toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3), taken, skipped, total: dayRecords.length })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {days.map(day => (
        <div key={day.date} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 4 }}>{day.label}</div>
          <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, background: day.total === 0 ? 'var(--bg-3)' : day.taken === day.total ? '#d1fae5' : day.skipped > 0 ? '#fee2e2' : '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: day.date === new Date().toISOString().split('T')[0] ? '2px solid var(--ink)' : 'none' }}>
            {day.total === 0 ? '' : day.taken === day.total ? '✓' : day.skipped > 0 ? '✗' : '~'}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdherenciaPage() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<Med[]>([])
  const [records, setRecords] = useState<TakeRecord[]>([])
  const [stats, setStats] = useState<AdherenceStats[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'today' | 'history' | 'insights'>('today')
  const [logging, setLogging] = useState<{ medId: string; slot: string } | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [skipNotes, setSkipNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const plan = (user?.plan || 'free') as string

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: medsData }, { data: recordsData }] = await Promise.all([
      supabase.from('personal_meds').select('id, name, dose, frequency').eq('user_id', user.id),
      supabase.from('adherence_records').select('*').eq('user_id', user.id)
        .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: false }),
    ])
    setMeds(medsData || [])
    setRecords(recordsData || [])

    // Calculate stats
    const s: AdherenceStats[] = (medsData || []).map((med: Med) => {
      const medRecords = (recordsData || []).filter((r: TakeRecord) => r.med_id === med.id)
      const taken = medRecords.filter((r: TakeRecord) => r.taken).length
      const total = medRecords.length
      const rate = total > 0 ? Math.round((taken / total) * 100) : 100

      // Detect patterns
      const skipReasons = medRecords.filter((r: TakeRecord) => !r.taken && r.reason_skipped).map((r: TakeRecord) => r.reason_skipped!)
      const mostCommon = skipReasons.sort((a, b) => skipReasons.filter(x => x === b).length - skipReasons.filter(x => x === a).length)[0]

      return {
        med_id: med.id, med_name: med.name,
        total_scheduled: total, total_taken: taken, rate,
        pattern: mostCommon,
        risk: rate >= 80 ? 'low' : rate >= 60 ? 'medium' : 'high',
      }
    })
    setStats(s)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const logTake = async (medId: string, slot: string, taken: boolean) => {
    if (!user) return
    setSaving(true)
    const med = meds.find(m => m.id === medId)
    await supabase.from('adherence_records').upsert({
      user_id: user.id, med_id: medId, med_name: med?.name || '',
      date: today, scheduled_time: slot, taken,
      reason_skipped: !taken ? skipReason || null : null,
      notes: skipNotes || null,
    }, { onConflict: 'user_id,med_id,date,scheduled_time' })
    setLogging(null); setSkipReason(''); setSkipNotes('')
    await load()
    setSaving(false)
  }

  const overallRate = stats.length > 0
    ? Math.round(stats.reduce((a, s) => a + s.rate, 0) / stats.length)
    : 100

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  const riskLabel = (skip: string) => {
    const r = SKIP_REASONS.find(r => r.id === skip)
    return r ? `${r.icon} ${r.label}` : skip
  }

  const getInsight = (s: AdherenceStats): { title: string; action: string; color: string } => {
    if (s.rate >= 90) return { title: 'Adesão excelente', action: 'Continua assim!', color: '#0d6e42' }
    if (s.pattern === 'forgot') return { title: 'Esquecimento frequente', action: 'Associa a toma a uma rotina diária (refeição, escovar dentes)', color: '#d97706' }
    if (s.pattern === 'side_effect') return { title: 'Possível efeito adverso', action: 'Discute com o farmacêutico — pode haver alternativa ou hora diferente', color: '#dc2626' }
    if (s.pattern === 'cost') return { title: 'Custo ou acesso', action: 'Verifica se há genérico disponível — pode poupar até 80%', color: '#7c3aed' }
    if (s.pattern === 'felt_well') return { title: 'Para quando se sente bem', action: 'A maioria dos fármacos crónicas precisam de ser tomados mesmo sem sintomas', color: '#b45309' }
    if (s.rate < 60) return { title: 'Adesão baixa — risco clínico', action: 'Fala com o teu médico ou farmacêutico — pode haver solução', color: '#dc2626' }
    return { title: 'Adesão moderada', action: 'Tenta estabelecer uma rotina consistente', color: '#d97706' }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox Adherência</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 3 }}>Monitor de Adesão</div>
              {stats.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: overallRate >= 80 ? '#0d6e42' : overallRate >= 60 ? '#d97706' : '#dc2626' }}>{overallRate}%</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>adesão global esta semana</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            <button onClick={() => setTab('today')} style={tabStyle('today')}>Hoje</button>
            <button onClick={() => setTab('history')} style={tabStyle('history')}>Histórico</button>
            <button onClick={() => setTab('insights')} style={tabStyle('insights')}>Insights</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* HOJE */}
        {tab === 'today' && (
          <div>
            {meds.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Sem medicamentos registados</div>
                <Link href="/mymeds" style={{ padding: '10px 20px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                  Adicionar medicamentos →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SCHEDULE_SLOTS.map(slot => {
                  const slotRecords = records.filter(r => r.date === today && r.scheduled_time === slot.id)
                  return (
                    <div key={slot.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 18 }}>{slot.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{slot.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{slot.time}</span>
                      </div>
                      {meds.map((med, i) => {
                        const rec = slotRecords.find(r => r.med_id === med.id)
                        const isLogging = logging?.medId === med.id && logging?.slot === slot.id
                        return (
                          <div key={med.id} style={{ padding: '12px 16px', borderBottom: i < meds.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{med.name}</div>
                                {med.dose && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.dose}</div>}
                              </div>
                              {rec ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <span style={{ fontSize: 18 }}>{rec.taken ? '✅' : '❌'}</span>
                                  <span style={{ fontSize: 11, color: rec.taken ? '#0d6e42' : '#dc2626', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                    {rec.taken ? 'Tomado' : rec.reason_skipped ? riskLabel(rec.reason_skipped) : 'Não tomado'}
                                  </span>
                                  <button onClick={() => supabase.from('adherence_records').delete().eq('user_id', user?.id).eq('med_id', med.id).eq('date', today).eq('scheduled_time', slot.id).then(() => load())}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 14, padding: 2 }}>×</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  <button onClick={() => logTake(med.id, slot.id, true)}
                                    style={{ padding: '7px 14px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                                    ✓ Tomei
                                  </button>
                                  <button onClick={() => setLogging({ medId: med.id, slot: slot.id })}
                                    style={{ padding: '7px 12px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                                    ✗ Não tomei
                                  </button>
                                </div>
                              )}
                            </div>
                            {isLogging && (
                              <div style={{ marginTop: 10, padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Porquê não tomaste?</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {SKIP_REASONS.map(r => (
                                    <button key={r.id} onClick={() => setSkipReason(r.id)}
                                      style={{ padding: '5px 10px', border: `1.5px solid ${skipReason === r.id ? '#dc2626' : '#fca5a5'}`, borderRadius: 6, background: skipReason === r.id ? '#fee2e2' : 'white', cursor: 'pointer', fontSize: 11, fontWeight: skipReason === r.id ? 700 : 400, color: '#991b1b', fontFamily: 'var(--font-sans)' }}>
                                      {r.icon} {r.label}
                                    </button>
                                  ))}
                                </div>
                                <input value={skipNotes} onChange={e => setSkipNotes(e.target.value)}
                                  placeholder="Nota opcional..."
                                  style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 8 }} />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => logTake(med.id, slot.id, false)} disabled={saving}
                                    style={{ padding: '7px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                                    Registar
                                  </button>
                                  <button onClick={() => setLogging(null)}
                                    style={{ padding: '7px 10px', background: 'white', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* HISTÓRICO */}
        {tab === 'history' && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Últimos 7 dias</div>
            {stats.map(s => (
              <div key={s.med_id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{s.med_name}</div>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.risk === 'low' ? '#0d6e42' : s.risk === 'medium' ? '#d97706' : '#dc2626', background: s.risk === 'low' ? '#d1fae5' : s.risk === 'medium' ? '#fef9c3' : '#fee2e2', border: `1px solid ${s.risk === 'low' ? '#6ee7b7' : s.risk === 'medium' ? '#fde68a' : '#fca5a5'}`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {s.risk === 'low' ? 'BOM' : s.risk === 'medium' ? 'ATENÇÃO' : 'RISCO'}
                  </span>
                </div>
                <AdherenceBar rate={s.rate} />
                <div style={{ marginTop: 10 }}>
                  <WeekCalendar records={records} medId={s.med_id} />
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  {s.total_taken}/{s.total_scheduled} doses registadas nos últimos 30 dias
                </div>
              </div>
            ))}
          </div>
        )}

        {/* INSIGHTS */}
        {tab === 'insights' && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: 10, padding: '20px 22px', marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Análise de adesão · Últimos 30 dias</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: '#f8fafc', lineHeight: 1, marginBottom: 4 }}>{overallRate}%</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {overallRate >= 80 ? 'Excelente — mantém a consistência.' : overallRate >= 60 ? 'Moderada — há espaço para melhorar.' : 'Baixa — o tratamento pode não estar a funcionar.'}
              </div>
            </div>

            {stats.map(s => {
              const insight = getInsight(s)
              return (
                <div key={s.med_id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{s.med_name}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: insight.color, flexShrink: 0 }}>{s.rate}%</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: `${insight.color}10`, border: `1px solid ${insight.color}30`, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: insight.color, marginBottom: 4 }}>{insight.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>→ {insight.action}</div>
                  </div>
                  {s.pattern && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                      Razão mais frequente: {riskLabel(s.pattern)}
                    </div>
                  )}
                </div>
              )
            })}

            {stats.length > 0 && (
              <div style={{ padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, fontSize: 13, color: 'var(--green-2)', lineHeight: 1.7 }}>
                💡 <strong>Sabia que?</strong> Uma adesão abaixo de 80% pode significar que o tratamento não está a funcionar como deveria, mesmo que os exames mostrem valores normais durante as consultas.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}