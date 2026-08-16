'use client'

// /patients/[id] — REFEITA DO ZERO (2026-06-26). Ficha de cada pessoa, limpa,
// prática e boa em mobile. Org-scoped (a equipa toda vê o mesmo). Secções em
// pilha (sem abas confusas): Resumo · Medicação · Sinais vitais · Contactos.
// Mantém o essencial que importa e funciona, sem a confusão antiga.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { reportError, MSG } from '@/lib/clientError'
import ResidentRequests from '@/components/ResidentRequests'
import PatientTimeline from '@/components/PatientTimeline'
import { usePhloxContext } from '@/lib/copilotContext'
import { institutionConfig } from '@/lib/institutionConfig'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'
import { setActiveProfile } from '@/lib/profileContext'
import { flagReading, VITAL_LEVEL_COLOR, VITAL_LABEL } from '@/lib/vitalRanges'
import { vitalTrendSignals, type TrendVital } from '@/lib/healthTrends'
import { printDoc, type PrintRecord } from '@/lib/print'
import { useToast } from '@/components/Toast'

interface LifeStory { profession?: string; family?: string; hobbies?: string; music?: string; notes?: string; sensitivities?: string }
interface Patient {
  id: string; name: string; age: number | null; sex: string | null
  weight: number | null; height: number | null; creatinine: number | null
  conditions: string | null; allergies: string | null; notes: string | null
  room_number?: string | null; admission_date?: string | null; emergency_contact?: string | null
  address?: string | null
  life_story?: LifeStory | null
  photo_url?: string | null
  updated_at?: string
}
interface Med { id: string; name: string; dose: string | null; frequency: string | null; indication: string | null; shifts?: string[] | null; take_location?: string | null }
interface Contact { id: string; name: string; relationship?: string; phone?: string; email?: string; is_emergency?: boolean; is_legal_guardian?: boolean }
interface Summary { profile_line?: string; overview?: string; watch_for?: { level: string; text: string }[]; interactions?: string[]; suggestions?: string[] }

