'use client'

// /scan — Phlox Scan: uma foto de QUALQUER coisa de saúde.
// A IA identifica o tipo (receita, caixa, análise, relatório, bula…) e age:
// extrai medicação, interpreta valores, resume relatórios. "O Shazam da saúde."
// Substitui o antigo /organizar — faz tudo o que ele fazia e muito mais.

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { extractFromFile } from '@/lib/docExtract'
import { sendToTool } from '@/lib/toolBridge'
import { useUsageLimit } from '@/lib/useUsageLimit'
import UpgradeNudge from '@/components/UpgradeNudge'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

// /scan — Phlox Scan: SÓ a foto auto-deteta. Voltou a ser uma ferramenta
// dedicada e simples (a fusão anterior em abas era frágil e rebentava).
// Para texto: /medicamento e /receita são páginas próprias.
export default function ScanPage() {
  return <ScanTool />
}

const ACCENT = '#0d6e42'

// Reduz a foto antes de enviar. As fotos da câmara (3–12 MB) em base64 estouravam
// o payload e o tempo da chamada de visão → "erro ao processar". Reduzir para
// ~1280px/JPEG 0.82 mantém a legibilidade do texto e corta o tamanho ~10×.
function downscaleImage(file: File, maxDim = 1280, q = 0.82): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ b64: (c.toDataURL('image/jpeg', q).split(',')[1]) || '', mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

interface Med { name: string; dose?: string; frequency?: string; _import?: boolean }
interface LabValue { name: string; value?: string; status?: string; note?: string }
interface ScanResult {
  kind: string
  title?: string
  summary?: string
  meds?: Med[]
  values?: LabValue[]
  bullets?: string[]
  action?: { label?: string; route?: string }
  warning?: string
  confidence?: string
}

const KIND_META: Record<string, { icon: string; label: string }> = {
  receita:     { icon: '📋', label: 'Receita médica' },
  medicamento: { icon: '💊', label: 'Medicamento' },
  analise:     { icon: '🩸', label: 'Análise' },
  relatorio:   { icon: '📄', label: 'Relatório médico' },
  bula:        { icon: '📑', label: 'Bula / folheto' },
  outro:       { icon: '🔍', label: 'Documento de saúde' },
  nao_saude:   { icon: '🤔', label: 'Sem relação com saúde' },
}
const STATUS_COLOR: Record<string, string> = { normal: '#0d6e42', baixo: '#b45309', alto: '#dc2626' }

