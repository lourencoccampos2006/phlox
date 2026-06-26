// app/blog/como-ler-receita-medica/page.tsx
// Artigo de conteúdo — "como ler uma receita médica / guia de saúde Portugal".
// SSR, texto rico, schema JSON-LD. Conteúdo único e específico de Portugal.
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Como Ler uma Receita Médica em Portugal (Guia Completo 2026) | Phlox',
  description: 'O que significam DCI, posologia, "1+0+1", a receita eletrónica do SNS, o código de dispensa e a comparticipação. Aprenda a ler a sua receita sem dúvidas.',
  keywords: 'como ler receita médica, receita eletrónica SNS, DCI posologia, código de dispensa, comparticipação medicamentos portugal',
  openGraph: {
    title: 'Como Ler uma Receita Médica em Portugal',
    description: 'DCI, posologia, receita eletrónica do SNS e comparticipação — explicado em linguagem simples.',
    type: 'article',
  },
  alternates: { canonical: 'https://phloxclinical.com/blog/como-ler-receita-medica' },
}

const H2: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 14, marginTop: 40, letterSpacing: '-0.015em' }
const P: React.CSSProperties = { marginBottom: 18 }

function Schema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Como Ler uma Receita Médica em Portugal',
    description: 'Guia para entender a receita eletrónica do SNS: DCI, posologia, código de dispensa e comparticipação.',
    author: { '@type': 'Organization', name: 'Phlox Clinical' },
    publisher: { '@type': 'Organization', name: 'Phlox Clinical', url: 'https://phloxclinical.com' },
    datePublished: '2026-06-20',
    dateModified: '2026-06-20',
    url: 'https://phloxclinical.com/blog/como-ler-receita-medica',
    mainEntityOfPage: 'https://phloxclinical.com/blog/como-ler-receita-medica',
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}

