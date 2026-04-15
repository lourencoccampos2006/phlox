// app/drugs/[slug]/page.tsx
// Este ficheiro vai para: app/drugs/[slug]/page.tsx
// Cria a pasta: app/drugs/[slug]/
//
// Esta é a página mais importante para SEO.
// Cada URL /drugs/ibuprofen é uma página estática com:
// - H1, H2 com palavras-chave naturais
// - Schema.org structured data (Drug, MedicalWebPage, FAQPage, BreadcrumbList)
// - Metadata optimizado para Google, ChatGPT, Gemini, Perplexity
// - Perguntas em formato natural para AEO (featured snippets)

import { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

interface DrugData {
  name: string
  generic_name: string
  brand_names: string[]
  manufacturer: string
  indications: string
  dosage: string
  contraindications: string
  warnings: string
  adverse_reactions: string
  top_adverse_events: { term: string; count: number }[]
}

async function getDrugData(slug: string): Promise<DrugData | null> {
  try {
    const name = slug.replace(/-/g, ' ')
    const [labelRes, adverseRes] = await Promise.allSettled([
      fetch(
        `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(name)}"&limit=1`,
        { next: { revalidate: 86400 } } // Cache 24h — dados não mudam frequentemente
      ),
      fetch(
        `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(name)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`,
        { next: { revalidate: 86400 } }
      ),
    ])

    const labelData = labelRes.status === 'fulfilled' && labelRes.value.ok
      ? await labelRes.value.json() : null
    const adverseData = adverseRes.status === 'fulfilled' && adverseRes.value.ok
      ? await adverseRes.value.json() : null

    const drug = labelData?.results?.[0]
    if (!drug) return null

    return {
      name,
      generic_name: drug.openfda?.generic_name?.[0] || name,
      brand_names: drug.openfda?.brand_name || [],
      manufacturer: drug.openfda?.manufacturer_name?.[0] || '',
      indications: drug.indications_and_usage?.[0] || '',
      dosage: drug.dosage_and_administration?.[0] || '',
      contraindications: drug.contraindications?.[0] || '',
      warnings: drug.warnings?.[0] || '',
      adverse_reactions: drug.adverse_reactions?.[0] || '',
      top_adverse_events: adverseData?.results?.slice(0, 10) || [],
    }
  } catch {
    return null
  }
}

function truncate(text: string, len: number) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len).trim() + '…' : text
}

