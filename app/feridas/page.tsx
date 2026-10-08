'use client'

// app/feridas/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FERIDAS — refeito de raiz na linguagem da mesa (2026-10-07).
//
// A rota /feridas é só um reencaminhamento: a ferramenta vive como aba do
// «Registo do dia» (/care-log?tab=feridas). O `FeridasTool` em baixo é o que
// lá aparece.
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. O DETALHE ERA OUTRA PÁGINA (`if (selected) return`). Quem faz a ronda
//     dos pensos vai de ferida em ferida: ver a segunda obrigava a voltar
//     atrás e procurar outra vez onde ia. Passa a mestre/detalhe.
//
//  2. A LISTA ESCONDIA O NÚMERO CLÍNICO. Cada ferida era um cartão com o
//     nome, o tipo, o local e a área. O PUSH — a escala validada de
//     cicatrização, 0 a 17, menor é melhor — estava enterrado dentro do
//     histórico de avaliações, a três cliques. É o número que diz se a
//     ferida está a fechar, e agora é uma coluna.
//
//  3. QUATRO CARTÕES DE ESTATÍSTICA COM FUNDO DE COR no topo (ativas, em
//     cicatrização, cat. III/IV, cicatrizadas/mês). Quatro caixas coloridas
//     antes de aparecer uma única ferida. Passam à barra, em texto.
//
//  4. O ROXO `var(--roxo-escuro)` do PUSH e das análises por IA — uma quinta cor, fora
//     do código de três. O PUSH é um número: lê-se, não se pinta.
//
// ── UM DEFEITO A SÉRIO, CORRIGIDO ──────────────────────────────────────────
// O `load` era `useCallback(..., [user, supabase])` mas usa `scope.filter`.
// O `scope.orgId` chega uns milissegundos DEPOIS do primeiro render — e sem
// ele nas dependências a lista nunca recarregava. Numa conta com organização
// isso significa que a primeira (e única) leitura corria com o filtro por
// `user_id`: cada pessoa via só as feridas que ela própria tinha registado,
// e as dos colegas não existiam. Numa ronda de pensos isso é grave.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { reportError } from '@/lib/clientError'
import { printDoc, type PrintRecord } from '@/lib/print'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Grupo, Campo, Folha, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// A rota /feridas redireciona p/ não partir links antigos.
export default function FeridasRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/care-log?tab=feridas') }, [r])
  return null
}

// ─── Tipos ──────────────────────────────────────────────────────────────────
type WStatus = 'active' | 'healing' | 'healed'
type WType = 'pressure' | 'venous' | 'arterial' | 'diabetic' | 'surgical' | 'skin_tear' | 'other'

interface Patient { id: string; name: string; room_number?: string | null }
interface Wound {
  id: string; patient_id: string; location: string; type: WType
  stage?: string | null; status: WStatus; onset_date?: string | null; healed_date?: string | null
  length_mm?: number | null; width_mm?: number | null; depth_mm?: number | null
  exudate?: string | null; tissue?: string | null; dressing?: string | null; notes?: string | null
}
interface WAssessment {
  id: string; wound_id: string; date: string
  length_mm?: number | null; width_mm?: number | null; depth_mm?: number | null
  stage?: string | null; exudate?: string | null; tissue?: string | null
  pain?: number | null; dressing?: string | null; notes?: string | null
  assessed_by?: string | null; photo_url?: string | null; ai_report?: any
}

const TYPE_LABELS: Record<WType, string> = {
  pressure: 'Pressão', venous: 'Venosa', arterial: 'Arterial', diabetic: 'Diabética',
  surgical: 'Cirúrgica', skin_tear: 'Laceração', other: 'Outra',
}

/* O ESTADIAMENTO NÃO É UM CÓDIGO DE CORES (2026-10-07)
   Eram seis tons próprios — um por categoria. Seis cores a competir com as
   três que querem dizer alguma coisa. A categoria é uma ESCALA: lê-se «II»,
   «III», «IV». O que decide a cor é a gravidade, e essa é binária aqui: a
   partir da III (e no «não estadiável») é vermelho, abaixo é tinta normal. */
const STAGE_CFG: Record<string, { label: string; grave: boolean }> = {
  'I': { label: 'Cat. I', grave: false },
  'II': { label: 'Cat. II', grave: false },
  'III': { label: 'Cat. III', grave: true },
  'IV': { label: 'Cat. IV', grave: true },
  'unstageable': { label: 'Não estadiável', grave: true },
  'DTI': { label: 'Suspeita LTP', grave: true },
}

const STATUS_CFG: Record<WStatus, { label: string; cor: string }> = {
  active: { label: 'Ativa', cor: 'var(--red)' },
  healing: { label: 'A cicatrizar', cor: 'var(--amber)' },
  healed: { label: 'Cicatrizada', cor: 'var(--green)' },
}

const EXUDATE = ['Nenhum', 'Escasso', 'Moderado', 'Abundante']
const TISSUE = ['Granulação', 'Epitelização', 'Esfacelo', 'Necrótico', 'Misto']
const LOCATIONS = ['Sacro', 'Calcâneo D', 'Calcâneo E', 'Trocânter D', 'Trocânter E', 'Ísquion', 'Maléolo', 'Cotovelo', 'Occipital', 'Omoplata', 'Outro']
const STAGES = ['I', 'II', 'III', 'IV', 'unstageable', 'DTI']

