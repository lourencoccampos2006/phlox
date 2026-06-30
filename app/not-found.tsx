import Link from 'next/link'

const SUGGESTIONS = [
  { href: '/interactions', label: 'Verificar Interações', icon: '⚡' },
  { href: '/ai',           label: 'Phlox AI',             icon: '🤖' },
  { href: '/calculos',     label: 'Calculadoras',          icon: '🧮' },
  { href: '/scan',         label: 'Tradutor de Bula',      icon: '📋' },
]

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 520 }}>

        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 96, fontWeight: 400, color: 'var(--bg-4)', lineHeight: 1, marginBottom: 4, letterSpacing: '-0.04em' }}>
          404
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 16, height: 1.5, background: 'var(--ink-5)', borderRadius: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Página não encontrada</span>
          <div style={{ width: 16, height: 1.5, background: 'var(--ink-5)', borderRadius: 1 }} />
        </div>

        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, maxWidth: 380, margin: '0 auto 40px' }}>
          O endereço que procuras não existe ou foi movido. Continua com uma das ferramentas abaixo.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 400, margin: '0 auto 28px' }}>
          {SUGGESTIONS.map(({ href, label, icon }) => (
            <Link key={href} href={href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', fontWeight: 600, letterSpacing: '-0.01em' }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>

        <Link href="/inicio"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← Voltar ao início
        </Link>
      </div>
    </div>
  )
}
