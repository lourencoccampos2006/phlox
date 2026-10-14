'use client'

// app/migrar/page.tsx
// ═══════════════════════════════════════════════════════════════════════════
// TRAZER UMA CASA DE OUTRO SISTEMA
// ═══════════════════════════════════════════════════════════════════════════
//
// O maior obstáculo à mudança de software numa casa não é o preço nem a
// formação: são os anos de dados que já lá estão. Ninguém troca de sistema
// para voltar a escrever sessenta fichas à mão.
//
// ── OS SISTEMAS MUDARAM (2026-10-13) ───────────────────────────────────────
// A lista de origens era Sifarma 2000, SClínico, PHC/WinMED e MySNS. São o
// software de uma FARMÁCIA, de um centro de saúde, de um consultório e do
// portal do utente — nenhum deles é o que um lar ou um centro de dia usa, e
// o Phlox deixou de servir farmácias e clínicas há muito.
//
// Quem está do outro lado de uma mudança para o Phlox está em: uma folha de
// Excel (a maioria, e de longe), um dos sistemas de lar que se vendem cá —
// Ankira, MySenior, Sioslife, Resilar — ou papel. É essa a lista agora.
//
// ── PORQUE É QUE O NOME DO SISTEMA IMPORTA ─────────────────────────────────
// Não é cortesia. O nome vai no prompt de leitura, e cada sistema exporta com
// a sua forma: o Ankira dá CSV com cabeçalhos próprios, o MySenior dá um mapa
// mensal, uma folha feita em casa tem o quarto numa coluna chamada «Qt.».
// Dizer qual é faz a diferença entre adivinhar e ler.

