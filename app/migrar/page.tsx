'use client'

// app/migrar/page.tsx — Phlox Migração
// Importa dados de qualquer sistema existente para o Phlox.
// Para profissionais e instituições que já usam Sifarma, SClínico,
// PHC, Excel, ou qualquer outro sistema.
// O único obstáculo real à adopção institucional é a migração de dados —
// esta ferramenta elimina esse obstáculo.

import { useState, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type SourceSystem = 'sifarma' | 'sclinico' | 'phc' | 'excel' | 'mysns' | 'word' | 'manual'
type ImportMode = 'patients' | 'medications' | 'residents' | 'labs'

interface ImportResult {
  success: number
  errors: number
  warnings: string[]
  preview: any[]
  raw_count: number
}

const SOURCE_SYSTEMS: { id: SourceSystem; label: string; desc: string; formats: string[]; color: string }[] = [
  { id: 'sifarma', label: 'Sifarma 2000 / Next', desc: 'Sistema de gestão de farmácia — exportação de histórico de dispensação ou lista de doentes', formats: ['.csv', '.xls', '.xlsx', '.txt'], color: '#1d4ed8' },
  { id: 'sclinico', label: 'SClínico', desc: 'Registo clínico dos CSP — exportação de lista de medicação activa ou sumário de saúde', formats: ['.pdf', '.txt', '.xml'], color: '#0d6e42' },
  { id: 'phc', label: 'PHC / WinMED', desc: 'Sistema clínico de consultórios — exportação de fichas de utente com medicação', formats: ['.csv', '.xls', '.xlsx'], color: '#7c3aed' },
  { id: 'excel', label: 'Excel / CSV', desc: 'Folha de cálculo com lista de doentes, residentes ou medicação — qualquer formato', formats: ['.xlsx', '.xls', '.csv', '.tsv'], color: '#0891b2' },
  { id: 'mysns', label: 'MySNS / Portal do Utente', desc: 'PDF descarregado do portal SNS24 com medicação activa, vacinas ou histórico', formats: ['.pdf'], color: '#dc2626' },
  { id: 'word', label: 'Word / PDF / Texto', desc: 'Carta de alta, resumo de internamento, ou qualquer documento clínico com medicação', formats: ['.pdf', '.docx', '.txt'], color: '#b45309' },
  { id: 'manual', label: 'Introdução manual', desc: 'Cola directamente o texto — lista de medicação, nomes de residentes, ou resultados de análises', formats: ['texto livre'], color: '#374151' },
]

const IMPORT_MODES: { id: ImportMode; label: string; desc: string }[] = [
  { id: 'patients', label: 'Doentes / Utentes', desc: 'Importar lista de doentes com dados demográficos e condições' },
  { id: 'medications', label: 'Medicação activa', desc: 'Importar lista de medicamentos prescritos ou dispensados' },
  { id: 'residents', label: 'Residentes de lar', desc: 'Importar lista de residentes com medicação completa para revisão AI' },
  { id: 'labs', label: 'Resultados de análises', desc: 'Importar resultados laboratoriais para interpretação e comparação temporal' },
]

export default function MigrarPage() {
  const { user, supabase } = useAuth()
  const [source, setSource] = useState<SourceSystem | null>(null)
  const [mode, setMode] = useState<ImportMode>('medications')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const plan = (user as any)?.plan || 'free'
  const canImport = plan !== 'free'
  const selectedSource = SOURCE_SYSTEMS.find(s => s.id === source)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')

    // For text files, read directly
    if (f.type !== 'application/pdf' && !f.name.endsWith('.pdf')) {
      try {
        const t = await f.text()
        setText(t.slice(0, 50000))
      } catch (_e: any) {}
    }
  }

  const analyse = async () => {
    if (!text.trim() && !file) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      let body: any = { source_system: source || 'manual', import_mode: mode, text: text.trim() }

      if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
        }
        body.pdf_base64 = btoa(binary)
        body.filename = file.name
      } else if (file) {
        body.filename = file.name
      }

      const res = await fetch('/api/migrar/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao analisar')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao processar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const confirmImport = async () => {
    if (!result?.preview?.length || !user) return
    setLoading(true)

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const res = await fetch('/api/migrar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ import_mode: mode, items: result.preview, source_system: source }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImported(true)
    } catch (e: any) {
      setError(e.message || 'Erro ao importar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!canImport) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 560 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 36px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, marginBottom: 14 }}>Phlox Migração</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Importa dados de Sifarma, SClínico, PHC, Excel, MySNS ou qualquer documento clínico. Disponível no plano Plus ou superior.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Ver planos →</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Migração de dados</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>Phlox Migração</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 540 }}>
            Importa dados de qualquer sistema. Sifarma, SClínico, PHC, Excel, MySNS, Word, PDF — a AI extrai e estrutura automaticamente.
          </p>
        </div>

        {imported ? (
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 14, padding: '40px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 16 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 10 }}>Importação concluída</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 24 }}>{result?.success} registos importados com sucesso.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={mode === 'patients' ? '/patients' : mode === 'residents' ? '/residentes' : mode === 'labs' ? '/registo' : '/mymeds'}
                style={{ padding: '11px 22px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                Ver dados importados →
              </Link>
              <button onClick={() => { setImported(false); setResult(null); setText(''); setFile(null); setSource(null) }}
                style={{ padding: '11px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)', fontWeight: 600 }}>
                Importar mais
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="migrar-grid">

            {/* Coluna esquerda — configuração */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Modo */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>O que queres importar?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {IMPORT_MODES.map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', border: `1.5px solid ${mode === m.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: mode === m.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: mode === m.id ? 'var(--green)' : 'var(--ink)', marginBottom: 2 }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Origem */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>De onde vêm os dados?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {SOURCE_SYSTEMS.map(s => (
                    <button key={s.id} onClick={() => setSource(s.id)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', border: `1.5px solid ${source === s.id ? s.color : 'var(--border)'}`, borderRadius: 7, background: source === s.id ? `${s.color}08` : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0, marginTop: 5 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: source === s.id ? s.color : 'var(--ink)', marginBottom: 1 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{s.formats.join(' · ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita — input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {selectedSource ? `Dados de ${selectedSource.label}` : 'Cola os dados ou faz upload do ficheiro'}
                </div>

                {/* Upload */}
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt,.pdf,.docx,.tsv" style={{ display: 'none' }} onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: '14px', border: '1.5px dashed var(--border)', borderRadius: 8, background: file ? 'var(--green-light)' : 'var(--bg-2)', cursor: 'pointer', fontSize: 13, color: file ? 'var(--green)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', marginBottom: 10, transition: 'all 0.15s', fontWeight: file ? 700 : 400 }}>
                  {file ? `Ficheiro: ${file.name}` : 'Clica para fazer upload (PDF, Excel, CSV, Word, TXT)'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder={
                    mode === 'medications'
                      ? 'Cola aqui a lista de medicamentos — pode ser de Sifarma, SClínico, ou simplesmente digitada:\n\nMetformina 1000mg 2x/dia\nAtovastatina 20mg à noite\nRamipril 5mg 1x/dia...'
                      : mode === 'patients'
                      ? 'Cola aqui a lista de doentes — nome, data nascimento, diagnósticos, NUT...\n\nJoão Silva, 12/03/1955, HTA DM2, SNS 123456789...'
                      : mode === 'residents'
                      ? 'Cola a lista de residentes com a sua medicação — pode ser directamente de Excel:\n\nMaria Costa, 84a, Q12A, HTA IC — Furosemida 40mg, Bisoprolol 5mg...'
                      : 'Cola aqui os resultados das análises — qualquer formato de laboratório:\n\nHemoglobina: 11.2 g/dL [12-16]\nGlicose: 125 mg/dL [70-110]...'
                  }
                  rows={14}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />

                {error && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#991b1b' }}>{error}</div>
                )}
              </div>

              <button onClick={analyse} disabled={loading || (!text.trim() && !file)}
                style={{ width: '100%', padding: '14px', background: loading || (!text.trim() && !file) ? 'var(--bg-3)' : '#1d4ed8', color: loading || (!text.trim() && !file) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading || (!text.trim() && !file) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    A analisar e extrair dados...
                  </>
                ) : 'Analisar com AI →'}
              </button>

              {/* Preview */}
              {result && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pré-visualização</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--ink-3)' }}>{result.success} registos encontrados</span>
                    </div>
                    {result.errors > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#dc2626' }}>{result.errors} com erros</span>}
                  </div>

                  {result.warnings?.length > 0 && (
                    <div style={{ padding: '10px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                      {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#92400e', marginBottom: i < result.warnings.length - 1 ? 3 : 0 }}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {result.preview?.slice(0, 10).map((item: any, i: number) => (
                      <div key={i} style={{ padding: '9px 16px', borderBottom: i < Math.min(result.preview.length - 1, 9) ? '1px solid var(--bg-3)' : 'none', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                        {mode === 'medications'
                          ? `${item.name || '—'} · ${item.dose || ''} · ${item.frequency || ''}`
                          : mode === 'patients' || mode === 'residents'
                          ? `${item.name || '—'} · ${item.age ? `${item.age}a` : ''} · ${item.room || item.diagnosis || ''}`
                          : `${item.name || '—'}: ${item.value || '—'} ${item.unit || ''}`}
                      </div>
                    ))}
                    {result.preview?.length > 10 && (
                      <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)' }}>
                        + {result.preview.length - 10} mais registos...
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={confirmImport} disabled={loading}
                      style={{ width: '100%', padding: '12px', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {loading ? 'A importar...' : `Confirmar e importar ${result.success} registos`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--ink-5)', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
            Os dados são processados por AI e importados para a tua conta Phlox. Nenhum dado é partilhado externamente. Podes apagar os registos importados a qualquer momento.
          </p>
        </div>
      </div>
      <style>{`
        @media(max-width:768px){.migrar-grid{grid-template-columns:1fr!important}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}