'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import ShareButton from '@/components/ShareButton'
import ShareCard from '@/components/ShareCard'
import SaveButton from '@/components/SaveButton'
import { usePhloxContext } from '@/lib/copilotContext'
import { logStudy, setLastTool } from '@/lib/studyProgress'
import { suggestDrugs, resolveDrugName } from '@/lib/drugNames'
import { useUsageLimit } from '@/lib/useUsageLimit'
import { UpgradePrompt, UsageBadge } from '@/components/UpgradePrompt'
import ProfileSelector from '@/components/ProfileSelector'
import type { ActiveProfile } from '@/lib/profileContext'
import NaoEDispositivoMedico from '@/components/NaoEDispositivoMedico'
import { lerMedsDoPerfil } from '@/lib/medsDoPerfil'
import { VERDE_DA_CASA } from '@/lib/institutionBlueprint'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

/* QUATRO GRAVIDADES, QUATRO ESTADOS — e são exactamente os do sistema.
   Eram cinco famílias de cor escritas à mão (vermelho, laranja, amarelo,
   verde, e um roxo para o CYP450): dezassete valores para dizer quatro
   coisas. O amarelo e o laranja liam-se igual num ecrã ao sol.

   «Ligeira» fica em tinta neutra de propósito: é para saber, não para agir.
   Uma cor de alarme numa interação que não muda nada é o que faz com que a
   GRAVE deixe de se ver. */
const SEVERITY: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  GRAVE:         { label: 'GRAVE',                  color: 'var(--red)',   bg: 'var(--badge-red-bg)',   border: 'var(--badge-red-border)',   barColor: 'var(--red)' },
  MODERADA:      { label: 'MODERADA',               color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', barColor: 'var(--amber)' },
  LIGEIRA:       { label: 'LIGEIRA',                color: 'var(--ink-2)', bg: 'var(--bg-2)',           border: 'var(--border-2)',           barColor: 'var(--ink-4)' },
  SEM_INTERACAO: { label: 'SEM INTERAÇÃO CONHECIDA', color: 'var(--green)', bg: 'var(--badge-green-bg)', border: 'var(--badge-green-border)', barColor: 'var(--green)' },
}

const EXAMPLES = [
  { drugs: ['ibuprofeno', 'varfarina'],        note: 'Hemorragia' },
  { drugs: ['metformina', 'álcool'],           note: 'Acidose' },
  { drugs: ['hipericão', 'sertralina'],        note: 'Serotonina' },
  { drugs: ['aspirina', 'heparina'],           note: 'Anticoag.' },
  { drugs: ['atorvastatina', 'claritromicina'], note: 'Miotoxicidade' },
  { drugs: ['digoxina', 'amiodarona'],         note: 'Toxicidade' },
]

// ─── Photo capture component ─────────────────────────────────────────────────
function PhotoCapture({ onCapture, loading = false }: {
  onCapture: (file: File) => void
  loading?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    onCapture(file)
  }
  return (
    <div>
      <div onClick={() => !loading && ref.current?.click()}
        style={{ border: '2px dashed var(--border-2)', borderRadius: 'var(--r-md)', padding: '14px', textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer', background: 'var(--bg-2)' }}>
        <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 2 }}>{loading ? 'A PROCESSAR…' : 'FOTO DA CAIXA OU DO BLISTER'}</div>
        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Tira foto à caixa e identificamos o medicamento</div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}



// Compress image before sending — reduces phone photos from 3-5MB to ~150KB
async function compressImageFile(file: File, maxDim = 1024, quality = 0.85): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("Canvas error")); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("Compression failed")); return }
        const reader = new FileReader()
        reader.onload = () => resolve({ base64: (reader.result as string).split(",")[1], mimeType: "image/jpeg" })
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }, "image/jpeg", quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível carregar a imagem")) }
    img.src = url
  })
}


