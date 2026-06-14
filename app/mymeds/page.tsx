'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePhloxContext } from '@/lib/copilotContext'
import { useHandoff } from '@/lib/toolBridge'
import { useAuth } from '@/components/AuthContext'
import DrugQuickLook from '@/components/DrugQuickLook'
import Link from 'next/link'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'
import { startClientReminderLoop, stopClientReminderLoop } from '@/lib/clientReminder'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface ScannedMed {
  name: string; dose: string|null; frequency: string|null; indication: string|null; selected: boolean
}

interface Med {
  id: string; name: string; dose: string|null
  frequency: string|null; indication: string|null
  reminder_times: string[]|null
  started_at: string|null; created_at: string
  pills_remaining?: number | null
  pills_per_day?: number | null
}

interface DoseLog {
  id: string; med_id: string; date: string
  logged_at: string; status: 'taken'|'skipped'|'snoozed'
}

interface Alert {
  severity: 'grave'|'moderada'|'info'
  message: string; action: string; drugs?: string[]
}

interface AutoCheckResult {
  severity: 'GRAVE'|'MODERADA'|'LIGEIRA'|'SEM_INTERACAO'
  patientInfo: string; recommendation: string; newDrug: string
}

interface ChatMessage { role: 'user'|'assistant'; content: string }

