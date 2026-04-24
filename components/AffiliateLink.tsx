'use client'

// Passive affiliate revenue — shows on drug pages and interaction results
// Amazon Associates Portugal: tag=phlox-21
// Replace AMAZON_TAG with your actual Amazon Associates tag

const AMAZON_TAG = 'phlox-21' // TODO: replace with your Amazon Associates tag

// Map common drug names to Amazon search terms
function getSearchTerm(drugName: string): string {
  const name = drugName.toLowerCase()
  // Generic terms that work on Amazon Farmácia
  const map: Record<string, string> = {
    ibuprofen:      'ibuprofeno 400mg',
    ibuprofeno:     'ibuprofeno 400mg',
    paracetamol:    'paracetamol 1000mg',
    acetaminophen:  'paracetamol 1000mg',
    omeprazole:     'omeprazol 20mg',
    omeprazol:      'omeprazol 20mg',
    loratadine:     'loratadina 10mg',
    cetirizine:     'cetirizina 10mg',
    'vitamin-d':    'vitamina d3 2000ui',
    'vitamina-d':   'vitamina d3 2000ui',
    magnesium:      'magnesio comprimidos',
    magnesio:       'magnesio comprimidos',
    'folic-acid':   'acido folico 400mcg',
    melatonin:      'melatonina 1mg',
    melatonina:     'melatonina 1mg',
    zinc:           'zinco comprimidos',
    zinco:          'zinco comprimidos',
  }
  return map[name] || `${drugName} farmácia`
}

function getAmazonUrl(drugName: string): string {
  const query = encodeURIComponent(getSearchTerm(drugName))
  return `https://www.amazon.es/s?k=${query}&tag=${AMAZON_TAG}`
}

// Only show for OTC drugs (not prescription-only)
const OTC_DRUGS = new Set([
  'ibuprofen','ibuprofeno','paracetamol','acetaminophen','aspirin','aspirina',
  'omeprazole','omeprazol','loratadine','loratadina','cetirizine','cetirizina',
  'vitamin-d','vitamina-d','magnesium','magnesio','folic-acid','melatonin',
  'melatonina','zinc','zinco','calcium','calcio','vitamin-b12','vitamina-b12',
])

interface Props {
  drugName: string
  variant?: 'compact' | 'full'
}

export default function AffiliateLink({ drugName, variant = 'compact' }: Props) {
  const normalized = drugName.toLowerCase().replace(/\s+/g, '-')
  if (!OTC_DRUGS.has(normalized)) return null

  const url = getAmazonUrl(drugName)

  if (variant === 'compact') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--ink-4)',
          textDecoration: 'none',
          padding: '5px 10px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg-2)',
          transition: 'border-color 0.15s, color 0.15s',
          fontFamily: 'var(--font-mono)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--ink-2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-4)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>
        Comprar online
        <span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
      </a>
    )
  }

  return (
    <div style={{
      marginTop: 16,
      padding: '14px 16px',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Onde comprar</div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          Farmácias online verificadas
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--ink)',
          textDecoration: 'none',
          padding: '8px 14px',
          border: '1px solid var(--border-2)',
          borderRadius: 7,
          background: 'white',
          fontWeight: 500,
        }}
      >
        Ver preços →
      </a>
    </div>
  )
}
