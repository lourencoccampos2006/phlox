import Link from 'next/link'
import Header from '@/components/Header'

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--green)', padding: '7px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            INFORMAÇÃO EDUCACIONAL — NÃO SUBSTITUI ACONSELHAMENTO PROFISSIONAL
          </span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            Dados: OpenFDA · RxNorm · NIH
          </span>
        </div>
      </div>

      <Header />

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--green-2)', textTransform: 'uppercase', marginBottom: 20 }}>
              Plataforma Farmacológica
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 52, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 24 }}>
              Informação clínica.<br />
              <em style={{ fontStyle: 'italic', color: 'var(--green-2)' }}>Rigorosa e acessível.</em>
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 36, maxWidth: 440 }}>
              Verifica interações medicamentosas, consulta informação clínica,
              calcula doses e prepara-te para exames de farmacologia.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link href="/interactions" style={{ background: 'var(--green)', color: 'white', padding: '13px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Verificar interações
              </Link>
              <Link href="/drugs" style={{ background: 'transparent', color: 'var(--ink)', padding: '13px 28px', borderRadius: 6, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1px solid var(--border-2)' }}>
                Pesquisar fármaco
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 4 }}>
            {[
              { value: '20k+', label: 'Medicamentos indexados' },
              { value: '5', label: 'Ferramentas clínicas' },
              { value: '3', label: 'Bases de dados' },
              { value: '100%', label: 'Gratuito' },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: 'var(--bg)', padding: '28px 24px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section style={{ padding: '64px 40px', background: 'var(--bg-2)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 40 }}>
            Ferramentas disponíveis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {[
              { href: '/interactions', code: '01', title: 'Verificador de Interações', desc: 'Analisa interações entre medicamentos, suplementos e plantas medicinais com classificação por gravidade.' },
              { href: '/drugs', code: '02', title: 'Base de Dados de Fármacos', desc: 'Informação clínica completa — mecanismo, posologia, efeitos adversos e contraindicações.' },
              { href: '/calculators', code: '03', title: 'Calculadoras Clínicas', desc: 'Clearance renal, TFGe, doses pediátricas, conversão de opióides e mais.' },
              { href: '/study', code: '04', title: 'Plataforma de Estudo', desc: 'Flashcards, quizzes e casos clínicos para estudantes de farmácia e medicina.' },
            ].map(({ href, code, title, desc }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block', background: 'var(--bg)', padding: '32px 28px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.15em', marginBottom: 14 }}>{code}</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                <div style={{ marginTop: 20, fontSize: 12, color: 'var(--green-2)', fontWeight: 500 }}>Aceder →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 40px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.01em' }}>
              Cria uma conta gratuita
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
              Guarda o teu histórico de pesquisas, cria a tua lista de medicamentos pessoais e acede a ferramentas avançadas.
            </p>
            <Link href="/login" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
              Criar conta gratuita →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Histórico de pesquisas guardado',
              'Lista de medicamentos pessoais com alertas',
              'Flashcards e quizzes de farmacologia',
              'Ferramentas avançadas para profissionais (Pro)',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4 }}>
                <span style={{ color: 'var(--green-2)', fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 40px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Clinical Reference</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['/interactions', '/drugs', '/calculators', '/study'].map(href => (
              <Link key={href} href={href} style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                {href.slice(1).charAt(0).toUpperCase() + href.slice(2)}
              </Link>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            Informação educacional · Não substitui aconselhamento profissional
          </span>
        </div>
      </footer>
    </div>
  )
}