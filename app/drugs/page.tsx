'use client'

import { useState } from 'react'
import Link from 'next/link'

const EXAMPLES = [
  { name: 'ibuprofen', pt: 'Ibuprofeno' },
  { name: 'metformin', pt: 'Metformina' },
  { name: 'amoxicillin', pt: 'Amoxicilina' },
  { name: 'atorvastatin', pt: 'Atorvastatina' },
  { name: 'omeprazole', pt: 'Omeprazol' },
  { name: 'lisinopril', pt: 'Lisinopril' },
  { name: 'warfarin', pt: 'Varfarina' },
  { name: 'sertraline', pt: 'Sertralina' },
]

const SECTIONS = [
  { key: 'indications', label: 'Indicações Terapêuticas', summary: 'Para que serve este medicamento' },
  { key: 'dosage', label: 'Posologia e Administração', summary: 'Como e quanto tomar' },
  { key: 'contraindications', label: 'Contraindicações', summary: 'Quando não deve ser usado' },
  { key: 'warnings', label: 'Advertências e Precauções', summary: 'Cuidados especiais' },
  { key: 'adverse_reactions', label: 'Reações Adversas', summary: 'Efeitos secundários possíveis' },
]

function truncate(text: string, len: number) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len).trim() + '…' : text
}

export default function DrugsPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const search = async (q?: string) => {
    const term = (q || query).trim()
    if (!term) return
    setLoading(true)
    setError('')
    setResult(null)
    setExpanded(new Set())
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch {
      setError('Medicamento não encontrado. Tenta o nome em inglês (DCI).')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Phlox</span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>CLINICAL</span>
          </Link>
          <span style={{ color: 'var(--border-2)' }}>|</span>
          <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>Base de Dados de Fármacos</span>
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: 28 }}>
            {[
              { href: '/interactions', label: 'Interações' },
              { href: '/study', label: 'Estudantes' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>

        {/* Search section */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>
                Base de Dados de Fármacos
              </h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                Dados clínicos directos da FDA. Introduz o nome DCI em inglês para melhores resultados.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Nome DCI ou comercial (ex: ibuprofen, metformin...)"
              style={{
                flex: 1,
                border: '1px solid var(--border-2)',
                borderRadius: 4,
                padding: '10px 16px',
                fontSize: 15,
                color: 'var(--ink)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => search()}
              disabled={!query.trim() || loading}
              style={{
                background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)',
                color: query.trim() && !loading ? 'white' : 'var(--ink-4)',
                border: 'none',
                borderRadius: 4,
                padding: '10px 28px',
                fontSize: 14,
                fontWeight: 600,
                cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'A pesquisar...' : 'Pesquisar'}
            </button>
          </div>

          {/* Example chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', marginRight: 4 }}>
              EXEMPLOS:
            </span>
            {EXAMPLES.map(({ name, pt }) => (
              <button
                key={name}
                onClick={() => { setQuery(name); search(name) }}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {name}
                <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>({pt})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'white',
            border: '1px solid #feb2b2',
            borderLeft: '4px solid #c53030',
            borderRadius: 4,
            padding: '16px 20px',
            marginBottom: 24,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c53030', letterSpacing: '0.1em', marginBottom: 4 }}>ERRO</div>
            <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

            {/* Main content */}
            <div>

              {/* Drug identity card */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: 'var(--green)', padding: '24px 28px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', marginBottom: 8 }}>
                    DENOMINAÇÃO COMUM INTERNACIONAL
                  </div>
                  <h2 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 32,
                    color: 'white',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    letterSpacing: '-0.01em',
                    margin: 0,
                  }}>
                    {result.generic_name}
                  </h2>
                </div>

                {/* Identity metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Fabricante', value: result.manufacturer || '—' },
                    { label: 'Nomes Comerciais', value: result.brand_names?.slice(0, 3).join(', ') || '—' },
                    { label: 'Fonte dos Dados', value: 'OpenFDA (FDA / EUA)' },
                  ].map(({ label, value }, i) => (
                    <div key={label} style={{
                      padding: '14px 20px',
                      borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical sections */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {SECTIONS.map(({ key, label, summary }, i) => {
                  const value = result[key]
                  if (!value) return null
                  const isOpen = expanded.has(key)

                  return (
                    <div key={key} style={{ borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>

                      {/* Section header — always visible */}
                      <button
                        onClick={() => toggle(key)}
                        style={{
                          width: '100%',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          alignItems: 'center',
                          padding: '16px 24px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          gap: 16,
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>
                            {label}
                          </div>
                          {!isOpen && (
                            <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                              {truncate(value, 120)}
                            </div>
                          )}
                        </div>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isOpen ? 'var(--green)' : 'var(--bg-3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isOpen ? 'white' : 'var(--ink-4)',
                          fontSize: 14,
                          flexShrink: 0,
                          fontWeight: 700,
                        }}>
                          {isOpen ? '−' : '+'}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div style={{
                          padding: '0 24px 20px',
                          borderTop: '1px solid var(--bg-3)',
                        }}>
                          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: '16px 0 0' }}>
                            {value}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Quick action */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Acções Rápidas
                </div>
                <Link
                  href="/interactions"
                  style={{
                    display: 'block',
                    background: 'var(--green)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 4,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  Verificar Interações →
                </Link>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                  Verifica se este medicamento interage com outros que tomas
                </p>
              </div>

              {/* Adverse events */}
              {result.top_adverse_events?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Efeitos Adversos Reportados
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginBottom: 12, lineHeight: 1.5 }}>
                    Dados de farmacovigilância FDA. Ordenados por frequência de reporte.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.top_adverse_events.slice(0, 10).map((e: any, i: number) => (
                      <div key={e.term} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: i < 9 ? '1px solid var(--bg-3)' : 'none',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                          {e.term?.toLowerCase()}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--ink-4)',
                          background: 'var(--bg-3)',
                          borderRadius: 3,
                          padding: '2px 6px',
                        }}>
                          {e.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '16px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 6 }}>
                  AVISO LEGAL
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
                  Informação educacional baseada em dados OpenFDA. Não substitui o RCM oficial nem aconselhamento farmacêutico ou médico.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}