import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 72, fontWeight: 700, color: 'var(--border-2)', marginBottom: 8, lineHeight: 1 }}>404</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Página não encontrada
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 32 }}>
          O endereço que procuras não existe ou foi movido. Usa as ferramentas abaixo para continuar.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {[
            { href: '/interactions', label: '⚕ Verificar Interações' },
            { href: '/drugs', label: '💊 Pesquisar Fármaco' },
            { href: '/calculators', label: '🧮 Calculadoras' },
            { href: '/study', label: '📚 Estudar' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ display: 'block', padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', fontWeight: 500, transition: 'border-color 0.15s' }}>
              {label}
            </Link>
          ))}
        </div>
        <Link href="/" style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
          ← Voltar ao início
        </Link>
      </div>
    </div>
  )
}