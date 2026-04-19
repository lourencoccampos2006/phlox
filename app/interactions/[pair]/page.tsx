import { Metadata } from 'next'
import Link from 'next/link'

// Top combinações pesquisadas — cada uma é uma página SEO indexada
// Gera /interactions/ibuprofeno-varfarina, /interactions/metformina-alcool, etc.

interface Props {
  params: Promise<{ pair: string }>
}

const DRUG_NAME_MAP: Record<string, string> = {
  'ibuprofeno': 'Ibuprofeno', 'varfarina': 'Varfarina', 'metformina': 'Metformina',
  'alcool': 'Álcool', 'aspirina': 'Aspirina', 'heparina': 'Heparina',
  'sertralina': 'Sertralina', 'hipericao': 'Hipericão', 'atorvastatina': 'Atorvastatina',
  'claritromicina': 'Claritromicina', 'digoxina': 'Digoxina', 'amiodarona': 'Amiodarona',
  'paracetamol': 'Paracetamol', 'codeina': 'Codeína', 'tramadol': 'Tramadol',
  'morfina': 'Morfina', 'diazepam': 'Diazepam', 'lorazepam': 'Lorazepam',
  'omeprazol': 'Omeprazol', 'clopidogrel': 'Clopidogrel', 'rivaroxabano': 'Rivaroxabano',
  'apixabano': 'Apixabano', 'lisinopril': 'Lisinopril', 'metoprolol': 'Metoprolol',
}

function parsePair(slug: string): [string, string] {
  const parts = slug.split('-e-')
  if (parts.length === 2) return [parts[0], parts[1]]
  // fallback: split on last hyphen
  const idx = slug.lastIndexOf('-')
  return [slug.slice(0, idx), slug.slice(idx + 1)]
}

function displayName(slug: string): string {
  return DRUG_NAME_MAP[slug] || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params
  const [d1, d2] = parsePair(pair)
  const n1 = displayName(d1)
  const n2 = displayName(d2)
  return {
    title: `Interação ${n1} + ${n2} — Gravidade e Recomendações | Phlox`,
    description: `Qual a interação medicamentosa entre ${n1} e ${n2}? Gravidade, mecanismo, consequências e recomendação clínica. Dados RxNorm/NIH.`,
    openGraph: {
      title: `${n1} + ${n2} — Interação Medicamentosa`,
      description: `Verifica a interação entre ${n1} e ${n2}. Classificação de gravidade, mecanismo e recomendação.`,
      type: 'article',
    },
    alternates: { canonical: `https://phlox.health/interactions/${pair}` },
  }
}