function ScanTool() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [res, setRes] = useState<ScanResult | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [err, setErr] = useState('')
  const [imported, setImported] = useState(false)
  const [interactions, setInteractions] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(getActiveProfile())
  const fileRef = useRef<HTMLInputElement>(null)
  const scanUsage = useUsageLimit('scan')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  function reset() { setErr(''); setRes(null); setMeds([]); setImported(false); setInteractions(null) }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    // Limite diário (Base/Plus). Pro/Institucional = ilimitado.
    if (scanUsage.hit) { reset(); setErr('limit'); return }
    reset()
    // Deteção robusta de imagem: a câmara do telemóvel devolve muitas vezes
    // file.type vazio (ou HEIC). Não confiar só no mimeType — olhar também à
    // extensão e tratar "tipo desconhecido" como imagem (caso da foto auto).
    const name = (file.name || '').toLowerCase()
    const isDoc = /\.(pdf|docx?|pptx?|txt|md)$/.test(name) || file.type === 'application/pdf'
      || file.type.startsWith('text/')
      || file.type.includes('word') || file.type.includes('officedocument')
    const isImage = !isDoc && (
      file.type.startsWith('image/') ||
      file.type === '' ||                       // câmara sem mimeType
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(name)
    )
    try {
      let payload: any
      if (isImage) {
        setBusy('A interpretar a imagem…')
        // 1ª via: reduzir no canvas (corta tamanho ~10×). Se o browser não souber
        // descodificar (ex: HEIC antigo), recai na leitura crua do ficheiro.
        let b64 = ''
        let mime = 'image/jpeg'
        try {
          const small = await downscaleImage(file)
          if (!small.b64) throw new Error('empty')
          b64 = small.b64; mime = small.mime
        } catch {
          const raw = await new Promise<string>((res2, rej) => {
            const rd = new FileReader()
            rd.onload = () => {
              const result = String(rd.result || '')
              const comma = result.indexOf(',')
              if (comma < 0) { rej(new Error('Não consegui ler a imagem. Tenta outra foto.')); return }
              res2(result.slice(comma + 1))
            }
            rd.onerror = () => rej(new Error('Não consegui ler a imagem. Tenta outra foto.'))
            rd.readAsDataURL(file)
          })
          b64 = raw
          mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
        }
        payload = { image: b64, mimeType: mime }
      } else {
        // PDF / Word / texto → extrai no browser e envia o texto
        setBusy('A ler o documento…')
        const ex = await extractFromFile(file)
        if (!ex.text || ex.text.trim().length < 10) throw new Error('Documento sem texto legível.')
        payload = { text: ex.text }
      }
      const r = await fetch('/api/scan', { method: 'POST', headers: await auth(), body: JSON.stringify(payload) })
      const j = await r.json()
      if (r.status === 429 || j.limit_reached) { setErr('limit'); return }
      if (!r.ok) throw new Error(j.error || 'Não consegui interpretar.')
      setRes(j)
      setMeds((j.meds || []).map((m: Med) => ({ ...m, _import: true })))
      scanUsage.increment()
    } catch (e: any) { setErr(e.message || 'Erro ao processar.') } finally { setBusy('') }
  }

  async function importMeds() {
    if (!user) { setErr('Inicie sessão para guardar.'); return }
    const toImport = meds.filter(m => m._import)
    if (!toImport.length) return
    setBusy('A guardar…')
    // Guarda no perfil ATIVO: o próprio (personal_meds) ou um familiar
    // (family_profile_meds). Resolve o caso do cuidador a importar para a mãe.
    const toFamily = activeProfile?.type === 'family' && activeProfile.id !== 'self'
    for (const m of toImport) {
      if (toFamily) {
        await supabase.from('family_profile_meds').insert({ user_id: user.id, profile_id: activeProfile!.id, name: m.name, dose: m.dose || null, frequency: m.frequency || null }).then(() => {}, () => {})
      } else {
        await supabase.from('personal_meds').insert({ user_id: user.id, name: m.name, dose: m.dose || null, frequency: m.frequency || null }).then(() => {}, () => {})
      }
    }
    setBusy(''); setImported(true)
  }

  async function checkInteractions() {
    const names = meds.filter(m => m._import).map(m => m.name)
    if (names.length < 2) { setInteractions('Precisas de pelo menos 2 medicamentos para verificar interações.'); return }
    setBusy('A verificar interações…')
    try {
      const r = await fetch('/api/interactions', { method: 'POST', headers: await auth(), body: JSON.stringify({ drugs: names }) })
      const j = await r.json()
      const sev = j.severity || j.results?.[0]?.severity
      setInteractions(j.summary || j.results?.[0]?.summary || (sev === 'SEM_INTERACAO' ? 'Sem interações relevantes conhecidas entre estes medicamentos.' : 'Verificação concluída — vê os detalhes em /interactions.'))
    } catch { setInteractions('Não consegui verificar agora.') } finally { setBusy('') }
  }

  const meta = res ? (KIND_META[res.kind] || KIND_META.outro) : null
  const hasMeds = meds.length > 0
  const hasValues = (res?.values?.length || 0) > 0

  return (
    <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99' }}>Phlox Scan</div>
      <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Uma foto. O Phlox percebe.</h1>
      <p style={{ color: '#6b7280', fontSize: 14.5, lineHeight: 1.6, marginBottom: 18 }}>Tire foto a <b>qualquer coisa de saúde</b> — receita, caixa de comprimidos, análise, relatório ou bula. O Phlox percebe o que é e explica de forma simples. Em segundos.</p>

      {/* Upload — foto (câmara/galeria) OU documento (PDF/Word) */}
      <div onClick={() => fileRef.current?.click()} style={{ border: `1.5px dashed ${ACCENT}`, borderRadius: 14, padding: 26, textAlign: 'center', cursor: 'pointer', background: '#f0fdf5' }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>📷</div>
        <div style={{ fontWeight: 700, color: ACCENT }}>{busy || 'Tirar foto ou escolher ficheiro'}</div>
        <div style={{ fontSize: 12, color: '#8b8f99', marginTop: 2 }}>Receita · caixa · análise · relatório · bula — câmara, galeria, PDF ou Word</div>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {err === 'limit'
        ? <UpgradeNudge used={scanUsage.used} limit={scanUsage.limit} what="fotos no Phlox Scan" plan="pro" />
        : err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 12, borderRadius: 8, marginTop: 14, fontSize: 13 }}>{err}</div>}

      {/* Contador discreto de uso restante (só planos limitados) */}
      {!scanUsage.unlimited && !res && err !== 'limit' && (
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
          {scanUsage.remaining} de {scanUsage.limit} análises grátis hoje
        </div>
      )}

      {/* Resultado interpretado */}
      {res && meta && (
        <div style={{ marginTop: 18 }}>
          {/* Cabeçalho do tipo identificado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 26 }}>{meta.icon}</span>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b8f99', fontFamily: 'var(--font-mono,monospace)' }}>{meta.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#16181d' }}>{res.title || meta.label}</div>
            </div>
            {res.confidence && res.confidence !== 'alta' && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b8f99', background: '#f3f4f6', padding: '3px 8px', borderRadius: 99 }}>confiança {res.confidence}</span>
            )}
          </div>

          {res.summary && <p style={{ color: '#374151', fontSize: 14.5, lineHeight: 1.65, margin: '0 0 12px' }}>{res.summary}</p>}

          {res.warning && <div style={{ background: '#fffbeb', color: '#92400e', padding: 11, borderRadius: 8, margin: '0 0 12px', fontSize: 13, lineHeight: 1.55 }}>⚠ {res.warning}</div>}

          {/* Valores de análise */}
          {hasValues && (
            <div style={{ display: 'grid', gap: 6, margin: '0 0 14px' }}>
              {res!.values!.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: '9px 12px' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</span>
                  {v.value && <span style={{ fontSize: 14, color: '#16181d' }}>{v.value}</span>}
                  {v.status && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: STATUS_COLOR[v.status] || '#6b7280' }}>{v.status}</span>}
                  {v.note && <span style={{ flexBasis: '100%', fontSize: 12.5, color: '#6b7280' }}>{v.note}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Pontos-chave */}
          {(res.bullets?.length || 0) > 0 && (
            <ul style={{ margin: '0 0 14px', paddingLeft: 20, color: '#374151', fontSize: 13.5, lineHeight: 1.7 }}>
              {res.bullets!.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}

          {/* Medicamentos extraídos — confirmar e importar */}
          {hasMeds && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Encontrei {meds.length} medicamento{meds.length > 1 ? 's' : ''} — confirma antes de guardar:</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {meds.map((m, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!m._import} onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, _import: e.target.checked } : x))} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 14.5 }}>{m.name}{m.dose ? ` ${m.dose}` : ''}</span>
                      {m.frequency && <span style={{ display: 'block', fontSize: 12.5, color: '#6b7280' }}>{m.frequency}</span>}
                    </span>
                  </label>
                ))}
              </div>
              {/* Para quem? Permite ao cuidador guardar no perfil de um familiar. */}
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>Guardar em:</span>
                  <ProfileSelector onChange={p => { setActiveProfile(p); setImported(false) }} includePatients={false} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={importMeds} disabled={!!busy || imported} style={{ padding: '11px 20px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{imported ? '✓ Guardado' : (activeProfile?.type === 'family' ? `Guardar em ${activeProfile.name.split(' ')[0]}` : 'Guardar na minha medicação')}</button>
                {/* Handoff: leva os medicamentos extraídos para "Os meus medicamentos",
                    onde o utilizador os revê, edita doses e ativa lembretes. */}
                <button onClick={() => sendToTool(router, '/mymeds', {
                  kind: 'meds', note: 'Importado do Phlox Scan', from: '/scan',
                  payload: { meds: meds.filter(m => m._import).map(m => ({ name: m.name, dose: m.dose || null, frequency: m.frequency || null })) },
                })} disabled={!!busy || !meds.some(m => m._import)} style={{ padding: '11px 20px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Rever e adicionar lembretes →</button>
                <button onClick={checkInteractions} disabled={!!busy} style={{ padding: '11px 20px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Verificar interações</button>
              </div>
              {imported && <div style={{ marginTop: 10, fontSize: 13, color: ACCENT }}>✓ Guardado. <Link href="/mymeds" style={{ color: ACCENT, fontWeight: 700 }}>Ver a minha medicação →</Link></div>}
              {interactions && <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e7e8ea', borderRadius: 10, padding: 12, fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{interactions} {' '}<Link href="/interactions" style={{ color: ACCENT, fontWeight: 600 }}>detalhes</Link></div>}
            </div>
          )}

          {/* Ação sugerida (para tipos sem medicação para importar) */}
          {!hasMeds && res.action?.route && res.action?.label && (
            <Link href={res.action.route} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: ACCENT, color: 'white', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
              {res.action.label} →
            </Link>
          )}

          {res.kind === 'nao_saude' && (
            <p style={{ color: '#8b8f99', fontSize: 13, marginTop: 8 }}>Esta foto não parece relacionada com saúde. Tenta uma receita, caixa de medicamento, análise ou relatório.</p>
          )}

          <button onClick={() => { reset(); fileRef.current?.click() }} style={{ display: 'block', marginTop: 16, background: 'none', border: 'none', color: '#8b8f99', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Analisar outra foto</button>
        </div>
      )}
    </main>
  )
}
