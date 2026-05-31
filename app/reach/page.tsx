'use client'

// Phlox Reach — partilha o teu código, ganha um mês por cada amigo que faça upgrade.
// Visualmente simples, partilhável, gamificado sem ser ridículo.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Redemption { id: string; invitee_email?: string | null; at: string; upgraded: boolean; upgraded_at?: string | null }
interface Reach { code: string; uses: number; redemptions: Redemption[]; upgraded: number }

export default function ReachPage() {
  const { user, supabase } = useAuth() as any
  const [r, setR] = useState<Reach | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch('/api/reach/code', { headers: { Authorization: `Bearer ${t}` } })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Erro')
      else setR(j)
    } catch (e: any) { setErr(String(e?.message || e)) }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://phloxclinical.com'
  const link = r ? `${origin}/login?ref=${r.code}` : ''

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  function share() {
    if (!link || !(navigator as any).share) return copyLink()
    ;(navigator as any).share({ title: 'Phlox', text: 'Estou a usar o Phlox e acho que ias gostar.', url: link }).catch(() => {})
  }

  // próximo nível visual
  const tiers = [
    { n: 1, label: '1 amigo' },
    { n: 3, label: '3 amigos · 3 meses' },
    { n: 5, label: '5 amigos · plano Pro grátis 1 mês' },
    { n: 10, label: '10 amigos · 1 ano Pro grátis' },
  ]
  const next = tiers.find(t => (r?.upgraded || 0) < t.n)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Reach</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Convida amigos. Ambos ganham.</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.6, maxWidth: 560 }}>
            Partilha o teu código. Quando alguém se regista com ele e faz upgrade, oferecemos-te <strong>1 mês</strong>. E o teu amigo começa com vantagens.
          </p>
        </div>

        {err && <div style={{ marginBottom: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#991b1b', fontSize: 13.5 }}>{err}</div>}

        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        ) : r ? (
          <>
            {/* Hero código */}
            <div style={{ background: 'linear-gradient(135deg, #0d6e42 0%, #16a34a 60%, #22c55e 100%)', borderRadius: 18, padding: '28px 28px', color: 'white', boxShadow: '0 16px 50px -20px rgba(13,110,66,0.45)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>O teu código</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 700, letterSpacing: '0.04em' }}>{r.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={copyLink} style={{ padding: '10px 18px', background: 'white', color: '#0d6e42', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{copied ? '✓ Copiado' : 'Copiar link'}</button>
                <button onClick={share} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Partilhar</button>
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{link}</div>
            </div>

            {/* Progresso */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: '#0d6e42', lineHeight: 1 }}>{r.upgraded}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{r.upgraded === 1 ? 'amigo a fazer upgrade' : 'amigos a fazer upgrade'}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>{r.redemptions.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{r.redemptions.length === 1 ? 'registo total' : 'registos totais'}</div>
                </div>
                {next && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>Próximo prémio</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{next.label}</div>
                    <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (r.upgraded / next.n) * 100)}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 3 }} />
                    </div>
                  </div>
                )}
              </div>

              {r.redemptions.length === 0 ? (
                <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--ink-5)', textAlign: 'center' }}>
                  Sem convites usados ainda. Partilha o código.
                </div>
              ) : (
                <div style={{ borderTop: '1px solid var(--bg-2)', paddingTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Últimos convites</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {r.redemptions.slice(0, 8).map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', borderRadius: 8, background: d.upgraded ? '#f0fdf4' : 'var(--bg-2)', fontSize: 12.5 }}>
                        <span style={{ color: 'var(--ink-2)' }}>{d.invitee_email || 'utilizador anónimo'}{d.upgraded ? ' — upgrade ✓' : ''}</span>
                        <span style={{ color: '#9ca3af' }}>{new Date(d.at).toLocaleDateString('pt-PT')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-5)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/trust" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Trust Center →</Link>
              <Link href="/pricing" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver planos →</Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