export default async function InteractionPairPage({ params }: Props) {
  const { pair } = await params
  const [d1slug, d2slug] = parsePair(pair)
  const drug1 = displayName(d1slug)
  const drug2 = displayName(d2slug)

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `${drug1} e ${drug2} podem ser tomados juntos?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `A interação entre ${drug1} e ${drug2} deve ser verificada com o verificador de interações da Phlox, que usa dados RxNorm/NIH. Consulta sempre um médico ou farmacêutico antes de combinar medicamentos.`,
            },
          },
          {
            '@type': 'Question',
            name: `Qual a gravidade da interação entre ${drug1} e ${drug2}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `A gravidade da interação entre ${drug1} e ${drug2} é classificada como GRAVE, MODERADA, LIGEIRA ou SEM INTERAÇÃO CONHECIDA pela base de dados RxNorm do NIH. Usa o verificador da Phlox para saber exactamente.`,
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Phlox', item: 'https://phlox.health' },
          { '@type': 'ListItem', position: 2, name: 'Interações', item: 'https://phlox.health/interactions' },
          { '@type': 'ListItem', position: 3, name: `${drug1} + ${drug2}`, item: `https://phlox.health/interactions/${pair}` },
        ],
      },
    ],
  }

  // Related pairs for internal linking
  const relatedPairs = [
    { href: '/interactions/ibuprofeno-e-varfarina', label: 'Ibuprofeno + Varfarina' },
    { href: '/interactions/metformina-e-alcool', label: 'Metformina + Álcool' },
    { href: '/interactions/aspirina-e-heparina', label: 'Aspirina + Heparina' },
    { href: '/interactions/sertralina-e-hipericao', label: 'Sertralina + Hipericão' },
    { href: '/interactions/atorvastatina-e-claritromicina', label: 'Atorvastatina + Claritromicina' },
    { href: '/interactions/digoxina-e-amiodarona', label: 'Digoxina + Amiodarona' },
  ].filter(p => !p.href.includes(d1slug) && !p.href.includes(d2slug)).slice(0, 4)

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* Minimal header */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>Phlox</Link>
          <span style={{ color: 'var(--border-2)' }}>|</span>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, minWidth: 0 }}>
            <Link href="/interactions" style={{ color: 'var(--ink-3)', textDecoration: 'none', flexShrink: 0 }}>Interações</Link>
            <span style={{ color: 'var(--border-2)', flexShrink: 0 }}>›</span>
            <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drug1} + {drug2}</span>
          </nav>
        </div>
      </header>

      <div className="page-container page-body">
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Interação entre {drug1} e {drug2}
            </h1>
            <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>
              Verifica em tempo real a gravidade, mecanismo e recomendação clínica para a combinação de {drug1} com {drug2}.
            </p>
          </div>

          {/* Live checker CTA */}
          <div style={{ background: 'var(--green)', borderRadius: 8, padding: '24px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 6 }}>VERIFICADOR EM TEMPO REAL</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white', marginBottom: 4 }}>{drug1} + {drug2}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Clica para ver a classificação de gravidade e recomendação clínica completa.</div>
            </div>
            <Link
              href={`/interactions?d1=${encodeURIComponent(d1slug)}&d2=${encodeURIComponent(d2slug)}`}
              style={{ background: 'white', color: 'var(--green)', textDecoration: 'none', padding: '12px 24px', borderRadius: 6, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Verificar agora →
            </Link>
          </div>

          {/* FAQ sections for SEO */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
            {[
              {
                q: `${drug1} e ${drug2} podem ser tomados juntos?`,
                a: `A combinação de ${drug1} com ${drug2} pode envolver interações farmacológicas clinicamente relevantes. A gravidade depende das características do doente, das doses e da duração do tratamento. Usa o verificador da Phlox para obter a classificação exacta baseada em dados RxNorm/NIH.`,
              },
              {
                q: `Quais os riscos de tomar ${drug1} com ${drug2}?`,
                a: `Os riscos da combinação de ${drug1} com ${drug2} incluem potenciais interações farmacocinéticas (ao nível da absorção, metabolismo ou excreção) ou farmacodinâmicas (efeitos aditivos ou antagonistas). A classificação exacta e as recomendações clínicas estão disponíveis no verificador de interações da Phlox.`,
              },
              {
                q: `O que fazer se estiver a tomar ${drug1} e ${drug2}?`,
                a: `Se estiveres a tomar ${drug1} e ${drug2} simultaneamente, consulta o teu médico ou farmacêutico. Verifica a interação no nosso verificador e partilha o resultado com o teu profissional de saúde. Nunca interrompas ou alters a medicação sem aconselhamento médico.`,
              },
            ].map(({ q, a }, i) => (
              <div key={i} style={{ padding: '20px 24px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>{q}</h2>
                <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>

          {/* Related searches */}
          {relatedPairs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Outras interações verificadas</div>
              <div className="card-grid-2" style={{ gap: 8 }}>
                {relatedPairs.map(({ href, label }) => (
                  <Link key={href} href={href}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 16px', textDecoration: 'none', fontSize: 14, color: 'var(--ink-2)', display: 'block' }}>
                    {label} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ padding: '14px 18px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
            ⚕️ Informação educacional. Não substitui aconselhamento médico ou farmacêutico profissional. Dados: RxNorm/NIH · OpenFDA.
          </div>
        </div>
      </div>
    </div>
  )
}