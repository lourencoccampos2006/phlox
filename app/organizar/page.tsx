'use client'

// /organizar — Foto da receita ou das caixas → organiza a medicação numa lista,
// importa para "Os meus medicamentos" e verifica interações. O momento "uau".

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { extractFromFile } from '@/lib/docExtract'

const ACCENT = '#0d6e42'
interface Med { name: string; active?: string; dose?: string; frequency?: string; notes?: string; _import?: boolean }

export default function OrganizarPage() {
  const { user, supabase } = useAuth() as any
  const [busy, setBusy] = useState('')
  const [meds, setMeds] = useState<Med[]>([])
  const [warning, setWarning] = useState('')
  const [err, setErr] = useState('')
  const [imported, setImported] = useState(false)
  const [interactions, setInteractions] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  async function handleResult(r: Response) {
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Erro')
    setMeds((j.meds || []).map((m: Med) => ({ ...m, _import: true })))
    setWarning(j.warning || '')
    if (!j.meds?.length) setErr('Não identifiquei medicamentos. Tenta uma imagem mais nítida ou outro ficheiro.')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setErr(''); setMeds([]); setWarning(''); setImported(false); setInteractions(null)
    const isImage = file.type.startsWith('image/')
    try {
      if (isImage) {
        setBusy('A ler a imagem…')
        const b64 = await new Promise<string>((res, rej) => {
          const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = rej; rd.readAsDataURL(file)
        })
        const r = await fetch('/api/receita-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: b64, mimeType: file.type }) })
        await handleResult(r)
      } else {
        // PDF / Word / texto → extrai no browser, envia o texto
        setBusy('A ler o documento…')
        const ex = await extractFromFile(file)
        if (!ex.text || ex.text.trim().length < 10) throw new Error('Documento sem texto legível.')
        const r = await fetch('/api/receita-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: ex.text }) })
        await handleResult(r)
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy('') }
  }

  async function importMeds() {
    if (!user) { setErr('Inicia sessão para guardar.'); return }
    const toImport = meds.filter(m => m._import)
    if (!toImport.length) return
    setBusy('A guardar…')
    for (const m of toImport) {
      await supabase.from('personal_meds').insert({ user_id: user.id, name: m.name, dose: m.dose || null, frequency: m.frequency || null, indication: m.notes || null }).then(() => {}, () => {})
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
      const sev = j.severity || (j.results?.[0]?.severity)
      setInteractions(j.summary || j.results?.[0]?.summary || (sev === 'SEM_INTERACAO' ? 'Sem interações relevantes conhecidas entre estes medicamentos.' : 'Verificação concluída — vê os detalhes em /interactions.'))
    } catch { setInteractions('Não consegui verificar agora.') } finally { setBusy('') }
  }

  return (
    <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99' }}>Organizar medicação</div>
      <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Uma foto. Tudo organizado.</h1>
      <p style={{ color: '#6b7280', fontSize: 14.5, lineHeight: 1.6, marginBottom: 18 }}>Tira foto à <b>receita</b> ou às <b>caixas</b> dos medicamentos. O Phlox lê tudo, cria a lista, e verifica se se dão bem — em segundos.</p>

      {/* Upload — foto (câmara/galeria) OU documento (PDF/Word) */}
      <div onClick={() => fileRef.current?.click()} style={{ border: `1.5px dashed ${ACCENT}`, borderRadius: 14, padding: 26, textAlign: 'center', cursor: 'pointer', background: '#f0fdf5' }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>📷📄</div>
        <div style={{ fontWeight: 700, color: ACCENT }}>{busy || 'Foto ou documento'}</div>
        <div style={{ fontSize: 12, color: '#8b8f99', marginTop: 2 }}>Foto da receita/caixas (câmara ou galeria) · PDF · Word</div>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 12, borderRadius: 8, marginTop: 14, fontSize: 13 }}>{err}</div>}
      {warning && <div style={{ background: '#fffbeb', color: '#92400e', padding: 10, borderRadius: 8, marginTop: 12, fontSize: 12.5 }}>⚠ {warning}</div>}

      {/* Lista extraída */}
      {meds.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Encontrei {meds.length} medicamento{meds.length > 1 ? 's' : ''} — confirma antes de guardar:</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {meds.map((m, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!m._import} onChange={e => setMeds(ms => ms.map((x, j) => j === i ? { ...x, _import: e.target.checked } : x))} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{m.name}{m.dose ? ` ${m.dose}` : ''}</span>
                  {(m.frequency || m.notes) && <span style={{ display: 'block', fontSize: 12.5, color: '#6b7280' }}>{[m.frequency, m.notes].filter(Boolean).join(' · ')}</span>}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={importMeds} disabled={!!busy || imported} style={{ padding: '11px 20px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{imported ? '✓ Guardado' : 'Guardar na minha medicação'}</button>
            <button onClick={checkInteractions} disabled={!!busy} style={{ padding: '11px 20px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Verificar interações</button>
          </div>

          {imported && <div style={{ marginTop: 10, fontSize: 13, color: ACCENT }}>✓ Guardado. <Link href="/mymeds" style={{ color: ACCENT, fontWeight: 700 }}>Ver a minha medicação →</Link></div>}
          {interactions && <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e7e8ea', borderRadius: 10, padding: 12, fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{interactions} {' '}<Link href="/interactions" style={{ color: ACCENT, fontWeight: 600 }}>detalhes</Link></div>}
        </div>
      )}
    </main>
  )
}
