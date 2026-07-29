'use client'

// app/adherencia/page.tsx — Adesão à medicação: padrões reais, não só "hoje".
//
// REESCRITO 2026-07-29. A versão anterior mantinha uma tabela paralela
// (`adherence_records`) com o seu próprio registo manual de "Tomei/Não
// tomei" — completamente desligada do que /mymeds já regista em `med_logs`
// sempre que alguém toca em "Tomar"/"Ignorar". Resultado: era preciso
// registar tudo OUTRA VEZ aqui para a página ter dados, e a página nunca
// esteve ligada a nenhum menu (só aparecia na pesquisa Cmd+K) — órfã, com uma
// fonte de dados fantasma.
//
// Esta versão só LÊ o que já existe (personal_meds.reminder_times + med_logs)
// e calcula padrões reais sobre várias semanas: que dia da semana falha mais,
// que período do dia falha mais, sequência atual sem falhas, e um "insight"
// por padrão detetado — sem julgar, só descrever e sugerir uma ação concreta.
// Ver lib/adherence.ts para o motor determinístico partilhado.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { computeAdherenceOverview, type AdherenceMed, type AdherenceLog, type AdherenceOverview } from '@/lib/adherence'

const WINDOW_DAYS = 28

function Bar({ pct, tone }: { pct: number | null; tone: 'good' | 'warn' | 'bad' | 'flat' }) {
  const color = tone === 'good' ? '#0d6e42' : tone === 'warn' ? '#d97706' : tone === 'bad' ? '#dc2626' : 'var(--border-2)'
  return (
    <div style={{ width: '100%', height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct ?? 0}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function toneFor(rate: number | null): 'good' | 'warn' | 'bad' | 'flat' {
  if (rate == null) return 'flat'
  if (rate >= 85) return 'good'
  if (rate >= 60) return 'warn'
  return 'bad'
}

export default function AdherenciaPage() {
  const { user, supabase } = useAuth() as any
  const [meds, setMeds] = useState<AdherenceMed[]>([])
  const [logs, setLogs] = useState<AdherenceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const since = new Date(Date.now() - (WINDOW_DAYS + 3) * 86400000).toISOString().slice(0, 10)
    const [{ data: medsData, error: medsErr }, { data: logsData, error: logsErr }] = await Promise.all([
      supabase.from('personal_meds').select('id, name, reminder_times, created_at').eq('user_id', user.id).eq('active', true),
      supabase.from('med_logs').select('med_id, date, logged_at, status').eq('user_id', user.id).gte('date', since),
    ])
    if (medsErr || logsErr) setErr('Não foi possível carregar os teus dados agora. Tenta de novo.')
    setMeds((medsData || []) as AdherenceMed[])
    setLogs((logsData || []) as AdherenceLog[])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const overview: AdherenceOverview = computeAdherenceOverview(meds, logs, WINDOW_DAYS)

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }
  const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 5 }}>Adesão à medicação</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-4)', maxWidth: 560, lineHeight: 1.5 }}>
            Padrões das últimas {WINDOW_DAYS} dias a partir do que já regista em <Link href="/mymeds" style={{ color: 'var(--green)', fontWeight: 700 }}>Os meus comprimidos</Link> — sem nada para preencher aqui.
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {loading && <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />}
        {err && <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', fontSize: 13, marginBottom: 14 }}>{err}</div>}

        {!loading && !err && meds.length === 0 && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Ainda sem medicamentos registados</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>Adiciona a tua medicação para começares a ver padrões de adesão.</div>
            <Link href="/mymeds" style={{ padding: '10px 20px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              Adicionar medicamentos →
            </Link>
          </div>
        )}

        {!loading && !err && meds.length > 0 && !overview.hasSchedule && (
          <div style={{ ...card, textAlign: 'center', padding: '40px 24px', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Falta definir horários</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Sem horários de toma definidos não há como saber o que foi cumprido e o que faltou. Define os horários em Os meus comprimidos — é isso que alimenta esta página.
            </div>
            <Link href="/mymeds" style={{ padding: '10px 20px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              Definir horários →
            </Link>
          </div>
        )}

        {!loading && !err && overview.hasSchedule && overview.daysWithData < 3 && (
          <div style={{ ...card, marginBottom: 16, fontSize: 13, color: 'var(--ink-4)' }}>
            Ainda há poucos dias de registo — os padrões ficam mais fiáveis a partir de uma semana. Continua a marcar as tomas em <Link href="/mymeds" style={{ color: 'var(--green)', fontWeight: 700 }}>Os meus comprimidos</Link>.
          </div>
        )}

        {!loading && !err && overview.hasSchedule && overview.totalSlots > 0 && (
          <>
            {/* Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={card}>
                <div style={eyebrow}>Adesão global</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: overview.overallRate != null && overview.overallRate >= 85 ? '#0d6e42' : overview.overallRate != null && overview.overallRate >= 60 ? '#d97706' : '#dc2626' }}>
                  {overview.overallRate ?? '—'}{overview.overallRate != null ? '%' : ''}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>{overview.takenSlots}/{overview.totalSlots} tomas nos últimos {overview.windowDays} dias</div>
              </div>
              <div style={card}>
                <div style={eyebrow}>Sequência atual</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--ink)' }}>{overview.currentStreak}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>dia{overview.currentStreak === 1 ? '' : 's'} seguido{overview.currentStreak === 1 ? '' : 's'} sem falhas</div>
              </div>
              <div style={card}>
                <div style={eyebrow}>Melhor sequência</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--ink)' }}>{overview.bestStreak}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>dia{overview.bestStreak === 1 ? '' : 's'}, nos últimos {overview.windowDays}</div>
              </div>
            </div>

            {/* Insights */}
            {overview.insights.length > 0 && (
              <div style={{ ...card, marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 0' }}><div style={eyebrow}>O que os dados mostram</div></div>
                <div>
                  {overview.insights.map((ins, i) => {
                    const color = ins.tone === 'good' ? '#0d6e42' : ins.tone === 'warn' ? '#b45309' : 'var(--ink-3)'
                    const bg = ins.tone === 'good' ? '#f0fdf4' : ins.tone === 'warn' ? '#fffbeb' : 'var(--bg-2)'
                    return (
                      <div key={i} style={{ padding: '12px 20px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{ins.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.5 }}>{ins.detail}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Por dia da semana */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={eyebrow}>Por dia da semana</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overview.weekdayStats.map(w => (
                  <div key={w.weekday} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 84, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>{w.short}</div>
                    <div style={{ flex: 1 }}><Bar pct={w.rate} tone={toneFor(w.rate)} /></div>
                    <div style={{ width: 42, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>{w.rate != null ? `${w.rate}%` : '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por período do dia */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={eyebrow}>Por período do dia</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overview.timeStats.filter(t => t.total > 0).map(t => (
                  <div key={t.bucket} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 84, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>{t.label}</div>
                    <div style={{ flex: 1 }}><Bar pct={t.rate} tone={toneFor(t.rate)} /></div>
                    <div style={{ width: 42, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>{t.rate != null ? `${t.rate}%` : '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por medicamento */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={eyebrow}>Por medicamento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overview.perMed.map(m => (
                  <div key={m.med_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 130, fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>{m.name}</div>
                    <div style={{ flex: 1 }}><Bar pct={m.rate} tone={toneFor(m.rate)} /></div>
                    <div style={{ width: 42, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>{m.rate != null ? `${m.rate}%` : '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.6 }}>
              Uma toma conta como cumprida quando fica marcada "Tomado" em Os meus comprimidos, à hora certa. Sem julgamento — só para perceberes o teu próprio padrão.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