export default function PostLerReceita() {
  return (
    <>
      <Schema />
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <article style={{ maxWidth: 680, margin: '0 auto', padding: '52px 24px 80px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
            <Link href="/blog" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Blog</Link>
            <span>·</span><span>Guia prático</span>
          </div>

          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', marginBottom: 16 }}>GUIA PRÁTICO</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,5vw,38px)', color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
              Como ler uma receita médica em Portugal
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
              A receita eletrónica do SNS tem várias informações que muita gente não percebe — e isso leva a tomar mal os medicamentos. Este guia explica, parte a parte, o que cada coisa quer dizer.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              <span>Atualizado em Junho de 2026</span><span>·</span><span>7 min de leitura</span>
            </div>
          </div>

          <div style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.85 }}>
            <h2 style={{ ...H2, marginTop: 0 }}>A receita já não é em papel — é uma SMS ou um papel com códigos</h2>
            <p style={P}>Desde 2016 que quase todas as receitas em Portugal são <strong>eletrónicas (a chamada receita sem papel)</strong>. O médico passa a receita no computador e você recebe a informação de três formas possíveis: por <strong>SMS</strong>, por <strong>email</strong>, ou num papel chamado <em>guia de tratamento</em>. Em qualquer dos casos, o que interessa para levantar os medicamentos são três códigos.</p>

            <h2 style={H2}>Os três códigos que a farmácia precisa</h2>
            <ul style={{ paddingLeft: 22, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><strong>Número da receita</strong> — uma sequência longa (19 dígitos) que identifica a receita.</li>
              <li><strong>Código de dispensa (ou de acesso)</strong> — 6 dígitos. É o que "abre" a receita na farmácia.</li>
              <li><strong>Código de direito de opção</strong> — 4 dígitos. Só é usado se quiser escolher uma marca específica em vez do genérico.</li>
            </ul>
            <p style={P}>Se recebeu a receita por SMS, estes números estão todos lá. Não precisa de levar papel nenhum — basta mostrar a SMS ou dizer os códigos. Guarde a mensagem até levantar tudo, porque uma receita pode dar para <strong>várias dispensas</strong> (por exemplo, medicação crónica para 3 meses, levantada mês a mês).</p>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #1d4ed8', borderRadius: '0 8px 8px 0', padding: '14px 18px', marginBottom: 28 }}>
              <p style={{ fontSize: 14, color: '#1e3a8a', lineHeight: 1.7, margin: 0 }}>
                <strong>Dica:</strong> se perder a SMS, a farmácia consegue, com o seu cartão de cidadão e número de utente, aceder à receita na maioria dos casos. Não fica sem a medicação por ter apagado a mensagem.
              </p>
            </div>

            <h2 style={H2}>DCI: porque é que o nome na receita não é o da caixa</h2>
            <p style={P}>Quase de certeza já reparou que o nome na receita não bate certo com o nome da caixa que trouxe da farmácia. Isto é normal e é por uma boa razão. A receita é passada pela <strong>DCI — Denominação Comum Internacional</strong>, que é o nome da <em>substância ativa</em>, não da marca.</p>
            <p style={P}>Por exemplo: a receita diz <strong>"paracetamol 1000 mg"</strong>. Na farmácia, isso pode ser dispensado como <em>Ben-u-ron</em>, <em>Panasorbe</em>, ou um genérico — todos têm a mesma substância. O médico receita a substância; você (ou o farmacêutico) escolhe a marca, normalmente a mais barata. Por lei, a farmácia tem de lhe oferecer um dos genéricos mais baratos disponíveis.</p>

            <h2 style={H2}>A posologia: o que significa "1 + 0 + 1"</h2>
            <p style={P}>A parte mais importante — e a que mais se percebe mal — é a <strong>posologia</strong>: quantos comprimidos tomar e quando. Em Portugal vê muitas vezes um formato de três (ou quatro) números separados:</p>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>1 + 0 + 1</div>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>
                Lê-se da esquerda para a direita ao longo do dia: <strong>1 ao pequeno-almoço</strong>, <strong>0 ao almoço</strong>, <strong>1 ao jantar</strong>. Ou seja, dois comprimidos por dia, um de manhã e um à noite.
              </p>
            </div>
            <p style={P}>Se vir quatro números (ex.: <strong>1+1+1+1</strong>), o quarto costuma ser o <strong>deitar</strong>. "Em SOS" ou "se necessário" significa tomar só quando tem o sintoma (por exemplo, dor), não de forma fixa. Se a receita diz "de 8 em 8 horas", divida o dia em três: por exemplo 8h, 16h, 24h.</p>

            <h2 style={H2}>Comparticipação: porque é que o preço muda</h2>
            <p style={P}>O Estado paga uma parte de muitos medicamentos — é a <strong>comparticipação</strong>. A percentagem depende do escalão do medicamento e do seu caso (há um regime especial para pensionistas com baixos rendimentos). Por isso o mesmo medicamento pode custar-lhe valores diferentes de outra pessoa. Na receita, se houver a sigla <strong>"R"</strong> ou <strong>"O"</strong> junto ao medicamento, indica regimes especiais de comparticipação — não é erro.</p>

            <h2 style={H2}>Validade: a receita não dura para sempre</h2>
            <p style={P}>Uma receita normal é válida por <strong>30 dias</strong>. As receitas de medicação crónica (renováveis) podem valer até <strong>6 meses</strong>, com várias vias para levantar ao longo desse tempo. Se passar da validade, tem de pedir nova receita — não é preciso consulta em muitos casos, basta contactar o centro de saúde.</p>

            <h2 style={H2}>Erros comuns a evitar</h2>
            <ul style={{ paddingLeft: 22, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Parar um antibiótico quando se sente melhor — deve completar sempre o ciclo indicado.</li>
              <li>Assumir que "comprimido" e "cápsula" são iguais em dose — confirme sempre os mg.</li>
              <li>Tomar dois medicamentos com a mesma substância sem saber (ex.: paracetamol num analgésico e noutro para a constipação) — pode levar a uma sobredosagem sem dar conta.</li>
            </ul>
          </div>

          <div style={{ marginTop: 44, padding: '24px', background: 'white', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>Não percebe a sua receita ou a caixa?</div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>Fotografe a receita ou a caixa no Phlox e ele explica, em palavras simples, para que serve cada medicamento e como o tomar.</p>
            <Link href="/login" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Experimentar grátis →</Link>
          </div>

          <div style={{ marginTop: 32, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, margin: 0, fontFamily: 'var(--font-mono)' }}>
              Artigo informativo. Não substitui o aconselhamento do seu médico ou farmacêutico. Em caso de dúvida sobre uma receita, fale com a farmácia onde a levanta. Base: SNS, INFARMED, SPMS.
            </p>
          </div>
        </article>
      </div>
    </>
  )
}
