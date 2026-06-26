// app/blog/medicamentos-sem-receita-cuidados/page.tsx
// Conteúdo — "medicamentos sem receita / automedicação cuidados". SSR + schema.
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Medicamentos Sem Receita: O Que Pode (e Não Deve) Misturar | Phlox',
  description: 'Paracetamol, ibuprofeno, antiácidos, xaropes para a tosse — o que é seguro tomar em casa, o que não combinar, e quando a automedicação se torna perigosa.',
  keywords: 'medicamentos sem receita, automedicação, paracetamol ibuprofeno juntos, misturar medicamentos farmácia, MNSRM',
  openGraph: {
    title: 'Medicamentos Sem Receita: O Que Pode (e Não Deve) Misturar',
    description: 'O que é seguro tomar em casa, o que não combinar, e quando a automedicação se torna perigosa.',
    type: 'article',
  },
  alternates: { canonical: 'https://phloxclinical.com/blog/medicamentos-sem-receita-cuidados' },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 18 }

function Schema() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Medicamentos Sem Receita: O Que Pode (e Não Deve) Misturar',
    description: 'Guia de automedicação segura: paracetamol, ibuprofeno, antiácidos e xaropes — o que combinar e o que evitar.',
    author: { '@type': 'Organization', name: 'Phlox Clinical' },
    publisher: { '@type': 'Organization', name: 'Phlox Clinical', url: 'https://phloxclinical.com' },
    datePublished: '2026-06-18', dateModified: '2026-06-18',
    url: 'https://phloxclinical.com/blog/medicamentos-sem-receita-cuidados',
    mainEntityOfPage: 'https://phloxclinical.com/blog/medicamentos-sem-receita-cuidados',
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}

export default function PostMNSRM() {
  return (
    <>
      <Schema />
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
            <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
            <span>·</span><span>Segurança</span>
          </div>

          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'inline-block', background: '#f0fdf5', color: '#0d6e42', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>SEGURANÇA</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,5vw,38px)', color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
              Medicamentos sem receita: o que pode (e não deve) misturar
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
              Os medicamentos de venda livre parecem inofensivos — mas misturados, ou em quem já toma outra coisa, podem fazer mal. Aqui fica o que é seguro, o que evitar, e o sinal de que é hora de falar com o farmacêutico.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              <span>Atualizado em Junho de 2026</span><span>·</span><span>8 min de leitura</span>
            </div>
          </div>

          <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
            <h2 style={{ ...H2, marginTop: 0 }}>Paracetamol e ibuprofeno: podem dar-se juntos?</h2>
            <p style={P}>Sim — e esta é uma das poucas combinações que é mesmo segura e até útil. O paracetamol e o ibuprofeno funcionam de maneiras diferentes, por isso podem ser tomados em conjunto para dor ou febre que não cede só com um deles. A forma mais comum é <strong>alterná-los</strong>: por exemplo, paracetamol e, três horas depois, ibuprofeno. O que <strong>não</strong> deve fazer é ultrapassar a dose máxima diária de cada um.</p>
            <p style={P}>O cuidado real está noutro lado: o ibuprofeno (e outros anti-inflamatórios como o naproxeno ou o diclofenac) é que tem mais limitações. Não é para quem tem <strong>úlcera, problemas renais, insuficiência cardíaca</strong>, nem para quem toma <strong>anticoagulantes</strong> (como a varfarina). Nesses casos, o paracetamol sozinho é a escolha mais segura.</p>

            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0', padding: '14px 18px', marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.08em', marginBottom: 5 }}>⚠ O ERRO MAIS PERIGOSO</div>
              <p style={{ fontSize: 14, color: '#742a2a', lineHeight: 1.7, margin: 0 }}>
                Tomar paracetamol "escondido" em vários produtos ao mesmo tempo. Muitos medicamentos para constipação e gripe já <strong>contêm paracetamol</strong>. Se juntar a isso comprimidos de paracetamol para a dor, pode passar a dose máxima sem dar conta — e o excesso de paracetamol faz mal ao fígado. Leia sempre os componentes.
              </p>
            </div>

            <h2 style={H2}>Antiácidos: o problema do "engole tudo junto"</h2>
            <p style={P}>Antiácidos (para a azia) e protetores do estômago são seguros para uso pontual. Mas os antiácidos com cálcio, magnésio ou alumínio podem <strong>reduzir a absorção</strong> de outros medicamentos se tomados ao mesmo tempo — incluindo alguns antibióticos, a levotiroxina (tiroide) e o ferro. A regra prática: deixe <strong>pelo menos 2 horas</strong> entre o antiácido e outro medicamento importante.</p>

            <h2 style={H2}>Xaropes para a tosse: nem todos servem para a mesma tosse</h2>
            <p style={P}>Há dois tipos quase opostos e misturá-los não faz sentido. Os <strong>antitússicos</strong> (com dextrometorfano, por exemplo) travam a tosse seca. Os <strong>expetorantes/mucolíticos</strong> (acetilcisteína, ambroxol) ajudam a soltar a expetoração na tosse com catarro. Tomar os dois ao mesmo tempo é contraditório: um quer travar, o outro quer pôr a expulsar. Escolha conforme a tosse — e se não souber, pergunte na farmácia.</p>

            <h2 style={H2}>Álcool e medicamentos de venda livre</h2>
            <p style={P}>O álcool aumenta o risco de lesão no fígado com o paracetamol e de irritação/hemorragia no estômago com os anti-inflamatórios. Com anti-histamínicos para alergias ou para dormir, o álcool potencia a sonolência. Em todos os casos, o bom senso é o mesmo: não associar álcool a medicação, sobretudo se for conduzir.</p>

            <h2 style={H2}>Quando a automedicação deixa de ser segura</h2>
            <p style={P}>Tratar uma dor de cabeça pontual ou uma azia ocasional em casa é razoável. Deixa de o ser quando:</p>
            <ul style={{ paddingLeft: 22, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>O sintoma <strong>dura mais de alguns dias</strong> sem melhorar (ex.: dor que não passa, febre que persiste).</li>
              <li>Toma <strong>medicação crónica</strong> — aí qualquer adição pode interagir e vale a pena confirmar antes.</li>
              <li>Está <strong>grávida, a amamentar</strong>, ou é para uma <strong>criança</strong> — as regras mudam por completo.</li>
              <li>Está a tomar o mesmo medicamento de venda livre <strong>há semanas</strong> (ex.: anti-inflamatórios ou laxantes em uso contínuo).</li>
            </ul>
            <p style={P}>O farmacêutico é o profissional de saúde mais acessível do país: não precisa de marcação nem de pagar consulta. Antes de misturar coisas, vale sempre a pergunta no balcão.</p>
          </div>

          <div style={{ marginTop: 44, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Quer ter a certeza antes de misturar?</div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>O verificador do Phlox cruza tudo o que toma — incluindo medicamentos de venda livre — e diz-lhe o risco de cada combinação.</p>
            <Link href="/interactions" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Verificar interações grátis →</Link>
          </div>

          <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
              Artigo informativo e educativo. Não substitui o aconselhamento de um profissional de saúde. Em caso de dúvida, fale com o seu farmacêutico ou médico. Base: INFARMED, EMA, DGS.
            </p>
          </div>
        </article>
      </div>
    </>
  )
}