const SEV = {
  grave:    { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', label:'GRAVE',    icon:'🚨' },
  moderada: { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', label:'MODERADA', icon:'⚠️' },
  info:     { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', label:'INFO',     icon:'ℹ️' },
}

const AUTO_SEV = {
  GRAVE:         { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', icon:'🚨', label:'ATENÇÃO — Interação grave' },
  MODERADA:      { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', icon:'⚠️', label:'Interação moderada' },
  LIGEIRA:       { bg:'#fffbeb', border:'#fde68a', color:'#92400e', icon:'ℹ️', label:'Interação ligeira' },
  SEM_INTERACAO: { bg:'#d1fae5', border:'#6ee7b7', color:'#065f46', icon:'✅', label:'Sem interações conhecidas' },
}

const QUICK_PROMPTS = [
  'Posso tomar com álcool?',
  'Esqueci uma dose, o que faço?',
  'Posso tomar com leite?',
  'Tenho dores de cabeça, posso tomar algo?',
  'Quais os efeitos secundários mais comuns?',
]

function todayStr() { return new Date().toISOString().split('T')[0] }

function nowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number); return h * 60 + m
}

// Returns true if a log's logged_at is within ±90min of a slot time
// Atribuição de logs a slots — 2026-06-01.
// Antes: comparávamos hora do click com hora do slot (janela ±90 min). Isso
// falhava sempre que o utilizador registava fora desse intervalo (ex: tomou às
// 15h o slot das 8h → não aparecia como marcado). Fix: dividimos os logs do
// medicamento pelos slots por proximidade, do mais cedo para o mais tarde,
// SEM exigir que cada log esteja perto do slot — basta haver um log a sobrar
// para o slot ficar coberto. Esta função é chamada por slot, recebe os logs
// já filtrados por med_id+status, e devolve o log atribuído (se existir).
function slotIsCovered(slotTime: string, logs: DoseLog[], slotIndex: number, totalSlotsForStatus: number): DoseLog|undefined {
  if (logs.length === 0) return undefined
  // Ordena logs cronologicamente
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  // Atribui sequencialmente: 1º slot do dia ← 1º log do dia (do mesmo med+status)
  if (slotIndex < sorted.length) return sorted[slotIndex]
  // Se o número de logs cobre todos os slots, qualquer slot fica coberto
  if (sorted.length >= totalSlotsForStatus) return sorted[Math.min(slotIndex, sorted.length - 1)]
  return undefined
}

// ─── Reminder Modal ────────────────────────────────────────────────────────────

function ReminderModal({ meds, onSave, onClose }: {
  meds: Med[]; onSave: (medId: string, times: string[]) => void; onClose: () => void
}) {
  const [times, setTimes] = useState<Record<string, string[]>>(
    Object.fromEntries(meds.map(m => [m.id, m.reminder_times || []]))
  )
  const SLOTS = ['07:00','09:00','12:00','13:00','18:00','20:00','22:00']
  const toggleTime = (medId: string, slot: string) => {
    setTimes(prev => {
      const cur = prev[medId] || []
      const next = cur.includes(slot) ? cur.filter(t => t !== slot) : [...cur, slot].sort()
      return { ...prev, [medId]: next }
    })
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'white', borderRadius:'16px 16px 0 0', padding:24, width:'100%', maxWidth:480, maxHeight:'82vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 20px' }} />
        <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>Lembretes de toma</div>
        <div style={{ fontSize:12, color:'var(--ink-4)', marginBottom:20 }}>Receberás uma notificação push no horário escolhido.</div>
        {meds.map(med => (
          <div key={med.id} style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:8 }}>
              💊 {med.name}{med.dose ? ` ${med.dose}` : ''}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {SLOTS.map(slot => {
                const active = (times[med.id]||[]).includes(slot)
                return (
                  <button key={slot} onClick={() => toggleTime(med.id, slot)}
                    style={{ padding:'7px 13px', borderRadius:20, border:`1.5px solid ${active?'var(--green)':'var(--border)'}`, background:active?'var(--green-light)':'white', color:active?'var(--green-2)':'var(--ink-4)', fontSize:12, fontWeight:active?700:400, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                    {slot}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <button onClick={() => { meds.forEach(m => onSave(m.id, times[m.id]||[])); onClose() }}
            style={{ flex:1, padding:13, background:'var(--green)', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            Guardar
          </button>
          <button onClick={onClose}
            style={{ padding:'13px 18px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:10, fontSize:14, cursor:'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Today Dose Row ────────────────────────────────────────────────────────────

function DoseRow({ med, slotTime, log, onTake, onSkip, justConfirmed }: {
  med: Med; slotTime: string; log: DoseLog|undefined
  onTake: () => void; onSkip: () => void; justConfirmed: boolean
}) {
  const now = nowHHMM()
  const slotMin = toMinutes(slotTime)
  const nowMin = toMinutes(now)
  const isPast = nowMin > slotMin + 10
  const isSoon = !isPast && nowMin >= slotMin - 30
  const taken = log?.status === 'taken'
  const skipped = log?.status === 'skipped'

  let dotColor = 'var(--border-2)'
  if (taken) dotColor = 'var(--green)'
  else if (skipped) dotColor = 'var(--ink-5)'
  else if (isPast) dotColor = '#f59e0b'
  else if (isSoon) dotColor = '#3b82f6'

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 16px',
      background: justConfirmed ? '#d1fae5' : taken ? '#f0fdf4' : skipped ? 'var(--bg-2)' : 'white',
      transition: 'background 0.4s',
    }}>
      <div style={{ width:10, height:10, borderRadius:'50%', background:dotColor, flexShrink:0 }} />
      <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--ink-4)', fontWeight:700, width:44, flexShrink:0 }}>{slotTime}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:taken||skipped?'var(--ink-4)':'var(--ink)', letterSpacing:'-0.01em', textDecoration:skipped?'line-through':'none' }}>
          {med.name}{med.dose ? ` ${med.dose}` : ''}
        </div>
        {taken && log && (
          <div style={{ fontSize:11, color:'var(--green-2)', fontFamily:'var(--font-mono)', marginTop:1 }}>
            ✓ Tomado às {new Date(log.logged_at).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })}
          </div>
        )}
        {skipped && <div style={{ fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginTop:1 }}>Ignorado</div>}
        {!taken && !skipped && isPast && <div style={{ fontSize:11, color:'#92400e', fontFamily:'var(--font-mono)', marginTop:1 }}>Em atraso</div>}
        {!taken && !skipped && isSoon && !isPast && <div style={{ fontSize:11, color:'#1d4ed8', fontFamily:'var(--font-mono)', marginTop:1 }}>A seguir</div>}
      </div>
      {!taken && !skipped && (
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button onClick={onTake}
            style={{ padding:'7px 14px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            Tomar
          </button>
          {isPast && (
            <button onClick={onSkip}
              style={{ padding:'7px 10px', background:'white', color:'var(--ink-5)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer' }}>
              Ignorar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MyMedsPage() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<Med[]>([])
  const [todayLogs, setTodayLogs] = useState<DoseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])

  usePhloxContext(
    meds.length ? 'A ver a minha medicação' : '',
    meds.length ? { medicamentos: meds.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}`) } : null
  )
  const [analysing, setAnalysing] = useState(false)
  const [analysed, setAnalysed] = useState(false)
  const [tab, setTab] = useState<'overview'|'alerts'|'add'|'ask'|'sintomas'>('overview')
  const [newMed, setNewMed] = useState({ name:'', dose:'', frequency:'', indication:'' })
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const [justConfirmed, setJustConfirmed] = useState<string|null>(null)

  // Auto-check
  const [autoCheckResult, setAutoCheckResult] = useState<AutoCheckResult|null>(null)
  const [autoChecking, setAutoChecking] = useState(false)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Emergency card
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyToken, setEmergencyToken] = useState<string|null>(null)
  const [emergencyForm, setEmergencyForm] = useState({ name:'', allergies:'', blood_type:'', emergency_contact:'' })
  const [emergencyLoading, setEmergencyLoading] = useState(false)

  // ADR symptom check
  const [symptoms, setSymptoms] = useState('')
  const [adrResult, setAdrResult] = useState<any>(null)
  const [adrLoading, setAdrLoading] = useState(false)

  // Push / reminders
  const [reminderOpen, setReminderOpen] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushGranted, setPushGranted] = useState(false)

  // Scan receita
  const [scannedMeds, setScannedMeds] = useState<ScannedMed[]>([])
  // Handoff: medicamentos enviados de outra ferramenta (ex: Phlox Scan) chegam
  // aqui pré-preenchidos e pré-selecionados, prontos a rever e guardar.
  const handoff = useHandoff('meds')
  const [handoffNote, setHandoffNote] = useState<string | null>(null)
  useEffect(() => {
    if (handoff?.payload?.meds?.length) {
      setScannedMeds(handoff.payload.meds.map((m: any) => ({ name: m.name, dose: m.dose ?? null, frequency: m.frequency ?? null, indication: m.indication ?? null, selected: true })))
      setHandoffNote(handoff.note || 'Importado')
    }
  }, [handoff])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string|null>(null)
  const [addingAll, setAddingAll] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(() => {
    if (typeof window !== 'undefined') return getActiveProfile()
    return null
  })
  const [familyProfileData, setFamilyProfileData] = useState<{ name: string; age?: number | null; conditions?: string | null; allergies?: string | null } | null>(null)

  const plan = (user?.plan || 'free') as string
  const canAnalyse = plan !== 'free'

  // ─── Load meds + today's logs ─────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return
    const today = todayStr()
    if (activeProfile?.type === 'family') {
      const [{ data: medsData }, { data: logsData }] = await Promise.all([
        supabase.from('family_profile_meds').select('*').eq('profile_id', activeProfile.id).order('created_at', { ascending: false }),
        supabase.from('med_logs').select('*').eq('user_id', user.id).eq('date', today),
      ])
      setMeds(medsData || [])
      setTodayLogs(logsData || [])
    } else {
      const [{ data: medsData }, { data: logsData }] = await Promise.all([
        supabase.from('personal_meds').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('med_logs').select('*').eq('user_id', user.id).eq('date', today),
      ])
      setMeds(medsData || [])
      setTodayLogs(logsData || [])
    }
    setLoading(false)
  }, [user, supabase, activeProfile])

  useEffect(() => { load() }, [load])

  // Load family profile details (for allergy/condition warnings)
  useEffect(() => {
    if (!user || !activeProfile || activeProfile.type !== 'family') { setFamilyProfileData(null); return }
    supabase.from('family_profiles').select('name, age, conditions, allergies').eq('id', activeProfile.id).single()
      .then(({ data }) => setFamilyProfileData(data || null))
  }, [user, supabase, activeProfile])

  // Push support detection — safe for iOS where Notification may not exist
  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
    setPushSupported(supported)
    if (supported) setPushGranted(Notification.permission === 'granted')
  }, [])

  // Client-side reminder loop — fires notifications while app is open (fallback for server cron)
  useEffect(() => {
    if (!pushGranted) return
    startClientReminderLoop(() => meds, () => todayLogs)
    return () => stopClientReminderLoop()
  }, [pushGranted, meds, todayLogs])

  // Handle push notification confirm URL (?confirm=<id>&date=<date>)
  useEffect(() => {
    if (!user || loading) return
    const params = new URLSearchParams(window.location.search)
    const confirmId = params.get('confirm')
    if (!confirmId) return
    const alreadyTaken = todayLogs.some(l => l.med_id === confirmId && l.status === 'taken')
    if (!alreadyTaken) {
      takeDose(confirmId, 'taken').then(() => {
        setJustConfirmed(confirmId)
        setTimeout(() => setJustConfirmed(null), 3000)
      })
    }
    // Remove param from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete('confirm')
    url.searchParams.delete('date')
    window.history.replaceState({}, '', url.toString())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ─── Dose tracking ────────────────────────────────────────────────────────────

  const takeDose = async (medId: string, status: 'taken'|'skipped' = 'taken') => {
    if (!user) return
    const today = todayStr()
    // 2026-06-01: O utilizador reportou que Tomar/Ignorar "não funciona".
    // Antes silenciávamos erros. Agora: tentamos optimistic update + mostramos
    // erro se o insert falhar (RLS / schema).
    const optimistic: DoseLog = {
      id: `tmp-${Date.now()}`, med_id: medId, date: today,
      logged_at: new Date().toISOString(), status,
    }
    setTodayLogs(prev => [...prev, optimistic])
    const { data, error } = await supabase.from('med_logs').insert({
      user_id: user.id, med_id: medId, date: today, status,
    }).select().single()
    if (error) {
      // Rollback optimistic + avisa
      setTodayLogs(prev => prev.filter(l => l.id !== optimistic.id))
      alert(`Não foi possível registar a toma: ${error.message}`)
      return
    }
    if (data) setTodayLogs(prev => prev.map(l => l.id === optimistic.id ? (data as DoseLog) : l))
  }

  // ─── Auto-check ───────────────────────────────────────────────────────────────

  const autoCheckInteractions = async (allMeds: Med[]) => {
    if (allMeds.length < 2) return
    setAutoChecking(true); setAutoCheckResult(null)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs: allMeds.map(m => m.name) }),
      })
      const data = await res.json()
      if (data.severity) {
        setAutoCheckResult({
          severity: data.severity, patientInfo: data.patient_info || data.summary || '',
          recommendation: data.recommendation || '', newDrug: allMeds[0].name,
        })
      }
    } catch {}
    setAutoChecking(false)
  }

  // ─── Push subscription ────────────────────────────────────────────────────────

  const requestPushAndOpen = async () => {
    if (!pushSupported) return
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      setPushGranted(perm === 'granted')
      if (perm !== 'granted') return
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (vapidKey) {
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        const { data: sd } = await supabase.auth.getSession()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
      }
    } catch {}
    setReminderOpen(true)
  }

  const saveReminder = async (medId: string, times: string[]) => {
    const table = activeProfile?.type === 'family' ? 'family_profile_meds' : 'personal_meds'
    await supabase.from(table).update({ reminder_times: times.length ? times : null }).eq('id', medId)
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, reminder_times: times.length ? times : null } : m))
  }

  // ─── Analyse ─────────────────────────────────────────────────────────────────

  const analyse = async () => {
    if (meds.length < 2) return
    setAnalysing(true)
    // 2026-06-02: o utilizador reportou que o botão "Analisar agora" não
    // funcionava. Causa raiz: a API /api/quickcheck devolve
    // `{ overall, findings, positives }` e o código fazia `if (data.alerts)`
    // — `data.alerts` era SEMPRE undefined, então o setAlerts/setAnalysed
    // nunca disparava e a UI ficava igual. Agora mapeamos findings → Alert[]
    // e mostramos erro real se a request falhar.
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/quickcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ medications: meds.map(m => `${m.name}${m.dose?' '+m.dose:''}${m.frequency?' '+m.frequency:''}`).join('\n'), mode: 'simple' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      // Aceita os dois formatos possíveis:
      //  • formato actual: { overall, findings: [{ level, title, explanation, action }], positives }
      //  • formato antigo: { alerts: [{ severity, message, action, drugs? }] }
      const mappedFromFindings: Alert[] = Array.isArray(data.findings)
        ? data.findings.map((f: any) => ({
            severity: (f.level === 'red' ? 'grave' : f.level === 'yellow' ? 'moderada' : 'info') as Alert['severity'],
            message: [f.title, f.explanation].filter(Boolean).join(' — '),
            action: f.action || '',
          }))
        : []
      const finalAlerts: Alert[] = Array.isArray(data.alerts) && data.alerts.length > 0 ? data.alerts : mappedFromFindings

      setAlerts(finalAlerts)
      setAnalysed(true)
      setTab('alerts')
    } catch (err: any) {
      alert(`Não foi possível analisar: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setAnalysing(false)
    }
  }

  // ─── Add med ──────────────────────────────────────────────────────────────────

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return
    setAdding(true)
    const resolved = resolveDrugName(newMed.name)
    const finalName = resolved ? resolved.dci : newMed.name.trim()

    // Allergy cross-check for family profiles
    if (activeProfile?.type === 'family' && familyProfileData?.allergies) {
      const allergyList = familyProfileData.allergies.toLowerCase()
      const drugLower = finalName.toLowerCase()
      if (allergyList.split(/[,;]+/).some(a => drugLower.includes(a.trim()) || a.trim().includes(drugLower))) {
        setAutoCheckResult({ severity: 'GRAVE', patientInfo: `${familyProfileData.name} tem alergia registada a "${familyProfileData.allergies}". Este medicamento pode estar na lista de alergias.`, recommendation: 'Confirma com o médico antes de adicionar.', newDrug: finalName })
      }
    }

    let data: any = null
    let insertError: any = null
    if (activeProfile?.type === 'family') {
      // CORREÇÃO 2026-06-01: family_profile_meds tem user_id NOT NULL + RLS
      // user_id = auth.uid(). Sem o user_id explícito, o insert falhava em
      // silêncio e data = null — utilizador relatava "não consigo adicionar".
      const result = await supabase.from('family_profile_meds').insert({
        profile_id: activeProfile.id,
        user_id: user.id,
        name: finalName,
        dose: newMed.dose || null, frequency: newMed.frequency || null, indication: newMed.indication || null,
      }).select().single()
      data = result.data
      insertError = result.error
    } else {
      const result = await supabase.from('personal_meds').insert({
        user_id: user.id, name: finalName,
        dose: newMed.dose || null, frequency: newMed.frequency || null, indication: newMed.indication || null,
      }).select().single()
      data = result.data
      insertError = result.error
    }
    if (data) {
      const updatedMeds = [data, ...meds]
      setMeds(updatedMeds)
      setAnalysed(false)
      autoCheckInteractions(updatedMeds)
    } else if (insertError) {
      alert(`Não foi possível adicionar: ${insertError.message}`)
    }
    setNewMed({ name:'', dose:'', frequency:'', indication:'' })
    setSuggestions([])
    setAdding(false)
    setTab('overview')
  }

  const removeMed = async (id: string) => {
    const table = activeProfile?.type === 'family' ? 'family_profile_meds' : 'personal_meds'
    await supabase.from(table).delete().eq('id', id)
    setMeds(p => p.filter(m => m.id !== id))
    setTodayLogs(p => p.filter(l => l.med_id !== id))
    setAnalysed(false); setAutoCheckResult(null)
  }

  // Refill — atualiza stock + doses/dia (pessoal ou perfil familiar).
  // 2026-06-01: o utilizador reportou "não tem sítio onde meter isso (refill)".
  const updateRefill = async (medId: string, pills: number | null, perDay: number | null) => {
    const table = activeProfile?.type === 'family' ? 'family_profile_meds' : 'personal_meds'
    const patch = { pills_remaining: pills, pills_per_day: perDay }
    const { error } = await supabase.from(table).update(patch).eq('id', medId)
    if (error) { alert(`Não foi possível atualizar stock: ${error.message}`); return }
    setMeds(p => p.map(m => m.id === medId ? { ...m, ...patch } : m))
  }

  // ─── Scan de receita ─────────────────────────────────────────────────────────

  const scanPrescription = async (file: File) => {
    setScanning(true); setScanError(null); setScannedMeds([])
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/scan-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ image: base64, mimeType: file.type || 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao analisar')
      if (!data.medications?.length) throw new Error('Nenhum medicamento encontrado. Tenta uma foto mais nítida.')
      setScannedMeds(data.medications.map((m: Omit<ScannedMed, 'selected'>) => ({ ...m, selected: true })))
    } catch (e: any) {
      setScanError(e.message)
    }
    setScanning(false)
  }

  const addAllScanned = async () => {
    if (!user) return
    const toAdd = scannedMeds.filter(m => m.selected)
    if (!toAdd.length) return
    setAddingAll(true)
    const inserted: Med[] = []
    for (const med of toAdd) {
      const resolved = resolveDrugName(med.name)
      let data: any = null
      if (activeProfile?.type === 'family') {
        const result = await supabase.from('family_profile_meds').insert({
          profile_id: activeProfile.id,
          user_id: user.id,
          name: resolved ? resolved.dci : med.name,
          dose: med.dose || null,
          frequency: med.frequency || null,
          indication: med.indication || null,
        }).select().single()
        data = result.data
      } else {
        const result = await supabase.from('personal_meds').insert({
          user_id: user.id,
          name: resolved ? resolved.dci : med.name,
          dose: med.dose || null,
          frequency: med.frequency || null,
          indication: med.indication || null,
        }).select().single()
        data = result.data
      }
      if (data) inserted.push(data as Med)
    }
    if (inserted.length) {
      const updatedMeds = [...inserted, ...meds]
      setMeds(updatedMeds)
      setAnalysed(false)
      autoCheckInteractions(updatedMeds)
    }
    setScannedMeds([])
    setAddingAll(false)
    setTab('overview')
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────────

  const sendChat = async (messageText?: string) => {
    const text = (messageText ?? chatInput).trim()
    if (!text || chatLoading) return
    setChatMessages(prev => [...prev, { role: 'user', content: text }])
    setChatInput(''); setChatLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/chat-med', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ message: text, meds: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency })), history: chatMessages.slice(-6), familyProfile: activeProfile?.type === 'family' ? { name: familyProfileData?.name || activeProfile.name, age: familyProfileData?.age, conditions: familyProfileData?.conditions, allergies: familyProfileData?.allergies } : null }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Não consegui responder. Tenta novamente.' }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao contactar o assistente.' }])
    }
    setChatLoading(false)
  }

  // ─── Emergency Card ──────────────────────────────────────────────────────────

  const generateEmergencyCard = async () => {
    setEmergencyLoading(true)
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/emergency-card/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify(emergencyForm),
    })
    const data = await res.json()
    if (data.token) setEmergencyToken(data.token)
    setEmergencyLoading(false)
  }

  const emergencyCardUrl = emergencyToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/emergency/${emergencyToken}`
    : null

  // ─── ADR Symptom Check ────────────────────────────────────────────────────────

  const checkSymptoms = async () => {
    if (!symptoms.trim() || meds.length === 0) return
    setAdrLoading(true); setAdrResult(null)
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/symptom-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ symptoms, medications: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency })) }),
    })
    const data = await res.json()
    setAdrResult(data)
    setAdrLoading(false)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const tabStyle = (t: string) => ({
    padding:'9px 16px', background:'none', border:'none',
    borderBottom:`2px solid ${tab===t?'var(--green)':'transparent'}`,
    cursor:'pointer', fontSize:12, fontWeight:700,
    color:tab===t?'var(--green)':'var(--ink-4)',
    fontFamily:'var(--font-sans)', letterSpacing:'0.04em',
    textTransform:'uppercase' as const, marginBottom:-1, whiteSpace:'nowrap' as const,
  })

  const unreadAlerts = alerts.filter(a => a.severity==='grave').length
  const hasReminders = meds.some(m => m.reminder_times && m.reminder_times.length > 0)
  const medsWithTimes = meds.filter(m => m.reminder_times && m.reminder_times.length > 0)
  const medsWithoutTimes = meds.filter(m => !m.reminder_times || m.reminder_times.length === 0)

  // Build today's schedule (med × slot pairs, sorted by time).
  // Para cada med, calculamos QUANTOS slots tem hoje e em que índice estamos
  // — isto deixa o slotIsCovered atribuir logs por ordem.
  const schedule = medsWithTimes.flatMap(med => {
    const slots = med.reminder_times!
    return slots.map((slot, idx) => ({ med, slot, slotIdx: idx, slotsTotal: slots.length }))
  }).sort((a, b) => toMinutes(a.slot) - toMinutes(b.slot))

  const todayDone = schedule.filter(({ med, slotIdx, slotsTotal }) =>
    slotIsCovered('', todayLogs.filter(l => l.med_id === med.id && l.status === 'taken'), slotIdx, slotsTotal)
  ).length
  const todayTotal = schedule.length

  const dateLabel = new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>


      {/* Page header */}
      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>
                {activeProfile?.type === 'family' ? 'Medicamentos de' : 'Os Meus Medicamentos'}
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', fontWeight:400 }}>
                {activeProfile?.type === 'family' && familyProfileData ? familyProfileData.name : loading ? '—' : `${meds.length} medicamento${meds.length!==1?'s':''}`}
              </div>
              {activeProfile?.type === 'family' && !loading && (
                <div style={{ fontSize:12, color:'var(--ink-4)', marginTop:3, fontFamily:'var(--font-mono)' }}>
                  {meds.length} medicamento{meds.length!==1?'s':''}
                  {familyProfileData?.age ? ` · ${familyProfileData.age} anos` : ''}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <ProfileSelector onChange={p => { setActiveProfileState(p); setMeds([]); setTodayLogs([]); setAlerts([]); setAnalysed(false); setAutoCheckResult(null); setLoading(true) }} />
              {canAnalyse && meds.length >= 2 && (
                <button onClick={analyse} disabled={analysing}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:analysing?'var(--bg-3)':'var(--green)', color:analysing?'var(--ink-4)':'white', border:'none', borderRadius:8, cursor:analysing?'wait':'pointer', fontSize:13, fontWeight:700 }}>
                  {analysing ? <><span style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A analisar...</> : '⚡ Analisar'}
                </button>
              )}
              {pushSupported && meds.length > 0 && (
                <button onClick={requestPushAndOpen}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:hasReminders?'var(--green-light)':'white', color:hasReminders?'var(--green-2)':'var(--ink)', border:`1px solid ${hasReminders?'var(--green-mid)':'var(--border)'}`, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  🔔 {hasReminders ? 'Lembretes ativos' : 'Ativar lembretes'}
                </button>
              )}
              <button onClick={() => { setEmergencyOpen(true); if (activeProfile?.type === 'family' && familyProfileData) setEmergencyForm(p => ({ ...p, name: p.name || familyProfileData.name, allergies: p.allergies || (familyProfileData.allergies ?? '') })) }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:emergencyToken?'#fee2e2':'white', color:emergencyToken?'#991b1b':'var(--ink)', border:`1px solid ${emergencyToken?'#fca5a5':'var(--border)'}`, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🆘 Cartão
              </button>
            </div>
          </div>
          <div style={{ display:'flex', borderTop:'1px solid var(--border)', overflowX:'auto' }}>
            <button onClick={() => setTab('overview')} style={tabStyle('overview')}>Medicação</button>
            <button onClick={() => setTab('alerts')} style={tabStyle('alerts')}>
              Alertas {unreadAlerts>0 && <span style={{ marginLeft:4, background:'#dc2626', color:'white', fontSize:9, padding:'1px 5px', borderRadius:10, fontWeight:700 }}>{unreadAlerts}</span>}
            </button>
            <button onClick={() => setTab('ask')} style={tabStyle('ask')}>💬 Perguntar</button>
            <button onClick={() => setTab('sintomas')} style={tabStyle('sintomas')}>🩺 Sintomas</button>
            <button onClick={() => setTab('add')} style={tabStyle('add')}>+ Adicionar</button>
          </div>
        </div>
      </div>

      {/* Family profile context banner */}
      {activeProfile?.type === 'family' && familyProfileData && (
        <div style={{ background:'#f5f3ff', borderBottom:'1px solid #e9d5ff' }}>
          <div className="page-container" style={{ paddingTop:10, paddingBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:'#e9d5ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#7c3aed', flexShrink:0 }}>
                {familyProfileData.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:12, color:'#6d28d9', fontWeight:600 }}>
                A gerir a medicação de {familyProfileData.name}
              </span>
              {familyProfileData.conditions && (
                <span style={{ fontSize:11, color:'#7c3aed', background:'white', border:'1px solid #e9d5ff', borderRadius:20, padding:'2px 8px' }}>
                  {familyProfileData.conditions}
                </span>
              )}
              {familyProfileData.allergies && (
                <span style={{ fontSize:11, color:'#dc2626', background:'#fff5f5', border:'1px solid #fca5a5', borderRadius:20, padding:'2px 8px' }}>
                  ⚠️ Alergia: {familyProfileData.allergies}
                </span>
              )}
              {familyProfileData.age && familyProfileData.age >= 75 && (
                <span style={{ fontSize:11, color:'#d97706', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:20, padding:'2px 8px' }}>
                  ≥75 anos — Critérios STOPP aplicáveis
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adherence summary bar — only show when there's a schedule */}
      {!loading && schedule.length > 0 && (
        <div style={{ background: todayDone === todayTotal ? '#f0fdf4' : todayDone === 0 ? '#fef2f2' : '#fffbeb', borderBottom: `1px solid ${todayDone === todayTotal ? '#bbf7d0' : todayDone === 0 ? '#fecaca' : '#fde68a'}` }}>
          <div className="page-container" style={{ paddingTop: 10, paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 6, background: todayDone === todayTotal ? '#bbf7d0' : '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0}%`, background: todayDone === todayTotal ? '#059669' : todayDone === 0 ? '#ef4444' : '#f59e0b', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: todayDone === todayTotal ? '#065f46' : todayDone === 0 ? '#991b1b' : '#92400e', whiteSpace: 'nowrap' }}>
                {todayDone === todayTotal ? '✓ Hoje completo' : `${todayDone}/${todayTotal} doses hoje`}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-container page-body">

        {/* ─── OVERVIEW ─── */}
        {tab === 'overview' && (
          <div>
            {/* Auto-check result */}
            {autoChecking && (
              <div style={{ marginBottom:14, padding:'12px 16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize:13, color:'var(--ink-4)' }}>A verificar interações com a medicação atual...</span>
              </div>
            )}
            {autoCheckResult && !autoChecking && (() => {
              const s = AUTO_SEV[autoCheckResult.severity]
              const detail = autoCheckResult.severity !== 'SEM_INTERACAO'
              return (
                <div style={{ marginBottom:14, padding:'14px 16px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:10 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{s.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:s.color, marginBottom:detail?5:0 }}>{s.label}</div>
                      {detail && autoCheckResult.patientInfo && (
                        <div style={{ fontSize:13, color:s.color, opacity:0.9, lineHeight:1.55, marginBottom:5 }}>{autoCheckResult.patientInfo}</div>
                      )}
                      {detail && autoCheckResult.recommendation && (
                        <div style={{ fontSize:12, color:s.color, fontFamily:'var(--font-mono)', opacity:0.8 }}>→ {autoCheckResult.recommendation}</div>
                      )}
                    </div>
                    {detail && (
                      <Link href={`/interactions?drugs=${meds.map(m=>m.name).join(',')}`}
                        style={{ fontSize:11, color:s.color, textDecoration:'none', fontWeight:700, fontFamily:'var(--font-mono)', flexShrink:0, whiteSpace:'nowrap' }}>
                        Ver →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })()}

            {!canAnalyse && meds.length >= 2 && (
              <div style={{ background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:10, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>⚡</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--green-2)', marginBottom:2 }}>Verifica as interações entre os teus {meds.length} medicamentos</div>
                  <div style={{ fontSize:12, color:'var(--green-2)', opacity:0.8 }}>Disponível no plano Student — 3,99€/mês</div>
                </div>
                <Link href="/pricing" style={{ padding:'8px 14px', background:'var(--green)', color:'white', textDecoration:'none', borderRadius:7, fontSize:12, fontWeight:700, flexShrink:0 }}>Desbloquear →</Link>
              </div>
            )}

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:68, borderRadius:8 }} />)}
              </div>
            ) : meds.length === 0 ? (
              <div style={{ background:'white', border:'2px dashed var(--border)', borderRadius:10, padding:'56px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>💊</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>
                  {activeProfile?.type === 'family' && familyProfileData ? `${familyProfileData.name} não tem medicamentos ainda` : 'Nenhum medicamento ainda'}
                </div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>
                  {activeProfile?.type === 'family' ? 'Adiciona os medicamentos deste perfil familiar para verificar interações e receber alertas.' : 'Adiciona os teus medicamentos para verificar interações e receber alertas.'}
                </div>
                <button onClick={() => setTab('add')}
                  style={{ background:'var(--green)', color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Adicionar primeiro medicamento →
                </button>
              </div>
            ) : (
              <>
                {/* ─── TODAY SCHEDULE ─── */}
                {schedule.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
                        {dateLabel}
                      </div>
                      <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: todayDone === todayTotal ? 'var(--green-2)' : 'var(--ink-4)' }}>
                        {todayDone}/{todayTotal} {todayDone === todayTotal && '✓ Completo'}
                      </div>
                    </div>
                    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                      {schedule.map(({ med, slot, slotIdx, slotsTotal }, i) => {
                        const medLogs = todayLogs.filter(l => l.med_id === med.id)
                        const log = slotIsCovered(slot, medLogs.filter(l => l.status === 'taken'), slotIdx, slotsTotal)
                          || slotIsCovered(slot, medLogs.filter(l => l.status === 'skipped'), slotIdx, slotsTotal)
                        const isConfirmed = justConfirmed === med.id && !log
                        return (
                          <div key={`${med.id}-${slot}`} style={{ borderBottom: i < schedule.length-1 ? '1px solid var(--bg-3)' : 'none' }}>
                            <DoseRow
                              med={med} slotTime={slot} log={log}
                              onTake={() => takeDose(med.id, 'taken')}
                              onSkip={() => takeDose(med.id, 'skipped')}
                              justConfirmed={isConfirmed}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ─── ALL MEDS LIST ─── */}
                {(medsWithoutTimes.length > 0 || medsWithTimes.length > 0) && (
                  <div>
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>
                      {medsWithoutTimes.length > 0 ? 'Todos os medicamentos' : 'Medicamentos'}
                    </div>
                    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                      {meds.map((med, i) => {
                        const medAlerts = alerts.filter(a => a.drugs?.some(d => d.toLowerCase().includes(med.name.toLowerCase())))
                        const hasGrave = medAlerts.some(a => a.severity==='grave')
                        const hasReminder = med.reminder_times && med.reminder_times.length > 0
                        const daysSinceStart = med.started_at
                          ? Math.floor((Date.now() - new Date(med.started_at).getTime()) / (1000 * 60 * 60 * 24))
                          : med.created_at
                            ? Math.floor((Date.now() - new Date(med.created_at).getTime()) / (1000 * 60 * 60 * 24))
                            : 0
                        const needsRefill = daysSinceStart >= 25
                        // Calcula dias até acabar (refill projection) com base no stock.
                        const stockDays = (med.pills_remaining != null && med.pills_per_day && med.pills_per_day > 0)
                          ? Math.floor((med.pills_remaining || 0) / med.pills_per_day)
                          : null
                        const stockCritical = stockDays != null && stockDays <= 3
                        const stockWarn = stockDays != null && stockDays > 3 && stockDays <= 7
                        return (
                          <div key={med.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:i<meds.length-1?'1px solid var(--bg-3)':'none' }}>
                            <div style={{ width:36, height:36, borderRadius:'50%', background:hasGrave?'#fee2e2':'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                              💊
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                                <DrugQuickLook drug={med.name} trigger={<span style={{ fontSize:14, fontWeight:700, color:'var(--ink)', cursor:'pointer', textDecorationLine:'underline', textDecorationStyle:'dotted', textDecorationColor:'var(--border-2)' }}>{med.name}</span>} />
                                {hasGrave && <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'#991b1b', background:'#fee2e2', border:'1px solid #fca5a5', padding:'1px 5px', borderRadius:3, textTransform:'uppercase' }}>Alerta</span>}
                                {hasReminder && <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--green-2)', background:'var(--green-light)', border:'1px solid var(--green-mid)', padding:'1px 5px', borderRadius:3 }}>🔔 {med.reminder_times!.join(' · ')}</span>}
                                {stockDays != null && (
                                  <span title={`${med.pills_remaining} cp restantes · ${med.pills_per_day}/dia`} style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color: stockCritical?'#991b1b':stockWarn?'#b45309':'#0d6e42', background: stockCritical?'#fee2e2':stockWarn?'#fffbeb':'#f0fdf5', border:`1px solid ${stockCritical?'#fca5a5':stockWarn?'#fde68a':'#bbf7d0'}`, padding:'1px 5px', borderRadius:3 }}>
                                    📦 {stockDays}d
                                  </span>
                                )}
                                {stockDays == null && needsRefill && <span title={`Adicionado há ${daysSinceStart} dias`} style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'#d97706', background:'#fffbeb', border:'1px solid #fde68a', padding:'1px 5px', borderRadius:3 }}>📦 Verificar stock</span>}
                              </div>
                              <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                                {[med.dose, med.frequency, med.indication].filter(Boolean).join(' · ')}
                                {daysSinceStart > 0 && <span style={{ color:'var(--ink-5)' }}> · há {daysSinceStart}d</span>}
                              </div>
                            </div>
                            <RefillEditor med={med} onSave={(pills, perDay) => updateRefill(med.id, pills, perDay)} />
                            <button onClick={() => removeMed(med.id)}
                              style={{ padding:'6px 8px', background:'white', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--ink-5)', fontSize:14, lineHeight:1, flexShrink:0 }}>
                              ×
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ─── Nudge to set reminders if none set ─── */}
                {medsWithTimes.length === 0 && pushSupported && (
                  <div style={{ marginTop:14, padding:'14px 16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ fontSize:20 }}>🔔</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:2 }}>Ativa lembretes de toma</div>
                      <div style={{ fontSize:12, color:'var(--ink-4)' }}>Recebe notificações no horário certo para cada medicamento.</div>
                    </div>
                    <button onClick={requestPushAndOpen}
                      style={{ padding:'8px 14px', background:'var(--green)', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                      Ativar →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── ALERTS ─── */}
        {tab === 'alerts' && (
          <div>
            {!analysed && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>⚡</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Sem análise ainda</div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>
                  {!canAnalyse ? 'Requer plano Student.' : meds.length < 2 ? 'Adiciona pelo menos 2 medicamentos.' : 'Clica em "Analisar" para verificar.'}
                </div>
                {canAnalyse && meds.length >= 2 && (
                  <button onClick={analyse} disabled={analysing}
                    style={{ padding:'11px 22px', background:'var(--green)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    Analisar agora →
                  </button>
                )}
                {!canAnalyse && <Link href="/pricing" style={{ display:'inline-block', padding:'11px 22px', background:'var(--green)', color:'white', textDecoration:'none', borderRadius:8, fontSize:13, fontWeight:700 }}>Ver plano Student →</Link>}
              </div>
            )}
            {analysed && alerts.length === 0 && (
              <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:10, padding:'32px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#065f46', marginBottom:6 }}>Sem interações conhecidas</div>
                <div style={{ fontSize:13, color:'#065f46', opacity:0.8 }}>A combinação dos teus medicamentos não tem interações clinicamente relevantes conhecidas.</div>
              </div>
            )}
            {analysed && alerts.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {alerts.map((alert, i) => {
                  const s = SEV[alert.severity]
                  return (
                    <div key={i} style={{ padding:'14px 16px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:10 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.label}</span>
                            {alert.drugs?.map(d => <span key={d} style={{ fontSize:10, color:s.color, fontFamily:'var(--font-mono)' }}>{d}</span>)}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:s.color, lineHeight:1.5, marginBottom:5 }}>{alert.message}</div>
                          <div style={{ fontSize:12, color:s.color, opacity:0.8 }}>→ {alert.action}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                  Discute sempre estes alertas com o teu médico ou farmacêutico.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ASK ─── */}
        {tab === 'ask' && (
          <div style={{ display:'flex', flexDirection:'column', minHeight:420 }}>
            {meds.length === 0 && (
              <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:24, textAlign:'center', marginBottom:12 }}>
                <div style={{ fontSize:13, color:'var(--ink-4)' }}>Adiciona os teus medicamentos para respostas personalizadas.</div>
              </div>
            )}
            {chatMessages.length === 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:10 }}>Perguntas frequentes</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} onClick={() => sendChat(p)}
                      style={{ padding:'8px 14px', background:'white', border:'1px solid var(--border)', borderRadius:20, fontSize:12, color:'var(--ink-3)', cursor:'pointer' }}
                      className="quick-prompt">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, paddingBottom:8 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display:'flex', justifyContent:msg.role==='user'?'flex-end':'flex-start' }}>
                  <div style={{
                    maxWidth:'82%', padding:'11px 14px',
                    borderRadius:msg.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',
                    background:msg.role==='user'?'var(--green)':'white',
                    color:msg.role==='user'?'white':'var(--ink)',
                    border:msg.role==='user'?'none':'1px solid var(--border)',
                    fontSize:13, lineHeight:1.55,
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:'flex' }}>
                  <div style={{ padding:'11px 16px', background:'white', border:'1px solid var(--border)', borderRadius:'14px 14px 14px 4px', display:'flex', gap:4, alignItems:'center' }}>
                    {[0,1,2].map(i => <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--ink-4)', display:'inline-block', animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display:'flex', gap:8, paddingTop:12, borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder={meds.length > 0 ? 'Pergunta sobre os teus medicamentos...' : 'Adiciona medicamentos primeiro...'}
                disabled={chatLoading}
                style={{ flex:1, border:'1.5px solid var(--border)', borderRadius:24, padding:'11px 16px', fontSize:13, outline:'none', background:'white', fontFamily:'var(--font-sans)' }} />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                style={{ padding:'11px 18px', background:chatInput.trim()?'var(--green)':'var(--bg-3)', color:chatInput.trim()?'white':'var(--ink-5)', border:'none', borderRadius:24, cursor:chatInput.trim()?'pointer':'default', fontSize:13, fontWeight:700, flexShrink:0 }}>
                →
              </button>
            </div>
            <div style={{ fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', textAlign:'center', marginTop:8 }}>
              Informativo — não substitui aconselhamento médico.
            </div>
          </div>
        )}

        {/* ─── SINTOMAS / ADR ─── */}
        {tab === 'sintomas' && (
          <div style={{ maxWidth:560 }}>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:14 }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Detetor de reações adversas</div>
              <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:16, lineHeight:1.5 }}>
                Descreve os sintomas que sentes — a IA verifica se podem estar relacionados com algum dos teus medicamentos.
              </div>
              {meds.length === 0 ? (
                <div style={{ padding:'16px', background:'var(--bg-2)', borderRadius:8, fontSize:13, color:'var(--ink-4)', textAlign:'center' }}>
                  Adiciona medicamentos primeiro para usar esta funcionalidade.
                </div>
              ) : (
                <>
                  <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)}
                    placeholder="Ex: tenho tonturas quando me levanto, a cabeça dói-me e estou mais cansado do que o habitual..."
                    rows={4}
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', resize:'vertical', boxSizing:'border-box', lineHeight:1.55 }} />
                  <button onClick={checkSymptoms} disabled={!symptoms.trim() || adrLoading}
                    style={{ marginTop:10, width:'100%', padding:'12px', background:symptoms.trim() && !adrLoading?'#dc2626':'var(--bg-3)', color:symptoms.trim() && !adrLoading?'white':'var(--ink-5)', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:symptoms.trim() && !adrLoading?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {adrLoading
                      ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A analisar...</>
                      : '🔍 Analisar sintomas'}
                  </button>
                </>
              )}
            </div>

            {adrResult && !adrLoading && (() => {
              const safety = adrResult.overall_safety as string
              const safetyStyle = {
                seguro:          { bg:'#d1fae5', border:'#6ee7b7', color:'#065f46', icon:'✅', label:'Sem relação com medicação' },
                monitorizar:     { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', icon:'👁', label:'Monitorizar' },
                consultar_medico:{ bg:'#fef3c7', border:'#fcd34d', color:'#92400e', icon:'⚠️', label:'Consulta recomendada' },
                urgente:         { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', icon:'🚨', label:'Urgente' },
              }[safety] || { bg:'var(--bg-2)', border:'var(--border)', color:'var(--ink)', icon:'ℹ️', label:safety }

              return (
                <div>
                  <div style={{ padding:'14px 16px', background:safetyStyle.bg, border:`1px solid ${safetyStyle.border}`, borderRadius:10, marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:adrResult.message?8:0 }}>
                      <span style={{ fontSize:20 }}>{safetyStyle.icon}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:safetyStyle.color }}>{safetyStyle.label}</span>
                    </div>
                    {adrResult.message && <div style={{ fontSize:13, color:safetyStyle.color, lineHeight:1.55 }}>{adrResult.message}</div>}
                  </div>

                  {adrResult.suspicions?.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Suspeitas identificadas</div>
                      {adrResult.suspicions.map((s: any, i: number) => {
                        const probColor = s.probability === 'alta' ? '#dc2626' : s.probability === 'moderada' ? '#d97706' : '#6b7280'
                        const actionIcon = { manter_vigilancia:'👁', avisar_medico:'🩺', urgente:'🚨', nao_relacionado:'ℹ️' }[s.action as string] || '•'
                        return (
                          <div key={i} style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                              <div style={{ flex:1 }}>
                                <span style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>{s.suspected_drug}</span>
                                <span style={{ fontSize:12, color:'var(--ink-4)', marginLeft:8 }}>→ {s.symptom}</span>
                              </div>
                              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:probColor, background:`${probColor}18`, border:`1px solid ${probColor}40`, padding:'2px 7px', borderRadius:4, whiteSpace:'nowrap' }}>
                                {s.probability}
                              </span>
                            </div>
                            {s.mechanism && <div style={{ fontSize:12, color:'var(--ink-4)', lineHeight:1.5, marginBottom:6 }}>{s.mechanism}</div>}
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:12 }}>{actionIcon}</span>
                              <span style={{ fontSize:12, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>
                                {{ manter_vigilancia:'Manter vigilância', avisar_medico:'Avisar médico', urgente:'Urgente', nao_relacionado:'Não relacionado' }[s.action as string] || s.action}
                              </span>
                              <span style={{ fontSize:10, color:'var(--ink-5)', marginLeft:'auto' }}>{s.evidence}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {adrResult.disclaimer && (
                    <div style={{ padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                      {adrResult.disclaimer}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ─── ADD ─── */}
        {tab === 'add' && (
          <div style={{ maxWidth:520 }}>

            {/* ── Scan receita ── */}
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📷</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>Fotografar receita</div>
                  <div style={{ fontSize:12, color:'var(--ink-4)' }}>A IA extrai todos os medicamentos automaticamente</div>
                </div>
              </div>

              {/* hidden file input — abre câmara OU galeria/ficheiros no mobile */}
              <input ref={scanInputRef} type="file" accept="image/*"
                style={{ display:'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) scanPrescription(f); e.target.value = '' }} />

              {scannedMeds.length === 0 && !scanning && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => scanInputRef.current?.click()}
                    style={{ flex:1, padding:'12px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span>📷</span> Tirar foto / Escolher imagem
                  </button>
                </div>
              )}

              {scanning && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px', background:'var(--bg-2)', borderRadius:8 }}>
                  <span style={{ width:16, height:16, border:'2.5px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 }} />
                  <span style={{ fontSize:13, color:'var(--ink-4)' }}>A analisar a imagem com IA...</span>
                </div>
              )}

              {scanError && (
                <div style={{ padding:'12px 14px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, fontSize:13, color:'#991b1b', marginBottom:8 }}>
                  {scanError}
                  <button onClick={() => { setScanError(null); scanInputRef.current?.click() }}
                    style={{ marginLeft:12, fontSize:12, fontWeight:700, color:'#991b1b', background:'none', border:'1px solid #fca5a5', borderRadius:5, padding:'2px 8px', cursor:'pointer' }}>
                    Tentar novamente
                  </button>
                </div>
              )}

              {scannedMeds.length > 0 && (
                <div>
                  {handoffNote && (
                    <div style={{ fontSize: 12.5, color: '#0d6e42', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontWeight: 600 }}>
                      ✓ {handoffNote} — revê e guarda os que quiseres.
                    </div>
                  )}
                  <div style={{ fontSize:12, color:'var(--ink-4)', marginBottom:10 }}>
                    {scannedMeds.filter(m=>m.selected).length} de {scannedMeds.length} selecionado{scannedMeds.filter(m=>m.selected).length!==1?'s':''} — toca para desselecionar
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                    {scannedMeds.map((med, i) => (
                      <button key={i} onClick={() => setScannedMeds(p => p.map((m,j) => j===i ? {...m, selected:!m.selected} : m))}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:med.selected?'var(--green-light)':'var(--bg-2)', border:`1.5px solid ${med.selected?'var(--green-mid)':'var(--border)'}`, borderRadius:8, cursor:'pointer', textAlign:'left' }}>
                        <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${med.selected?'var(--green)':'var(--border)'}`, background:med.selected?'var(--green)':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {med.selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>{med.name}</div>
                          <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                            {[med.dose, med.frequency, med.indication].filter(Boolean).join(' · ') || 'sem detalhes'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={addAllScanned} disabled={addingAll || !scannedMeds.some(m=>m.selected)}
                      style={{ flex:1, padding:'13px', background:scannedMeds.some(m=>m.selected)?'var(--green)':'var(--bg-3)', color:scannedMeds.some(m=>m.selected)?'white':'var(--ink-5)', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:scannedMeds.some(m=>m.selected)?'pointer':'default' }}>
                      {addingAll ? 'A adicionar...' : `Adicionar ${scannedMeds.filter(m=>m.selected).length} medicamento${scannedMeds.filter(m=>m.selected).length!==1?'s':''}`}
                    </button>
                    <button onClick={() => setScannedMeds([])}
                      style={{ padding:'13px 14px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Manual ── */}
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:16 }}>Adicionar manualmente</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ position:'relative' }}>
                  <input value={newMed.name}
                    onChange={e => { setNewMed(p=>({...p,name:e.target.value})); setSuggestions(suggestDrugs(e.target.value)) }}
                    placeholder="Nome do medicamento *"
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                  {suggestions.length > 0 && newMed.name.length > 1 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', zIndex:10, marginTop:2, overflow:'hidden' }}>
                      {suggestions.slice(0,6).map(s => (
                        <button key={s.dci} onClick={() => { setNewMed(p=>({...p,name:s.display})); setSuggestions([]) }}
                          style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'white', border:'none', borderBottom:'1px solid var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--ink)' }}
                          className="suggestion-item">
                          {s.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={newMed.dose} onChange={e => setNewMed(p=>({...p,dose:e.target.value}))} placeholder="Dose (ex: 500mg)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <input value={newMed.frequency} onChange={e => setNewMed(p=>({...p,frequency:e.target.value}))} placeholder="Frequência (ex: 1x/dia, de manhã)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <input value={newMed.indication} onChange={e => setNewMed(p=>({...p,indication:e.target.value}))} placeholder="Indicação (ex: HTA, diabetes)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <button onClick={addMed} disabled={!newMed.name.trim() || adding}
                  style={{ padding:12, background:newMed.name.trim()?'var(--green)':'var(--bg-3)', color:newMed.name.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, cursor:newMed.name.trim()?'pointer':'not-allowed', fontSize:14, fontWeight:700 }}>
                  {adding ? 'A adicionar...' : 'Adicionar medicamento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {emergencyOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setEmergencyOpen(false)}>
          <div style={{ background:'white', borderRadius:14, padding:24, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>🆘 Cartão de Emergência</div>
            <div style={{ fontSize:12, color:'var(--ink-4)', marginBottom:20, lineHeight:1.55 }}>
              Cria um cartão público com a tua medicação essencial, acessível por QR code. Útil para primeiros socorros.
            </div>

            {emergencyToken ? (
              <div>
                <div style={{ textAlign:'center', marginBottom:16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(emergencyCardUrl!)}`}
                    alt="QR Code" style={{ width:180, height:180, borderRadius:8, border:'2px solid #dc2626' }} />
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)', marginTop:8, wordBreak:'break-all' }}>{emergencyCardUrl}</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { navigator.clipboard?.writeText(emergencyCardUrl!); }}
                    style={{ flex:1, padding:'11px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    Copiar link
                  </button>
                  <button onClick={() => window.open(emergencyCardUrl!, '_blank')}
                    style={{ flex:1, padding:'11px', background:'#dc2626', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    Abrir cartão
                  </button>
                </div>
                <button onClick={() => { setEmergencyToken(null) }}
                  style={{ marginTop:8, width:'100%', padding:'10px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                  Regenerar / Editar
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input value={emergencyForm.name} onChange={e => setEmergencyForm(p => ({...p,name:e.target.value}))}
                  placeholder="Nome completo *"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <input value={emergencyForm.blood_type} onChange={e => setEmergencyForm(p => ({...p,blood_type:e.target.value}))}
                  placeholder="Grupo sanguíneo (ex: A+)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <input value={emergencyForm.allergies} onChange={e => setEmergencyForm(p => ({...p,allergies:e.target.value}))}
                  placeholder="Alergias conhecidas (ex: penicilina, ibuprofeno)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <input value={emergencyForm.emergency_contact} onChange={e => setEmergencyForm(p => ({...p,emergency_contact:e.target.value}))}
                  placeholder="Contacto de emergência (ex: Maria 912345678)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
                <button onClick={generateEmergencyCard} disabled={!emergencyForm.name.trim() || emergencyLoading}
                  style={{ padding:'13px', background:emergencyForm.name.trim() && !emergencyLoading?'#dc2626':'var(--bg-3)', color:emergencyForm.name.trim() && !emergencyLoading?'white':'var(--ink-5)', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:emergencyForm.name.trim() && !emergencyLoading?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {emergencyLoading
                    ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A gerar...</>
                    : '🆘 Gerar cartão de emergência'}
                </button>
                <div style={{ fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', textAlign:'center' }}>
                  O cartão inclui os {meds.length} medicamento{meds.length!==1?'s':''} da tua lista atual.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reminderOpen && meds.length > 0 && (
        <ReminderModal meds={meds} onSave={saveReminder} onClose={() => setReminderOpen(false)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity:0.4 } 40% { transform: scale(1); opacity:1 } }
        .suggestion-item:hover { background: var(--bg-2) !important }
        .quick-prompt:hover { background: var(--bg-2) !important; border-color: var(--green) !important; color: var(--green-2) !important }
      `}</style>
    </div>
  )
}

// ─── RefillEditor ─────────────────────────────────────────────────────────────
// Popover de stock por linha de medicamento. Compatível com personal_meds e
// family_profile_meds (a função updateRefill já trata da tabela certa).
function RefillEditor({ med, onSave }: { med: Med; onSave: (pills: number | null, perDay: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const [pills, setPills] = useState<string>(med.pills_remaining != null ? String(med.pills_remaining) : '')
  const [perDay, setPerDay] = useState<string>(med.pills_per_day != null ? String(med.pills_per_day) : '')
  // Modal central — não precisa de ref; fecha pelo backdrop / ESC.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const has = med.pills_remaining != null

  function save() {
    const p = pills.trim() === '' ? null : Math.max(0, Math.floor(Number(pills)))
    const pd = perDay.trim() === '' ? null : Math.max(0, Number(perDay))
    if (p != null && Number.isNaN(p)) return
    if (pd != null && Number.isNaN(pd)) return
    onSave(p, pd)
    setOpen(false)
  }

  // 2026-06-01: trocado popover por modal central. O popover absoluto era
  // cortado pelo `overflow:hidden` da lista de medicamentos e ficava recortado
  // em mobile. Modal fixo no centro do viewport resolve em todas as larguras.
  const days = pills && perDay && Number(perDay) > 0 ? Math.floor(Number(pills) / Number(perDay)) : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Stock"
        style={{
          padding: '6px 10px',
          background: has ? '#f0fdf5' : 'white',
          border: `1px solid ${has ? '#bbf7d0' : 'var(--border)'}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: has ? '#0d6e42' : 'var(--ink-4)',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
          flexShrink: 0,
        }}>📦</button>

      {open && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(8,12,24,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          <div onMouseDown={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 380, background: 'white',
            borderRadius: 14, padding: 18,
            boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
            fontFamily: 'var(--font-sans)',
            maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>📦 Stock e ritmo</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}{med.dose ? ` · ${med.dose}` : ''}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar"
                style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-2)', border: 'none', cursor: 'pointer', fontSize: 17, color: 'var(--ink-4)' }}>×</button>
            </div>

            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 5, fontWeight: 700 }}>Comprimidos restantes</label>
            <input value={pills} onChange={e => setPills(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric"
              placeholder="ex: 30"
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none', fontFamily: 'var(--font-sans)' }} />

            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 12, marginBottom: 5, fontWeight: 700 }}>Comprimidos por dia</label>
            <input value={perDay} onChange={e => setPerDay(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} inputMode="decimal"
              placeholder="ex: 1 ou 0.5"
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, outline: 'none', fontFamily: 'var(--font-sans)' }} />

            {days !== null && (
              <div style={{ fontSize: 13, color: '#0d6e42', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', marginTop: 12, lineHeight: 1.45 }}>
                ✓ Acaba em <strong>{days} dia{days === 1 ? '' : 's'}</strong> ({new Date(Date.now() + days * 86400000).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })})
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {has && <button onClick={() => { setPills(''); setPerDay(''); onSave(null, null); setOpen(false) }}
                style={{ flex: '1 1 100%', padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                🗑 Apagar stock guardado
              </button>}
              <button onClick={() => setOpen(false)}
                style={{ flex: 1, padding: '11px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancelar</button>
              <button onClick={save}
                style={{ flex: 1, padding: '11px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
