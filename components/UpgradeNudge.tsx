'use client'

// UpgradeNudge — cartão discreto mostrado quando o utilizador atinge o limite
// diário de uma ferramenta. Empurra para o Pro de forma honesta (diz o que
// ganha), sem ser agressivo. Reutilizável em qualquer ferramenta.

import Link from 'next/link'

export default function UpgradeNudge({
  used, limit, what, plan = 'pro',
}: {
  used: number
  limit: number
  what: string            // ex: "fotos no Phlox Scan"
  plan?: 'student' | 'pro'
}) {
  const planName = plan === 'student' ? 'Plus' : 'Pro'
  const price = plan === 'student' ? '3,99€/mês' : '12,99€/mês'
  const accent = plan === 'student' ? 'var(--roxo)' : 'var(--green)'
  const soft = plan === 'student' ? 'var(--blue-light)' : 'var(--green-light)'
  return (
    <div style={{ background: soft, border: `1px solid ${accent}33`, borderRadius: 'var(--r-xl)', padding: '16px 18px', marginTop: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
        Chegaste ao limite de hoje ({used}/{limit} {what})
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 12 }}>
        Com o <b>{planName}</b> ({price}) ficas sem limites diários{plan === 'pro' ? ', com lembretes no telemóvel e a tua saúde toda num só sítio' : ' e com tudo de estudo desbloqueado'}.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/checkout?plan=${plan}`} style={{ background: accent, color: 'white', textDecoration: 'none', borderRadius: 'var(--r-lg)', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>
          Ver {planName} →
        </Link>
        <Link href="/pricing" style={{ background: 'white', color: 'var(--ink-3)', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>
          Comparar planos
        </Link>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 10 }}>O limite renova à meia-noite.</div>
    </div>
  )
}
