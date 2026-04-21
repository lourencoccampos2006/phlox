import Header from '@/components/Header'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — Phlox Clinical',
  description: 'Artigos sobre farmacologia, interações medicamentosas e segurança do medicamento em português.',
}

const POSTS = [
  {
    slug: 'ibuprofeno-varfarina',
    title: 'Posso tomar ibuprofeno com varfarina?',
    desc: 'Uma das interações mais perigosas e mais comuns em Portugal. O que acontece, por que acontece, e o que podes tomar em alternativa.',
    tag: 'Interações',
    date: '2026-04-01',
    readTime: '4 min',
  },
  {
    slug: 'omeprazol-todos-os-dias',
    title: 'Tomar omeprazol todos os dias faz mal?',
    desc: 'Milhões de portugueses tomam omeprazol diariamente. O que diz a evidência sobre o uso prolongado, os riscos reais, e quando deve ser revisto.',
    tag: 'Medicamentos',
    date: '2026-04-05',
    readTime: '5 min',
  },
  {
    slug: 'metformina-alcool',
    title: 'Metformina e álcool: o que realmente acontece',
    desc: 'Um copo de vinho ao jantar com metformina — é perigoso? A resposta honesta, com o mecanismo explicado em linguagem simples.',
    tag: 'Interações',
    date: '2026-04-10',
    readTime: '3 min',
  },
  {
    slug: 'vitamina-d-deficiencia',
    title: 'Défice de vitamina D: sintomas, diagnóstico e suplementação',
    desc: 'Em Portugal, mais de 70% da população tem défice de vitamina D. Como interpretar os teus valores nas análises e quando e como suplementar.',
    tag: 'Análises',
    date: '2026-04-14',
    readTime: '6 min',
  },
  {
    slug: 'antibiotico-probiotico',
    title: 'Devo tomar probiótico com o antibiótico?',
    desc: 'A resposta que o teu médico não teve tempo de te dar. Evidência actual, qual comprar, e quando tomar em relação ao antibiótico.',
    tag: 'Medicamentos',
    date: '2026-04-18',
    readTime: '4 min',
  },
]

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  'Interações': { bg: '#fff5f5', color: '#dc2626' },
  'Medicamentos': { bg: '#eff6ff', color: '#1e40af' },
  'Análises': { bg: '#f0fdf4', color: '#16a34a' },
}

export default function BlogPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <section style={{ borderBottom: '1px solid var(--border)', padding: '60px 0 48px', background: 'white' }}>
        <div className="page-container" style={{ maxWidth: 760 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Blog</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: 'var(--ink)', marginBottom: 16, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Farmacologia em português.<br />
            <em style={{ color: 'var(--green)', fontStyle: 'italic' }}>Sem filtros.</em>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.75, maxWidth: 520 }}>
            Respostas honestas às perguntas que toda a gente faz ao médico mas não tem tempo de receber. Escrito por farmacologistas, verificado com dados.
          </p>
        </div>
      </section>

      <section style={{ padding: '48px 0 80px' }}>
        <div className="page-container" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {POSTS.map((post, i) => {
              const ts = TAG_STYLE[post.tag] || { bg: 'var(--bg-2)', color: 'var(--ink-4)' }
              return (
                <Link key={post.slug} href={`/blog/${post.slug}`}
                  style={{ display: 'flex', flexDirection: 'column', padding: '24px 28px', background: 'white', textDecoration: 'none', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, background: ts.bg, color: ts.color, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.04em' }}>{post.tag}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{post.date} · {post.readTime}</span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{post.title}</h2>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{post.desc}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}