const area = (l?: number | null, w?: number | null) => (l && w) ? Math.round(l * w / 100) / 10 : null // cm²
const daysSince = (d?: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null

// ── PUSH (Pressure Ulcer Scale for Healing) ────────────────────────────────
// 0 a 17, menor é melhor. Área + exsudado + tipo de tecido. É a escala
// validada que diz se a ferida está mesmo a fechar — e não a área sozinha,
// que uma ferida pode manter enquanto o tecido piora.
function pushAreaScore(cm2: number | null): number | null {
  if (cm2 == null) return null
  if (cm2 <= 0) return 0
  if (cm2 < 0.3) return 1
  if (cm2 <= 0.6) return 2
  if (cm2 <= 1.0) return 3
  if (cm2 <= 2.0) return 4
  if (cm2 <= 3.0) return 5
  if (cm2 <= 4.0) return 6
  if (cm2 <= 8.0) return 7
  if (cm2 <= 12.0) return 8
  if (cm2 <= 24.0) return 9
  return 10
}
const pushExudateScore = (exudate?: string | null) => exudate ? EXUDATE.indexOf(exudate) : null
const TISSUE_PUSH: Record<string, number> = { 'Epitelização': 1, 'Granulação': 2, 'Esfacelo': 3, 'Necrótico': 4, 'Misto': 3 }
const pushTissueScore = (tissue?: string | null) => tissue ? (TISSUE_PUSH[tissue] ?? null) : null
function pushTotal(x: { length_mm?: number | null; width_mm?: number | null; exudate?: string | null; tissue?: string | null }): number | null {
  const a = pushAreaScore(area(x.length_mm, x.width_mm)), e = pushExudateScore(x.exudate), t = pushTissueScore(x.tissue)
  if (a == null || e == null || t == null) return null
  return a + e + t
}

type Filtro = 'open' | 'healed' | 'all'

export function FeridasTool() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const largo = useLargo()
  const person = cfg.personNoun
  const personLower = person.toLowerCase()

  const [patients, setPatients] = useState<Patient[]>([])
  const [wounds, setWounds] = useState<Wound[]>([])
  const [assessments, setAssessments] = useState<WAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [filter, setFilter] = useState<Filtro>('open')
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
  // Análise pós-submissão (sobre uma avaliação já guardada, com foto)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [storedAiErr, setStoredAiErr] = useState<Record<string, string>>({})

  // Reduz a imagem no cliente (≤1024px, JPEG) — evita timeouts/payloads grandes na IA
  function downscaleToBase64(file: File, maxDim = 1024, quality = 0.82): Promise<{ b64: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Não foi possível processar a imagem.')); return }
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ b64: dataUrl.split(',')[1] || '', mime: 'image/jpeg' })
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')) }
      img.src = url
    })
  }

  async function analyzePhoto() {
    if (!photo || !selected) return
    setAiAnalyzing(true); setAiErr(''); setAiResult(null)
    try {
      const { b64, mime } = await downscaleToBase64(photo)
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

  // Analisa a foto JÁ GUARDADA de uma avaliação e persiste o relatório
  async function analyzeStored(assessment: any, wound: Wound) {
    if (!assessment.photo_url) return
    setAnalyzingId(assessment.id); setStoredAiErr(p => ({ ...p, [assessment.id]: '' }))
    try {
      const res = await fetch('/api/wound-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: assessment.photo_url, context: { location: wound.location, type: TYPE_LABELS[wound.type] } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const { error } = await supabase.from('wound_assessments').update({ ai_report: data }).eq('id', assessment.id)
      if (error) { console.error('[phlox:feridas-ai-save]', error.message); throw new Error('O relatório foi gerado mas não foi possível guardá-lo agora.') }
      setAssessments((prev: any[]) => prev.map(a => a.id === assessment.id ? { ...a, ai_report: data } : a))
    } catch (e: any) { setStoredAiErr(p => ({ ...p, [assessment.id]: e.message || 'Falhou' })) }
    finally { setAnalyzingId(null) }
  }

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
      scope.filter(supabase.from('patients').select('id,name,room_number')).order('name'),
      scope.filter(supabase.from('wounds').select('*')).order('created_at', { ascending: false }),
    ])
    setPatients(p.data || [])
    if (w.error) { setTableMissing(true); setWounds([]) }
    else { setTableMissing(false); setWounds(w.data || []) }
    // Sem scope.filter: wound_assessments não tem org_id (herda pelo join à
    // ferida). O filtro acrescentava `org_id = …` a uma coluna inexistente e
    // a consulta rebentava em contas com organização. A RLS já protege.
    const { data: a } = await (supabase.from('wound_assessments').select('*')).order('date', { ascending: true })
    setAssessments(a || [])
    setLoading(false)
    // `scope.orgId`/`scope.userId` TÊM de estar aqui: chegam depois do
    // primeiro render, e sem eles a lista ficava com a leitura que correu
    // antes de haver casa — filtrada por `user_id`. Cada pessoa via só as
    // feridas que ela própria registou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || person
  const roomOf = (id: string) => { if (!cfg.hasBeds) return ''; const r = patients.find(p => p.id === id)?.room_number; return r ? `${cfg.roomLabel[0]}${r}` : '' }
  const woundAssessments = useCallback(
    (wid: string) => assessments.filter(a => a.wound_id === wid).sort((x, y) => x.date.localeCompare(y.date)),
    [assessments])

  /** A última medição conhecida — da avaliação mais recente, ou da ferida. */
  const latestArea = useCallback((w: Wound): number | null => {
    const a = woundAssessments(w.id)
    if (a.length) { const last = a[a.length - 1]; return area(last.length_mm, last.width_mm) }
    return area(w.length_mm, w.width_mm)
  }, [woundAssessments])

  /** O PUSH mais recente. É o número que diz se a ferida está a fechar. */
  const latestPush = useCallback((w: Wound): number | null => {
    const a = woundAssessments(w.id)
    if (a.length) return pushTotal(a[a.length - 1])
    return pushTotal(w)
  }, [woundAssessments])

  const trend = useCallback((w: Wound): 'down' | 'up' | 'flat' | null => {
    const a = woundAssessments(w.id)
    const series = [area(w.length_mm, w.width_mm), ...a.map(x => area(x.length_mm, x.width_mm))].filter(v => v != null) as number[]
    if (series.length < 2) return null
    const first = series[0], last = series[series.length - 1]
    if (last < first * 0.95) return 'down'
    if (last > first * 1.05) return 'up'
    return 'flat'
  }, [woundAssessments])

  async function addWound() {
    if (!user || !wForm.patient_id || !wForm.location) return
    setSaving(true)
    const payload = scope.stamp({
      user_id: user.id, patient_id: wForm.patient_id, location: wForm.location, type: wForm.type,
      stage: wForm.stage || null, status: 'active', onset_date: wForm.onset_date || null,
      length_mm: wForm.length_mm ? parseFloat(wForm.length_mm) : null,
      width_mm: wForm.width_mm ? parseFloat(wForm.width_mm) : null,
      depth_mm: wForm.depth_mm ? parseFloat(wForm.depth_mm) : null,
      exudate: wForm.exudate || null, tissue: wForm.tissue || null,
      dressing: wForm.dressing || null, notes: wForm.notes || null,
    })
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
      } catch (e) {
        setUploadErr(reportError('feridas-photo', e, 'Não foi possível guardar a foto agora. A avaliação foi guardada sem foto.'))
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
    // Reflecte a medição mais recente na linha da ferida.
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
      tags: [
        { label: STATUS_CFG[w.status].label, color: STATUS_CFG[w.status].cor },
        ...(w.stage ? [{ label: STAGE_CFG[w.stage]?.label || w.stage, color: STAGE_CFG[w.stage]?.grave ? 'var(--red)' : 'var(--ink-4)' }] : []),
      ],
      fields: [
        { label: person, value: nameOf(w.patient_id) },
        ...(cfg.hasBeds ? [{ label: cfg.roomLabel, value: roomOf(w.patient_id) || '—' }] : []),
        { label: 'Início', value: w.onset_date || '—' },
        { label: 'Dias em evolução', value: String(daysSince(w.onset_date) ?? '—') },
        { label: 'Dimensão atual', value: latestArea(w) != null ? `${latestArea(w)} cm²` : '—' },
        { label: 'PUSH atual', value: latestPush(w) != null ? `${latestPush(w)} / 17` : '—' },
        { label: 'Exsudado', value: w.exudate || '—' },
        { label: 'Tecido', value: w.tissue || '—' },
        { label: 'Penso', value: w.dressing || '—' },
      ],
      body: w.notes || undefined,
    }]
    const evolution: PrintRecord[] = a.map(x => {
      const r = x.ai_report
      const aiBullets = r ? [
        r.suggested_stage && r.suggested_stage !== 'não aplicável' ? `IA: estádio sugerido ${r.suggested_stage}` : '',
        r.tissue ? `IA: tecido ${r.tissue}` : '',
        r.exudate ? `IA: exsudado ${r.exudate}` : '',
        r.infection_signs ? `IA: possível infeção — ${r.infection_notes || 'ver foto'}` : '',
        ...(Array.isArray(r.recommendations) ? r.recommendations.map((rec: string) => `IA: ${rec}`) : []),
      ].filter(Boolean) : []
      return {
        title: new Date(x.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }),
        meta: [
          x.stage ? `Categoria ${x.stage}` : '',
          area(x.length_mm, x.width_mm) != null ? `${area(x.length_mm, x.width_mm)} cm²` : '',
          pushTotal(x) != null ? `PUSH ${pushTotal(x)}` : '',
          x.exudate ? `exsudado ${x.exudate.toLowerCase()}` : '',
          x.photo_url ? 'com foto' : '',
        ].filter(Boolean).join(' · '),
        body: [x.notes, r?.observations].filter(Boolean).join(' — ') || undefined,
        bullets: aiBullets.length ? aiBullets : undefined,
      }
    })
    printDoc({
      docTitle: 'Registo de Ferida',
      docSubtitle: `${nameOf(w.patient_id)} · ${TYPE_LABELS[w.type]} · ${w.location}`,
      institution: cfg.unitNoun,
      sections: [
        { heading: 'Caracterização', records },
        { heading: 'Evolução', note: `${a.length} avaliações`, records: evolution.length ? evolution : [{ title: 'Sem avaliações registadas' }] },
      ],
      footerNote: 'Registo de ferida · classificação NPUAP/EPUAP · PUSH 0–17 · Phlox',
    })
  }

  // ── O que se vê ────────────────────────────────────────────────────────────
  const visible = useMemo(() => wounds.filter(w => {
    if (filter === 'open' && w.status === 'healed') return false
    if (filter === 'healed' && w.status !== 'healed') return false
    if (search
      && !nameOf(w.patient_id).toLowerCase().includes(search.toLowerCase())
      && !w.location.toLowerCase().includes(search.toLowerCase())) return false
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wounds, filter, search, patients])

  const stats = useMemo(() => ({
    active: wounds.filter(w => w.status === 'active').length,
    healing: wounds.filter(w => w.status === 'healing').length,
    severe: wounds.filter(w => w.status !== 'healed' && STAGE_CFG[w.stage || '']?.grave).length,
    healedMonth: wounds.filter(w => w.status === 'healed' && (w.healed_date || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
  }), [wounds])

  const aberta = selected ? (wounds.find(x => x.id === selected.id) || selected) : null

  /* ── O DETALHE DE UMA FERIDA ───────────────────────────────────────────────
     Era uma página à parte. Passa à coluna da direita, para quem faz a ronda
     dos pensos não perder o sítio na lista de cada vez que abre uma. */
  const detalhe = aberta ? (() => {
    const w = aberta
    const a = woundAssessments(w.id)
    const stg = w.stage ? STAGE_CFG[w.stage] : null
    const sc = STATUS_CFG[w.status]

    /* A evolução da área. Era um gráfico de barras verdes de 110px; passa a
       uma linha de números em mono com a barra por baixo — o valor lê-se, a
       barra mostra a forma, e cabe no painel sem empurrar o histórico. */
    const serie = [
      { date: w.onset_date || '', ar: area(w.length_mm, w.width_mm) },
      ...a.map(x => ({ date: x.date, ar: area(x.length_mm, x.width_mm) })),
    ].filter(s => s.ar != null) as { date: string; ar: number }[]
    const maxAr = Math.max(...serie.map(s => s.ar), 1)

    return (
      <>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <Botao onClick={() => setSelected(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'block', fontSize: 'var(--t-destaque)',
              fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
            }}>{nameOf(w.patient_id)}</span>
            <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {TYPE_LABELS[w.type].toUpperCase()} · {w.location.toUpperCase()}
              {roomOf(w.patient_id) ? ` · ${roomOf(w.patient_id)}` : ''}
              {' · '}{daysSince(w.onset_date) ?? '—'} DIAS
            </span>
          </span>
          <Botao onClick={() => printWound(w)}>IMPRIMIR</Botao>
          <Botao feitio="principal" onClick={() => { setAForm(emptyAssess); setShowAssess(true) }}>
            + AVALIAÇÃO
          </Botao>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <Grupo titulo="Onde está hoje">
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 6 }}>
              <span>
                <span style={{ ...ROTULO, display: 'block' }}>Área</span>
                <span style={{ ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any }}>
                  {latestArea(w) != null ? `${latestArea(w)}` : '—'}
                  <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}> cm²</span>
                </span>
              </span>
              <span title="PUSH (Pressure Ulcer Scale for Healing) — 0 a 17. Área + exsudado + tecido. Menor é melhor.">
                <span style={{ ...ROTULO, display: 'block' }}>PUSH</span>
                <span style={{ ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any }}>
                  {latestPush(w) ?? '—'}
                  <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}> /17</span>
                </span>
              </span>
              <span>
                <span style={{ ...ROTULO, display: 'block' }}>Categoria</span>
                <span style={{
                  ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                  color: stg?.grave ? 'var(--red)' : 'var(--ink-2)',
                }}>{stg?.label || '—'}</span>
              </span>
              <span>
                <span style={{ ...ROTULO, display: 'block' }}>Tendência</span>
                <span style={{
                  ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                  color: trend(w) === 'down' ? 'var(--green)' : trend(w) === 'up' ? 'var(--red)' : 'var(--ink-4)',
                }}>
                  {trend(w) === 'down' ? '▼ a fechar'
                    : trend(w) === 'up' ? '▲ a agravar'
                    : trend(w) === 'flat' ? '— estável' : 'sem 2.ª medição'}
                </span>
              </span>
              <span>
                <span style={{ ...ROTULO, display: 'block' }}>Exsudado · tecido</span>
                <span style={{ fontSize: 'var(--t-dado)' }}>{w.exudate || '—'} · {w.tissue || '—'}</span>
              </span>
              <span>
                <span style={{ ...ROTULO, display: 'block' }}>Penso</span>
                <span style={{ fontSize: 'var(--t-dado)' }}>{w.dressing || '—'}</span>
              </span>
            </div>
            {w.notes && (
              <p style={{
                fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55,
                margin: '10px 0 0', whiteSpace: 'pre-wrap',
              }}>{w.notes}</p>
            )}
          </Grupo>

          {serie.length > 1 && (
            <Grupo titulo="Evolução da área · cm²">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
                {serie.map((s, i) => (
                  <span key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                    <span style={{
                      ...MONO, fontSize: 'var(--t-micro)',
                      fontWeight: (i === serie.length - 1 ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                      color: i === serie.length - 1 ? 'var(--ink)' : 'var(--ink-4)',
                    }}>{s.ar}</span>
                    <span style={{
                      width: '100%', maxWidth: 28,
                      height: Math.max((s.ar / maxAr) * 56, 3),
                      background: i === serie.length - 1 ? 'var(--green)' : 'var(--green-mid)',
                      borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                    }} />
                    <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                      {s.date ? `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}` : '—'}
                    </span>
                  </span>
                ))}
              </div>
            </Grupo>
          )}

          <Grupo titulo={`Histórico de avaliações · ${a.length}`}>
            {a.length === 0 ? (
              <Vazio titulo="Ainda sem avaliações."
                oQueFazer="Uma ferida sem segunda medição não tem tendência: não há como saber se está a fechar. Acrescente a primeira em «+ Avaliação»." />
            ) : [...a].reverse().map((x, i, arr) => {
              const push = pushTotal(x)
              const prevPush = i + 1 < arr.length ? pushTotal(arr[i + 1]) : null
              return (
                <div key={x.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{
                      ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
                    }}>{x.date.slice(8, 10)}/{x.date.slice(5, 7)}/{x.date.slice(0, 4)}</span>

                    {push != null && (
                      <span title="PUSH — 0 a 17, menor é melhor" style={{
                        ...MONO, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
                        color: prevPush == null ? 'var(--ink-3)'
                          : push < prevPush ? 'var(--green)'
                          : push > prevPush ? 'var(--red)' : 'var(--ink-3)',
                      }}>
                        PUSH {push}
                        {prevPush != null && push < prevPush ? ' ▼' : prevPush != null && push > prevPush ? ' ▲' : ''}
                      </span>
                    )}
                    {area(x.length_mm, x.width_mm) != null && (
                      <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                        {area(x.length_mm, x.width_mm)} cm²
                      </span>
                    )}
                    {x.stage && <Codigo texto={`CAT ${x.stage}`} cor={STAGE_CFG[x.stage]?.grave ? 'var(--red)' : undefined} />}
                    {x.exudate && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{x.exudate}</span>}
                    {x.tissue && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{x.tissue}</span>}
                    {x.pain != null && (
                      <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: x.pain >= 7 ? 'var(--red)' : 'var(--ink-4)' }}>
                        DOR {x.pain}/10
                      </span>
                    )}
                    {x.assessed_by && (
                      <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginLeft: 'auto' }}>
                        {x.assessed_by}
                      </span>
                    )}
                  </div>

                  {x.dressing && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 3 }}>
                      Penso: {x.dressing}
                    </div>
                  )}
                  {x.notes && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.5 }}>
                      {x.notes}
                    </div>
                  )}

                  {x.photo_url && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 7, flexWrap: 'wrap' }}>
                      <a href={x.photo_url} target="_blank" rel="noopener noreferrer">
                        <img src={x.photo_url} alt={`Ferida em ${x.date}`} style={{
                          width: 72, height: 72, objectFit: 'cover',
                          borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                        }} />
                      </a>
                      {!x.ai_report && (
                        <Botao onClick={() => analyzeStored(x, w)} esperando={analyzingId === x.id}>
                          ANALISAR A FOTO COM IA
                        </Botao>
                      )}
                    </div>
                  )}
                  {storedAiErr[x.id] && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 5 }}>
                      {storedAiErr[x.id]}
                    </div>
                  )}

                  {x.ai_report && (
                    <div style={{
                      marginTop: 7, padding: '9px 11px', background: 'var(--bg-2)',
                      border: '1px dashed var(--border-2)', borderRadius: 'var(--r-sm)',
                    }}>
                      <div style={{ ...ROTULO, marginBottom: 5 }}>Leitura da foto por IA — confirme sempre</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                        {x.ai_report.suggested_stage && x.ai_report.suggested_stage !== 'não aplicável' && (
                          <Codigo texto={`SUGERE CAT ${x.ai_report.suggested_stage}`} />
                        )}
                        {x.ai_report.tissue && <Codigo texto={String(x.ai_report.tissue).toUpperCase()} />}
                        {x.ai_report.exudate && <Codigo texto={`EXS ${String(x.ai_report.exudate).toUpperCase()}`} />}
                        {x.ai_report.infection_signs && <Codigo texto="POSSÍVEL INFEÇÃO" cor="var(--red)" />}
                      </div>
                      {x.ai_report.observations && (
                        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                          {x.ai_report.observations}
                        </div>
                      )}
                      {Array.isArray(x.ai_report.recommendations) && x.ai_report.recommendations.length > 0 && (
                        <ul style={{ margin: '5px 0 0', paddingLeft: 16, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                          {x.ai_report.recommendations.map((r: string, k: number) => <li key={k}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Grupo>

          <Grupo titulo="Em que ponto está">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {(['active', 'healing', 'healed'] as WStatus[]).map(st => {
                const c = STATUS_CFG[st]
                const on = w.status === st
                return (
                  <button key={st} type="button" onClick={() => setStatus(w, st)} className="mesa-botao"
                    style={{
                      ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                      textTransform: 'uppercase', padding: '0 12px',
                      borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${on ? c.cor : 'var(--border-2)'}`,
                      background: on ? c.cor : 'transparent',
                      color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                      fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                    }}>{c.label}</button>
                )
              })}
              <span style={{ marginLeft: 'auto' }}>
                <Botao feitio="calmo" onClick={() => deleteWound(w)}>ELIMINAR O REGISTO</Botao>
              </span>
            </div>
          </Grupo>
        </div>
      </>
    )
  })() : null

  if (tableMissing) {
    return (
      <Mesa>
        <Painel>
          <Vazio titulo="As feridas ainda não estão disponíveis nesta conta."
            oQueFazer="Falta um passo de configuração desta casa. Assim que estiver feito, esta página passa a acompanhar cada ferida com medições, fotografia e a escala PUSH." />
        </Painel>
      </Mesa>
    )
  }

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Feridas</span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${personLower} ou local…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 230 }} />

          <Seletor
            opcoes={[
              { id: 'open', rotulo: 'Em curso' },
              { id: 'healed', rotulo: 'Cicatrizadas' },
              { id: 'all', rotulo: 'Todas' },
            ]}
            ativa={filter} aoMudar={f => setFilter(f as Filtro)} />

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              {stats.active > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                  {stats.active} ATIVA{stats.active === 1 ? '' : 'S'}
                </span>
              )}
              {stats.severe > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                  {stats.severe} CAT. III OU PIOR
                </span>
              )}
              {stats.healing > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
                  {stats.healing} A CICATRIZAR
                </span>
              )}
              {stats.healedMonth > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)' }}>
                  {stats.healedMonth} FECHADA{stats.healedMonth === 1 ? '' : 'S'} ESTE MÊS
                </span>
              )}
            </span>
          )}

          <div style={{ marginLeft: 'auto' }}>
            <Botao feitio="principal" onClick={() => { setWForm(emptyWound); setShowAdd(true) }}>
              + NOVA FERIDA
            </Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>PUSH 0–17, menor é melhor — área + exsudado + tecido</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>▼ a fechar</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>▲ a agravar · Cat. III ou pior</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Classificação NPUAP/EPUAP. A decisão é sempre do profissional.
          </span>
        </BarraDeEstado>
      }
    >
      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(380px, 1fr) minmax(400px, 560px)' : '1fr',
      }}>
        {(largo || !aberta) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 44, textAlign: 'right' }}>Dias</span>
                <span style={{ ...ROTULO, flex: 1 }}>{person} · tipo e local</span>
                <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Área</span>
                <span style={{ ...ROTULO, width: 50, textAlign: 'right' }}>PUSH</span>
                <span style={{ ...ROTULO, width: 70 }}>Categoria</span>
                <span style={{ ...ROTULO, width: 86 }}>Estado</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{visible.length} de {wounds.length}</span>}
          >
            {loading ? (
              <ACarregar oQue="A carregar as feridas…" />
            ) : visible.length === 0 ? (
              <Vazio
                titulo={wounds.length === 0 ? 'Sem feridas registadas.' : 'Nenhuma corresponde ao filtro.'}
                oQueFazer={wounds.length === 0
                  ? 'Registe a primeira para começar o acompanhamento: medida, exsudado e tecido dão o PUSH, e é o PUSH que diz se está a fechar.'
                  : 'Experimente alargar o filtro ou limpar a pesquisa.'} />
            ) : visible.map(w => {
              const sc = STATUS_CFG[w.status]
              const stg = w.stage ? STAGE_CFG[w.stage] : null
              const ar = latestArea(w)
              const push = latestPush(w)
              const tr = trend(w)
              const dias = daysSince(w.onset_date)
              return (
                <LinhaTabela key={w.id}
                  aoTocar={() => setSelected(w)}
                  ativa={aberta?.id === w.id}
                  filete={w.status !== 'healed' && stg?.grave ? 'var(--red)' : w.status === 'active' ? sc.cor : undefined}
                  antes={{
                    largura: 44,
                    conteudo: (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-3)',
                        display: 'block', textAlign: largo ? 'right' : 'left',
                      }}>{dias != null ? `${dias}d` : '—'}</span>
                    ),
                  }}
                  principal={
                    <>
                      {nameOf(w.patient_id)}
                      {roomOf(w.patient_id) && (
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                          {' '}· {roomOf(w.patient_id)}
                        </span>
                      )}
                    </>
                  }
                  secundaria={`${TYPE_LABELS[w.type]} · ${w.location}`}
                  celulas={[
                    {
                      rotulo: 'Área', largura: 56, direita: true,
                      valor: ar != null ? (
                        <>
                          {tr === 'down' && <span style={{ color: 'var(--green)' }}>▼</span>}
                          {tr === 'up' && <span style={{ color: 'var(--red)' }}>▲</span>}
                          {ar}
                        </>
                      ) : '—',
                      cor: tr === 'up' ? 'var(--red)' : tr === 'down' ? 'var(--green)' : 'var(--ink-3)',
                    },
                    { rotulo: 'PUSH', valor: push ?? '—', largura: 50, direita: true, forte: true },
                    {
                      rotulo: 'Categoria', valor: stg?.label || '—', largura: 70,
                      cor: stg?.grave ? 'var(--red)' : 'var(--ink-4)', forte: !!stg?.grave,
                    },
                    {
                      rotulo: 'Estado', valor: sc.label.toUpperCase(), largura: 86,
                      cor: sc.cor, forte: true,
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {aberta ? (
          <Painel>{detalhe}</Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo="Escolha uma ferida."
              oQueFazer="Abre aqui ao lado, com a lista sempre à vista — para a ronda dos pensos não obrigar a voltar atrás de cada vez." />
          </Painel>
        ) : null}
      </div>
    </Mesa>

    {/* ── REGISTAR UMA FERIDA ────────────────────────────────────────────── */}
    {showAdd && (
      <Folha titulo="Registar ferida" aoFechar={() => setShowAdd(false)}>
        <Campo rotulo={person} para="f-utente" obrigatorio>
          <select id="f-utente" value={wForm.patient_id}
            onChange={e => setWForm({ ...wForm, patient_id: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
            <option value="">Escolher…</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{cfg.hasBeds && p.room_number ? ` — ${cfg.roomLabel[0]}${p.room_number}` : ''}
              </option>
            ))}
          </select>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Tipo" para="f-tipo">
            <select id="f-tipo" value={wForm.type} onChange={e => setWForm({ ...wForm, type: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {(Object.keys(TYPE_LABELS) as WType[]).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Localização" para="f-local">
            <select id="f-local" value={wForm.location} onChange={e => setWForm({ ...wForm, location: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Categoria" para="f-cat">
            <select id="f-cat" value={wForm.stage} onChange={e => setWForm({ ...wForm, stage: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              <option value="">—</option>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data de início" para="f-inicio">
            <input id="f-inicio" type="date" value={wForm.onset_date}
              onChange={e => setWForm({ ...wForm, onset_date: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        </div>

        <Campo rotulo="Medida (mm)"
          ajuda="O comprimento e a largura dão a área, e a área entra no PUSH. Sem elas não há como medir a evolução.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input aria-label="Comprimento em mm" type="number" inputMode="decimal" placeholder="Comp."
              value={wForm.length_mm} onChange={e => setWForm({ ...wForm, length_mm: e.target.value })} style={CAIXA} />
            <input aria-label="Largura em mm" type="number" inputMode="decimal" placeholder="Larg."
              value={wForm.width_mm} onChange={e => setWForm({ ...wForm, width_mm: e.target.value })} style={CAIXA} />
            <input aria-label="Profundidade em mm" type="number" inputMode="decimal" placeholder="Prof."
              value={wForm.depth_mm} onChange={e => setWForm({ ...wForm, depth_mm: e.target.value })} style={CAIXA} />
          </div>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Exsudado" para="f-exs">
            <select id="f-exs" value={wForm.exudate} onChange={e => setWForm({ ...wForm, exudate: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {EXUDATE.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tecido" para="f-tec">
            <select id="f-tec" value={wForm.tissue} onChange={e => setWForm({ ...wForm, tissue: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {TISSUE.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Penso / tratamento" para="f-penso">
          <input id="f-penso" value={wForm.dressing} onChange={e => setWForm({ ...wForm, dressing: e.target.value })}
            placeholder="Ex: hidrocolóide, espuma…" style={{ ...CAIXA, width: '100%' }} />
        </Campo>
        <Campo rotulo="Notas" para="f-notas">
          <textarea id="f-notas" value={wForm.notes} onChange={e => setWForm({ ...wForm, notes: e.target.value })}
            rows={2} style={{ ...CAIXA_TEXTO, width: '100%' }} />
        </Campo>

        <div style={{ marginTop: 16 }}>
          <Botao feitio="principal" onClick={addWound} esperando={saving} disabled={!wForm.patient_id}>
            REGISTAR A FERIDA
          </Botao>
        </div>
      </Folha>
    )}

    {/* ── NOVA AVALIAÇÃO ─────────────────────────────────────────────────── */}
    {showAssess && aberta && (
      <Folha titulo={`Nova avaliação · ${nameOf(aberta.patient_id)}`} aoFechar={() => setShowAssess(false)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Data" para="a-data">
            <input id="a-data" type="date" value={aForm.date}
              onChange={e => setAForm({ ...aForm, date: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Categoria" para="a-cat">
            <select id="a-cat" value={aForm.stage} onChange={e => setAForm({ ...aForm, stage: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              <option value="">—</option>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_CFG[s].label}</option>)}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Medida (mm)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input aria-label="Comprimento em mm" type="number" inputMode="decimal" placeholder="Comp."
              value={aForm.length_mm} onChange={e => setAForm({ ...aForm, length_mm: e.target.value })} style={CAIXA} />
            <input aria-label="Largura em mm" type="number" inputMode="decimal" placeholder="Larg."
              value={aForm.width_mm} onChange={e => setAForm({ ...aForm, width_mm: e.target.value })} style={CAIXA} />
            <input aria-label="Profundidade em mm" type="number" inputMode="decimal" placeholder="Prof."
              value={aForm.depth_mm} onChange={e => setAForm({ ...aForm, depth_mm: e.target.value })} style={CAIXA} />
          </div>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Campo rotulo="Exsudado" para="a-exs">
            <select id="a-exs" value={aForm.exudate} onChange={e => setAForm({ ...aForm, exudate: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {EXUDATE.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Tecido" para="a-tec">
            <select id="a-tec" value={aForm.tissue} onChange={e => setAForm({ ...aForm, tissue: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
              {TISSUE.map(x => <option key={x}>{x}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Dor (0–10)" para="a-dor">
            <input id="a-dor" type="number" min="0" max="10" inputMode="numeric" value={aForm.pain}
              onChange={e => setAForm({ ...aForm, pain: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        </div>

        <Campo rotulo="Penso aplicado" para="a-penso">
          <input id="a-penso" value={aForm.dressing} onChange={e => setAForm({ ...aForm, dressing: e.target.value })}
            placeholder="Ex: hidrocolóide, espuma…" style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        <Campo rotulo="Fotografia da ferida"
          ajuda="Fica guardada com a data. É o que permite a alguém que não estava cá ver como a ferida estava há três semanas.">
          {photoPreview ? (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={photoPreview} alt="Pré-visualização da fotografia" style={{
                    width: 88, height: 88, objectFit: 'cover',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                  }} />
                  <button type="button" aria-label="Tirar a fotografia"
                    onClick={() => { setPhoto(null); setPhotoPreview(''); setAiResult(null); setAiErr('') }}
                    style={{
                      position: 'absolute', top: -7, right: -7, width: 20, height: 20,
                      borderRadius: '50%', background: 'var(--red)', color: 'var(--sobre-acento)',
                      border: '2px solid var(--bg)', cursor: 'pointer', fontSize: 'var(--t-micro)', lineHeight: 1,
                    }}>×</button>
                </span>
                <Botao onClick={analyzePhoto} esperando={aiAnalyzing}>ANALISAR A FOTO COM IA</Botao>
              </div>
              {aiErr && <div style={{ marginTop: 8 }}><Aviso tom="atencao">{aiErr}</Aviso></div>}
              {aiResult && (
                <div style={{
                  marginTop: 9, padding: '10px 12px', background: 'var(--bg-2)',
                  border: '1px dashed var(--border-2)', borderRadius: 'var(--r-sm)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ ...ROTULO, flex: 1 }}>Leitura por IA — proposta, não diagnóstico</span>
                    <Botao onClick={applyAi}>APLICAR AOS CAMPOS</Botao>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                    {aiResult.suggested_stage && aiResult.suggested_stage !== 'não aplicável' && (
                      <Codigo texto={`SUGERE CAT ${aiResult.suggested_stage}`} />
                    )}
                    {aiResult.tissue && <Codigo texto={String(aiResult.tissue).toUpperCase()} />}
                    {aiResult.exudate && <Codigo texto={`EXS ${String(aiResult.exudate).toUpperCase()}`} />}
                    {aiResult.infection_signs && <Codigo texto="POSSÍVEL INFEÇÃO" cor="var(--red)" />}
                  </div>
                  {aiResult.observations && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                      {aiResult.observations}
                    </div>
                  )}
                  {aiResult.infection_signs && aiResult.infection_notes && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 4 }}>
                      {aiResult.infection_notes}
                    </div>
                  )}
                  {Array.isArray(aiResult.recommendations) && aiResult.recommendations.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                      {aiResult.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  {aiResult.disclaimer && (
                    <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 7 }}>
                      {aiResult.disclaimer}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <label className="mesa-botao" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '0 14px', border: '1px dashed var(--border-2)',
              borderRadius: 'var(--r-md)', cursor: 'pointer',
              ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em', color: 'var(--ink-4)',
            }}>
              TIRAR OU ESCOLHER FOTO
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)) } }} />
            </label>
          )}
        </Campo>

        <Campo rotulo="Notas" para="a-notas">
          <textarea id="a-notas" value={aForm.notes} onChange={e => setAForm({ ...aForm, notes: e.target.value })}
            rows={2} style={{ ...CAIXA_TEXTO, width: '100%' }} />
        </Campo>
        <Campo rotulo="Avaliado por" para="a-quem">
          <input id="a-quem" value={aForm.assessed_by} onChange={e => setAForm({ ...aForm, assessed_by: e.target.value })}
            style={{ ...CAIXA, width: '100%' }} />
        </Campo>

        {uploadErr && <div style={{ marginTop: 10 }}><Aviso tom="atencao">{uploadErr}</Aviso></div>}

        <div style={{ marginTop: 16 }}>
          <Botao feitio="principal" onClick={addAssessment} esperando={saving}>GUARDAR A AVALIAÇÃO</Botao>
        </div>
      </Folha>
    )}
    </>
  )
}
