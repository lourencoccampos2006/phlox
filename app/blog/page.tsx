// app/blog/page.tsx — Índice do blog com artigos SEO
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — saúde e medicação, em português',
  description: 'Artigos sobre medicação, interações, cuidar de idosos e segurança dos medicamentos. Baseados em fontes INFARMED, FDA e EMA.',
}

const ARTICLES = [
  {
    slug: 'organizar-medicacao-idoso',
    title: 'Como Organizar a Medicação de um Idoso em Casa',
    desc: 'Guia prático para cuidadores: um sistema simples para nunca trocar, falhar ou repetir tomas. Caixa semanal, gatilhos e lembretes.',
    tag: 'Cuidadores', date: '2026-06-15', readTime: '7 min',
    color: 'var(--amber)',
  },
  {
    slug: 'sinais-desidratacao-idosos',
    title: 'Sinais de Desidratação em Idosos — O Que Vigiar',
    desc: 'Sinais precoces e de alarme, quanto deve beber por dia, quando há mais risco e quando é urgente. Para cuidadores e famílias.',
    tag: 'Cuidar de idosos', date: '2026-06-15', readTime: '6 min',
    color: 'var(--green-3)',
  },
  {
    slug: 'como-ler-receita-medica',
    title: 'Como Ler uma Receita Médica em Portugal',
    desc: 'DCI, posologia "1+0+1", a receita eletrónica do SNS, o código de dispensa e a comparticipação — tudo explicado em linguagem simples.',
    tag: 'Guia prático', date: '2026-06-20', readTime: '7 min',
    color: 'var(--ink-2)',
  },
  {
    slug: 'como-guardar-medicamentos-casa',
    title: 'Como Guardar Medicamentos em Casa (e Quando Deitar Fora)',
    desc: 'O erro de os ter na casa de banho, o que precisa de frigorífico, a validade depois de aberto e como deitar fora com segurança (VALORMED).',
    tag: 'Em casa', date: '2026-06-16', readTime: '6 min',
    color: 'var(--green-3)',
  },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Interações':  { bg: 'var(--badge-red-bg)', color: 'var(--red)' },
  'Pediatria':   { bg: 'var(--badge-amber-bg)', color: 'var(--amber)' },
  'Diabetes':    { bg: 'var(--green-light)', color: 'var(--green)' },
  'Gravidez':    { bg: 'var(--roxo-claro)', color: 'var(--roxo)' },
  'Suplementos': { bg: 'var(--badge-amber-bg)', color: 'var(--amber)' },
  'Geriatria':   { bg: 'var(--bg-2)', color: 'var(--ink-2)' },
  'Renal':       { bg: 'var(--green-light)', color: 'var(--green)' },
  'Cuidadores':  { bg: 'var(--badge-amber-bg)', color: 'var(--amber)' },
  'Cuidar de idosos': { bg: 'var(--green-light)', color: 'var(--green-3)' },
  'Guia prático': { bg: 'var(--bg-2)', color: 'var(--ink-2)' },
  'Segurança':   { bg: 'var(--green-light)', color: 'var(--green)' },
  'Em casa':     { bg: 'var(--green-light)', color: 'var(--green-3)' },
}

export default function BlogIndexPage() {
  return (
    <div className="page-container page-body">
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Farmacologia em português</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,42px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 14 }}>Blog Clínico Phlox</h1>
        <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 560 }}>Artigos de farmacologia clínica baseados em evidência, em português europeu. Para profissionais, estudantes e cuidadores.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,340px),1fr))', gap: 16 }}>
        {ARTICLES.map(a => {
          const tc = TAG_COLORS[a.tag] || { bg: 'var(--bg-2)', color: 'var(--ink-3)' }
          return (
            <Link key={a.slug} href={`/blog/${a.slug}`}
              style={{ display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', textDecoration: 'none', transition: 'transform 0.12s, box-shadow 0.12s', borderTop: `3px solid ${a.color}` }}
              className="blog-card">
              <div style={{ padding: '22px 22px 18px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tc.color, background: tc.bg, padding: '2px 8px', borderRadius: 'var(--r-sm)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{a.tag}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>{a.readTime}</span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, lineHeight: 1.35, marginBottom: 10, letterSpacing: '-0.01em' }}>{a.title}</h2>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>{a.desc}</p>
              </div>
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>
                  {new Date(a.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: a.color }}>Ler →</span>
              </div>
            </Link>
          )
        })}
      </div>

      <style>{`.blog-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }`}</style>
    </div>
  )
}