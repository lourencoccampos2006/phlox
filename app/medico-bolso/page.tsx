'use client'

// /medico-bolso — Médico de bolso proativo.
// O Phlox olha sozinho para a tua medicação, sinais vitais e análises e diz-te
// o que merece atenção, em linguagem simples e com o que fazer a seguir.
// Não esperas que perguntes — ele avisa.

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'
type Sev = 'urgent' | 'attention' | 'info' | 'good'
interface Concern { id: string; severity: Sev; icon: string; title: string; detail: string; action?: { label: string; route: string } }
interface Resp { intro: string; concerns: Concern[]; summary: { urgent: number; attention: number; info: number }; hasData: boolean }

const SEV: Record<Sev, { border: string; bg: string; label: string; chip: string }> = {
  urgent:    { border: '#dc2626', bg: '#fef2f2', label: 'Urgente',  chip: '#dc2626' },
  attention: { border: '#d97706', bg: '#fffbeb', label: 'Atenção',  chip: '#b45309' },
  info:      { border: '#2563eb', bg: '#eff6ff', label: 'A saber',  chip: '#1d4ed8' },
  good:      { border: '#0d6e42', bg: '#f0fdf5', label: 'Tudo bem', chip: '#0d6e42' },
}

export default function MedicoBolsoPage() {
  const { user, supabase } = useAuth() as any
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<Resp | null>(null)
  const [err, setErr] = useState('')

  const analyse = useCallback(async () => {
    if (!user) { setErr('Inicia sessão para o Phlox poder olhar pela tua saúde.'); return }
    setBusy(true); setErr('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/companion', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token || ''}` }, body: '{}' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui analisar agora.')
      setData(j)
    } catch (e: any) { setErr(e.message || 'Erro.') } finally { setBusy(false) }
  }, [user, supabase])

  return (
    <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99' }}>Médico de bolso</div>
      <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>O Phlox olha por ti.</h1>
      <p style={{ color: '#6b7280', fontSize: 14.5, lineHeight: 1.6, marginBottom: 18 }}>Não precisas de perguntar nada. O Phlox vê a tua medicação, sinais vitais e análises e diz-te <b>o que merece atenção</b> — e o que fazer a seguir.</p>

      {!data && (
        <button onClick={analyse} disabled={busy} style={{ padding: '13px 24px', background: ACCENT, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'A olhar pela tua saúde…' : '🔍 Ver o que merece atenção'}
        </button>
      )}

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 12, borderRadius: 8, marginTop: 14, fontSize: 13 }}>{err}</div>}

      {data && (
        <>
          <div style={{ background: '#fafafa', border: '1px solid #ededed', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 15.5, color: '#16181d', lineHeight: 1.55 }}>{data.intro}</p>
            {(data.summary.urgent + data.summary.attention) > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {data.summary.urgent > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: SEV.urgent.chip, background: SEV.urgent.bg, padding: '3px 10px', borderRadius: 99 }}>{data.summary.urgent} urgente{data.summary.urgent > 1 ? 's' : ''}</span>}
                {data.summary.attention > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: SEV.attention.chip, background: SEV.attention.bg, padding: '3px 10px', borderRadius: 99 }}>{data.summary.attention} a precisar de atenção</span>}
              </div>
            )}
          </div>

          {!data.hasData && (
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 12, padding: 16, fontSize: 14, color: '#1e3a5f', lineHeight: 1.6 }}>
              Ainda não tenho dados suficientes sobre ti. Começa por adicionar a tua medicação ou registar a tua tensão — depois volto a olhar.
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Link href="/mymeds" style={{ color: ACCENT, fontWeight: 700, fontSize: 13.5 }}>Adicionar medicação →</Link>
                <Link href="/vitals" style={{ color: ACCENT, fontWeight: 700, fontSize: 13.5 }}>Registar sinais vitais →</Link>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {data.concerns.map(c => {
              const s = SEV[c.severity]
              return (
                <div key={c.id} style={{ background: s.bg, border: `1px solid ${s.border}33`, borderLeft: `4px solid ${s.border}`, borderRadius: 12, padding: '13px 15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#16181d', flex: 1 }}>{c.title}</span>
                    {c.severity !== 'good' && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.chip }}>{s.label}</span>}
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#3f3f46', lineHeight: 1.6 }}>{c.detail}</p>
                  {c.action && <Link href={c.action.route} style={{ fontSize: 13, fontWeight: 700, color: s.chip, textDecoration: 'none' }}>{c.action.label} →</Link>}
                </div>
              )
            })}
          </div>

          <button onClick={analyse} disabled={busy} style={{ display: 'block', marginTop: 16, background: 'none', border: 'none', color: '#8b8f99', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>{busy ? 'A atualizar…' : 'Voltar a verificar'}</button>

          <p style={{ marginTop: 16, fontSize: 11.5, color: '#a1a1aa', lineHeight: 1.55 }}>Informação de apoio com base nos teus dados no Phlox. Não substitui a avaliação do teu médico. Em emergência, liga 112.</p>
        </>
      )}
    </main>
  )
}
