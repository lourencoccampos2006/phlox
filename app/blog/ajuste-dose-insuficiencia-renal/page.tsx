import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ajustar a dose na insuficiência renal — guia prático | Phlox',
  description: 'Como ajustar fármacos à função renal: Cockcroft-Gault vs CKD-EPI, os medicamentos que mais exigem ajuste, e como calcular rapidamente. Para profissionais e estudantes.',
  openGraph: {
    title: 'Ajuste de dose na insuficiência renal — guia prático',
    description: 'Cockcroft-Gault, CKD-EPI e os fármacos que mais exigem ajuste renal.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostAjusteRenal() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Renal</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#ecfeff', color: '#0891b2', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>RENAL</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Ajustar a dose na insuficiência renal — guia prático
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Muitos fármacos saem do corpo pelos rins. Se os rins funcionam mal, o fármaco acumula-se e a dose normal passa a ser uma sobredose. Saber estimar a função renal e ajustar é uma competência básica — para profissionais e estudantes.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>20 de Fevereiro de 2026</span><span>·</span><span>8 min de leitura</span><span>·</span><span>Base: KDIGO, RCM/INFARMED</span>
          </div>
        </div>

        <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderLeft: '4px solid #0891b2', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#155e75', letterSpacing: '0.08em', marginBottom: 6 }}>ℹ REGRA DE OURO</div>
          <p style={{ fontSize: 14, color: '#164e63', lineHeight: 1.7, margin: 0 }}>
            Para <strong>dosear fármacos</strong>, a referência clássica é a <strong>Cockcroft-Gault</strong> (clearance de creatinina). Para <strong>estadiar a doença renal</strong>, usa-se a <strong>CKD-EPI</strong> (eGFR). Não são a mesma coisa.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>Cockcroft-Gault vs CKD-EPI</h2>
          <p style={P}>A <strong>Cockcroft-Gault</strong> estima a clearance de creatinina (mL/min) e usa peso, idade, sexo e creatinina. Foi a fórmula usada na maioria dos estudos de doseamento — por isso é a que aparece nos resumos das características do medicamento (RCM) para ajustar doses.</p>
          <p style={P}>A <strong>CKD-EPI</strong> estima a taxa de filtração glomerular (eGFR, mL/min/1,73m²) e é a recomendada para classificar a doença renal crónica em estádios (G1 a G5). É mais robusta para estadiar, mas para <em>dosear</em> um fármaco específico convém seguir o que o RCM indica.</p>

          <h2 style={H2}>Os fármacos que mais exigem atenção</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li><strong>Anticoagulantes orais diretos</strong> (apixabano, rivaroxabano, dabigatrano) — têm cortes de função renal definidos; o dabigatrano é o mais dependente do rim.</li>
            <li><strong>Antibióticos</strong> (vancomicina, aminoglicosídeos, betalactâmicos) — exigem ajuste e, alguns, monitorização de níveis.</li>
            <li><strong>Metformina</strong> — contraindicada abaixo de eGFR 30; rever entre 30-45.</li>
            <li><strong>Heparinas de baixo peso molecular</strong> (enoxaparina) — acumulam na insuficiência renal grave.</li>
            <li><strong>Digoxina, lítio, gabapentina/pregabalina, alopurinol</strong> — janela estreita e eliminação renal.</li>
          </ul>

          <h2 style={H2}>Como ajustar, na prática</h2>
          <p style={P}>O ajuste faz-se de duas formas: <strong>reduzir a dose</strong> de cada toma, ou <strong>espaçar</strong> os intervalos entre tomas — consoante o fármaco. Alguns precisam de dose de carga normal seguida de manutenção reduzida. A fonte de verdade é sempre o RCM do medicamento (INFARMED) ou um guia de referência renal.</p>
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)', marginBottom: 4 }}>✓ Fluxo rápido</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>1) Calcula a função renal · 2) Vê o corte no RCM do fármaco · 3) Aplica a dose/intervalo ajustado · 4) Reavalia se a função renal mudar.</div>
          </div>

          <h2 style={H2}>Cuidados que se esquecem</h2>
          <p style={P}>A creatinina sozinha engana em pessoas com pouca massa muscular (idosos, caquéticos) — pode parecer "normal" com rins maus. A função renal também muda com desidratação e doença aguda, por isso uma estimativa de há meses pode já não valer. E nem todos os fármacos precisam de ajuste — vale confirmar antes de reduzir por reflexo.</p>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Calcula a função renal em segundos</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>As calculadoras clínicas do Phlox incluem Cockcroft-Gault e CKD-EPI, com interpretação por estádio.</p>
          <Link href="/calculos" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Abrir calculadoras clínicas →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Conteúdo educativo para profissionais e estudantes. O doseamento final deve seguir o RCM do medicamento (INFARMED) e o julgamento clínico. Base: KDIGO, INFARMED, literatura de referência renal.
          </p>
        </div>
      </article>
    </div>
  )
}
