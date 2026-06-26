import Link from 'next/link'
import { Metadata } from 'next'
import ArticleSchema from '@/components/ArticleSchema'

export const metadata: Metadata = {
  title: 'Sinais de desidratação em idosos — o que vigiar | Phlox',
  description: 'Como reconhecer a desidratação num idoso: sinais precoces, sinais de alarme, quanto deve beber por dia e quando ir ao médico. Guia prático para cuidadores e famílias.',
  openGraph: {
    title: 'Sinais de desidratação em idosos',
    description: 'O que vigiar, quanto deve beber, e quando é urgente.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostDesidratacao() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <ArticleSchema slug="sinais-desidratacao-idosos" headline="Sinais de desidratação em idosos — o que vigiar" description="Como reconhecer a desidratação num idoso: sinais precoces, sinais de alarme, quanto deve beber por dia e quando é urgente." datePublished="2026-06-15" />
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Cuidar de idosos</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#ecfeff', color: '#0e7490', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>CUIDAR DE IDOSOS</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Sinais de desidratação em idosos
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Os idosos desidratam mais facilmente — sentem menos sede e os rins retêm pior a água. E a desidratação, neles, confunde-se com outras coisas (confusão, quedas). Saber o que vigiar faz toda a diferença.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>15 de Junho de 2026</span><span>·</span><span>6 min de leitura</span>
          </div>
        </div>

        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ SINAIS DE ALARME — LIGAR 112 / IR À URGÊNCIA</div>
          <p style={{ fontSize: 14, color: '#742a2a', lineHeight: 1.7, margin: 0 }}>
            Confusão súbita, sonolência difícil de acordar, tensão muito baixa, batimento muito rápido, ou ausência de urina há mais de 8 horas. Não esperar.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>Sinais precoces (vigiar)</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>Boca e lábios secos, língua "pegajosa"</li>
            <li>Urina escura e em pouca quantidade</li>
            <li>Mais cansaço ou sonolência do que o habitual</li>
            <li>Dor de cabeça, tonturas ao levantar</li>
            <li>Pele que, ao ser beliscada nas costas da mão, demora a voltar ao normal</li>
            <li>Confusão ligeira ou irritabilidade novas</li>
          </ul>
          <p style={P}>Nos idosos, a <strong>confusão e as quedas</strong> podem ser o primeiro sinal — antes mesmo da sede. Por isso uma mudança no estado mental merece sempre que se pense também em desidratação.</p>

          <h2 style={H2}>Quanto deve beber por dia?</h2>
          <p style={P}>Como referência geral, cerca de <strong>1,5 a 2 litros de líquidos por dia</strong> — mas conta tudo: água, chá, sopa, gelatina, fruta com água. Em dias de calor, febre, diarreia ou vómitos, a necessidade aumenta. Quem tem insuficiência cardíaca ou renal pode ter restrições — nesses casos, segue o que o médico indicou.</p>
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)', marginBottom: 4 }}>✓ O que funciona</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>Oferecer pequenas quantidades muitas vezes (em vez de um copo grande de uma vez), variar (chá, sopa, fruta), e ter sempre um copo à vista. A maioria não bebe por não se lembrar, não por não ter sede.</div>
          </div>

          <h2 style={H2}>Quando há mais risco</h2>
          <p style={P}>Calor, febre, diarreia ou vómitos, alguns diuréticos ("comprimidos da água"), diabetes descompensada, e dificuldade em chegar ao copo (mobilidade reduzida ou demência). Nestes dias e situações, vigiar de perto e oferecer líquidos com mais frequência.</p>

          <h2 style={H2}>O que dizer ao médico</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['"Quanto deve beber por dia, no caso dele/dela?"', '"Algum dos medicamentos aumenta o risco de desidratação?"', '"Que sinais devo vigiar para agir a tempo?"'].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Não sabes se é urgente?</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>O Phlox ajuda-te a decidir se deves ir ao médico ou ajudar já em casa, com primeiros passos seguros.</p>
          <Link href="/saude-agora" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Devo ir ao médico? →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Conteúdo educativo. Não substitui avaliação médica. Em caso de sinais de alarme, contactar o 112 ou ir à urgência.
          </p>
        </div>
      </article>
    </div>
  )
}
