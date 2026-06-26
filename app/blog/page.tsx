// app/blog/page.tsx — Índice do blog com artigos SEO
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog de Farmacologia Clínica — Phlox Clinical',
  description: 'Artigos sobre interações medicamentosas, doses pediátricas, segurança na medicação e saúde em Portugal. Baseados em fontes INFARMED, FDA e EMA.',
}

const ARTICLES = [
  {
    slug: 'interacoes-comuns-a-evitar',
    title: 'As 10 Interações Medicamentosas Mais Comuns em Portugal (e como as evitar)',
    desc: 'Varfarina + AINEs, estatinas + antibióticos, metformina + contraste — as combinações que todo o profissional precisa de saber.',
    tag: 'Interações', date: '2026-01-15', readTime: '8 min',
    color: '#dc2626',
  },
  {
    slug: 'dose-paracetamol-crianca',
    title: 'Dose de Paracetamol para Crianças — Tabela por Peso 2026',
    desc: 'Tabela completa por peso e idade, calculadora gratuita, e quando ir ao médico urgentemente.',
    tag: 'Pediatria', date: '2025-12-10', readTime: '5 min',
    color: '#b45309',
  },
  {
    slug: 'ibuprofeno-varfarina',
    title: 'Posso Tomar Ibuprofeno com Varfarina?',
    desc: 'A combinação mais perigosa dos domicílios portugueses. Mecanismo, risco real e alternativas seguras.',
    tag: 'Interações', date: '2025-11-22', readTime: '6 min',
    color: '#dc2626',
  },
  {
    slug: 'metformina-alcool',
    title: 'Metformina e Álcool — O Que Realmente Acontece',
    desc: 'Risco de acidose láctica, quanto é demasiado, e o que dizer ao doente diabético que quer beber socialmente.',
    tag: 'Diabetes', date: '2026-02-01', readTime: '7 min',
    color: '#0d6e42',
  },
  {
    slug: 'antibioticos-em-gravidez',
    title: 'Antibióticos na Gravidez — Guia Completo por Categoria',
    desc: 'Quais são seguros, quais são proibidos, e quando o benefício supera o risco. Com tabela por classe e trimestre.',
    tag: 'Gravidez', date: '2026-02-15', readTime: '10 min',
    color: '#7c3aed',
  },
  {
    slug: 'hipericao-medicamentos',
    title: 'Hipericão (Erva de São João) — As Interações que Ninguém Conta',
    desc: 'O suplemento natural mais perigoso em Portugal. Anticonceptivos, antidepressivos, anticoagulantes — tudo interagiria.',
    tag: 'Suplementos', date: '2026-01-28', readTime: '6 min',
    color: '#d97706',
  },
  {
    slug: 'medicamentos-idosos-lista-beers',
    title: 'Medicamentos a Evitar em Idosos — Critérios Beers 2024',
    desc: 'A lista actualizada dos medicamentos potencialmente inapropriados em pessoas com mais de 65 anos. Com alternativas.',
    tag: 'Geriatria', date: '2026-03-01', readTime: '9 min',
    color: '#1d4ed8',
  },
  {
    slug: 'ajuste-dose-insuficiencia-renal',
    title: 'Como Ajustar a Dose na Insuficiência Renal — Guia Prático',
    desc: 'Fórmulas de Cockcroft-Gault e CKD-EPI, os fármacos que mais requerem ajuste, e como calcular rapidamente.',
    tag: 'Renal', date: '2026-02-20', readTime: '8 min',
    color: '#0891b2',
  },
  {
    slug: 'organizar-medicacao-idoso',
    title: 'Como Organizar a Medicação de um Idoso em Casa',
    desc: 'Guia prático para cuidadores: um sistema simples para nunca trocar, falhar ou repetir tomas. Caixa semanal, gatilhos e lembretes.',
    tag: 'Cuidadores', date: '2026-06-15', readTime: '7 min',
    color: '#b45309',
  },
  {
    slug: 'sinais-desidratacao-idosos',
    title: 'Sinais de Desidratação em Idosos — O Que Vigiar',
    desc: 'Sinais precoces e de alarme, quanto deve beber por dia, quando há mais risco e quando é urgente. Para cuidadores e famílias.',
    tag: 'Cuidar de idosos', date: '2026-06-15', readTime: '6 min',
    color: '#0e7490',
  },
  {
    slug: 'como-ler-receita-medica',
    title: 'Como Ler uma Receita Médica em Portugal',
    desc: 'DCI, posologia "1+0+1", a receita eletrónica do SNS, o código de dispensa e a comparticipação — tudo explicado em linguagem simples.',
    tag: 'Guia prático', date: '2026-06-20', readTime: '7 min',
    color: '#1d4ed8',
  },
  {
    slug: 'medicamentos-sem-receita-cuidados',
    title: 'Medicamentos Sem Receita: O Que Pode (e Não Deve) Misturar',
    desc: 'Paracetamol com ibuprofeno, antiácidos, xaropes para a tosse, álcool — o que é seguro em casa e quando a automedicação se torna perigosa.',
    tag: 'Segurança', date: '2026-06-18', readTime: '8 min',
    color: '#0d6e42',
  },
  {
    slug: 'como-guardar-medicamentos-casa',
    title: 'Como Guardar Medicamentos em Casa (e Quando Deitar Fora)',
    desc: 'O erro de os ter na casa de banho, o que precisa de frigorífico, a validade depois de aberto e como deitar fora com segurança (VALORMED).',
    tag: 'Em casa', date: '2026-06-16', readTime: '6 min',
    color: '#0e7490',
  },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Interações':  { bg: '#fee2e2', color: '#dc2626' },
  'Pediatria':   { bg: '#fffbeb', color: '#b45309' },
  'Diabetes':    { bg: '#f0fdf5', color: '#0d6e42' },
  'Gravidez':    { bg: '#faf5ff', color: '#7c3aed' },
  'Suplementos': { bg: '#fefce8', color: '#d97706' },
  'Geriatria':   { bg: '#eff6ff', color: '#1d4ed8' },
  'Renal':       { bg: '#ecfeff', color: '#0891b2' },
  'Cuidadores':  { bg: '#fffbeb', color: '#b45309' },
  'Cuidar de idosos': { bg: '#ecfeff', color: '#0e7490' },
  'Guia prático': { bg: '#eff6ff', color: '#1d4ed8' },
  'Segurança':   { bg: '#f0fdf5', color: '#0d6e42' },
  'Em casa':     { bg: '#ecfeff', color: '#0e7490' },
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
              style={{ display: 'flex', flexDirection: 'column', background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', transition: 'transform 0.12s, box-shadow 0.12s', borderTop: `3px solid ${a.color}` }}
              className="blog-card">
              <div style={{ padding: '22px 22px 18px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tc.color, background: tc.bg, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{a.tag}</span>
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