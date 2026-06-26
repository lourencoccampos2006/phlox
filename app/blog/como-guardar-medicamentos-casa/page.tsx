// app/blog/como-guardar-medicamentos-casa/page.tsx
// Conteúdo — "como guardar/conservar medicamentos em casa". SSR + schema.
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como Guardar Medicamentos em Casa (e Quando Deitar Fora) | Phlox',
  description: 'Onde guardar os medicamentos, o erro de os ter na casa de banho, o que precisa de frigorífico, prazos de validade depois de abertos e como deitar fora em segurança (VALORMED).',
  keywords: 'como guardar medicamentos, conservar medicamentos casa, validade medicamentos abertos, valormed, medicamentos frigorifico',
  openGraph: {
    title: 'Como Guardar Medicamentos em Casa (e Quando Deitar Fora)',
    description: 'Onde guardar, o que precisa de frio, validade depois de aberto e como deitar fora com segurança.',
    type: 'article',
  },
  alternates: { canonical: 'https://phloxclinical.com/blog/como-guardar-medicamentos-casa' },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 18 }

function Schema() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Como Guardar Medicamentos em Casa (e Quando Deitar Fora)',
    description: 'Onde guardar os medicamentos, o que precisa de frio, validade depois de aberto e como deitar fora com segurança.',
    author: { '@type': 'Organization', name: 'Phlox Clinical' },
    publisher: { '@type': 'Organization', name: 'Phlox Clinical', url: 'https://phloxclinical.com' },
    datePublished: '2026-06-16', dateModified: '2026-06-16',
    url: 'https://phloxclinical.com/blog/como-guardar-medicamentos-casa',
    mainEntityOfPage: 'https://phloxclinical.com/blog/como-guardar-medicamentos-casa',
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}

export default function PostGuardarMeds() {
  return (
    <>
      <Schema />
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
            <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
            <span>·</span><span>Em casa</span>
          </div>

          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'inline-block', background: '#ecfeff', color: '#0e7490', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>EM CASA</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,5vw,38px)', color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
              Como guardar medicamentos em casa (e quando deitar fora)
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
              A maioria das pessoas guarda os medicamentos no pior sítio possível — a casa de banho. O calor e a humidade estragam-nos antes do prazo. Aqui fica como conservar bem, o que precisa de frio, e como livrar-se do que já não presta.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              <span>Atualizado em Junho de 2026</span><span>·</span><span>6 min de leitura</span>
            </div>
          </div>

          <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
            <h2 style={{ ...H2, marginTop: 0 }}>O pior sítio: a casa de banho (e a cozinha)</h2>
            <p style={P}>Parece o lugar natural, mas é o pior. Sempre que toma banho, a casa de banho enche-se de <strong>calor e vapor</strong> — exatamente as duas coisas que degradam os medicamentos. A humidade faz os comprimidos amolecerem e perderem eficácia muito antes do prazo de validade. A cozinha tem o mesmo problema por causa do fogão e do vapor.</p>
            <p style={P}>O sítio certo é um armário ou gaveta <strong>fresco, seco e ao abrigo da luz</strong> — por exemplo, no quarto ou num corredor. E, obrigatoriamente, <strong>fora do alcance das crianças</strong>: idealmente num armário alto ou com fecho.</p>

            <h2 style={H2}>O que precisa mesmo de frigorífico</h2>
            <p style={P}>A maioria dos medicamentos <strong>não</strong> vai ao frigorífico — e pô-los lá sem necessidade pode até prejudicá-los. Vão ao frio só os que a caixa diz "conservar entre 2°C e 8°C", tipicamente:</p>
            <ul style={{ paddingLeft: 22, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <li><strong>Insulinas</strong> (a fechar; a que está em uso pode ficar fora, ver a bula)</li>
              <li>Alguns <strong>colírios</strong> e antibióticos em xarope depois de preparados</li>
              <li>Certos injetáveis e vacinas</li>
            </ul>
            <p style={P}>Regra de ouro: guarde no frigorífico, mas <strong>nunca no congelador</strong> nem encostado à parede do fundo (onde congela). E não deixe ao alcance de crianças que abrem o frigorífico.</p>

            <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderLeft: '4px solid #0e7490', borderRadius: '0 8px 8px 0', padding: '14px 18px', marginBottom: 28 }}>
              <p style={{ fontSize: 14, color: '#155e75', lineHeight: 1.7, margin: 0 }}>
                <strong>Dica:</strong> mantenha sempre o medicamento <strong>dentro da caixa original com a bula</strong>. A caixa protege da luz e a bula tem a validade, a dose e as instruções. Tirar tudo para uma caixa semanal é ótimo para a rotina diária — mas guarde as embalagens originais à parte para consulta.
              </p>
            </div>

            <h2 style={H2}>Validade: a data na caixa não conta sempre</h2>
            <p style={P}>O prazo impresso na caixa vale para o produto <strong>fechado</strong>. Depois de aberto, muitos perdem validade mais cedo:</p>
            <ul style={{ paddingLeft: 22, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <li><strong>Colírios:</strong> normalmente até 28 dias depois de abertos, mesmo que a caixa diga mais.</li>
              <li><strong>Xaropes e antibióticos preparados:</strong> dias a poucas semanas — vem indicado na bula.</li>
              <li><strong>Cremes e pomadas:</strong> verificar o símbolo do frasco aberto com um número e "M" (meses).</li>
            </ul>
            <p style={P}>Escreva a <strong>data de abertura</strong> na embalagem com caneta. É o truque mais simples para nunca usar um colírio ou xarope estragado.</p>

            <h2 style={H2}>Como deitar fora: nunca no lixo nem na sanita</h2>
            <p style={P}>Medicamentos fora do prazo ou que já não usa <strong>não</strong> se deitam no lixo comum nem na sanita — contaminam a água e o ambiente. Em Portugal, entregue-os na <strong>farmácia</strong>, no contentor <strong>VALORMED</strong>. Aceitam medicamentos fora de prazo, sobras e até as embalagens vazias. É gratuito e é o destino correto.</p>

            <h2 style={H2}>Faça uma "limpeza" duas vezes por ano</h2>
            <p style={P}>Vale a pena, a cada seis meses, abrir o sítio onde guarda os medicamentos e: tirar tudo o que está fora de prazo, juntar para levar à farmácia, e confirmar que não tem dois medicamentos repetidos com a mesma substância. Quem cuida de uma pessoa idosa devia fazer isto com regularidade — é onde aparecem mais erros e medicamentos esquecidos.</p>
          </div>

          <div style={{ marginTop: 44, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Tenha a lista de medicamentos sempre à mão</div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>No Phlox, fotografe as caixas e fique com a lista organizada — com validades, para que serve cada um e lembretes de toma no calendário do telemóvel.</p>
            <Link href="/login" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Organizar a medicação →</Link>
          </div>

          <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
              Artigo informativo. Em caso de dúvida sobre a conservação de um medicamento específico, consulte a bula ou pergunte na farmácia. Base: INFARMED, VALORMED, DGS.
            </p>
          </div>
        </article>
      </div>
    </>
  )
}
