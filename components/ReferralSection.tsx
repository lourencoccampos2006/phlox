'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'

interface ReferralData {
  code: string
  uses: number
  rewarded: number
}

export default function ReferralSection() {
  const { user, supabase } = useAuth()
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/referral', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [user, supabase])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://phlox.health'
  const referralUrl = data ? `${baseUrl}/login?ref=${data.code}` : ''

  const copy = () => {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return null

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--green-light) 0%, white 100%)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Programa de referidos</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Convida. Ambos ganham.</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>
          Partilha o teu link. Quem se registar com o teu código ganha <strong>30 dias de Student grátis</strong>. Quando fazem upgrade, tu ganhas <strong>1 mês grátis</strong>.
        </p>

        {data && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <div style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {referralUrl}
              </div>
              <button onClick={copy}
                style={{ padding: '9px 16px', background: copied ? 'var(--green)' : 'var(--green)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'background 0.15s' }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 7, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--green)', letterSpacing: '-0.02em' }}>{data.uses}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>registos com o teu código</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-2)', borderRadius: 7, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--green)', letterSpacing: '-0.02em' }}>{data.rewarded}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>meses grátis ganhos</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
