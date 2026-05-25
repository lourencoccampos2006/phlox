'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { printDoc, type PrintRecord } from '@/lib/print'

// ─── Types ──────────────────────────────────────────────────────────────────
type WStatus = 'active' | 'healing' | 'healed'
type WType = 'pressure' | 'venous' | 'arterial' | 'diabetic' | 'surgical' | 'skin_tear' | 'other'

interface Patient { id: string; name: string; room_number?: string | null }
interface Wound {
  id: string; patient_id: string; location: string; type: WType
  stage?: string | null; status: WStatus; onset_date?: string | null; healed_date?: string | null
  length_mm?: number | null; width_mm?: number | null; depth_mm?: number | null
  exudate?: string | null; tissue?: string | null; infection_signs?: boolean
  dressing?: string | null; treatment?: string | null; notes?: string | null
}
interface WAssessment {
  id: string; wound_id: string; date: string
  length_mm?: number | null; width_mm?: number | null; depth_mm?: number | null
  stage?: string | null; exudate?: string | null; tissue?: string | null; pain?: number | null
  dressing?: string | null; notes?: string | null; assessed_by?: string | null; photo_url?: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<WType, string> = {
  pressure: 'Úlcera de pressão', venous: 'Úlcera venosa', arterial: 'Úlcera arterial',
  diabetic: 'Pé diabético', surgical: 'Ferida cirúrgica', skin_tear: 'Laceração cutânea', other: 'Outra',
}
const STAGE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'I':           { label: 'Categoria I',   color: '#ca8a04', bg: '#fefce8' },
  'II':          { label: 'Categoria II',  color: '#d97706', bg: '#fffbeb' },
  'III':         { label: 'Categoria III', color: '#dc2626', bg: '#fef2f2' },
  'IV':          { label: 'Categoria IV',  color: '#991b1b', bg: '#fee2e2' },
  'unstageable': { label: 'Inclassificável', color: '#6b21a8', bg: '#faf5ff' },
  'DTI':         { label: 'Suspeita LTP',  color: '#7c3aed', bg: '#f5f3ff' },
}
const STATUS_CFG: Record<WStatus, { label: string; color: string; bg: string; border: string }> = {
  active:  { label: 'Ativa',       color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  healing: { label: 'Em cicatrização', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  healed:  { label: 'Cicatrizada', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
}
const EXUDATE = ['Nenhum', 'Escasso', 'Moderado', 'Abundante']
const TISSUE = ['Granulação', 'Epitelização', 'Esfacelo', 'Necrótico', 'Misto']
const LOCATIONS = ['Sacro', 'Calcâneo D', 'Calcâneo E', 'Trocânter D', 'Trocânter E', 'Ísquion', 'Maléolo', 'Cotovelo', 'Occipital', 'Omoplata', 'Outro']
const STAGES = ['I', 'II', 'III', 'IV', 'unstageable', 'DTI']

const area = (l?: number | null, w?: number | null) => (l && w) ? Math.round(l * w / 100) / 10 : null // cm²
const daysSince = (d?: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function FeridasPage() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [wounds, setWounds] = useState<Wound[]>([])
  const [assessments, setAssessments] = useState<WAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [filter, setFilter] = useState<'open' | 'healed' | 'all'>('open')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Wound | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAssess, setShowAssess] = useState(false)
  const [saving, setSaving] = useState(false)

  const emptyWound = { patient_id: '', location: 'Sacro', type: 'pressure' as WType, stage: 'II', onset_date: new Date().toISOString().slice(0, 10), length_mm: '', width_mm: '', depth_mm: '', exudate: 'Escasso', tissue: 'Granulação', dressing: '', notes: '' }
  const [wForm, setWForm] = useState<any>(emptyWound)
  const emptyAssess = { date: new Date().toISOString().slice(0, 10), length_mm: '', width_mm: '', depth_mm: '', stage: '', exudate: 'Escasso', tissue: 'Granulação', pain: '', dressing: '', notes: '', assessed_by: '' }
  const [aForm, setAForm] = useState<any>(emptyAssess)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [uploadErr, setUploadErr] = useState('')
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiErr, setAiErr] = useState('')

  function fileToBase64(file: File): Promise<{ b64: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => { const s = String(r.result); resolve({ b64: s.split(',')[1] || '', mime: file.type || 'image/jpeg' }) }
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }
  async function analyzePhoto() {
    if (!photo || !selected) return
    setAiAnalyzing(true); setAiErr(''); setAiResult(null)
    try {
      const { b64, mime } = await fileToBase64(photo)
      const res = await fetch('/api/wound-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime, context: { location: selected.location, type: TYPE_LABELS[selected.type] } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setAiResult(data)
    } catch (e: any) { setAiErr(e.message || 'Não foi possível analisar.') }
    finally { setAiAnalyzing(false) }
  }
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  function applyAi() {
    if (!aiResult) return
    setAForm((f: any) => ({
      ...f,
      tissue: TISSUE.find(t => t.toLowerCase() === (aiResult.tissue || '').toLowerCase()) || f.tissue,
      exudate: EXUDATE.find(e => e.toLowerCase() === (aiResult.exudate || '').toLowerCase()) || f.exudate,
      stage: STAGES.includes(aiResult.suggested_stage) ? aiResult.suggested_stage : f.stage,
      notes: [f.notes, aiResult.observations].filter(Boolean).join(f.notes ? ' · ' : ''),
    }))
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, w] = await Promise.all([
      supabase.from('patients').select('id,name,room_number').eq('user_id', user.id).order('name'),
      supabase.from('wounds').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setPatients(p.data || [])
    if (w.error) { setTableMissing(true); setWounds([]) }
    else { setTableMissing(false); setWounds(w.data || []) }
    const { data: a } = await supabase.from('wound_assessments').select('*').eq('user_id', user.id).order('date', { ascending: true })
    setAssessments(a || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const roomOf = (id: string) => { const r = patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }
  const woundAssessments = (wid: string) => assessments.filter(a => a.wound_id === wid).sort((x, y) => x.date.localeCompare(y.date))

  // latest known measurements (from assessments or wound base)
  function latestArea(w: Wound): number | null {
    const a = woundAssessments(w.id)
    if (a.length) { const last = a[a.length - 1]; return area(last.length_mm, last.width_mm) }
    return area(w.length_mm, w.width_mm)
  }
  function trend(w: Wound): 'down' | 'up' | 'flat' | null {
    const a = woundAssessments(w.id)
    const series = [area(w.length_mm, w.width_mm), ...a.map(x => area(x.length_mm, x.width_mm))].filter(v => v != null) as number[]
    if (series.length < 2) return null
    const first = series[0], last = series[series.length - 1]
    if (last < first * 0.95) return 'down'
    if (last > first * 1.05) return 'up'
    return 'flat'
  }

  async function addWound() {
    if (!user || !wForm.patient_id || !wForm.location) return
    setSaving(true)
    const payload = {
      user_id: user.id, patient_id: wForm.patient_id, location: wForm.location, type: wForm.type,
      stage: wForm.stage || null, status: 'active', onset_date: wForm.onset_date || null,
      length_mm: wForm.length_mm ? parseFloat(wForm.length_mm) : null,
      width_mm: wForm.width_mm ? parseFloat(wForm.width_mm) : null,
      depth_mm: wForm.depth_mm ? parseFloat(wForm.depth_mm) : null,
      exudate: wForm.exudate || null, tissue: wForm.tissue || null,
      dressing: wForm.dressing || null, notes: wForm.notes || null,
    }
    const { error } = await supabase.from('wounds').insert(payload)
    setSaving(false)
    if (!error) { setShowAdd(false); setWForm(emptyWound); load() }
  }

  async function addAssessment() {
    if (!user || !selected) return
    setSaving(true); setUploadErr('')
    // Upload da foto (best-effort) → Supabase Storage 'wounds'
    let photoUrl: string | null = null
    if (photo) {
      try {
        const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${selected.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('wounds').upload(path, photo, { upsert: false, contentType: photo.type || 'image/jpeg' })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('wounds').getPublicUrl(path)
        photoUrl = pub?.publicUrl || null
      } catch {
        setUploadErr('Não foi possível guardar a foto (cria o bucket "wounds" no Supabase). A avaliação foi guardada sem foto.')
      }
    }
    await supabase.from('wound_assessments').insert({
      user_id: user.id, wound_id: selected.id, date: aForm.date,
      length_mm: aForm.length_mm ? parseFloat(aForm.length_mm) : null,
      width_mm: aForm.width_mm ? parseFloat(aForm.width_mm) : null,
      depth_mm: aForm.depth_mm ? parseFloat(aForm.depth_mm) : null,
      stage: aForm.stage || null, exudate: aForm.exudate || null, tissue: aForm.tissue || null,
      pain: aForm.pain ? parseInt(aForm.pain) : null, dressing: aForm.dressing || null,
      notes: aForm.notes || null, assessed_by: aForm.assessed_by || null, photo_url: photoUrl,
    })
    // reflect latest measurement on the wound row
    await supabase.from('wounds').update({
      length_mm: aForm.length_mm ? parseFloat(aForm.length_mm) : selected.length_mm,
      width_mm: aForm.width_mm ? parseFloat(aForm.width_mm) : selected.width_mm,
      depth_mm: aForm.depth_mm ? parseFloat(aForm.depth_mm) : selected.depth_mm,
      stage: aForm.stage || selected.stage, exudate: aForm.exudate || selected.exudate,
      tissue: aForm.tissue || selected.tissue, dressing: aForm.dressing || selected.dressing,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id).eq('user_id', user.id)
    setSaving(false); setShowAssess(false); setAForm(emptyAssess); setPhoto(null); setPhotoPreview(''); load()
    setSelected(s => s ? { ...s } : s)
  }

  async function setStatus(w: Wound, status: WStatus) {
    await supabase.from('wounds').update({ status, healed_date: status === 'healed' ? new Date().toISOString().slice(0, 10) : null }).eq('id', w.id).eq('user_id', user.id)
    setWounds(prev => prev.map(x => x.id === w.id ? { ...x, status } : x))
    if (selected?.id === w.id) setSelected({ ...selected, status })
  }

  async function deleteWound(w: Wound) {
    if (!confirm('Eliminar este registo de ferida?')) return
    await supabase.from('wounds').delete().eq('id', w.id).eq('user_id', user.id)
    setSelected(null); load()
  }

  function printWound(w: Wound) {
    const a = woundAssessments(w.id)
    const records: PrintRecord[] = [{
      title: `${TYPE_LABELS[w.type]} · ${w.location}`,
      tags: [{ label: STATUS_CFG[w.status].label, color: STATUS_CFG[w.status].color }, ...(w.stage ? [{ label: STAGE_CFG[w.stage]?.label || w.stage, color: STAGE_CFG[w.stage]?.color || '#64748b' }] : [])],
      fields: [
        { label: 'Residente', value: nameOf(w.patient_id) },
        { label: 'Quarto', value: roomOf(w.patient_id) || '—' },
        { label: 'Início', value: w.onset_date || '—' },
        { label: 'Dias em evolução', value: String(daysSince(w.onset_date) ?? '—') },
        { label: 'Dimensão atual', value: latestArea(w) != null ? `${latestArea(w)} cm²` : '—' },
        { label: 'Exsudado', value: w.exudate || '—' },
        { label: 'Tecido', value: w.tissue || '—' },
        { label: 'Penso', value: w.dressing || '—' },
      ],
      body: w.notes || undefined,
    }]
    const evolution: PrintRecord[] = a.map(x => ({
      title: new Date(x.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }),
      meta: [x.stage ? `Categoria ${x.stage}` : '', area(x.length_mm, x.width_mm) != null ? `${area(x.length_mm, x.width_mm)} cm²` : '', x.exudate ? `exsudado ${x.exudate.toLowerCase()}` : ''].filter(Boolean).join(' · '),
      body: x.notes || undefined,
    }))
    printDoc({
      docTitle: 'Registo de Ferida',
      docSubtitle: `${nameOf(w.patient_id)} · ${TYPE_LABELS[w.type]} · ${w.location}`,
      institution: 'Lar / ERPI',
      sections: [
        { heading: 'Caracterização', records },
        { heading: 'Evolução', note: `${a.length} avaliações`, records: evolution.length ? evolution : [{ title: 'Sem avaliações registadas' }] },
      ],
      footerNote: 'Registo de ferida · classificação NPUAP/EPUAP · Phlox',
    })
  }

  // ── Derived ──
  const visible = wounds.filter(w => {
    if (filter === 'open' && w.status === 'healed') return false
    if (filter === 'healed' && w.status !== 'healed') return false
    if (search && !nameOf(w.patient_id).toLowerCase().includes(search.toLowerCase()) && !w.location.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const stats = {
    active: wounds.filter(w => w.status === 'active').length,
    healing: wounds.filter(w => w.status === 'healing').length,
    severe: wounds.filter(w => w.status !== 'healed' && (w.stage === 'III' || w.stage === 'IV' || w.stage === 'unstageable')).length,
    healedMonth: wounds.filter(w => w.status === 'healed' && (w.healed_date || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
  }

  // ════════════════ DETAIL VIEW ════════════════
  if (selected) {
    const w = wounds.find(x => x.id === selected.id) || selected
    const a = woundAssessments(w.id)
    const series = [{ date: w.onset_date || '', ar: area(w.length_mm, w.width_mm) }, ...a.map(x => ({ date: x.date, ar: area(x.length_mm, x.width_mm) }))].filter(s => s.ar != null) as { date: string; ar: number }[]
    const maxAr = Math.max(...series.map(s => s.ar), 1)
    const sc = STATUS_CFG[w.status]; const stg = w.stage ? STAGE_CFG[w.stage] : null
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Voltar
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => printWound(w)} style={{ padding: '8px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Imprimir</button>
              <button onClick={() => { setAForm(emptyAssess); setShowAssess(true) }} style={{ padding: '8px 14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Avaliação</button>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: 4, background: sc.color }} />
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{TYPE_LABELS[w.type]} · {w.location}</h2>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>{nameOf(w.patient_id)} {roomOf(w.patient_id)} · início {w.onset_date || '—'} · {daysSince(w.onset_date) ?? '—'} dias</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(() => {
                    const tr = trend(w)
                    if (!tr) return null
                    const cfg = tr === 'down' ? { l: 'A melhorar', c: '#16a34a', bg: '#f0fdf4', a: '▼' } : tr === 'up' ? { l: 'A agravar', c: '#dc2626', bg: '#fef2f2', a: '▲' } : { l: 'Estável', c: '#64748b', bg: 'var(--bg-2)', a: '–' }
                    return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.c}33`, padding: '3px 10px', borderRadius: 6 }}>{cfg.a} {cfg.l}</span>
                  })()}
                  {stg && <span style={{ fontSize: 11, fontWeight: 700, color: stg.color, background: stg.bg, padding: '3px 10px', borderRadius: 6 }}>{stg.label}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: '3px 10px', borderRadius: 6 }}>{sc.label}</span>
                </div>
              </div>

              {/* Area evolution chart */}
              {series.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ ...lbl, marginBottom: 10 }}>Evolução da área (cm²)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, padding: '0 2px' }}>
                    {series.map((s, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0d6e42', fontFamily: 'var(--font-mono)' }}>{s.ar}</div>
                        <div style={{ width: '100%', maxWidth: 38, height: `${Math.max((s.ar / maxAr) * 80, 4)}px`, background: i === series.length - 1 ? '#0d6e42' : '#86c9a8', borderRadius: '4px 4px 0 0' }} />
                        <div style={{ fontSize: 8, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' }) : '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {(['active', 'healing', 'healed'] as WStatus[]).map(s => {
                  const c = STATUS_CFG[s]; const on = w.status === s
                  return <button key={s} onClick={() => setStatus(w, s)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${on ? c.color : 'var(--border)'}`, background: on ? c.bg : 'white', color: on ? c.color : 'var(--ink-4)', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{c.label}</button>
                })}
                <button onClick={() => deleteWound(w)} style={{ marginLeft: 'auto', padding: '7px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Eliminar</button>
              </div>
            </div>
          </div>

          {/* Assessment history */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Histórico de avaliações ({a.length})</div>
            {a.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem avaliações. Adiciona a primeira com “+ Avaliação”.</div>
            ) : [...a].reverse().map(x => (
              <div key={x.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{new Date(x.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--ink-4)', flexWrap: 'wrap' }}>
                    {area(x.length_mm, x.width_mm) != null && <span><strong style={{ color: '#0d6e42' }}>{area(x.length_mm, x.width_mm)} cm²</strong></span>}
                    {x.stage && <span>Cat. {x.stage}</span>}
                    {x.exudate && <span>{x.exudate}</span>}
                    {x.tissue && <span>{x.tissue}</span>}
                    {x.pain != null && <span>Dor {x.pain}/10</span>}
                  </div>
                </div>
                {x.dressing && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Penso: {x.dressing}</div>}
                {x.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{x.notes}</div>}
                {x.photo_url && (
                  <a href={x.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>
                    <img src={x.photo_url} alt="Ferida" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {showAssess && (
          <Modal title="Nova avaliação" onClose={() => setShowAssess(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Data</span><input type="date" value={aForm.date} onChange={e => setAForm({ ...aForm, date: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Estadiamento</span><select value={aForm.stage} onChange={e => setAForm({ ...aForm, stage: e.target.value })} style={inp}><option value="">—</option>{STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Comp. (mm)</span><input type="number" value={aForm.length_mm} onChange={e => setAForm({ ...aForm, length_mm: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Larg. (mm)</span><input type="number" value={aForm.width_mm} onChange={e => setAForm({ ...aForm, width_mm: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Prof. (mm)</span><input type="number" value={aForm.depth_mm} onChange={e => setAForm({ ...aForm, depth_mm: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Exsudado</span><select value={aForm.exudate} onChange={e => setAForm({ ...aForm, exudate: e.target.value })} style={inp}>{EXUDATE.map(x => <option key={x}>{x}</option>)}</select></div>
                <div><span style={lbl}>Tecido</span><select value={aForm.tissue} onChange={e => setAForm({ ...aForm, tissue: e.target.value })} style={inp}>{TISSUE.map(x => <option key={x}>{x}</option>)}</select></div>
                <div><span style={lbl}>Dor (0-10)</span><input type="number" min="0" max="10" value={aForm.pain} onChange={e => setAForm({ ...aForm, pain: e.target.value })} style={inp} /></div>
              </div>
              <div><span style={lbl}>Penso aplicado</span><input value={aForm.dressing} onChange={e => setAForm({ ...aForm, dressing: e.target.value })} placeholder="Ex: Hidrocolóide, espuma..." style={inp} /></div>
              <div>
                <span style={lbl}>Fotografia da ferida</span>
                {photoPreview ? (
                  <div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={photoPreview} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                        <button onClick={() => { setPhoto(null); setPhotoPreview(''); setAiResult(null); setAiErr('') }} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#dc2626', color: 'white', border: '2px solid white', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
                      </div>
                      <button onClick={analyzePhoto} disabled={aiAnalyzing} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #7c3aed', background: aiAnalyzing ? 'var(--bg-3)' : '#faf5ff', color: '#7c3aed', fontSize: 13, fontWeight: 700, cursor: aiAnalyzing ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 1.5.5 2 1 3M12 2a4 4 0 0 1 4 4c0 1.5-.5 2-1 3M8 13h8M9 17h6"/></svg>
                        {aiAnalyzing ? 'A analisar foto…' : 'Analisar foto com IA'}
                      </button>
                    </div>
                    {aiErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 8 }}>{aiErr}</div>}
                    {aiResult && (
                      <div style={{ marginTop: 10, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Análise por IA</span>
                          <button onClick={applyAi} style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: 'white', border: '1px solid #e9d5ff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Aplicar sugestões</button>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {aiResult.suggested_stage && aiResult.suggested_stage !== 'não aplicável' && <span style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', background: 'white', border: '1px solid #e9d5ff', padding: '2px 8px', borderRadius: 5 }}>Estádio {aiResult.suggested_stage}</span>}
                          {aiResult.tissue && <span style={{ fontSize: 11, color: '#6b21a8', background: 'white', border: '1px solid #e9d5ff', padding: '2px 8px', borderRadius: 5 }}>{aiResult.tissue}</span>}
                          {aiResult.exudate && <span style={{ fontSize: 11, color: '#6b21a8', background: 'white', border: '1px solid #e9d5ff', padding: '2px 8px', borderRadius: 5 }}>exsudado {aiResult.exudate}</span>}
                          {aiResult.infection_signs && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 5 }}>Possível infeção</span>}
                        </div>
                        {aiResult.observations && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{aiResult.observations}</div>}
                        {aiResult.infection_signs && aiResult.infection_notes && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{aiResult.infection_notes}</div>}
                        {Array.isArray(aiResult.recommendations) && aiResult.recommendations.length > 0 && (
                          <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                            {aiResult.recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                          </ul>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 8, fontStyle: 'italic' }}>{aiResult.disclaimer}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: '1.5px dashed var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--ink-4)', fontSize: 13 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Tirar / escolher foto
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)) } }} />
                  </label>
                )}
              </div>
              <div><span style={lbl}>Notas</span><textarea value={aForm.notes} onChange={e => setAForm({ ...aForm, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div><span style={lbl}>Avaliado por</span><input value={aForm.assessed_by} onChange={e => setAForm({ ...aForm, assessed_by: e.target.value })} style={inp} /></div>
              {uploadErr && <div style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>{uploadErr}</div>}
              <button onClick={addAssessment} disabled={saving} style={{ padding: '11px', background: saving ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar avaliação'}</button>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  // ════════════════ LIST VIEW ════════════════
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 920 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Clínico · Cuidados de Pele</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Gestão de Feridas</h1>
          </div>
          <button onClick={() => { setWForm(emptyWound); setShowAdd(true) }} style={{ padding: '10px 18px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova ferida
          </button>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Base de dados por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>Corre o ficheiro <strong>supabase/sprint14_wounds.sql</strong> no SQL Editor do Supabase para ativar a gestão de feridas.</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { n: stats.active, l: 'Ativas', c: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
                { n: stats.healing, l: 'Em cicatrização', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
                { n: stats.severe, l: 'Cat. III/IV', c: '#991b1b', bg: '#fee2e2', bd: '#fca5a5' },
                { n: stats.healedMonth, l: 'Cicatrizadas/mês', c: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 130px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['open', 'healed', 'all'] as const).map(fl => (
                <button key={fl} onClick={() => setFilter(fl)} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${filter === fl ? '#0d6e42' : 'var(--border)'}`, background: filter === fl ? '#eef6f1' : 'white', color: filter === fl ? '#0d6e42' : 'var(--ink-4)', fontSize: 12, fontWeight: filter === fl ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {fl === 'open' ? 'Em curso' : fl === 'healed' ? 'Cicatrizadas' : 'Todas'}
                </button>
              ))}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar residente ou local..." style={{ ...inp, width: 240, flex: '0 1 240px', marginLeft: 'auto' }} />
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}</div>
            ) : visible.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 44, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>{wounds.length === 0 ? 'Sem feridas registadas' : 'Sem resultados'}</div>
                {wounds.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Regista a primeira ferida para começar o acompanhamento.</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visible.map(w => {
                  const sc = STATUS_CFG[w.status]; const stg = w.stage ? STAGE_CFG[w.stage] : null
                  const ar = latestArea(w); const tr = trend(w)
                  return (
                    <div key={w.id} onClick={() => setSelected(w)} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${sc.color}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{nameOf(w.patient_id)}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{roomOf(w.patient_id)}</span>
                          {stg && <span style={{ fontSize: 10, fontWeight: 700, color: stg.color, background: stg.bg, padding: '1px 7px', borderRadius: 5 }}>{stg.label}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{TYPE_LABELS[w.type]} · {w.location} · {daysSince(w.onset_date) ?? '—'}d</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {ar != null && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0d6e42', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {tr === 'down' && <span style={{ color: '#16a34a' }}>▼</span>}
                            {tr === 'up' && <span style={{ color: '#dc2626' }}>▲</span>}
                            {ar} cm²
                          </div>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <Modal title="Registar ferida" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><span style={lbl}>Residente *</span>
              <select value={wForm.patient_id} onChange={e => setWForm({ ...wForm, patient_id: e.target.value })} style={inp}>
                <option value="">Selecionar...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.room_number ? ` — Q${p.room_number}` : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Tipo</span><select value={wForm.type} onChange={e => setWForm({ ...wForm, type: e.target.value })} style={inp}>{(Object.keys(TYPE_LABELS) as WType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></div>
              <div><span style={lbl}>Localização</span><select value={wForm.location} onChange={e => setWForm({ ...wForm, location: e.target.value })} style={inp}>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Estadiamento</span><select value={wForm.stage} onChange={e => setWForm({ ...wForm, stage: e.target.value })} style={inp}><option value="">—</option>{STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}</select></div>
              <div><span style={lbl}>Data de início</span><input type="date" value={wForm.onset_date} onChange={e => setWForm({ ...wForm, onset_date: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Comp. (mm)</span><input type="number" value={wForm.length_mm} onChange={e => setWForm({ ...wForm, length_mm: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Larg. (mm)</span><input type="number" value={wForm.width_mm} onChange={e => setWForm({ ...wForm, width_mm: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Prof. (mm)</span><input type="number" value={wForm.depth_mm} onChange={e => setWForm({ ...wForm, depth_mm: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Exsudado</span><select value={wForm.exudate} onChange={e => setWForm({ ...wForm, exudate: e.target.value })} style={inp}>{EXUDATE.map(x => <option key={x}>{x}</option>)}</select></div>
              <div><span style={lbl}>Tecido</span><select value={wForm.tissue} onChange={e => setWForm({ ...wForm, tissue: e.target.value })} style={inp}>{TISSUE.map(x => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div><span style={lbl}>Penso / tratamento</span><input value={wForm.dressing} onChange={e => setWForm({ ...wForm, dressing: e.target.value })} placeholder="Ex: Hidrocolóide" style={inp} /></div>
            <div><span style={lbl}>Notas</span><textarea value={wForm.notes} onChange={e => setWForm({ ...wForm, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
            <button onClick={addWound} disabled={saving || !wForm.patient_id} style={{ padding: '11px', background: (!wForm.patient_id || saving) ? 'var(--bg-3)' : '#0d6e42', color: (!wForm.patient_id || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!wForm.patient_id || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Registar ferida'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