export default function InteractionsPage() {
  const { user, supabase } = useAuth()
  const usage = useUsageLimit('interactions')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [input, setInput] = useState('')
  const [drugs, setDrugs] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  usePhloxContext(
    drugs.length ? 'A verificar interações' : '',
    drugs.length ? { medicamentos: drugs, resultado: result ? JSON.stringify(result).slice(0, 1000) : 'ainda não verificado' } : null
  )

  // Pre-populate from ?drugs=a,b,c URL param or sessionStorage (set by CaregiverHome)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('drugs') || sessionStorage.getItem('interactions_prefill')
    sessionStorage.removeItem('interactions_prefill')
    if (raw) {
      const names = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10)
      if (names.length > 0) setDrugs(names)
    }
  }, [])

  const handlePhoto = async (file: File) => {
    setPhotoLoading(true); setError('')
    try {
      const compressed = await compressImageFile(file)
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const visionRes = await fetch('/api/vision', {
        method: 'POST', headers,
        body: JSON.stringify({ image: compressed.base64, mimeType: compressed.mimeType, mode: 'drug_list' })
      })
      const visionData = await visionRes.json()
      if (!visionRes.ok) throw new Error(visionData.error)
      const identified: string[] = visionData.drugs || []
      if (identified.length === 0) {
        setError('Não foram identificados medicamentos. Tenta uma foto mais nítida da frente da caixa.')
        return
      }
      const existing = new Set(drugs.map((d: string) => d.toLowerCase()))
      const toAdd = identified.filter((d: string) => !existing.has(d.toLowerCase())).slice(0, 5)
      if (toAdd.length > 0) setDrugs((prev: string[]) => [...prev, ...toAdd].slice(0, 10))
      else setError('Os medicamentos da foto já estão na lista.')
    } catch (e: any) { setError(e.message || 'Erro ao processar foto.') }
    finally { setPhotoLoading(false) }
  }

  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])

  const handleInput = (val: string) => {
    setInput(val)
    setSuggestions(val.length >= 2 ? suggestDrugs(val) : [])
  }

  const addDrug = (rawInput?: string) => {
    const raw = (rawInput ?? input).trim()
    if (!raw) return
    // Resolve brand → DCI
    const resolved = resolveDrugName(raw)
    const final = resolved ? resolved.dci : raw
    if (!drugs.map(d => d.toLowerCase()).includes(final.toLowerCase()) && drugs.length < 10) {
      setDrugs(prev => [...prev, final])
      setInput('')
      setSuggestions([])
      setResult(null)
    }
  }

  const selectSuggestion = (dci: string) => {
    if (!drugs.map(d => d.toLowerCase()).includes(dci.toLowerCase()) && drugs.length < 10) {
      setDrugs(prev => [...prev, dci])
      setInput('')
      setSuggestions([])
      setResult(null)
    }
  }

  const removeDrug = (d: string) => {
    setDrugs(prev => prev.filter(x => x !== d))
    setResult(null)
  }

  const handleProfileSelect = async (profile: ActiveProfile) => {
    if (!user) return
    setDrugs([])
    setResult(null)
    // A escolha da tabela (personal_meds / family_profile_meds / patient_meds)
    // vive em lib/medsDoPerfil. Estava aqui, copiada em sete ferramentas — e
    // foi essa duplicação que fez o caso do utente institucional cair no ramo
    // errado e não carregar nada.
    const leitura = await lerMedsDoPerfil(supabase, profile, user.id, { codigo: 'interactions-meds' })
    if (leitura.falhou) {
      // Uma lista vazia aqui seria o pior resultado possível: "não encontrei
      // interações" a quem toma oito medicamentos.
      setError(leitura.aviso)
      return
    }
    setError('')
    const uniq = Array.from(new Set(leitura.meds.map(m => m.name).filter(Boolean)))
    if (uniq.length > 0) setDrugs(uniq)
  }

  const saveHistory = async (data: any, drugList: string[]) => {
    if (!user) return
    try {
      await supabase.from('search_history').insert({
        user_id: user.id,
        type: 'interaction',
        query: drugList.join(' + '),
        result_severity: data.severity || null,
        result_source: data.source || null,
      })
    } catch { }
  }

  const check = async () => {
    if (drugs.length < 2) return
    if (!usage.allowed) { setShowUpgrade(true); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      usage.increment()
      setResult(data)
      saveHistory(data, drugs)
      // Estudar uma interação com mecanismo conta como atividade de estudo (kind 'reading').
      if (data?.mechanism) { logStudy({ kind: 'reading' }); setLastTool('/interactions', 'Interações com Mecanismo') }
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const sev = result ? (SEVERITY[result.severity] ?? SEVERITY['SEM_INTERACAO']) : null

  /* A MOLDURA — refeita (2026-10-08).
     A forma já estava certa: dois painéis, o da esquerda preso. O que sobrava
     era o cabeçalho — «Estes medicamentos dão-se bem?» em serifa de 24px com
     um parágrafo por baixo. A pergunta é boa, mas é o NOME da página, não
     conteúdo dela: desce para a barra de estado, que é onde vivem as frases
     que explicam o que se está a ver. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Interações</span>
          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {drugs.length} {drugs.length === 1 ? 'SUBSTÂNCIA' : 'SUBSTÂNCIAS'}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Estes medicamentos dão-se bem?</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Também valem suplementos e chás — o que não aparece aqui não foi verificado
          </span>
        </BarraDeEstado>
      }
    >
        <div className="interactions-layout">

          {/* LEFT PANEL */}
          <div className="sticky-panel">

            {user && (<div style={{ marginBottom: 12 }}><ProfileSelector onChange={handleProfileSelect} /></div>)}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Adicionar substância</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: suggestions.length > 0 ? 0 : (drugs.length > 0 ? 12 : 0) }}>
                  <input type="text" value={input} onChange={e => handleInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDrug(); if (e.key === 'Escape') setSuggestions([]) }} placeholder="Ex: brufen, voltaren, ibuprofeno..." style={{ flex: 1, border: '1px solid var(--border-2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0 }} />
                  <button onClick={() => addDrug()} disabled={!input.trim()} style={{ background: input.trim() ? 'var(--green)' : 'var(--bg-3)', color: input.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r)', padding: '9px 14px', fontSize: 'var(--t-destaque)', cursor: input.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
                </div>
                <div style={{ marginTop: 8 }}><PhotoCapture onCapture={handlePhoto} loading={photoLoading} /></div>
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden' }}>
                    {suggestions.map(s => (
                      <button key={s.dci} onClick={() => selectSuggestion(s.dci)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', fontWeight: 'var(--peso-corpo)' as any }}>{s.display}</span>
                          {s.isBrand && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>→ {s.dci}</span>}
                        </div>
                        {s.isBrand && <span style={{ fontSize: 'var(--t-micro)', background: 'var(--bg-3)', color: 'var(--ink-4)', padding: '1px 6px', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>marca</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {drugs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {drugs.map((d, i) => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                      </div>
                      <button aria-label="Eliminar" onClick={() => removeDrug(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 'var(--t-destaque)', lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}>×</button>                    </div>
                  ))}
                </div>
              )}
            </div>

            {!usage.unlimited && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <UsageBadge remaining={usage.remaining} unlimited={usage.unlimited} />
              </div>
            )}
            <button onClick={check} disabled={drugs.length < 2 || loading} style={{ width: '100%', background: drugs.length >= 2 && !loading ? 'var(--green)' : 'var(--bg-3)', color: drugs.length >= 2 && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r)', padding: '12px', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, cursor: drugs.length >= 2 && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              {loading ? 'A consultar...' : drugs.length < 2 ? 'Adiciona 2+ substâncias' : `Analisar ${drugs.length} substâncias`}
            </button>
            <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)} toolLabel="Verificar interações" plan={usage.plan} limit={usage.limit} />

            <div>
              <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Exemplos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 4 }}>
                {EXAMPLES.map(({ drugs: ex, note }) => (
                  <button key={ex.join('+')} onClick={() => { setDrugs(ex); setResult(null) }} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 10px', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.join(' + ')}</div>
                    <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{note}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          {/* BUG CORRIGIDO 2026-08-07 (mobile): sem minWidth:0, um item de grid
              não encolhe abaixo da largura intrínseca do seu conteúdo — uma
              fonte/referência comprida (ex: "Stockley's Drug Interactions")
              com white-space:nowrap (.source-pill) empurrava a coluna toda
              (e a página) para além da largura do ecrã em mobile. */}
          <div style={{ minWidth: 0 }}>
            {loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--green)', padding: '14px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}>A CONSULTAR BASES DE DADOS</div>
                </div>
                <div style={{ padding: '20px' }}>
                  {['RxNorm / NIH', 'Análise farmacológica AI', 'Mecanismo CYP450'].map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--border-2)', animation: i === 0 ? 'pulse-dot 1.5s infinite' : 'none', flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--t-dado)', color: i === 0 ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <Painel>
                <Vazio titulo="Ainda não há nada para analisar."
                  oQueFazer="Acrescente pelo menos duas substâncias à esquerda — medicamentos, suplementos ou chás — e peça a análise." />
              </Painel>
            )}

            {error && (
              <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r)', padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--red)', letterSpacing: '0.1em', marginBottom: 4 }}>ERRO</div>
                <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--red)', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && sev && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                {/* Severity header */}
                <div style={{ background: sev.barColor, padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.15em', marginBottom: 4 }}>GRAVIDADE DA INTERAÇÃO</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'white', fontWeight: 'var(--peso-forte)' as any }}>{sev.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
                      {result.source === 'rxnorm' ? 'RXNORM/NIH' : result.source === 'ai_enhanced' ? 'AI + RXNORM' : 'SEM DADOS'}
                      {result.cached && ' · CACHE'}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Summary */}
                  <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.barColor}`, borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 20 }}>
                    <p style={{ fontSize: 'var(--t-corpo)', color: sev.color, lineHeight: 1.7, fontWeight: 'var(--peso-corpo)' as any, margin: 0 }}>{result.summary}</p>
                  </div>

                  {/* Clinical details table */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 16 }}>
                    {[
                      { label: 'Mecanismo', value: result.mechanism },
                      { label: 'Consequências', value: result.consequences },
                      { label: 'Recomendação', value: result.recommendation },
                      result.onset ? { label: 'Início da interação', value: result.onset } : null,
                    ].filter(Boolean).map(({ label, value }: any, i, arr) => (
                      <div key={label} className="info-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 'var(--peso-corpo)' as any }}>{label}</span>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CYP450 — NEW */}
                  {result.cyp450?.involved && (
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderLeft: '3px solid var(--ink-2)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 'var(--peso-forte)' as any }}>
                        Mecanismo CYP450 — {result.cyp450.type}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: result.cyp450.clinical_relevance ? 10 : 0 }}>
                        {result.cyp450.enzymes?.map((e: string) => (
                          <span key={e} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', background: 'var(--bg-3)', border: '1px solid var(--border-2)', padding: '2px 8px', borderRadius: 'var(--r-sm)' }}>{e}</span>
                        ))}
                      </div>
                      {result.cyp450.clinical_relevance && (
                        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{result.cyp450.clinical_relevance}</p>
                      )}
                    </div>
                  )}

                  {/* Risk factors — NEW */}
                  {result.risk_factors?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Factores de Risco que Agravam</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.risk_factors.map((r: string) => (
                          <span key={r} style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-sm)', padding: '3px 8px', color: 'var(--amber)', background: 'var(--badge-amber-bg)' }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monitor */}
                  {result.monitor?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Parâmetros a Monitorizar</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.monitor.map((m: string) => (
                          <span key={m} style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)', padding: '3px 8px', color: 'var(--ink-2)', background: 'var(--bg-2)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alternatives — NEW */}
                  {result.alternatives?.length > 0 && (
                    <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderLeft: '3px solid var(--green)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 'var(--peso-forte)' as any }}>Alternativas Terapêuticas</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.alternatives.map((a: string) => (
                          <span key={a} style={{ fontSize: 'var(--t-dado)', color: 'var(--green)', background: 'white', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-sm)', padding: '3px 10px', fontWeight: 'var(--peso-corpo)' as any }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Patient info — NEW */}
                  {result.patient_info && (
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--ink-2)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 'var(--peso-forte)' as any }}>Em linguagem simples (para o doente)</div>
                      <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.patient_info}</p>
                    </div>
                  )}

                  {/* References — NEW */}
                  {result.references?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>Fontes</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {result.references.map((r: string) => (
                          <span key={r} className="source-pill">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Informação educacional — não substitui aconselhamento profissional</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => {
                        const text = [
                          `${drugs.join(' + ')} — ${result?.severity || ''}`,
                          result?.summary,
                          result?.recommendation ? `Recomendação: ${result.recommendation}` : '',
                        ].filter(Boolean).join('\n\n')
                        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
                      }} style={{ padding: '6px 12px', background: copied ? 'var(--green-light)' : 'var(--bg-2)', color: copied ? 'var(--green-2)' : 'var(--ink-4)', border: `1px solid ${copied ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                        {copied ? '✓ Copiado' : '⎘ Copiar'}
                      </button>
                      <ShareButton title={`${drugs.join(' + ')} — ${result?.severity || ''}`} text={result?.summary || ''} />
                      <SaveButton
                        kind="med_check"
                        title={`Interação: ${drugs.join(' + ')}`}
                        preview={result?.summary || result?.recommendation || ''}
                        href="/interactions"
                        data={{ drugs, result }}
                        color={sev?.color || VERDE_DA_CASA}
                        size="sm"
                      />
                      <ShareCard
                        title={drugs.join(' + ')}
                        badge={result?.severity}
                        badgeColor={sev?.color || VERDE_DA_CASA}
                        lines={[result?.summary || '', result?.recommendation || ''].filter(Boolean)}
                        footer="Verificador de interações medicamentosas"
                        label="↗ Cartão"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <NaoEDispositivoMedico />
        </div>
    </Mesa>
  )
}