const SHIFTS = [{ v: 'manha', l: 'Manhã' }, { v: 'tarde', l: 'Tarde' }, { v: 'noite', l: 'Noite' }]
const LOC = [{ v: 'centro', l: '☀️ No centro' }, { v: 'casa', l: '🏠 Em casa' }, { v: 'ambos', l: 'Casa + centro' }]

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const toast = useToast()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const cfg = institutionConfig(institution)
  const noun = cfg.personNoun.toLowerCase()
  const isDayCare = institution === 'day_care'
  const warm = institution === 'day_care' || institution === 'nursing_home'
  const accent = warm ? '#0d9488' : '#1d4ed8'
  const accentSoft = warm ? '#f0fdfa' : '#eff6ff'

  const [pid, setPid] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [vitals, setVitals] = useState<any | null>(null)
  const [todayMar, setTodayMar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Contexto p/ o Copilot: o doente/utente ativo (medicação, condições, alergias).
  usePhloxContext(
    patient ? `${cfg.personNoun}: ${patient.name}` : '',
    patient ? { nome: patient.name, idade: patient.age, sexo: patient.sex, condicoes: patient.conditions, alergias: patient.allergies, medicacao: meds.map((m: any) => m.name) } : null as any
  )

  // Convidar família (gera código + partilha)
  const [familyCode, setFamilyCode] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteErr, setInviteErr] = useState('')
  const [copied, setCopied] = useState(false)

  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState<Partial<Patient>>({})
  const [editingLife, setEditingLife] = useState(false)
  const [lifeForm, setLifeForm] = useState<LifeStory>({})
  const [savingLife, setSavingLife] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [showAddMed, setShowAddMed] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', dose: '', frequency: '', indication: '', shifts: [] as string[], take_location: 'centro' })
  const [sug, setSug] = useState<{ display: string; dci: string }[]>([])
  const [addingMed, setAddingMed] = useState(false)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [sumLoading, setSumLoading] = useState(false)
  const [sumErr, setSumErr] = useState('')

  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', is_emergency: true })
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => { params.then(p => setPid(p.id)) }, [params])

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!user || !pid) return
    const [pRes, mRes, cRes, vRes, marRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', pid).maybeSingle(),
      supabase.from('patient_meds').select('*').eq('patient_id', pid).eq('active', true).order('created_at', { ascending: false }),
      supabase.from('resident_contacts').select('*').eq('patient_id', pid).order('created_at', { ascending: true }),
      supabase.from('care_records').select('vitals,date').eq('patient_id', pid).order('date', { ascending: false }).limit(1),
      supabase.from('mar_records').select('*').eq('patient_id', pid).eq('date', today),
    ])
    if (!pRes.data) { router.push('/patients'); return }
    setPatient(pRes.data); setEdit(pRes.data); setLifeForm(pRes.data?.life_story || {})
    setFamilyCode((pRes.data as any).family_code || null)
    setMeds(mRes.data || []); setContacts(cRes.data || [])
    setVitals(vRes.data?.[0]?.vitals || null)
    setTodayMar(marRes.data || [])
    setActiveProfile({ id: pRes.data.id, name: pRes.data.name, type: 'patient', age: pRes.data.age, sex: pRes.data.sex, conditions: pRes.data.conditions, allergies: pRes.data.allergies, ownerId: user.id })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, pid, router])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, table: ['patient_meds', 'care_records', 'mar_records', 'resident_contacts'], filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  const crCl = patient?.age && patient?.weight && patient?.creatinine && patient?.sex
    ? Math.round(((140 - patient.age) * patient.weight * (patient.sex === 'F' ? 0.85 : 1)) / (72 * patient.creatinine)) : null

  // ── ações ──
  async function saveEdit() {
    if (!patient) return
    setSavingEdit(true); setEditErr('')
    const patch: any = {
      name: (edit.name || '').trim() || patient.name,
      age: edit.age ? Number(edit.age) : null, sex: edit.sex || null,
      weight: edit.weight ? Number(edit.weight) : null, height: edit.height ? Number(edit.height) : null,
      creatinine: edit.creatinine ? Number(edit.creatinine) : null,
      conditions: (edit.conditions || '').trim() || null, allergies: (edit.allergies || '').trim() || null,
      room_number: (edit.room_number || '').trim() || null, emergency_contact: (edit.emergency_contact || '').trim() || null,
      address: (edit.address || '').trim() || null,
      notes: (edit.notes || '').trim() || null,
    }
    // BUG CORRIGIDO 2026-07-28: nunca se verificava o erro do update — um
    // campo em falta no schema (aconteceu com 'address') fazia o PostgREST
    // rejeitar o pedido INTEIRO, e o modal fechava como se tivesse guardado.
    // Nenhum campo de nenhum residente estava a gravar, em silêncio.
    const { error } = await supabase.from('patients').update(patch).eq('id', patient.id)
    setSavingEdit(false)
    if (error) { setEditErr(reportError('patients-save-edit', error, MSG.save)); return }
    setEditing(false); load()
  }

  // Foto de perfil — bucket público "patient-photos", pasta por UTENTE (não por
  // quem faz upload, ao contrário do bucket "documents"): qualquer pessoa da
  // equipa vê/substitui a mesma foto. Precisa de supabase/sprint125_patient_photo.sql
  // (coluna photo_url + bucket + políticas) — ver reportError, degrada com
  // mensagem amigável se ainda não tiver sido aplicado.
  async function uploadPhoto(file: File) {
    if (!patient) return
    setUploadingPhoto(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${patient.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('patient-photos').upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('patient-photos').getPublicUrl(path)
      const photoUrl = pub?.publicUrl
      if (!photoUrl) throw new Error('sem URL pública')
      const { error: updErr } = await supabase.from('patients').update({ photo_url: photoUrl }).eq('id', patient.id)
      if (updErr) throw updErr
      setPatient(p => p ? { ...p, photo_url: photoUrl } : p)
    } catch (e) {
      toast.error('Não foi possível guardar a foto', reportError('patients-photo-upload', e, 'Verifica a ligação e tenta de novo.'))
    } finally { setUploadingPhoto(false) }
  }

  // BUG CORRIGIDO 2026-08-07: "não dá para eliminar utentes" — a capacidade já
  // existia (arquivar = active:false, reversível em "Arquivados"), mas só na
  // lista /patients, num botão de texto discreto no rodapé do cartão. Quem
  // está a ver a FICHA do utente (onde realmente se decide isto) não tinha
  // nenhuma forma de o fazer. Reutiliza o mesmo soft-delete — nunca apagar a
  // sério: o histórico de cuidados de uma pessoa é um registo que tem de ficar.
  async function archiveThisPatient() {
    if (!patient) return
    if (!confirm(`Arquivar ${patient.name}? Sai das listas ativas, mas o histórico fica guardado e pode ser reposto em "${cfg.personNounPlural}" → Arquivados.`)) return
    const { error } = await supabase.from('patients').update({ active: false }).eq('id', patient.id)
    if (error) { toast.error('Não foi possível arquivar', reportError('patients-archive', error, MSG.save)); return }
    router.push('/patients')
  }

  async function addMed() {
    if (!newMed.name.trim() || !pid) return
    setAddingMed(true)
    const resolved = resolveDrugName(newMed.name)
    const name = resolved ? resolved.dci : newMed.name.trim()
    const { data } = await supabase.from('patient_meds').insert(scope.stamp({
      patient_id: pid, user_id: user.id, active: true, name,
      dose: newMed.dose || null, frequency: newMed.frequency || null, indication: newMed.indication || null,
      shifts: newMed.shifts.length ? newMed.shifts : null,
      ...(isDayCare ? { take_location: newMed.take_location } : {}),
    })).select().single()
    if (data) setMeds(p => [data, ...p])
    setNewMed({ name: '', dose: '', frequency: '', indication: '', shifts: [], take_location: 'centro' }); setSug([])
    setShowAddMed(false); setAddingMed(false)
  }

  async function removeMed(id: string) {
    if (!confirm('Remover este medicamento da ficha?')) return
    await supabase.from('patient_meds').update({ active: false }).eq('id', id)
    setMeds(p => p.filter(m => m.id !== id))
  }

  async function addContact() {
    if (!contactForm.name.trim() || !pid) return
    setSavingContact(true)
    const { data } = await supabase.from('resident_contacts').insert(scope.stamp({
      patient_id: pid, user_id: user.id, name: contactForm.name.trim(),
      relationship: contactForm.relationship || null, phone: contactForm.phone || null, is_emergency: contactForm.is_emergency,
    })).select().single()
    if (data) setContacts(p => [...p, data])
    setContactForm({ name: '', relationship: '', phone: '', is_emergency: true }); setShowAddContact(false); setSavingContact(false)
  }

  // Convidar família: gera o código (se não existir) e abre o painel de partilha.
  async function openInvite() {
    setInviteOpen(true); setInviteErr('')
    if (familyCode || !pid) return
    setInviteBusy(true)
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const rnd = new Uint32Array(8); crypto.getRandomValues(rnd)
    const code = Array.from(rnd, n => alpha[n % 32]).join('')
    const { error } = await supabase.from('patients').update({ family_code: code }).eq('id', pid)
    if (!error) setFamilyCode(code)
    else setInviteErr(reportError('patient-family-code', error, MSG.save))
    setInviteBusy(false)
  }
  const inviteText = () => {
    const first = (patient?.name || '').split(' ')[0]
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://phloxclinical.com'
    return `Olá! Pode acompanhar o dia de ${first} no Phlox.\n\n1. Crie a sua conta: ${base}/login?mode=family\n2. Abra "A minha família" e toque em "Ligar a um lar ou centro de dia"\n3. Introduza o código: ${familyCode}\n\n(Vai confirmar com os últimos 4 dígitos do telemóvel registado na instituição.)`
  }

  async function genSummary() {
    if (!patient) return
    setSumLoading(true); setSumErr(''); setSummary(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/patient-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ name: patient.name, age: patient.age, sex: patient.sex, conditions: patient.conditions, allergies: patient.allergies, meds: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency })) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não consegui gerar o resumo.')
      setSummary(d)
    } catch (e: any) { setSumErr(e.message) } finally { setSumLoading(false) }
  }

  function printChart() {
    if (!patient) return
    const w = window.open('', '_blank'); if (!w) return
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
    const medRows = meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose || '')}</td><td>${esc(m.frequency || '')}</td><td>${esc(m.indication || '')}</td></tr>`).join('')
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Ficha — ${esc(patient.name)}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}h1{font-size:20px;font-family:Georgia,serif}
      .meta{color:#555;margin:4px 0 16px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #ddd;padding:7px 9px;text-align:left}
      th{background:#f5f5f5;font-size:11px;text-transform:uppercase}.box{border:1px solid #ddd;border-radius:6px;padding:12px;margin:10px 0}
      .warn{color:#b91c1c;font-weight:700}</style></head><body>
      <h1>${esc(patient.name)}</h1>
      <div class="meta">${[patient.age ? patient.age + ' anos' : '', patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : '', patient.room_number ? cfg.roomLabel + ' ' + patient.room_number : ''].filter(Boolean).join(' · ')}</div>
      ${patient.allergies ? `<div class="box warn">⚠ Alergias: ${esc(patient.allergies)}</div>` : ''}
      ${patient.conditions ? `<div class="box"><strong>Diagnósticos:</strong> ${esc(patient.conditions)}</div>` : ''}
      <h3>Medicação (${meds.length})</h3>
      <table><thead><tr><th>Medicamento</th><th>Dose</th><th>Frequência</th><th>Indicação</th></tr></thead><tbody>${medRows || '<tr><td colspan=4>Sem medicação registada</td></tr>'}</tbody></table>
      <p style="margin-top:24px;color:#999;font-size:11px">Phlox Clinical · ${new Date().toLocaleDateString('pt-PT')}</p>
      </body></html>`)
    w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  // Cartão de emergência — para a equipa levar/enviar quando o utente vai às
  // urgências. Diferente da "Ficha" (registo clínico completo): só o essencial
  // num relance (alergias em destaque, medicação atual, contacto de emergência).
  function printEmergencyCard() {
    if (!patient) return
    const w = window.open('', '_blank'); if (!w) return
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
    const medRows = meds.map(m => `<li>${esc(m.name)}${m.dose ? ` — ${esc(m.dose)}` : ''}</li>`).join('')
    const emergencyContact = contacts.find(c => c.is_emergency) || contacts[0]
    const contactLine = emergencyContact
      ? `${esc(emergencyContact.name)}${emergencyContact.relationship ? ` (${esc(emergencyContact.relationship)})` : ''}${emergencyContact.phone ? ` — ${esc(emergencyContact.phone)}` : ''}`
      : (patient.emergency_contact ? esc(patient.emergency_contact) : null)
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Cartão de emergência — ${esc(patient.name)}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:15px}
      h1{font-size:26px;font-family:Georgia,serif;margin:0 0 4px}
      .meta{color:#555;margin:0 0 18px;font-size:14px}
      .warn{background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:16px;margin:0 0 16px}
      .warn .lbl{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#991b1b;font-weight:700;margin-bottom:4px}
      .warn .val{font-size:20px;font-weight:700;color:#991b1b}
      .box{border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:0 0 14px}
      .box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:6px}
      ul{margin:0;padding-left:20px}li{margin-bottom:3px}</style></head><body>
      <h1>${esc(patient.name)}</h1>
      <div class="meta">${[patient.age ? patient.age + ' anos' : '', patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : '', patient.room_number ? cfg.roomLabel + ' ' + patient.room_number : ''].filter(Boolean).join(' · ')}</div>
      <div class="warn"><div class="lbl">⚠ Alergias</div><div class="val">${patient.allergies ? esc(patient.allergies) : 'Nenhuma conhecida'}</div></div>
      ${patient.conditions ? `<div class="box"><div class="lbl">Diagnósticos</div>${esc(patient.conditions)}</div>` : ''}
      <div class="box"><div class="lbl">Medicação atual (${meds.length})</div><ul>${medRows || '<li>Sem medicação registada</li>'}</ul></div>
      ${contactLine ? `<div class="box"><div class="lbl">Contacto de emergência</div>${contactLine}</div>` : ''}
      <p style="margin-top:24px;color:#999;font-size:11px">Phlox Clinical · Gerado em ${new Date().toLocaleString('pt-PT')} · ${esc(cfg.unitNoun)}</p>
      </body></html>`)
    w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  // História de vida — profissão, família, hobbies/música: a equipa usa para
  // conversar com sentido (essencial em demência); a família ajuda a preencher.
  async function saveLifeStory() {
    if (!patient) return
    setSavingLife(true)
    const { error } = await supabase.from('patients').update({ life_story: lifeForm }).eq('id', patient.id)
    if (!error) { setPatient(p => p ? { ...p, life_story: lifeForm } : p); setEditingLife(false) }
    setSavingLife(false)
  }

  // Relatório do mês para a família — A4 caloroso a partir dos registos do mês.
  const [reportBusy, setReportBusy] = useState(false)
  async function printMonthlyReport() {
    if (!patient || !pid) return
    setReportBusy(true)
    try {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const { data: recs } = await supabase.from('care_records').select('date,shift,nutrition,mood,vitals').eq('patient_id', pid).gte('date', first).order('date')
      const { data: doses } = await supabase.from('mar_records').select('status,date').eq('patient_id', pid).gte('date', first)
      const days = new Set((recs || []).map((r: any) => r.date)).size
      const meals = (recs || []).flatMap((r: any) => [r.nutrition?.breakfast, r.nutrition?.lunch, r.nutrition?.dinner]).filter((x: any) => typeof x === 'number')
      const avgMeal = meals.length ? Math.round(meals.reduce((a: number, b: number) => a + b, 0) / meals.length) : null
      const moods = (recs || []).map((r: any) => r.mood?.level).filter((x: any) => typeof x === 'number')
      const avgMood = moods.length ? (moods.reduce((a: number, b: number) => a + b, 0) / moods.length) : null
      const dosesGiven = (doses || []).filter((d: any) => d.status === 'administered' || d.status === 'given' || d.status === 'taken').length
      const monthName = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      const moodWord = avgMood == null ? '—' : avgMood >= 4 ? 'bem-disposto(a) a maior parte dos dias' : avgMood >= 3 ? 'tranquilo(a)' : 'com alguns dias menos bons'
      const mealWord = avgMeal == null ? '—' : avgMeal >= 75 ? 'comeu bem' : avgMeal >= 40 ? 'comeu razoavelmente' : 'comeu pouco'
      const w = window.open('', '_blank'); if (!w) { setReportBusy(false); return }
      const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
      w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Relatório de ${esc(patient.name)} — ${esc(monthName)}</title>
        <style>body{font-family:Georgia,'Times New Roman',serif;padding:40px;color:#1a1a1a;line-height:1.7;max-width:680px;margin:0 auto}
        h1{font-size:24px;font-weight:400}.kicker{font-family:Arial;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#0d6e42;font-weight:700}
        .stats{display:flex;gap:24px;margin:20px 0;flex-wrap:wrap}.stat{}.num{font-size:30px;color:#0d6e42}.lbl{font-family:Arial;font-size:11px;color:#777}
        .box{background:#f6f9f7;border-radius:10px;padding:18px 20px;margin:16px 0;font-size:15px}
        .foot{font-family:Arial;font-size:11px;color:#999;margin-top:30px;border-top:1px solid #eee;padding-top:12px}</style></head><body>
        <div class="kicker">Relatório mensal · ${esc(monthName)}</div>
        <h1>Como correu o mês de ${esc(patient.name.split(' ')[0])}</h1>
        <div class="stats">
          <div class="stat"><div class="num">${days}</div><div class="lbl">dias com registo</div></div>
          <div class="stat"><div class="num">${dosesGiven}</div><div class="lbl">tomas de medicação</div></div>
        </div>
        <div class="box">Este mês, ${esc(patient.name.split(' ')[0])} <strong>${mealWord}</strong> e esteve <strong>${moodWord}</strong>. A equipa acompanhou-o(a) de perto, com registo em ${days} ${days === 1 ? 'dia' : 'dias'}.</div>
        <p style="font-size:14px;color:#444">Continuamos a cuidar com atenção e carinho. Para qualquer questão, fale connosco a qualquer momento.</p>
        <div class="foot">Gerado pelo Phlox Clinical a partir dos registos de cuidado · ${new Date().toLocaleDateString('pt-PT')}. Documento informativo para a família.</div>
        </body></html>`)
      w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
    } catch { /* ignora */ }
    finally { setReportBusy(false) }
  }

  // Briefing clínico para consulta/exame externo (Módulo 6, 2026-08-16) —
  // medicação atual + alergias + tendência REAL de sinais vitais (lib/
  // healthTrends, a mesma função já ligada ao /care-log) + red flags/perguntas
  // sugeridas por IA (reutiliza app/api/briefing, já existente, usado até
  // agora só com medicação colada à mão — aqui alimentado com os dados reais
  // desta pessoa). A IA nunca inventa medicação: recebe só a lista real.
  const [briefingBusy, setBriefingBusy] = useState(false)
  async function printConsultBriefing() {
    if (!patient || !pid) return
    setBriefingBusy(true)
    try {
      const since = new Date(); since.setDate(since.getDate() - 90)
      const { data: recs } = await supabase.from('care_records').select('date,created_at,vitals').eq('patient_id', pid).gte('date', since.toISOString().slice(0, 10)).order('date')
      const trendVitals: TrendVital[] = ((recs || []) as any[])
        .filter(r => r.vitals && Object.values(r.vitals).some((v: any) => v != null))
        .map(r => ({ recorded_at: r.created_at || r.date, ...r.vitals }))
      const trends = vitalTrendSignals(trendVitals, true)

      const medications = meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` — ${m.frequency}` : ''}`).join('\n') || 'Sem medicação ativa registada'
      const context = [
        patient.age ? `Idade: ${patient.age} anos` : '',
        `Alergias: ${patient.allergies || 'nenhuma conhecida'}`,
        patient.conditions ? `Diagnósticos: ${patient.conditions}` : '',
        trends.length ? `Tendências recentes de sinais vitais: ${trends.map(t => `${t.title} — ${t.detail}`).join('; ')}` : 'Sem tendências relevantes nos sinais vitais recentes',
      ].filter(Boolean).join('. ')

      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ medications, chief_complaint: `Consulta/exame agendado. ${context}` }),
      })
      const b = await r.json()
      if (!r.ok) throw new Error(b.error || 'Não foi possível gerar o briefing.')

      const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))
      const w = window.open('', '_blank'); if (!w) { setBriefingBusy(false); return }
      w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Briefing de consulta — ${esc(patient.name)}</title>
        <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13.5px;line-height:1.55;max-width:720px;margin:0 auto}
        h1{font-size:22px;font-family:Georgia,serif;margin:0 0 4px}.meta{color:#555;margin:0 0 18px;font-size:13px}
        .warn{background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px 16px;margin:0 0 14px}
        .warn .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#991b1b;font-weight:700;margin-bottom:4px}
        .box{border:1px solid #ddd;border-radius:8px;padding:14px 16px;margin:0 0 14px}
        .box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:8px;font-weight:700}
        .flag{border-left:3px solid #d97706;padding:6px 0 6px 12px;margin-bottom:8px}
        .flag.IMEDIATA{border-color:#dc2626}.flag .urg{font-size:10px;font-weight:800;text-transform:uppercase;color:#92400e}
        .flag.IMEDIATA .urg{color:#991b1b}
        ul{margin:0;padding-left:20px}li{margin-bottom:4px}</style></head><body>
        <h1>Briefing de consulta — ${esc(patient.name)}</h1>
        <div class="meta">${[patient.age ? patient.age + ' anos' : '', patient.room_number ? cfg.roomLabel + ' ' + patient.room_number : ''].filter(Boolean).join(' · ')} · Gerado em ${new Date().toLocaleString('pt-PT')}</div>
        <div class="warn"><div class="lbl">⚠ Alergias</div>${patient.allergies ? esc(patient.allergies) : 'Nenhuma conhecida'}</div>
        <div class="box"><div class="lbl">Medicação atual (${meds.length})</div><ul>${meds.map(m => `<li>${esc(m.name)}${m.dose ? ` — ${esc(m.dose)}` : ''}${m.frequency ? ` (${esc(m.frequency)})` : ''}</li>`).join('') || '<li>Sem medicação registada</li>'}</ul></div>
        ${trends.length ? `<div class="box"><div class="lbl">Tendências recentes de sinais vitais</div><ul>${trends.map(t => `<li><strong>${esc(t.title)}</strong> — ${esc(t.detail)}</li>`).join('')}</ul></div>` : ''}
        ${b.clinical_note ? `<div class="box"><div class="lbl">Síntese clínica</div>${esc(b.clinical_note)}</div>` : ''}
        ${(b.red_flags || []).length ? `<div class="box"><div class="lbl">Pontos de atenção</div>${b.red_flags.map((f: any) => `<div class="flag${f.urgency === 'IMEDIATA' ? ' IMEDIATA' : ''}"><span class="urg">${esc(f.urgency)}</span><br>${esc(f.flag)}${f.reason ? ` — ${esc(f.reason)}` : ''}</div>`).join('')}</div>` : ''}
        ${(b.questions_to_ask || []).length ? `<div class="box"><div class="lbl">Perguntas sugeridas ao médico</div><ul>${b.questions_to_ask.map((q: string) => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
        ${(b.what_to_monitor || []).length ? `<div class="box"><div class="lbl">A monitorizar</div><ul>${b.what_to_monitor.map((m: any) => `<li><strong>${esc(m.parameter)}</strong>${m.target ? ` — alvo ${esc(m.target)}` : ''}${m.reason ? ` (${esc(m.reason)})` : ''}</li>`).join('')}</ul></div>` : ''}
        <p style="margin-top:24px;color:#999;font-size:11px">Phlox Clinical · Apoio à consulta, não substitui avaliação clínica · ${esc(cfg.unitNoun)}</p>
        </body></html>`)
      w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
    } catch (e: any) { toast.error('Não foi possível gerar o briefing', reportError('consult-briefing', e, 'Tenta de novo.')) }
    finally { setBriefingBusy(false) }
  }

  // Dossier mensal — formal, para a direção mostrar a uma família ou numa
  // inspeção: presenças, atividades, adesão à medicação, ocorrências. Diferente
  // do "Relatório mensal" acima (narrativa calorosa) e do dossier institucional
  // do /painel-dono (esse é da instituição toda; este é DESTA pessoa).
  const [dossierBusy, setDossierBusy] = useState(false)
  async function printPatientDossier() {
    if (!patient || !pid) return
    setDossierBusy(true)
    try {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const monthLabel = now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      const [attRes, partsRes, dosesRes, incRes] = await Promise.all([
        supabase.from('attendance').select('date,status').eq('patient_id', pid).gte('date', first).order('date').then((r: any) => r, () => ({ data: [] })),
        supabase.from('activity_participations').select('attended,activities(title,date,type)').eq('patient_id', pid).eq('attended', true).then((r: any) => r, () => ({ data: [] })),
        supabase.from('mar_records').select('status,date').eq('patient_id', pid).gte('date', first).then((r: any) => r, () => ({ data: [] })),
        supabase.from('incidents').select('date,type,severity,description,action_taken,follow_up_required').eq('patient_id', pid).gte('date', first).order('date').then((r: any) => r, () => ({ data: [] })),
      ])
      const att = (attRes.data || []) as { date: string; status: string }[]
      const parts = ((partsRes.data || []) as any[]).filter(p => p.activities && p.activities.date >= first)
      const doses = (dosesRes.data || []) as { status: string; date: string }[]
      const incs = (incRes.data || []) as { date: string; type: string; severity: string; description: string; action_taken?: string; follow_up_required?: boolean }[]

      const presentDays = att.filter(a => a.status === 'present').length
      const attendanceRate = att.length ? Math.round((presentDays / att.length) * 100) : null
      const dosesGiven = doses.filter(d => d.status === 'administered' || d.status === 'given' || d.status === 'taken').length
      const adherence = doses.length ? Math.round((dosesGiven / doses.length) * 100) : null
      const TYPE_LABELS: Record<string, string> = { fall: 'Queda', medication_error: 'Erro de Medicação', pressure_ulcer: 'Úlcera de Pressão', behavioral: 'Incidente Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Outro' }
      const SEV_LABELS: Record<string, string> = { minor: 'Ligeiro', moderate: 'Moderado', major: 'Grave', critical: 'Crítico' }

      const attendanceRecords: PrintRecord[] = att.length ? [{
        title: `${presentDays} de ${att.length} dias marcados`,
        fields: [
          { label: 'Presente', value: String(presentDays) },
          { label: 'Ausente', value: String(att.filter(a => a.status === 'absent').length) },
          { label: 'Saiu antes', value: String(att.filter(a => a.status === 'left').length) },
        ],
      }] : [{ title: 'Sem presenças marcadas este mês', fields: [] }]

      const activityRecords: PrintRecord[] = parts.length
        ? parts.sort((a, b) => a.activities.date.localeCompare(b.activities.date)).map(p => ({
            title: p.activities.title,
            meta: new Date(p.activities.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
          }))
        : [{ title: 'Sem participação em atividades registada este mês' }]

      const medRecords: PrintRecord[] = doses.length ? [{
        title: `${dosesGiven} de ${doses.length} tomas dadas`,
        fields: [{ label: 'Adesão', value: adherence != null ? `${adherence}%` : '—' }],
      }] : [{ title: 'Sem tomas registadas este mês', fields: [] }]

      const incidentRecords: PrintRecord[] = incs.length
        ? incs.map(i => ({
            title: TYPE_LABELS[i.type] || i.type,
            meta: `${new Date(i.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} · ${SEV_LABELS[i.severity] || i.severity}`,
            fields: [
              { label: 'Descrição', value: i.description },
              ...(i.action_taken ? [{ label: 'Ação tomada', value: i.action_taken }] : []),
              { label: 'Seguimento', value: i.follow_up_required ? 'Necessário' : 'Não necessário' },
            ],
          }))
        : [{ title: 'Sem ocorrências este mês' }]

      printDoc({
        docTitle: `Dossier mensal — ${patient.name}`,
        docSubtitle: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        institution: cfg.unitNoun,
        meta: [
          { label: 'presença', value: attendanceRate != null ? `${attendanceRate}%` : '—' },
          { label: 'atividades', value: String(parts.length) },
          { label: 'adesão à medicação', value: adherence != null ? `${adherence}%` : '—' },
          { label: 'ocorrências', value: String(incs.length) },
        ],
        sections: [
          { heading: 'Presenças', records: attendanceRecords },
          { heading: 'Atividades', records: activityRecords },
          { heading: 'Medicação', records: medRecords },
          { heading: 'Ocorrências', records: incidentRecords },
          { heading: 'Validação', records: [{ title: 'Responsável', fields: [{ label: 'Nome', value: '' }, { label: 'Assinatura', value: '' }, { label: 'Data', value: '' }] }] },
        ],
        footerNote: 'Dossier organizado a partir dos registos da equipa. Documento de gestão — não constitui avaliação clínica.',
      })
    } catch { /* ignora */ }
    finally { setDossierBusy(false) }
  }

  if (!user) return null
  if (loading) return <Shell warm={warm}><div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>A carregar…</div></Shell>
  if (!patient) return null

  const SEV: Record<string, { c: string; b: string }> = { alta: { c: '#991b1b', b: '#fee2e2' }, 'média': { c: '#b45309', b: '#fef3c7' }, baixa: { c: '#475569', b: '#f1f5f9' } }
  const homeMeds = meds.filter(m => m.take_location === 'casa' || m.take_location === 'ambos')
  const centreMeds = meds.filter(m => m.take_location !== 'casa')

  return (
    <Shell warm={warm}>
      {/* Voltar */}
      <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: accent, textDecoration: 'none', fontWeight: 600, marginBottom: 14 }}>← {cfg.personNounPlural}</Link>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        {patient.photo_url ? (
          <img src={patient.photo_url} alt={patient.name} style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: accentSoft, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{patient.name.charAt(0).toUpperCase()}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 'clamp(22px,5vw,28px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{patient.name}</h1>
          <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {[patient.age ? `${patient.age} anos` : null, patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : null, patient.room_number ? `${cfg.roomLabel} ${patient.room_number}` : null].filter(Boolean).join(' · ') || `Ficha de ${noun}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => setEditing(true)} style={btnGhost(accent)}>Editar</button>
          <button onClick={printChart} style={btnGhost(accent)} title="Imprimir ficha clínica">🖨 Ficha</button>
          <button onClick={printEmergencyCard} style={{ ...btnGhost(accent), borderColor: '#dc2626', color: '#dc2626' }} title="Resumo de 1 página para levar às urgências">🚨 Cartão de emergência</button>
          <button onClick={printMonthlyReport} disabled={reportBusy} style={btnGhost(accent)} title="Relatório do mês para a família">{reportBusy ? '…' : '📄 Relatório'}</button>
          <button onClick={printConsultBriefing} disabled={briefingBusy} style={btnGhost(accent)} title="Medicação, tendências e perguntas sugeridas para uma consulta/exame externo">{briefingBusy ? '…' : '🩺 Preparar consulta'}</button>
          <button onClick={printPatientDossier} disabled={dossierBusy} style={btnGhost(accent)} title="Dossier mensal: presenças, atividades, medicação, ocorrências">{dossierBusy ? '…' : '🗂 Dossier mensal'}</button>
          {scope.canEdit && (
            <button onClick={archiveThisPatient} style={{ ...btnGhost(accent), borderColor: '#e2e8f0', color: '#94a3b8' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8' }}
              title={`Arquivar ${noun} — sai das listas ativas, histórico fica guardado`}>🗄 Arquivar</button>
          )}
        </div>
      </div>

      {/* Alergia — sempre visível, é segurança */}
      {patient.allergies && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#991b1b' }}>⚠ ALERGIAS: </span>
          <span style={{ fontSize: 13.5, color: '#7f1d1d' }}>{patient.allergies}</span>
        </div>
      )}

      {/* Preferências e sensibilidades — sempre visível, mesmo tratamento que
          alergias (Módulo 9): quem substitui a pessoa habitual não deve ter de
          ler a página toda até ao fim para saber "não gosta de duche, prefere
          banho" ou uma prática religiosa a respeitar. Vive dentro do mesmo
          life_story jsonb da História de vida, campo à parte (essa continua
          mais abaixo, para conversar; isto é o que importa AO CUIDAR). */}
      {patient.life_story?.sensitivities ? (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #d97706', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#92400e' }}>PREFERÊNCIAS E SENSIBILIDADES: </span>
            <span style={{ fontSize: 13.5, color: '#78350f' }}>{patient.life_story.sensitivities}</span>
          </div>
          <button onClick={() => { setEditingLife(true); document.getElementById('historia-vida-anexo')?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{ background: 'none', border: 'none', color: '#92400e', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, textDecoration: 'underline' }}>Editar</button>
        </div>
      ) : (
        <button onClick={() => { setEditingLife(true); document.getElementById('historia-vida-anexo')?.scrollIntoView({ behavior: 'smooth' }) }}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: '#fffbeb', border: '1px dashed #fde68a', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 12.5, color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Registar preferências e sensibilidades (ex: "prefere duche a banho de imersão", "gosta de ser tratada por Dona Maria")
        </button>
      )}

      {/* AÇÕES RÁPIDAS — a ficha vira um hub: dar medicação, registar o dia */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Link href={`/mar?patient=${patient.id}`} style={{ ...btnSolid(accent), flex: '1 1 140px', textAlign: 'center', textDecoration: 'none' }}>💊 Dar medicação</Link>
        <Link href={`/care-log?patient=${patient.id}`} style={{ ...btnGhost(accent), flex: '1 1 140px', textAlign: 'center', textDecoration: 'none' }}>📝 Registar o dia</Link>
      </div>

      {/* RESUMO */}
      <Card>
        <CardTitle>Resumo</CardTitle>
        {/* Estado em linha — só o que tem dados (sem "0" vazios) */}
        {(crCl != null || patient.weight || todayMar.length > 0 || meds.length > 0) && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: patient.conditions ? 14 : 0 }}>
            {meds.length > 0 && <Mini label="Medicamentos" value={String(meds.length)} accent={accent} />}
            {crCl != null && <Mini label="Função renal" value={`CrCl ${crCl}`} alert={crCl < 30} warn={crCl < 60} />}
            {patient.weight && <Mini label="Peso" value={`${patient.weight} kg`} />}
            {todayMar.length > 0 && <Mini label="Tomas hoje" value={String(todayMar.filter(m => m.status === 'administered' || m.status === 'given' || m.status === 'taken').length)} accent={accent} />}
          </div>
        )}
        {patient.conditions && (
          <div>
            <Label>Diagnósticos</Label>
            <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{patient.conditions}</div>
          </div>
        )}
        {patient.address && <div style={{ marginTop: 12 }}><Label>{isDayCare ? 'Morada (recolha)' : 'Morada'}</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>📍 {patient.address}</div></div>}
        {patient.notes && <div style={{ marginTop: 12 }}><Label>Notas</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.notes}</div></div>}

        {/* Resumo clínico IA — só quando há matéria para analisar */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
          {!summary && !sumLoading && (
            meds.length > 0 || patient.conditions
              ? <button onClick={genSummary} style={{ ...btnGhost(accent), width: '100%' }}>✨ Gerar resumo clínico (IA)</button>
              : <div style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center' }}>Adicione medicação ou diagnósticos para gerar um resumo clínico.</div>
          )}
          {sumLoading && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 8 }}>A analisar a ficha…</div>}
          {sumErr && <div style={{ fontSize: 13, color: '#dc2626' }}>{sumErr}</div>}
          {summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary.overview && <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.65, margin: 0 }}>{summary.overview}</p>}
              {(summary.watch_for || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {summary.watch_for!.map((w, i) => {
                    const s = SEV[w.level] || SEV.baixa
                    return <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ fontSize: 9.5, fontWeight: 800, color: s.c, background: s.b, borderRadius: 4, padding: '2px 7px', flexShrink: 0, textTransform: 'uppercase', marginTop: 1 }}>{w.level}</span><span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{w.text}</span></div>
                  })}
                </div>
              )}
              {(summary.interactions || []).length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', marginBottom: 5 }}>Interações a confirmar</div>
                  {summary.interactions!.map((it, i) => <div key={i} style={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}>• {it}</div>)}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Orientação de apoio — confirma sempre clinicamente. <button onClick={genSummary} style={{ background: 'none', border: 'none', color: accent, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Atualizar</button></div>
            </div>
          )}
        </div>
      </Card>

      {/* HISTÓRIA DE VIDA — para a equipa conversar com sentido (essencial em
          demência); a família pode ajudar a preencher. */}
      <div id="historia-vida-anexo" />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <CardTitle noMargin>História de vida</CardTitle>
          {!editingLife && <button onClick={() => setEditingLife(true)} style={btnGhost(accent)}>{patient.life_story ? 'Editar' : '+ Adicionar'}</button>}
        </div>
        {editingLife ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea value={lifeForm.sensitivities || ''} onChange={e => setLifeForm(f => ({ ...f, sensitivities: e.target.value }))} placeholder="Preferências e sensibilidades (ex: prefere duche a banho de imersão, não gosta que lhe toquem no braço esquerdo, prática religiosa a respeitar)" rows={2} style={{ ...inp, resize: 'vertical', borderColor: '#fde68a', background: '#fffbeb' }} />
            <input value={lifeForm.profession || ''} onChange={e => setLifeForm(f => ({ ...f, profession: e.target.value }))} placeholder="Profissão (ex: Professora primária, 32 anos)" style={inp} />
            <input value={lifeForm.family || ''} onChange={e => setLifeForm(f => ({ ...f, family: e.target.value }))} placeholder="Família (ex: 3 filhos, 7 netos, viúva desde 2015)" style={inp} />
            <input value={lifeForm.hobbies || ''} onChange={e => setLifeForm(f => ({ ...f, hobbies: e.target.value }))} placeholder="Hobbies (ex: jardinagem, tricô, jogar às cartas)" style={inp} />
            <input value={lifeForm.music || ''} onChange={e => setLifeForm(f => ({ ...f, music: e.target.value }))} placeholder="Música/artistas preferidos (ex: fado, Amália Rodrigues)" style={inp} />
            <textarea value={lifeForm.notes || ''} onChange={e => setLifeForm(f => ({ ...f, notes: e.target.value }))} placeholder="Outras notas (histórias, o que a acalma, o que evitar)" rows={2} style={{ ...inp, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveLifeStory} disabled={savingLife} style={{ ...btnSolid(accent), flex: 1 }}>{savingLife ? 'A guardar…' : 'Guardar'}</button>
              <button onClick={() => { setLifeForm(patient.life_story || {}); setEditingLife(false) }} style={btnGhost(accent)}>Cancelar</button>
            </div>
          </div>
        ) : patient.life_story && Object.values(patient.life_story).some(Boolean) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {patient.life_story.profession && <div><Label>Profissão</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.life_story.profession}</div></div>}
            {patient.life_story.family && <div><Label>Família</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.life_story.family}</div></div>}
            {patient.life_story.hobbies && <div><Label>Hobbies</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.life_story.hobbies}</div></div>}
            {patient.life_story.music && <div><Label>Música</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.life_story.music}</div></div>}
            {patient.life_story.notes && <div><Label>Notas</Label><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{patient.life_story.notes}</div></div>}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Ainda sem história de vida registada. Adicionar ajuda a equipa a conversar com {noun.toLowerCase()} de forma mais próxima.</div>
        )}
      </Card>

      {/* MEDICAÇÃO */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <CardTitle noMargin>Medicação ({meds.length})</CardTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            {meds.length >= 2 && <Link href={`/interactions?meds=${encodeURIComponent(meds.map(m => m.name).join(','))}`} style={{ fontSize: 12.5, color: accent, textDecoration: 'none', fontWeight: 700 }}>Verificar interações</Link>}
            <button onClick={() => setShowAddMed(s => !s)} style={btnSolid(accent)}>+ Medicamento</button>
          </div>
        </div>

        {showAddMed && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <input value={newMed.name} autoFocus placeholder="Nome do medicamento" style={inp}
                onChange={e => { const v = e.target.value; setNewMed(p => ({ ...p, name: v })); setSug(v.length >= 2 ? suggestDrugs(v).slice(0, 5) : []) }} />
              {sug.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                  {sug.map((s, i) => <button key={i} onClick={() => { setNewMed(p => ({ ...p, name: s.dci })); setSug([]) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{s.display}</button>)}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))} placeholder="Dose (ex: 1000 mg)" style={inp} />
              <input value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))} placeholder="Frequência (1+0+1)" style={inp} />
            </div>
            <input value={newMed.indication} onChange={e => setNewMed(p => ({ ...p, indication: e.target.value }))} placeholder="Para que serve (opcional)" style={{ ...inp, marginTop: 8 }} />
            {/* Turnos: num centro de dia não existe turno da noite (o centro está
                fechado) — oferecer "Noite" faria a toma nunca aparecer no /mar. */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {SHIFTS.filter(s => !isDayCare || s.v !== 'noite').map(s => { const on = newMed.shifts.includes(s.v); return <button key={s.v} onClick={() => setNewMed(p => ({ ...p, shifts: on ? p.shifts.filter(x => x !== s.v) : [...p.shifts, s.v] }))} style={chip(on, accent)}>{on ? '✓ ' : ''}{s.l}</button> })}
            </div>
            {isDayCare && (
              <div style={{ marginTop: 10 }}>
                <Label>Onde é dado?</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {LOC.map(l => <button key={l.v} onClick={() => setNewMed(p => ({ ...p, take_location: l.v }))} style={chip(newMed.take_location === l.v, accent)}>{l.l}</button>)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>“Em casa” → a família marca a toma e ela aparece aqui.</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={addMed} disabled={!newMed.name.trim() || addingMed} style={{ ...btnSolid(accent), flex: 1, opacity: newMed.name.trim() ? 1 : 0.5 }}>{addingMed ? 'A guardar…' : 'Adicionar'}</button>
              <button onClick={() => { setShowAddMed(false); setSug([]) }} style={btnGhost(accent)}>Cancelar</button>
            </div>
          </div>
        )}

        {meds.length === 0 ? <Empty msg="Sem medicação registada." />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meds.map(m => {
                const givenToday = todayMar.some(r => r.med_id === m.id && (r.status === 'administered' || r.status === 'given' || r.status === 'taken'))
                const homeRec = todayMar.find(r => r.med_id === m.id && r.source === 'home')
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, border: '1px solid #f1f5f9', borderRadius: 10, padding: '11px 13px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0b1120' }}>{m.name}{m.dose ? <span style={{ fontWeight: 500, color: '#64748b' }}> · {m.dose}</span> : ''}</div>
                      <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
                        {[m.frequency, m.indication, (m.shifts || []).map(s => SHIFTS.find(x => x.v === s)?.l).filter(Boolean).join('/')].filter(Boolean).join(' · ') || '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        {isDayCare && m.take_location && <Tag color={m.take_location === 'casa' ? '#b45309' : accent} bg={m.take_location === 'casa' ? '#fffbeb' : accentSoft}>{m.take_location === 'casa' ? '🏠 Em casa' : m.take_location === 'ambos' ? 'Casa + centro' : '☀️ No centro'}</Tag>}
                        {givenToday && <Tag color="#15803d" bg="#f0fdf4">{homeRec ? `✓ dado em casa${homeRec.home_by ? ` (${homeRec.home_by})` : ''}` : '✓ dado hoje'}</Tag>}
                      </div>
                    </div>
                    <button aria-label="Eliminar" onClick={() => removeMed(m.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 13, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}>×</button>                  </div>
                )
              })}
            </div>}

        {isDayCare && homeMeds.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 12px' }}>
            🏠 {homeMeds.length} {homeMeds.length === 1 ? 'medicamento é dado' : 'medicamentos são dados'} em casa — a família vê-os e marca a toma. {centreMeds.length} no centro.
          </div>
        )}
      </Card>

      {/* SINAIS VITAIS (últimos) — avaliados contra o intervalo seguro para esta
          pessoa (idade/condições), não só números soltos. */}
      {vitals && Object.values(vitals).some(v => v != null) && (() => {
        const flags = flagReading(
          { bp_sys: vitals.bp_sys, bp_dia: vitals.bp_dia, hr: vitals.hr, temp: vitals.temp, spo2: vitals.spo2, glucose: vitals.glucose },
          { age: patient.age, conditions: patient.conditions }
        )
        const flagFor = (field: string) => flags.find(f => f.field === field)?.reading
        return (
        <Card>
          <CardTitle>Sinais vitais <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: 12 }}>· último registo</span></CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
            {[
              vitals.bp_sys ? { l: 'T.A.', v: `${vitals.bp_sys}/${vitals.bp_dia ?? '—'}`, f: flagFor('bp_sys') || flagFor('bp_dia') } : null,
              vitals.hr ? { l: 'F.C.', v: `${vitals.hr}`, f: flagFor('hr') } : null,
              vitals.temp ? { l: 'Temp.', v: `${vitals.temp}°`, f: flagFor('temp') } : null,
              vitals.spo2 ? { l: 'SpO₂', v: `${vitals.spo2}%`, f: flagFor('spo2') } : null,
              vitals.glucose ? { l: 'Glicemia', v: `${vitals.glucose}`, f: flagFor('glucose') } : null,
              vitals.weight ? { l: 'Peso', v: `${vitals.weight} kg` } : null,
            ].filter(Boolean).map((x: any) => <Mini key={x.l} label={x.l} value={x.v} alert={x.f?.level === 'critical'} warn={x.f?.level === 'warning'} />)}
          </div>
          {flags.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flags.map(({ field, reading }) => {
                const c = VITAL_LEVEL_COLOR[reading.level]
                return (
                  <div key={field} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '7px 11px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{reading.level === 'critical' ? '🔴' : '🟠'} {VITAL_LABEL[field]}: {reading.label}</div>
                    {reading.watch && <div style={{ fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>{reading.watch}</div>}
                  </div>
                )
              })}
            </div>
          )}
          <Link href={`/care-log?patient=${patient.id}`} style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, color: accent, textDecoration: 'none', fontWeight: 700 }}>Registar o dia →</Link>
        </Card>
        )
      })()}

      {/* CONTACTOS */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <CardTitle noMargin>Contactos da família</CardTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openInvite} style={btnGhost(accent)}>👨‍👩‍👧 Convidar família</button>
            <button onClick={() => setShowAddContact(s => !s)} style={btnSolid(accent)}>+ Contacto</button>
          </div>
        </div>
        {showAddContact && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome" style={inp} autoFocus />
              <input value={contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))} placeholder="Relação (filho/a…)" style={inp} />
            </div>
            <input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="Telefone" style={{ ...inp, marginTop: 8 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={contactForm.is_emergency} onChange={e => setContactForm(p => ({ ...p, is_emergency: e.target.checked }))} /> Contacto de emergência
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={addContact} disabled={!contactForm.name.trim() || savingContact} style={{ ...btnSolid(accent), flex: 1, opacity: contactForm.name.trim() ? 1 : 0.5 }}>{savingContact ? 'A guardar…' : 'Adicionar'}</button>
              <button onClick={() => setShowAddContact(false)} style={btnGhost(accent)}>Cancelar</button>
            </div>
          </div>
        )}
        {contacts.length === 0 ? <Empty msg="Sem contactos registados." />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 13px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{c.name} {c.is_emergency && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#991b1b', background: '#fee2e2', borderRadius: 4, padding: '1px 6px', marginLeft: 4 }}>SOS</span>}</div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8' }}>{[c.relationship, c.phone].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 13, color: accent, textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>Ligar</a>}
                </div>
              ))}
            </div>}
        <Link href={`/family`} style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, color: accent, textDecoration: 'none', fontWeight: 700 }}>Abrir portal das famílias →</Link>
      </Card>

      {/* PEDIDOS & OBSERVAÇÕES DO UTENTE (lar / centro de dia) */}
      {warm && pid && (
        <Card>
          <CardTitle>Pedidos &amp; observações</CardTitle>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: -6, marginBottom: 12, lineHeight: 1.5 }}>O que {noun} pede ou diz — para toda a equipa saber e poder intervir.</p>
          <ResidentRequests patientId={pid} supabase={supabase} scope={scope} accent={accent} />
        </Card>
      )}

      {/* LINHA DO TEMPO — funde tudo o que se registou sobre a pessoa (Ronda 12) */}
      {pid && (
        <Card>
          <CardTitle>Linha do tempo</CardTitle>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: -6, marginBottom: 12, lineHeight: 1.5 }}>Tudo o que se registou — medicação, cuidados, vitais, ocorrências, consultas — por ordem, num só sítio.</p>
          <PatientTimeline patientId={pid} supabase={supabase} scope={scope} patientName={patient?.name} accent={accent} />
        </Card>
      )}

      {/* MODAL CONVIDAR FAMÍLIA */}
      {inviteOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setInviteOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>Convidar a família de {patient.name.split(' ')[0]}</div>
              <button aria-label="Fechar" onClick={() => setInviteOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>            </div>
            {inviteErr ? <div style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.5 }}>{inviteErr}</div>
            : inviteBusy || !familyCode ? <div style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>A gerar código…</div>
            : (
              <>
                <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>
                  Partilhe este código com a família. Ela acompanha o dia, recebe fotos e marca a medicação de casa — sem instalar nada.
                </p>
                <div style={{ background: accentSoft, border: `1.5px solid ${accent}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Código de acesso</div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 24, fontWeight: 800, color: accent, letterSpacing: '0.08em' }}>{familyCode}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={`https://wa.me/?text=${encodeURIComponent(inviteText())}`} target="_blank" rel="noopener noreferrer" style={{ ...btnSolid('#25D366'), flex: '1 1 130px', textAlign: 'center', textDecoration: 'none' }}>WhatsApp</a>
                  <a href={`sms:?&body=${encodeURIComponent(inviteText())}`} style={{ ...btnGhost(accent), flex: '1 1 90px', textAlign: 'center', textDecoration: 'none' }}>SMS</a>
                  <button onClick={() => { navigator.clipboard?.writeText(inviteText()); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ ...btnGhost(accent), flex: '1 1 90px' }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '12px 0 0', lineHeight: 1.5 }}>A família confirma com os últimos 4 dígitos do telemóvel registado nos contactos — por isso adicione primeiro o contacto com telefone.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editing && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditing(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '88vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>Editar ficha</div>
              <button aria-label="Fechar" onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {patient.photo_url ? (
                <img src={patient.photo_url} alt={patient.name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: accentSoft, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>{patient.name.charAt(0).toUpperCase()}</div>
              )}
              <label style={{ ...btnGhost(accent), cursor: uploadingPhoto ? 'default' : 'pointer', opacity: uploadingPhoto ? 0.6 : 1 }}>
                {uploadingPhoto ? 'A enviar…' : patient.photo_url ? 'Trocar foto' : '+ Foto de perfil'}
                <input type="file" accept="image/*" disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={edit.name || ''} onChange={e => setEdit(p => ({ ...p, name: e.target.value }))} placeholder="Nome" style={inp} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={edit.age ?? ''} onChange={e => setEdit(p => ({ ...p, age: e.target.value as any }))} placeholder="Idade" type="number" style={inp} />
                <select value={edit.sex || ''} onChange={e => setEdit(p => ({ ...p, sex: e.target.value }))} style={{ ...inp, background: 'white' }}><option value="">Sexo</option><option value="M">Masculino</option><option value="F">Feminino</option></select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input value={edit.weight ?? ''} onChange={e => setEdit(p => ({ ...p, weight: e.target.value as any }))} placeholder="Peso kg" type="number" style={inp} />
                <input value={edit.height ?? ''} onChange={e => setEdit(p => ({ ...p, height: e.target.value as any }))} placeholder="Altura cm" type="number" style={inp} />
                <input value={edit.creatinine ?? ''} onChange={e => setEdit(p => ({ ...p, creatinine: e.target.value as any }))} placeholder="Creat." type="number" step="0.01" style={inp} />
              </div>
              <input value={edit.conditions || ''} onChange={e => setEdit(p => ({ ...p, conditions: e.target.value }))} placeholder="Diagnósticos" style={inp} />
              <input value={edit.allergies || ''} onChange={e => setEdit(p => ({ ...p, allergies: e.target.value }))} placeholder="Alergias" style={inp} />
              <input value={edit.address || ''} onChange={e => setEdit(p => ({ ...p, address: e.target.value }))} placeholder={isDayCare ? 'Morada (recolha de transporte)' : 'Morada'} style={inp} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={edit.room_number || ''} onChange={e => setEdit(p => ({ ...p, room_number: e.target.value }))} placeholder={cfg.roomLabel} style={inp} />
                <input value={edit.emergency_contact || ''} onChange={e => setEdit(p => ({ ...p, emergency_contact: e.target.value }))} placeholder="Contacto SOS" style={inp} />
              </div>
              <textarea value={edit.notes || ''} onChange={e => setEdit(p => ({ ...p, notes: e.target.value }))} placeholder="Notas" rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
            {editErr && <div style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626' }}>{editErr}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveEdit} disabled={savingEdit} style={{ ...btnSolid(accent), flex: 1 }}>{savingEdit ? 'A guardar…' : 'Guardar'}</button>
              <button onClick={() => { setEditing(false); setEditErr('') }} style={btnGhost(accent)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

// ── peças ──
function Shell({ children, warm }: { children: React.ReactNode; warm: boolean }) {
  return <div style={{ minHeight: '100vh', background: warm ? '#fbfaf8' : '#f8fafc', fontFamily: 'var(--font-sans)' }}><div style={{ maxWidth: 720, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 70px' }}>{children}</div></div>
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>{children}</div>
}
function CardTitle({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: noMargin ? 0 : 12 }}>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>
}
function Mini({ label, value, accent, alert, warn }: { label: string; value: string; accent?: string; alert?: boolean; warn?: boolean }) {
  const c = alert ? '#991b1b' : warn ? '#b45309' : accent || '#0b1120'
  return <div><div style={{ fontSize: 19, fontWeight: 800, color: c, lineHeight: 1 }}>{value}</div><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{label}</div></div>
}
function Tag({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: bg, borderRadius: 5, padding: '2px 8px' }}>{children}</span>
}
function Empty({ msg }: { msg: string }) { return <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '14px 0' }}>{msg}</div> }

const inp: React.CSSProperties = { border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }
const btnSolid = (a: string): React.CSSProperties => ({ padding: '9px 16px', background: a, color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
const btnGhost = (a: string): React.CSSProperties => ({ padding: '9px 14px', background: 'white', color: a, border: `1.5px solid ${a}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
const chip = (on: boolean, a: string): React.CSSProperties => ({ padding: '7px 12px', borderRadius: 999, border: `1.5px solid ${on ? a : '#e2e8f0'}`, background: on ? '#f0fdfa' : 'white', color: on ? a : '#475569', fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' })
