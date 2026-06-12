import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hipericão (erva de São João) — as interações que ninguém conta | Phlox',
  description: 'O suplemento "natural" com mais interações perigosas: pílula, antidepressivos, anticoagulantes, imunossupressores. Porquê e o que fazer. Base EMA/INFARMED.',
  openGraph: {
    title: 'Hipericão — as interações que ninguém conta',
    description: '"Natural" não é o mesmo que "inofensivo". O caso da erva de São João.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostHipericao() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Suplementos</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#fffbeb', color: '#b45309', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>SUPLEMENTOS</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Hipericão — as interações que ninguém conta
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            O hipericão (erva de São João) vende-se sem receita, para o humor e o sono. O problema: é um dos suplementos com <strong>mais interações graves</strong> que existem — e "natural" engana muita gente.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>28 de Janeiro de 2026</span><span>·</span><span>6 min de leitura</span><span>·</span><span>Base: EMA, INFARMED</span>
          </div>
        </div>

        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ INTERAÇÕES GRAVES</div>
          <p style={{ fontSize: 14, color: '#742a2a', lineHeight: 1.7, margin: 0 }}>
            O hipericão pode <strong>reduzir o efeito</strong> de muitos medicamentos (incluindo a pílula) e <strong>aumentar perigosamente</strong> o de outros. Se tomas medicação crónica, fala com o farmacêutico antes.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>Por que interage com tanta coisa</h2>
          <p style={P}>O hipericão acelera enzimas do fígado (sobretudo a CYP3A4) e um "transportador" chamado glicoproteína-P. Estes sistemas processam uma enorme fatia dos medicamentos. Ao acelerá-los, o corpo elimina o medicamento mais depressa — e a dose deixa de fazer efeito. Em alguns casos faz o contrário e há acumulação perigosa.</p>

          <h2 style={H2}>As interações que mais importam</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong>Pílula contracetiva</strong> — pode falhar. Há gravidezes documentadas associadas ao hipericão.</li>
            <li><strong>Antidepressivos</strong> (ISRS como sertralina, fluoxetina) — risco de <em>síndrome serotoninérgico</em> (excesso de serotonina), que é grave.</li>
            <li><strong>Anticoagulantes</strong> (varfarina) — reduz o efeito, aumentando o risco de coágulos.</li>
            <li><strong>Imunossupressores</strong> (ciclosporina, tacrolimus) — risco de rejeição em transplantados.</li>
            <li><strong>Alguns antirretrovirais e anticancerígenos</strong> — perda de eficácia que pode ser crítica.</li>
          </ul>

          <h2 style={H2}>"Mas é natural..."</h2>
          <p style={P}>Natural não quer dizer inofensivo nem fraco. O hipericão tem efeito biológico real — por isso é que funciona para o humor, e por isso é que interage. A diferença para um medicamento de farmácia é que vem sem bula clara sobre interações, o que o torna mais traiçoeiro, não menos.</p>

          <h2 style={H2}>O que fazer</h2>
          <p style={P}>Se já tomas hipericão e algum medicamento crónico, <strong>não pares nada de repente</strong> — parar o hipericão também altera os níveis dos medicamentos. Fala com o farmacêutico ou médico para ajustar com segurança. E se pensas começar, verifica antes as interações com o que já tomas.</p>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>O hipericão dá-se bem com a tua medicação?</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>O verificador do Phlox inclui suplementos como o hipericão e diz-te o risco com cada medicamento que tomas.</p>
          <Link href="/interactions" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Verificar interações grátis →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Este artigo destina-se a fins informativos e educativos. Não substitui o aconselhamento de um profissional de saúde. Não pares nem inicies suplementos sem falar com o teu médico ou farmacêutico. Base: EMA, INFARMED, NIH.
          </p>
        </div>
      </article>
    </div>
  )
}
