import { Metadata } from 'next'
import Link from 'next/link'

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
      fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(name)}"&limit=1`, { next: { revalidate: 86400 } }),
      fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(name)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`, { next: { revalidate: 86400 } }),
    ])
    const labelData = labelRes.status === 'fulfilled' && labelRes.value.ok ? await labelRes.value.json() : null
    const adverseData = adverseRes.status === 'fulfilled' && adverseRes.value.ok ? await adverseRes.value.json() : null
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
  } catch { return null }
}

function truncate(text: string, len: number) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len).trim() + '…' : text
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const drug = await getDrugData(slug)
  const name = slug.replace(/-/g, ' ')
  const displayName = drug?.generic_name || name
  const title = `${displayName} — Informação Clínica, Doses e Efeitos Adversos | Phlox`
  const description = `Informação clínica completa sobre ${displayName}. Posologia, efeitos adversos, contraindicações e interações medicamentosas.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    alternates: { canonical: `https://phlox.health/drugs/${slug}` },
  }
}

const SECTIONS = [
  { key: 'indications', label: 'Indicações Terapêuticas', q: 'Para que serve?' },
  { key: 'dosage', label: 'Posologia e Administração', q: 'Qual é a dose?' },
  { key: 'contraindications', label: 'Contraindicações', q: 'Quando não usar?' },
  { key: 'warnings', label: 'Advertências e Precauções', q: 'Que cuidados ter?' },
  { key: 'adverse_reactions', label: 'Reações Adversas', q: 'Quais os efeitos secundários?' },
]

export default async function DrugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const drug = await getDrugData(slug)
  const name = slug.replace(/-/g, ' ')

  const structuredData = drug ? {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Drug', name: drug.generic_name, alternateName: drug.brand_names, description: truncate(drug.indications, 300), url: `https://phlox.health/drugs/${slug}` },
      { '@type': 'FAQPage', mainEntity: SECTIONS.filter(s => drug[s.key as keyof DrugData]).map(s => ({ '@type': 'Question', name: `${s.q} ${drug.generic_name}`, acceptedAnswer: { '@type': 'Answer', text: truncate(drug[s.key as keyof DrugData] as string, 300) } })) },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Phlox', item: 'https://phlox.health' }, { '@type': 'ListItem', position: 2, name: 'Medicamentos', item: 'https://phlox.health/drugs' }, { '@type': 'ListItem', position: 3, name: drug.generic_name, item: `https://phlox.health/drugs/${slug}` }] },
    ]
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      )}

      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>CLINICAL</span>
          </Link>
          <span style={{ color: 'var(--border-2)' }}>|</span>
          <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <Link href="/drugs" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>Medicamentos</Link>
            <span style={{ color: 'var(--border-2)' }}>›</span>
            <span style={{ color: 'var(--ink-2)', textTransform: 'capitalize' }}>{drug?.generic_name || name}</span>
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        {!drug ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '60px', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>Medicamento não encontrado</h1>
            <p style={{ fontSize: 15, color: 'var(--ink-4)', marginBottom: 24 }}>Não encontrámos "{name}" na base de dados FDA.</p>
            <Link href="/drugs" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: 4, fontSize: 14, fontWeight: 600 }}>Pesquisar outro medicamento</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' }}>
            <main>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ background: 'var(--green)', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>DENOMINAÇÃO COMUM INTERNACIONAL</div>
                  <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'white', fontWeight: 700, textTransform: 'capitalize', letterSpacing: '-0.01em', margin: 0 }}>{drug.generic_name}</h1>
                  {drug.brand_names.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>NOMES COMERCIAIS:</span>
                      {drug.brand_names.slice(0, 5).map((b: string) => (
                        <span key={b} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '2px 8px', fontFamily: 'var(--font-mono)' }}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
                  {[{ label: 'Fabricante', value: drug.manufacturer || '—' }, { label: 'Fonte', value: 'OpenFDA (FDA)' }, { label: 'Actualizado', value: new Date().toLocaleDateString('pt-PT') }].map(({ label, value }, i) => (
                    <div key={label} style={{ padding: '14px 20px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {SECTIONS.map(({ key, label, q }, i) => {
                  const value = drug[key as keyof DrugData] as string
                  if (!value) return null
                  return (
                    <section key={key} style={{ borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none', padding: '24px 28px' }}>
                      <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{label}</h2>
                      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 12, fontStyle: 'italic' }}>{q} {drug.generic_name}?</p>
                      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: 0 }}>{value}</p>
                    </section>
                  )
                })}
              </div>
            </main>

            <aside>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas</div>
                <Link href="/interactions" style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 4, padding: '11px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>Verificar Interações →</Link>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Verifica se este medicamento interage com outros</p>
              </div>
              {drug.top_adverse_events.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Efeitos Adversos Reportados</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {drug.top_adverse_events.map((e, i) => (
                      <div key={e.term} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < drug.top_adverse_events.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{e.term?.toLowerCase()}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-3)', borderRadius: 3, padding: '2px 6px' }}>{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>AVISO LEGAL</div>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>Informação educacional baseada em dados OpenFDA. Não substitui aconselhamento profissional.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}