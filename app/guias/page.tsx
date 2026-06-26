// app/guias/page.tsx
// Hub de guias práticos — página de CONTEÚDO real (SSR, texto rico), pensada para
// ser indexável e útil. Reúne os guias por tema, com uma introdução com substância.
// Complementa o /blog (que é a lista cronológica de artigos).
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guias de Saúde e Medicação em Português — Phlox',
  description: 'Guias práticos sobre medicação, interações, cuidar de idosos e segurança dos medicamentos. Escritos em português europeu, baseados em INFARMED, EMA e fontes oficiais.',
  alternates: { canonical: 'https://phloxclinical.com/guias' },
}

const SECTIONS: { title: string; intro: string; color: string; guides: { title: string; href: string; desc: string }[] }[] = [
  {
    title: 'Interações e segurança',
    intro: 'A maior parte dos problemas com medicamentos em casa não vem de um medicamento isolado, mas da combinação de vários — sobretudo em quem toma medicação crónica. Estes guias explicam as combinações que mais importam, porquê, e o que fazer.',
    color: '#dc2626',
    guides: [
      { title: 'As 10 interações mais comuns em Portugal', href: '/blog/interacoes-comuns-a-evitar', desc: 'As combinações que causam mais internamentos. Mecanismo, risco e alternativas.' },
      { title: 'Posso tomar ibuprofeno com varfarina?', href: '/blog/ibuprofeno-varfarina', desc: 'A combinação mais perigosa dos domicílios portugueses.' },
      { title: 'Hipericão — as interações que ninguém conta', href: '/blog/hipericao-medicamentos', desc: '"Natural" não quer dizer inofensivo. O caso da erva de São João.' },
      { title: 'Metformina e álcool — o que acontece', href: '/blog/metformina-alcool', desc: 'Risco de acidose láctica e o que dizer a quem é diabético.' },
    ],
  },
  {
    title: 'Cuidar de quem precisa',
    intro: 'Quem cuida de um pai, mãe ou avó muitas vezes herda uma caixa de medicamentos sem manual. Estes guias dão sistemas simples e seguros para não falhar, trocar nem repetir tomas — e para saber quando vale a pena preocupar-se.',
    color: '#b45309',
    guides: [
      { title: 'Como organizar a medicação de um idoso em casa', href: '/blog/organizar-medicacao-idoso', desc: 'Um sistema simples para nunca falhar uma toma. Caixa semanal, gatilhos e lembretes.' },
      { title: 'Sinais de desidratação em idosos', href: '/blog/sinais-desidratacao-idosos', desc: 'O que vigiar, quanto deve beber e quando é urgente.' },
      { title: 'Medicamentos a evitar em idosos (Critérios Beers)', href: '/blog/medicamentos-idosos-lista-beers', desc: 'A lista dos medicamentos potencialmente inapropriados depois dos 65, com alternativas.' },
    ],
  },
  {
    title: 'Doses e situações especiais',
    intro: 'A dose certa depende da pessoa: o peso de uma criança, a função do rim, a gravidez. Estes guias mostram como pensar a dose com segurança e quando não há margem para tentativa e erro.',
    color: '#0d6e42',
    guides: [
      { title: 'Dose de paracetamol para crianças (por peso)', href: '/blog/dose-paracetamol-crianca', desc: 'Tabela por peso e idade, e quando ir ao médico com urgência.' },
      { title: 'Antibióticos na gravidez — guia por categoria', href: '/blog/antibioticos-em-gravidez', desc: 'Quais são seguros, quais são proibidos, e quando o benefício supera o risco.' },
      { title: 'Ajustar a dose na insuficiência renal', href: '/blog/ajuste-dose-insuficiencia-renal', desc: 'Fórmulas, os fármacos que mais requerem ajuste, e como calcular.' },
    ],
  },
]

export default function GuiasPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>

        {/* Header com substância (texto real para o leitor e para o crawler) */}
        <div style={{ marginBottom: 40, maxWidth: 660 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Guias práticos</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 16, lineHeight: 1.1 }}>
            Saúde e medicação, explicadas em português.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.75, margin: '0 0 14px' }}>
            A maior parte da informação sobre medicamentos online é confusa, em inglês, ou escrita para profissionais. Aqui não. Estes guias explicam o que precisa de saber sobre a sua medicação — e a de quem cuida — em linguagem simples, sem alarmismo e sem rodeios.
          </p>
          <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0 }}>
            Cada guia é baseado em fontes oficiais (INFARMED, EMA, FDA) e revisto para o contexto português — os nomes de marca que se vendem cá, as regras do SNS, o que faz sentido na nossa realidade. Não substituem o seu médico ou farmacêutico; ajudam a ir ter com eles a saber o que perguntar.
          </p>
        </div>

        {SECTIONS.map(sec => (
          <section key={sec.title} style={{ marginBottom: 44 }}>
            <div style={{ borderLeft: `3px solid ${sec.color}`, paddingLeft: 16, marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.015em' }}>{sec.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, maxWidth: 620 }}>{sec.intro}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
              {sec.guides.map(g => (
                <Link key={g.href} href={g.href} className="guia-card" style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', height: '100%', transition: 'border-color 0.15s, transform 0.12s', borderTop: `3px solid ${sec.color}` }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 7, lineHeight: 1.35 }}>{g.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>{g.desc}</div>
                    <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: sec.color }}>Ler →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* CTA honesto */}
        <div style={{ background: 'white', border: '1.5px solid var(--green)', borderRadius: 14, padding: '26px 28px', textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Tem uma dúvida sobre a sua medicação?</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', maxWidth: 520, margin: '0 auto 18px', lineHeight: 1.6 }}>
            O Phlox verifica interações, explica bulas e análises e organiza a medicação de toda a família. Comece grátis, sem instalar nada.
          </p>
          <Link href="/login" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Criar conta grátis →</Link>
        </div>

        <style>{`.guia-card:hover > div { border-color: var(--ink-4); transform: translateY(-2px); }`}</style>
      </div>
    </div>
  )
}
