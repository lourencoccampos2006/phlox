'use client'

// PatientSummaryButton — PRO. Gera um resumo clínico do perfil/doente ATIVO
// num clique e guarda-o no histórico dessa pessoa (lib/saves). Mostra o resultado
// inline. Aparece nas ferramentas clínicas individuais e no painel.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'
import { save } from '@/lib/saves'
import { useToast } from '@/components/Toast'

interface Summary {
  profile_line?: string; overview?: string
  watch_for?: { level: string; text: string }[]
  interactions?: string[]; suggestions?: string[]; disclaimer?: string
}

const LVL: Record<string, { c: string; bg: string; b: string }> = {
  alta:  { c: '#991b1b', bg: '#fef2f2', b: '#fca5a5' },
  média: { c: '#92400e', bg: '#fffbeb', b: '#fde68a' },
  baixa: { c: '#1e40af', bg: '#eff6ff', b: '#bfdbfe' },
}

export default function PatientSummaryButton({ compact = false }: { compact?: boolean }) {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Summary | null>(null)
  const [err, setErr] = useState('')

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  if (!isPro) return null

  async function generate() {
    const ap = getActiveProfile()
    if (!ap) { setErr('Escolhe primeiro a pessoa no seletor de perfil.'); return }
    setBusy(true); setErr(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/patient-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ profileId: ap.id, profileType: ap.type, name: ap.name, age: ap.age, sex: ap.sex, conditions: ap.conditions, allergies: ap.allergies }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setResult(j)
      const profileName = ap.type === 'self' ? `Eu (${ap.name.split(' ')[0]})` : ap.name
      save({
        kind: 'briefing',
        title: `Resumo clínico — ${ap.name}`,
        preview: j.overview?.slice(0, 160),
        data: j,
        href: '/painel',
        profileId: ap.id, profileName, profileType: ap.type,
      })
      toast.success('Resumo guardado', `No histórico de ${profileName}.`)
    } catch (e: any) {
      setErr(e.message || 'Não foi possível gerar o resumo.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: compact ? 8 : 12 }}>
      <button onClick={generate} disabled={busy} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: compact ? '8px 14px' : '10px 16px', borderRadius: 10,
        background: busy ? '#94a3b8' : '#0d6e42', color: 'white', border: 'none',
        fontSize: 13.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)',
      }}>
        ✦ {busy ? 'A gerar resumo…' : 'Resumo clínico (Pro)'}
      </button>
      {err && <div style={{ marginTop: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}

      {result && (
        <div style={{ marginTop: 12, background: 'white', border: '1px solid #e6ebf1', borderRadius: 12, padding: '14px 16px' }}>
          {result.profile_line && <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 8 }}>{result.profile_line}</div>}
          {result.overview && <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6, margin: '0 0 12px' }}>{result.overview}</p>}

          {!!result.watch_for?.length && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>O que vigiar</div>
              {result.watch_for.map((w, i) => {
                const s = LVL[w.level] || LVL.baixa
                return <div key={i} style={{ background: s.bg, border: `1px solid ${s.b}`, color: s.c, borderRadius: 8, padding: '7px 10px', fontSize: 13, marginBottom: 5 }}><b style={{ textTransform: 'capitalize' }}>{w.level}:</b> {w.text}</div>
              })}
            </div>
          )}

          {!!result.interactions?.length && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Interações a confirmar</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{result.interactions.map((x, i) => <li key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{x}</li>)}</ul>
            </div>
          )}

          {!!result.suggestions?.length && (
            <div style={{ marginBottom: result.disclaimer ? 10 : 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Sugestões</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{result.suggestions.map((x, i) => <li key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{x}</li>)}</ul>
            </div>
          )}

          {result.disclaimer && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{result.disclaimer}</div>}
          <div style={{ marginTop: 8, fontSize: 11.5, color: '#0d6e42', fontWeight: 700 }}>★ Guardado no histórico desta pessoa.</div>
        </div>
      )}
    </div>
  )
}
