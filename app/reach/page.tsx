'use client'

// Phlox Reach — convide amigos, ganhe Pro. REESCRITO 2026-08-09 (pedido do
// Fernando: "refaz completamente o programa de referrals"):
//
// 1. A versão anterior prometia "níveis" fictícios ("5 amigos · Pro grátis
//    1 mês", "10 amigos · 1 ano Pro grátis") que NUNCA existiram no motor —
//    lib/api/stripe/webhook.ts `grantReachReward()` só dá +1 mês FIXO por
//    cada amigo que faz upgrade, empilhado, sem limite nem escalões. A
//    partir de 5 amigos a promessa e a realidade já nem batiam certo (5
//    amigos davam 5 meses reais, a UI prometia "1 mês"). Em vez de construir
//    lógica de escalões nova (risco financeiro real, sem forma de testar
//    pagamentos ao vivo esta noite), a reescrita torna a promessa HONESTA:
//    mostra exatamente o que o motor já faz — 1 mês por amigo, sem limite.
// 2. Hero de gradiente diagonal trocado pela linguagem visual do resto do
//    site reconstruído esta sessão (cartão branco, hairline, serifa/mono) —
//    era o único sítio ainda com esse estilo.
// 3. Passa a ter uma entrada em /inicio (pessoal/cuidador) via um widget
//    (components/inicio/HomeWidgets.tsx `ReachWidget`) — antes só vivia
//    escondido dentro do acordeão "Explorar".

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Redemption { id: string; invitee_email?: string | null; at: string; upgraded: boolean; upgraded_at?: string | null }
interface Reach { code: string; uses: number; redemptions: Redemption[]; upgraded: number }

const ACCENT = '#0d6e42'

export default function ReachPage() {
  const { supabase } = useAuth() as any
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Reach</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Convide amigos. Ambos ganham.</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '8px 0 0', lineHeight: 1.6, maxWidth: 500 }}>
            Partilhe o seu código. Por cada amigo que se regista com ele e passa a Pro, ganha <strong>1 mês de Pro grátis</strong> — sem limite de convites, os meses somam-se.
          </p>
        </div>

        {err && <div style={{ marginBottom: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#991b1b', fontSize: 13.5 }}>{err}</div>}

        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        ) : r ? (
          <>
            {/* Código */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 10 }}>O seu código</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,5vw,42px)', fontWeight: 400, letterSpacing: '0.02em', color: ACCENT }}>{r.code}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={copyLink} style={{ padding: '10px 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{copied ? '✓ Copiado' : 'Copiar link'}</button>
                <button onClick={share} style={{ padding: '10px 18px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Partilhar</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{link}</div>
            </div>

            {/* Progresso — honesto: o que se vê aqui é exatamente o que o motor dá, sem escalões inventados */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: r.redemptions.length ? 14 : 0 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: ACCENT, lineHeight: 1 }}>{r.upgraded}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{r.upgraded === 1 ? 'mês de Pro ganho' : 'meses de Pro ganhos'}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>{r.redemptions.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{r.redemptions.length === 1 ? 'pessoa registada' : 'pessoas registadas'}</div>
                </div>
                {r.upgraded < r.redemptions.length && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-4)', maxWidth: 200, lineHeight: 1.5 }}>
                    {r.redemptions.length - r.upgraded} {r.redemptions.length - r.upgraded === 1 ? 'ainda não fez' : 'ainda não fizeram'} upgrade a Pro
                  </div>
                )}
              </div>

              {r.redemptions.length === 0 ? (
                <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--ink-5)', textAlign: 'center' }}>
                  Sem convites usados ainda. Partilhe o código.
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
