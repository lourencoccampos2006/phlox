import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--green)', padding: '8px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--green-mid)', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            INFORMAÇÃO EDUCACIONAL — NÃO SUBSTITUI ACONSELHAMENTO PROFISSIONAL
          </span>
          <span style={{ color: 'var(--green-mid)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            Dados: OpenFDA · DrugBank · RxNorm
          </span>
        </div>
      </div>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.02em' }}>
              Phlox
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Clinical Reference
            </span>
          </div>
          <nav style={{ display: 'flex', gap: 32 }}>
            {[
              { href: '/interactions', label: 'Interações' },
              { href: '/drugs', label: 'Medicamentos' },
              { href: '/study', label: 'Estudantes' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ink-2)',
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '72px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--green-2)', textTransform: 'uppercase', marginBottom: 20 }}>
              Plataforma Farmacológica
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 48, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 24 }}>
              Informação clínica.<br />
              <em style={{ fontStyle: 'italic', color: 'var(--green-2)' }}>Rigorosa e acessível.</em>
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 36, maxWidth: 440 }}>
              Verifica interações medicamentosas, consulta informação clínica detalhada,
              e prepara-te para exames de farmacologia. Tudo num só lugar.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link href="/interactions" style={{
                background: 'var(--green)',
                color: 'white',
                padding: '12px 28px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}>
                Verificar interações
              </Link>
              <Link href="/drugs" style={{
                background: 'transparent',
                color: 'var(--ink)',
                padding: '12px 28px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                border: '1px solid var(--border-2)',
              }}>
                Pesquisar fármaco
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}>
            {[
              { value: '20k+', label: 'Medicamentos indexados' },
              { value: '3', label: 'Bases de dados clínicas' },
              { value: '100%', label: 'Gratuito' },
              { value: 'PT · EN · ES', label: 'Línguas disponíveis' },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: 'var(--bg)', padding: '28px 24px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                  {value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', letterSpacing: '0.03em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section style={{ padding: '64px 32px', background: 'var(--bg-2)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 40 }}>
            Ferramentas disponíveis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)' }}>
            {[
              {
                href: '/interactions',
                code: '01',
                title: 'Verificador de Interações',
                desc: 'Analisa interações entre medicamentos, suplementos, plantas medicinais e alimentos. Classificação por gravidade com mecanismo farmacológico detalhado.',
              },
              {
                href: '/drugs',
                code: '02',
                title: 'Base de Dados de Fármacos',
                desc: 'Consulta informação clínica completa sobre qualquer medicamento. Mecanismo de acção, posologia, efeitos adversos, contraindicações e farmacocinética.',
              },
              {
                href: '/study',
                code: '03',
                title: 'Plataforma de Estudo',
                desc: 'Flashcards automáticos, quizzes adaptativos e casos clínicos simulados para estudantes de farmácia, medicina e enfermagem.',
              },
            ].map(({ href, code, title, desc }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', background: 'var(--bg)', padding: '36px 32px', transition: 'background 0.15s' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.15em', marginBottom: 16 }}>
                  {code}
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7 }}>
                  {desc}
                </p>
                <div style={{ marginTop: 24, fontSize: 13, color: 'var(--green-2)', fontWeight: 500 }}>
                  Aceder →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-3)', fontWeight: 700 }}>Phlox</span>
          <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            Informação educacional · Não substitui aconselhamento médico profissional
          </span>
        </div>
      </footer>
    </div>
  )
}