// generateMetadata — corre no servidor antes de renderizar
// Gera título e descrição únicos para cada medicamento
// Crítico para SEO — cada página tem metadata diferente e optimizado
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const drug = await getDrugData(params.slug)
  const name = params.slug.replace(/-/g, ' ')
  const displayName = drug?.generic_name || name

  const title = `${displayName} — Indicações, Doses e Efeitos Adversos`
  const description = drug?.indications
    ? `${displayName}: ${truncate(drug.indications, 120)}. Informação clínica completa, posologia, contraindicações e efeitos adversos. Dados FDA.`
    : `Informação clínica completa sobre ${displayName}. Posologia, efeitos adversos, contraindicações e interações. Dados FDA.`

  return {
    title,
    description,
    keywords: [
      displayName,
      `${displayName} efeitos adversos`,
      `${displayName} dose`,
      `${displayName} para que serve`,
      `${displayName} contraindicações`,
      `${displayName} bula`,
      ...(drug?.brand_names?.slice(0, 3) || []),
    ].join(', '),
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${BASE_URL}/drugs/${params.slug}`,
      siteName: 'Phlox Clinical',
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE_URL}/drugs/${params.slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function DrugPage({ params }: { params: { slug: string } }) {
  const drug = await getDrugData(params.slug)
  const name = params.slug.replace(/-/g, ' ')

  // Structured data — o coração do SEO, GEO e AEO
  // Drug: diz ao Google exactamente o que esta página descreve
  // MedicalWebPage: credencia a página como conteúdo médico verificado
  // FAQPage: cada pergunta pode aparecer como featured snippet no Google (AEO)
  // BreadcrumbList: melhora a apresentação nos resultados de pesquisa
  const structuredData = drug ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Drug',
        '@id': `${BASE_URL}/drugs/${params.slug}`,
        name: drug.generic_name,
        alternateName: drug.brand_names,
        manufacturer: drug.manufacturer
          ? { '@type': 'Organization', name: drug.manufacturer }
          : undefined,
        description: truncate(drug.indications, 300),
        warning: truncate(drug.warnings, 300),
        url: `${BASE_URL}/drugs/${params.slug}`,
      },
      {
        '@type': 'MedicalWebPage',
        url: `${BASE_URL}/drugs/${params.slug}`,
        name: `${drug.generic_name} — Informação Clínica`,
        description: `Informação farmacológica completa sobre ${drug.generic_name}`,
        lastReviewed: new Date().toISOString().split('T')[0],
        audience: {
          '@type': 'MedicalAudience',
          audienceType: 'Patient, Caregiver, Pharmacist, Physician',
        },
      },
      {
        '@type': 'FAQPage',
        // Cada question é uma pesquisa real que as pessoas fazem no Google
        // O Google pode mostrar estas respostas directamente nos resultados (AEO)
        mainEntity: [
          drug.indications && {
            '@type': 'Question',
            name: `Para que serve o ${drug.generic_name}?`,
            acceptedAnswer: { '@type': 'Answer', text: truncate(drug.indications, 300) },
          },
          drug.dosage && {
            '@type': 'Question',
            name: `Qual é a dose correcta do ${drug.generic_name}?`,
            acceptedAnswer: { '@type': 'Answer', text: truncate(drug.dosage, 300) },
          },
          drug.contraindications && {
            '@type': 'Question',
            name: `Quais são as contraindicações do ${drug.generic_name}?`,
            acceptedAnswer: { '@type': 'Answer', text: truncate(drug.contraindications, 300) },
          },
          drug.adverse_reactions && {
            '@type': 'Question',
            name: `Quais são os efeitos secundários do ${drug.generic_name}?`,
            acceptedAnswer: { '@type': 'Answer', text: truncate(drug.adverse_reactions, 300) },
          },
          drug.warnings && {
            '@type': 'Question',
            name: `Quais são os cuidados a ter com o ${drug.generic_name}?`,
            acceptedAnswer: { '@type': 'Answer', text: truncate(drug.warnings, 300) },
          },
        ].filter(Boolean),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Phlox', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Medicamentos', item: `${BASE_URL}/drugs` },
          { '@type': 'ListItem', position: 3, name: drug.generic_name, item: `${BASE_URL}/drugs/${params.slug}` },
        ],
      },
    ].filter(Boolean),
  } : null

  const SECTIONS = [
    {
      key: 'indications',
      label: 'Indicações Terapêuticas',
      question: `Para que serve o ${drug?.generic_name || name}?`
    },
    {
      key: 'dosage',
      label: 'Posologia e Administração',
      question: `Qual é a dose do ${drug?.generic_name || name}?`
    },
    {
      key: 'contraindications',
      label: 'Contraindicações',
      question: `Quando não se deve tomar ${drug?.generic_name || name}?`
    },
    {
      key: 'warnings',
      label: 'Advertências e Precauções',
      question: `Quais são os cuidados com o ${drug?.generic_name || name}?`
    },
    {
      key: 'adverse_reactions',
      label: 'Reações Adversas',
      question: `Quais são os efeitos secundários do ${drug?.generic_name || name}?`
    },
  ]

  return (
    <>
      {structuredData && (
        <Script
          id="drug-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}

      <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>

        {/* Header */}
        <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>CLINICAL</span>
            </Link>
            <span style={{ color: 'var(--border-2)' }}>|</span>
            {/* Breadcrumbs visíveis — melhoram SEO e UX */}
            <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Link href="/drugs" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Medicamentos</Link>
              <span style={{ color: 'var(--border-2)' }}>›</span>
              <span style={{ color: 'var(--ink-2)', textTransform: 'capitalize' }}>{drug?.generic_name || name}</span>
            </nav>
            <nav style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
              <Link href="/interactions" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>Interações</Link>
              <Link href="/study" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none' }}>Estudantes</Link>
            </nav>
          </div>
        </header>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>

          {!drug ? (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px', textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>
                Medicamento não encontrado
              </h1>
              <p style={{ fontSize: 15, color: 'var(--ink-4)', marginBottom: 24 }}>
                Não encontrámos informação sobre "{name}" na base de dados FDA.
              </p>
              <Link href="/drugs" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: 4, fontSize: 14, fontWeight: 600 }}>
                Pesquisar outro medicamento
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' }}>

              <main>
                {/* Drug header */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ background: 'var(--green)', padding: '28px 32px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>
                      DENOMINAÇÃO COMUM INTERNACIONAL
                    </div>
                    {/* H1 — contém a palavra-chave principal. Crítico para SEO. */}
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'white', fontWeight: 700, textTransform: 'capitalize', letterSpacing: '-0.01em', margin: 0 }}>
                      {drug.generic_name}
                    </h1>
                    {drug.brand_names.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                          NOMES COMERCIAIS:
                        </span>
                        {drug.brand_names.slice(0, 5).map((b: string) => (
                          <span key={b} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {[
                      { label: 'Fabricante', value: drug.manufacturer || '—' },
                      { label: 'Fonte dos Dados', value: 'OpenFDA (FDA / EUA)' },
                      { label: 'Última Actualização', value: new Date().toLocaleDateString('pt-PT') },
                    ].map(({ label, value }, i) => (
                      <div key={label} style={{ padding: '14px 20px', borderRight: i < 2 ? '1px solid var(--border)' : 'none', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical sections */}
                {/* H2 em formato de pergunta = AEO gold */}
                {/* O Google mostra estas perguntas e respostas directamente nos resultados */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {SECTIONS.map(({ key, label, question }, i) => {
                    const value = drug[key as keyof DrugData] as string
                    if (!value) return null
                    return (
                      <section
                        key={key}
                        style={{ padding: '24px 28px', borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                          {label}
                        </h2>
                        {/* Pergunta visível — formato natural que as pessoas pesquisam */}
                        <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 12, fontStyle: 'italic' }}>
                          {question}
                        </p>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: 0 }}>
                          {value}
                        </p>
                      </section>
                    )
                  })}
                </div>

                {/* Adverse events */}
                {drug.top_adverse_events.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '24px 28px', marginTop: 20 }}>
                    <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                      Efeitos Adversos Mais Reportados
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, fontStyle: 'italic' }}>
                      Quais são os efeitos secundários mais frequentes do {drug.generic_name}?
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {drug.top_adverse_events.map((e) => (
                        <div key={e.term} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 3, padding: '5px 10px', background: 'var(--bg-2)' }}>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{e.term?.toLowerCase()}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--border)', borderRadius: 2, padding: '1px 5px' }}>{e.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </main>

              {/* Sidebar */}
              <aside>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Verificar Interações
                  </div>
                  <Link
                    href="/interactions"
                    style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '11px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}
                  >
                    Abrir Verificador →
                  </Link>
                  <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                    Verifica se este medicamento interage com outros que tomas
                  </p>
                </div>

                {/* Internal links — melhoram SEO por link building interno */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Pesquisas Frequentes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      `${drug.generic_name} e álcool`,
                      `${drug.generic_name} em gravidez`,
                      `${drug.generic_name} dose máxima`,
                    ].map(label => (
                      <Link
                        key={label}
                        href={`/drugs?q=${encodeURIComponent(drug.generic_name)}`}
                        style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', padding: '6px 0', borderBottom: '1px solid var(--bg-3)', lineHeight: 1.4 }}
                      >
                        {label} →
                      </Link>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>AVISO LEGAL</div>
                  <p style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
                    Informação educacional baseada em dados OpenFDA. Não substitui o RCM oficial nem aconselhamento farmacêutico ou médico profissional.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  )
}