import { useState, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

type SourceSystem = 'excel' | 'ankira' | 'mysenior' | 'sioslife' | 'resilar'
  | 'outro_lar' | 'word' | 'manual'
/* O `residents` saiu: era igual ao `patients` menos o quarto, e ter dois
   caminhos para a mesma escrita garantiu que um ficou para trás na
   correção do `org_id`. A rota de importação trata os dois como um. */
type ImportMode = 'patients' | 'medications' | 'labs'

interface ImportResult {
  success: number
  errors: number
  warnings: string[]
  preview: any[]
  raw_count: number
}

const SOURCE_SYSTEMS: { id: SourceSystem; label: string; desc: string; formats: string[]; color: string }[] = [
  // O Excel está em primeiro porque é onde está a maior parte das casas — e
  // porque mesmo quem vem de um sistema vem quase sempre por uma exportação
  // para folha de cálculo.
  { id: 'excel', label: 'Excel ou CSV', desc: 'A folha de cálculo da casa, ou a exportação de qualquer sistema. Não é preciso arrumá-la primeiro', formats: ['.xlsx', '.xls', '.csv', '.tsv'], color: 'var(--green)' },
  { id: 'ankira', label: 'Ankira', desc: 'Exportação de utentes, medicação ou registos', formats: ['.csv', '.xlsx', '.pdf'], color: 'var(--ink-3)' },
  { id: 'mysenior', label: 'MySenior', desc: 'Exportação de fichas de utente ou mapa de medicação', formats: ['.csv', '.xlsx', '.pdf'], color: 'var(--ink-3)' },
  { id: 'sioslife', label: 'Sioslife', desc: 'Exportação de utentes ou plano de atividades', formats: ['.csv', '.xlsx'], color: 'var(--ink-3)' },
  { id: 'resilar', label: 'Resilar', desc: 'Exportação de utentes, mensalidades ou medicação', formats: ['.csv', '.xlsx'], color: 'var(--ink-3)' },
  { id: 'outro_lar', label: 'Outro sistema de lar', desc: 'Qualquer outro software de ERPI, centro de dia ou apoio domiciliário — diz-se o nome mais abaixo', formats: ['.csv', '.xlsx', '.pdf', '.txt'], color: 'var(--ink-3)' },
  { id: 'word', label: 'Word, PDF ou papel digitalizado', desc: 'O mapa de medicação, a lista de quartos, a ficha de inscrição — como estiverem', formats: ['.pdf', '.docx', '.txt'], color: 'var(--amber)' },
  { id: 'manual', label: 'Escrever ou colar', desc: 'Cola a lista directamente — nomes, medicação, o que houver', formats: ['texto livre'], color: 'var(--ink-3)' },
]

const IMPORT_MODES: { id: ImportMode; label: string; desc: string }[] = [
  { id: 'patients', label: 'Utentes', desc: 'Nomes, datas de nascimento, quarto, condições, alergias — e a medicação e os contactos de família que vierem com eles' },
  { id: 'medications', label: 'Só medicação', desc: 'Uma lista de medicamentos, sem as pessoas' },
  { id: 'labs', label: 'Análises', desc: 'Resultados laboratoriais, para comparar ao longo do tempo' },
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
    <Mesa altura="documento">
      <Painel>
        <Vazio
          titulo="A migração de dados não está incluída neste plano."
          oQueFazer="Traz os utentes, a medicação e os contactos de Excel, Ankira, MySenior, Sioslife, Resilar ou de qualquer documento. Disponível no plano Plus ou superior."
          acao={<Link href="/pricing" style={{ textDecoration: 'none' }}><Botao feitio="principal">VER PLANOS</Botao></Link>} />
      </Painel>
    </Mesa>
  )

  /* A MOLDURA — refeita (2026-10-08).
     Tinha 110px antes do primeiro botão: migalha, «Phlox Migração» em serifa
     de 38px, e um parágrafo. Isto usa-se UMA VEZ na vida de cada casa, e o
     que importa nessa vez é o passo seguinte, não o nome da ferramenta. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Migração</span>
          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {imported ? 'IMPORTADO' : source ? 'POR CONFIRMAR' : 'À ESPERA DO FICHEIRO'}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Excel · Ankira · MySenior · Sioslife · Resilar · Word · PDF</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Nada entra na casa antes de o rever — a extração é uma proposta, não um registo
          </span>
        </BarraDeEstado>
      }
    >
        {imported ? (
          <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-xl)', padding: '40px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 16 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, marginBottom: 10 }}>Importação concluída</h2>
            <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', marginBottom: 24 }}>{result?.success} registos importados com sucesso.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={mode === 'patients' ? '/patients' : mode === 'labs' ? '/registo' : '/mymeds'}
                style={{ padding: '11px 22px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>
                Ver dados importados →
              </Link>
              <button onClick={() => { setImported(false); setResult(null); setText(''); setFile(null); setSource(null) }}
                style={{ padding: '11px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)', fontWeight: 'var(--peso-corpo)' as any }}>
                Importar mais
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="migrar-grid">

            {/* Coluna esquerda — configuração */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Modo */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>O que queres importar?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {IMPORT_MODES.map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', border: `1.5px solid ${mode === m.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: mode === m.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                      <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: mode === m.id ? 'var(--green)' : 'var(--ink)', marginBottom: 2 }}>{m.label}</span>
                      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.4 }}>{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Origem */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>De onde vêm os dados?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {SOURCE_SYSTEMS.map(s => (
                    <button key={s.id} onClick={() => setSource(s.id)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', border: `1.5px solid ${source === s.id ? s.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: source === s.id ? `${s.color}08` : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0, marginTop: 5 }} />
                      <div>
                        <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: source === s.id ? s.color : 'var(--ink)', marginBottom: 1 }}>{s.label}</div>
                        <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{s.formats.join(' · ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita — input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '20px', flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {selectedSource ? `Dados de ${selectedSource.label}` : 'Cola os dados ou faz upload do ficheiro'}
                </div>

                {/* Upload */}
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt,.pdf,.docx,.tsv" style={{ display: 'none' }} onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: '14px', border: '1.5px dashed var(--border)', borderRadius: 'var(--r-md)', background: file ? 'var(--green-light)' : 'var(--bg-2)', cursor: 'pointer', fontSize: 'var(--t-dado)', color: file ? 'var(--green)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', marginBottom: 10, transition: 'all 0.15s', fontWeight: file ? 700 : 400 }}>
                  {file ? `Ficheiro: ${file.name}` : 'Clica para fazer upload (PDF, Excel, CSV, Word, TXT)'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder={
                    mode === 'medications'
                      ? 'Cola aqui a lista — de uma folha de cálculo, do sistema antigo, ou escrita à mão:\n\nMetformina 1000mg 2x/dia\nAtorvastatina 20mg à noite\nRamipril 5mg 1x/dia...'
                      : mode === 'patients'
                      ? 'Cola a lista dos utentes — pode vir directamente de uma folha de cálculo, com a medicação na mesma linha:\n\nMaria Costa, 84a, Q12A, HTA e IC — Furosemida 40mg, Bisoprolol 5mg\nJoão Silva, 12/03/1955, Q7, DM2, alérgico a penicilina...'
                      : 'Cola aqui os resultados das análises — qualquer formato de laboratório:\n\nHemoglobina: 11.2 g/dL [12-16]\nGlicose: 125 mg/dL [70-110]...'
                  }
                  rows={14}
                  style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />

                {error && (
                  <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginTop: 10, fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{error}</div>
                )}
              </div>

              <button onClick={analyse} disabled={loading || (!text.trim() && !file)}
                style={{ width: '100%', padding: '14px', background: loading || (!text.trim() && !file) ? 'var(--bg-3)' : 'var(--ink-2)', color: loading || (!text.trim() && !file) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: loading || (!text.trim() && !file) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    A analisar e extrair dados...
                  </>
                ) : 'Analisar com AI →'}
              </button>

              {/* Preview */}
              {result && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pré-visualização</span>
                      <span style={{ marginLeft: 10, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>{result.success} registos encontrados</span>
                    </div>
                    {result.errors > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--red)' }}>{result.errors} com erros</span>}
                  </div>

                  {result.warnings?.length > 0 && (
                    <div style={{ padding: '10px 16px', background: 'var(--badge-amber-bg)', borderBottom: '1px solid var(--badge-amber-border)' }}>
                      {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)', marginBottom: i < result.warnings.length - 1 ? 3 : 0 }}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {result.preview?.slice(0, 10).map((item: any, i: number) => (
                      <div key={i} style={{ padding: '9px 16px', borderBottom: i < Math.min(result.preview.length - 1, 9) ? '1px solid var(--bg-3)' : 'none', fontSize: 'var(--t-meta)', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                        {mode === 'medications'
                          ? `${item.name || '—'} · ${item.dose || ''} · ${item.frequency || ''}`
                          : mode === 'patients'
                          ? `${item.name || '—'} · ${item.age ? `${item.age}a` : ''} · ${item.room || item.diagnosis || ''}`
                          : `${item.name || '—'}: ${item.value || '—'} ${item.unit || ''}`}
                      </div>
                    ))}
                    {result.preview?.length > 10 && (
                      <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                        + {result.preview.length - 10} mais registos...
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={confirmImport} disabled={loading}
                      style={{ width: '100%', padding: '12px', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {loading ? 'A importar...' : `Confirmar e importar ${result.success} registos`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
            Os dados são processados por AI e importados para a tua conta Phlox. Nenhum dado é partilhado externamente. Podes apagar os registos importados a qualquer momento.
          </p>
        </div>
      <style>{`
        @media(max-width:768px){.migrar-grid{grid-template-columns:1fr!important}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </Mesa>
  )
}
