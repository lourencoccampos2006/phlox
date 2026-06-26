import Link from 'next/link'
import { Metadata } from 'next'
import ArticleSchema from '@/components/ArticleSchema'

export const metadata: Metadata = {
  title: 'Antibióticos na gravidez — guia por categoria | Phlox',
  description: 'Que antibióticos são seguros na gravidez e quais evitar, por trimestre. Penicilinas, cefalosporinas, macrólidos vs. tetraciclinas e quinolonas. Base EMA/FDA.',
  openGraph: {
    title: 'Antibióticos na gravidez — guia completo por categoria',
    description: 'Quais são seguros, quais evitar, e quando o benefício supera o risco.',
    type: 'article',
  },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 16, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 20 }

export default function PostAntibioticosGravidez() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <ArticleSchema slug="antibioticos-em-gravidez" headline="Antibióticos na gravidez — guia por categoria" description="Que antibióticos são seguros na gravidez e quais evitar, por trimestre: penicilinas, cefalosporinas, macrólidos vs. tetraciclinas e quinolonas." datePublished="2026-02-15" />
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 28, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
          <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
          <span>·</span><span>Gravidez</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: '#faf5ff', color: '#7c3aed', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>GRAVIDEZ</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Antibióticos na gravidez — guia por categoria
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
            Uma infeção não tratada pode ser mais perigosa para o bebé do que o antibiótico certo. A questão raramente é "tomar ou não tomar" — é <strong>qual</strong>. Há antibióticos com longo historial de segurança na gravidez, e outros a evitar.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            <span>15 de Fevereiro de 2026</span><span>·</span><span>10 min de leitura</span><span>·</span><span>Base: EMA, FDA</span>
          </div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #2563eb', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af', letterSpacing: '0.08em', marginBottom: 6 }}>ℹ NUNCA EM AUTOMEDICAÇÃO</div>
          <p style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.7, margin: 0 }}>
            Na gravidez, qualquer antibiótico tem de ser prescrito por um médico que conheça a situação. Este guia ajuda a perceber as categorias — não a escolher sozinha.
          </p>
        </div>

        <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
          <h2 style={H2}>Geralmente considerados seguros</h2>
          <p style={P}>Têm décadas de uso e bom perfil de segurança em grávidas:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong>Penicilinas</strong> (amoxicilina, amoxicilina+ácido clavulânico) — das mais usadas e estudadas.</li>
            <li><strong>Cefalosporinas</strong> (cefuroxima, cefalexina) — alternativa frequente às penicilinas.</li>
            <li><strong>Azitromicina e eritromicina</strong> (macrólidos) — úteis em alergia à penicilina (evitar o estolato de eritromicina).</li>
            <li><strong>Nitrofurantoína</strong> — comum nas infeções urinárias, mas <em>evitada perto do parto</em> (risco de icterícia no recém-nascido).</li>
            <li><strong>Fosfomicina</strong> — opção em dose única para infeção urinária.</li>
          </ul>

          <h2 style={H2}>A evitar (salvo decisão médica ponderada)</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong>Tetraciclinas</strong> (doxiciclina, minociclina) — podem afetar ossos e dentes do bebé a partir do 2.º trimestre.</li>
            <li><strong>Quinolonas</strong> (ciprofloxacina, levofloxacina) — preocupação com a cartilagem em desenvolvimento.</li>
            <li><strong>Cotrimoxazol</strong> (sulfametoxazol+trimetoprim) — evitar no 1.º trimestre (antifolato) e perto do parto.</li>
            <li><strong>Aminoglicosídeos</strong> (gentamicina) — risco para a audição do bebé; só quando não há alternativa.</li>
          </ul>

          <h2 style={H2}>O trimestre importa</h2>
          <p style={P}>O <strong>1.º trimestre</strong> é o mais sensível (formação dos órgãos) — daí evitarem-se antifolatos como o cotrimoxazol. No <strong>fim da gravidez</strong>, a preocupação muda para o efeito no recém-nascido (ex.: nitrofurantoína perto do parto). Por isso a mesma infeção pode ter respostas diferentes consoante a semana.</p>

          <h2 style={H2}>E se for alérgica à penicilina?</h2>
          <p style={P}>Diz sempre ao médico. Muitas alergias "registadas" não se confirmam, mas nunca se testa por conta própria. Os macrólidos (azitromicina) e algumas cefalosporinas são alternativas frequentes — a escolha é do médico.</p>

          <h2 style={H2}>O que dizer ao médico</h2>
          <ul style={{ paddingLeft: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['"Estou grávida de quantas semanas e este antibiótico é o mais seguro para esta fase?"', '"Sou alérgica a algum antibiótico — qual é a alternativa?"', '"Há alguma precaução perto do parto?"'].map(q => (
              <li key={q} style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{q}</li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Percebe a tua receita e a tua medicação</div>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>Tira foto a um medicamento e o Phlox explica o que é, para que serve e os cuidados — em português simples.</p>
          <Link href="/scan" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Experimentar o Phlox Scan →</Link>
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
            Este artigo destina-se a fins informativos e educativos. Não substitui o aconselhamento médico. Na gravidez, nenhum antibiótico deve ser tomado sem prescrição. Base: EMA, FDA, NIH.
          </p>
        </div>
      </article>
    </div>
  )
}
