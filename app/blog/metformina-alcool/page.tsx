import Link from 'next/link'
import { Metadata } from 'next'
import ArticleSchema from '@/components/ArticleSchema'

export const metadata: Metadata = {
  title: 'Metformina e álcool — o que realmente acontece | Phlox',
  description: 'Posso beber álcool se tomo metformina? Explica o risco de acidose láctica e hipoglicemia, quanto é demasiado, e o que dizer ao médico. Linguagem simples, base científica.',
  openGraph: {
    title: 'Metformina e álcool — o que realmente acontece',
    description: 'O risco real de juntar metformina e bebida, sem alarmismo nem mitos.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostMetforminaAlcool() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <ArticleSchema slug="metformina-alcool" headline="Metformina e álcool — o que realmente acontece" description="O risco real de juntar metformina e bebida: acidose láctica e hipoglicemia, quanto é demasiado, e o que dizer ao médico." datePublished="2026-02-01" />
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Diabetes</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#f0fdf5', color: '#0d6e42', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>DIABETES</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Metformina e álcool — o que realmente acontece
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Resposta curta: um copo ocasional à refeição, para a maioria das pessoas, não é problema. O perigo está no <strong>excesso</strong> e em <strong>beber com o estômago vazio</strong>. Este artigo explica porquê — sem mitos nem alarmismo.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>1 de Fevereiro de 2026</span><span>·</span><span>7 min de leitura</span><span>·</span><span>Base: EMA, ADA</span>
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #d97706', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400e', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ ATENÇÃO</div>
          <p style={{ fontSize: 14, color: '#7c5a12', lineHeight: 1.7, margin: 0 }}>
            O risco mais grave (mas raro) é a <strong>acidose láctica</strong> — sobretudo com consumo excessivo de álcool. O risco mais comum é a <strong>hipoglicemia</strong>, especialmente se beberes sem comer.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>O que é a metformina e o que faz</h2>
          <p style={P}>A metformina é o medicamento de primeira linha na diabetes tipo 2. Reduz a quantidade de açúcar que o fígado liberta e ajuda o corpo a usar melhor a insulina que já tem. Não causa hipoglicemia por si só nas doses habituais — e é isso que torna a interação com o álcool importante de perceber.</p>

          <h2 style={H2}>Por que o álcool muda as coisas</h2>
          <p style={P}><strong>Hipoglicemia (o mais comum):</strong> o fígado tem dois trabalhos — processar o álcool e libertar açúcar quando o nível baixa. Quando bebes, o fígado dá prioridade ao álcool e "esquece-se" de libertar açúcar. Resultado: o açúcar pode descer demasiado, sobretudo se bebeste em jejum. Os sinais (tremores, suores, confusão) confundem-se facilmente com estar simplesmente bêbado — o que é perigoso.</p>
          <p style={P}><strong>Acidose láctica (rara mas grave):</strong> a metformina aumenta ligeiramente o ácido láctico no sangue, e o álcool em excesso também. Juntos, em consumo elevado, podem fazer esse ácido acumular-se a níveis perigosos. É raro, mas é uma emergência médica — dá cansaço extremo, dores musculares, respiração rápida e dor de barriga.</p>

          <h2 style={H2}>Quanto é "demasiado"?</h2>
          <p style={P}>Não há um número mágico igual para todos, mas as orientações apontam para o mesmo: <strong>moderação e nunca em jejum</strong>. Um copo de vinho ou uma cerveja à refeição, de vez em quando, é geralmente tolerado por quem está estável. O problema é a bebedeira (vários copos de uma vez) e o consumo diário elevado — é aí que o risco dispara.</p>
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)', marginBottom: 4 }}>✓ Regra prática</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>Se beberes, bebe <strong>com comida</strong>, em <strong>quantidade pequena</strong>, e não conduzas nem vás dormir sem comer alguma coisa. Tem sempre algo doce à mão caso sintas hipoglicemia.</div>
          </div>

          <h2 style={H2}>Quem deve evitar mesmo</h2>
          <p style={P}>O risco é maior — e o álcool deve ser evitado ou muito limitado — se tiveres problemas de fígado ou rins, insuficiência cardíaca, ou se bebes regularmente em quantidade. Nestes casos a conversa com o médico não é opcional.</p>

          <h2 style={H2}>O que dizer ao médico</h2>
          <p style={{ marginBottom: 16 }}>Sê honesto sobre os teus hábitos — o médico não está lá para julgar, está para ajustar. Pergunta:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['"Com a minha situação, posso beber socialmente?"', '"Como reconheço uma hipoglicemia e o que faço?"', '"A minha função renal e hepática está bem para tomar metformina?"'].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>O que não posso misturar com a minha medicação?</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>O Phlox diz-te que alimentos, bebidas e álcool evitar com os medicamentos que tomas.</p>
          <Link href="/food-drug" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Ver o que evitar →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Este artigo destina-se a fins informativos e educativos. Não substitui o aconselhamento de um profissional de saúde. Confirma sempre a tua situação com o teu médico ou farmacêutico. Base: EMA, ADA, NIH.
          </p>
        </div>
      </article>
    </div>
  )
}
