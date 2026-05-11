import Link from 'next/link'

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

        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 40, maxWidth: 380, margin: '0 auto 40px' }}>
          O endereço que procuras não existe ou foi movido. Usa uma das ferramentas abaixo para continuar.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
          {[
            { href: '/interactions', label: 'Verificar Interações' },
            { href: '/bula',         label: 'Tradutor de Bula' },
            { href: '/calculators',  label: 'Calculadoras' },
            { href: '/study',        label: 'Estudar' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 15px', background: 'white', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', fontWeight: 600, transition: 'border-color 0.15s', letterSpacing: '-0.01em' }}>
              {label}
            </Link>
          ))}
        </div>

        <Link href="/"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ← Voltar ao início
        </Link>
      </div>
    </div>
  )
}
