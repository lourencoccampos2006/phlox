'use client'

// DailyBriefCard — PRO. "A tua saúde hoje": briefing diário gerado por IA a
// partir da medicação/adesão/vitais. Chama /api/daily-brief (que já existia mas
// não estava ligado a lado nenhum). Cache por dia em localStorage — não volta a
// gastar IA se já gerou hoje. Só Pro/Institucional.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'

interface Brief {
  greeting?: string; status_line?: string
  health_score?: number; health_score_label?: string
  insights?: { icon: string; text: string; type: string }[]
  today_focus?: string; encouragement?: string
}

const TYPE_BG: Record<string, string> = { positive: '#f0fdf4', warning: '#fffbeb', info: '#eff6ff', tip: '#faf5ff' }
const CACHE_KEY = 'phlox-daily-brief'

export default function DailyBriefCard() {
  const { user, supabase } = useAuth() as any
  const [brief, setBrief] = useState<Brief | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  const today = new Date().toISOString().slice(0, 10)

  // Carrega da cache do dia (sem gerar automaticamente — o utilizador decide).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) { const o = JSON.parse(raw); if (o.day === today && o.brief) { setBrief(o.brief); setOpen(true) } }
    } catch {}
  }, [today])

  if (!isPro) return null

  async function generate() {
    setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/daily-brief', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
      const j = await r.json()
      if (r.ok) {
        setBrief(j); setOpen(true)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ day: today, brief: j })) } catch {}
      }
    } finally { setBusy(false) }
  }

  if (!brief) {
    return (
      <button onClick={generate} disabled={busy} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: 'linear-gradient(135deg,#0d6e42,#0f766e)', border: 'none', borderRadius: 14,
        padding: '14px 16px', marginBottom: 18, cursor: busy ? 'default' : 'pointer', textAlign: 'left',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>✦ A tua saúde hoje</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{busy ? 'A preparar o teu briefing…' : 'Resumo inteligente do teu dia — toca para gerar'}</div>
        </div>
        {!busy && <span style={{ flexShrink: 0, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>Gerar</span>}
      </button>
    )
  }

  const score = brief.health_score ?? 0
  const scoreColor = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ background: 'white', border: '1px solid #e6ebf1', borderRadius: 14, padding: '16px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: open ? 12 : 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{brief.greeting || 'A tua saúde hoje'}</div>
          {brief.status_line && <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{brief.status_line}</div>}
        </div>
        {brief.health_score != null && (
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700 }}>{brief.health_score_label || '/10'}</div>
          </div>
        )}
      </div>

      {open && (
        <>
          {!!brief.insights?.length && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {brief.insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: TYPE_BG[ins.type] || '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ flexShrink: 0 }}>{ins.icon}</span>
                  <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          )}
          {brief.today_focus && (
            <div style={{ fontSize: 13, color: '#0f172a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', marginBottom: brief.encouragement ? 8 : 0 }}>
              <b>🎯 Hoje:</b> {brief.today_focus}
            </div>
          )}
          {brief.encouragement && <div style={{ fontSize: 12.5, color: '#64748b', fontStyle: 'italic' }}>{brief.encouragement}</div>}
        </>
      )}
      <button onClick={() => setOpen(o => !o)} style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: '#0d6e42', cursor: 'pointer' }}>
        {open ? '▲ Esconder' : '▼ Ver briefing'}
      </button>
    </div>
  )
}
