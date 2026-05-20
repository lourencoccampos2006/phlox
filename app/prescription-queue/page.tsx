'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Fila de Validação Farmacêutica
// Pharmacist prescription review workflow with clinical checking & audit trail
//
// DB Schema required (run in Supabase SQL editor):
//
// CREATE TABLE prescription_queue (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   org_id uuid REFERENCES orgs(id),
//   patient_name text NOT NULL,
//   patient_dob date,
//   patient_weight numeric,
//   ward text, bed text, prescriber text,
//   drug_name text NOT NULL, dose text NOT NULL,
//   route text NOT NULL, frequency text NOT NULL,
//   indication text, duration text,
//   status text DEFAULT 'pending'
//     CHECK (status IN ('pending','reviewing','approved','modified','rejected','on_hold')),
//   reviewer_id uuid REFERENCES profiles(id),
//   reviewed_at timestamptz,
//   intervention_type text, intervention_note text,
//   clinical_checks jsonb,
//   priority text DEFAULT 'normal' CHECK (priority IN ('routine','urgent','stat')),
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX ON prescription_queue (org_id, status, created_at DESC);
// ALTER TABLE prescription_queue ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "org members" ON prescription_queue USING (
//   org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
// );
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type PrescStatus = 'pending' | 'reviewing' | 'approved' | 'modified' | 'rejected' | 'on_hold'
type Priority = 'routine' | 'urgent' | 'stat'

interface ClinicalChecks {
  dose_correct: boolean | null
  route_appropriate: boolean | null
  frequency_correct: boolean | null
  indication_documented: boolean | null
  allergy_checked: boolean | null
  interaction_checked: boolean | null
  renal_adjusted: boolean | null
  duplicate_checked: boolean | null
  legible_complete: boolean | null
}

interface Prescription {
  id: string
  patient_name: string
  patient_dob?: string
  patient_weight?: number
  ward?: string
  bed?: string
  prescriber?: string
  drug_name: string
  dose: string
  route: string
  frequency: string
  indication?: string
  duration?: string
  status: PrescStatus
  reviewer_id?: string
  reviewed_at?: string
  intervention_type?: string
  intervention_note?: string
  clinical_checks?: ClinicalChecks
  priority: Priority
  created_at: string
  org_id: string
}

interface NewRxForm {
  patient_name: string; patient_dob: string; patient_weight: string
  ward: string; bed: string; prescriber: string
  drug_name: string; dose: string; route: string; frequency: string
  indication: string; duration: string; priority: Priority
}

const BLANK_FORM: NewRxForm = {
  patient_name: '', patient_dob: '', patient_weight: '',
  ward: '', bed: '', prescriber: '',
  drug_name: '', dose: '', route: 'oral', frequency: '',
  indication: '', duration: '', priority: 'routine',
}

const BLANK_CHECKS: ClinicalChecks = {
  dose_correct: null, route_appropriate: null, frequency_correct: null,
  indication_documented: null, allergy_checked: null, interaction_checked: null,
  renal_adjusted: null, duplicate_checked: null, legible_complete: null,
}

const STATUS_META: Record<PrescStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pendente',    color: '#ca8a04', bg: '#fef9c3', icon: '🕐' },
  reviewing: { label: 'Em revisão',  color: '#2563eb', bg: '#eff6ff', icon: '🔍' },
  approved:  { label: 'Aprovado',    color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
  modified:  { label: 'Modificado',  color: '#7c3aed', bg: '#faf5ff', icon: '✏️' },
  rejected:  { label: 'Rejeitado',   color: '#dc2626', bg: '#fef2f2', icon: '❌' },
  on_hold:   { label: 'Em espera',   color: '#64748b', bg: '#f8fafc', icon: '⏸' },
}

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  routine: { label: 'Rotina', color: '#64748b' },
  urgent:  { label: 'Urgente', color: '#ca8a04' },
  stat:    { label: 'STAT', color: '#dc2626' },
}

const CHECK_ITEMS: { key: keyof ClinicalChecks; label: string; tooltip: string }[] = [
  { key: 'dose_correct',           label: 'Dose correcta',              tooltip: 'Dose adequada para o peso/função renal/indicação?' },
  { key: 'route_appropriate',      label: 'Via adequada',               tooltip: 'A via de administração é a mais adequada?' },
  { key: 'frequency_correct',      label: 'Frequência correcta',        tooltip: 'A posologia está correcta?' },
  { key: 'indication_documented',  label: 'Indicação documentada',      tooltip: 'A indicação clínica está clara?' },
  { key: 'allergy_checked',        label: 'Alergias verificadas',       tooltip: 'Histórico de alergias verificado?' },
  { key: 'interaction_checked',    label: 'Interações verificadas',     tooltip: 'Interações com medicação actual verificadas?' },
  { key: 'renal_adjusted',         label: 'Ajuste renal avaliado',      tooltip: 'Dose ajustada para função renal se necessário?' },
  { key: 'duplicate_checked',      label: 'Duplicação verificada',      tooltip: 'Sem duplicação terapêutica na medicação actual?' },
  { key: 'legible_complete',       label: 'Prescrição legível/completa',tooltip: 'Prescrição legível com todos os elementos?' },
]

const INTERVENTION_TYPES = [
  'Dose ajustada', 'Via de administração alterada', 'Frequência corrigida',
  'Medicamento substituído por genérico', 'Medicamento substituído por alternativa',
  'Prescrição cancelada (contraindicação)', 'Prescrição cancelada (duplicação)',
  'Prescrição cancelada (alergia)', 'Informação clínica solicitada',
  'Reconciliação de medicação', 'Monitorização recomendada', 'Aconselhamento fornecido',
  'Outro',
]

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_PRESCRIPTIONS: Prescription[] = [
  {
    id: '1', patient_name: 'Maria dos Santos', patient_dob: '1948-03-12', patient_weight: 58,
    ward: 'Medicina A', bed: '204-2', prescriber: 'Dr. Rodrigues',
    drug_name: 'Metformina', dose: '850 mg', route: 'oral', frequency: '2×/dia',
    indication: 'Diabetes tipo 2', duration: 'Crónico',
    status: 'pending', priority: 'routine',
    created_at: new Date(Date.now() - 25 * 60000).toISOString(), org_id: 'demo',
  },
  {
    id: '2', patient_name: 'António Ferreira', patient_dob: '1955-07-22', patient_weight: 82,
    ward: 'UCI', bed: 'UCI-3', prescriber: 'Dra. Costa',
    drug_name: 'Vancomicina', dose: '1500 mg', route: 'IV', frequency: 'q12h',
    indication: 'MRSA bacteriémia', duration: '14 dias',
    status: 'pending', priority: 'stat',
    created_at: new Date(Date.now() - 8 * 60000).toISOString(), org_id: 'demo',
  },
  {
    id: '3', patient_name: 'Fernanda Oliveira', patient_dob: '1932-11-05', patient_weight: 49,
    ward: 'Cardiologia', bed: '318-1', prescriber: 'Dr. Sousa',
    drug_name: 'Digoxina', dose: '250 mcg', route: 'oral', frequency: '1×/dia',
    indication: 'Fibrilhação auricular', duration: 'Crónico',
    status: 'pending', priority: 'urgent',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(), org_id: 'demo',
  },
  {
    id: '4', patient_name: 'João Pereira', patient_dob: '1978-05-14', patient_weight: 75,
    ward: 'Ortopedia', bed: '105-3', prescriber: 'Dr. Almeida',
    drug_name: 'Ibuprofeno', dose: '800 mg', route: 'oral', frequency: '3×/dia',
    indication: 'Dor pós-operatória', duration: '5 dias',
    status: 'approved', priority: 'routine',
    reviewed_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(), org_id: 'demo',
  },
  {
    id: '5', patient_name: 'Rosa Lima', patient_dob: '1961-09-30', patient_weight: 64,
    ward: 'Medicina B', bed: '210-4', prescriber: 'Dr. Santos',
    drug_name: 'Amoxicilina', dose: '1 g', route: 'oral', frequency: '3×/dia',
    indication: 'Pneumonia comunitária', duration: '7 dias',
    status: 'modified', priority: 'urgent',
    intervention_type: 'Dose ajustada',
    intervention_note: 'Dose reduzida para 500 mg 3×/dia por IR ligeira (CrCl 45 mL/min)',
    reviewed_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(), org_id: 'demo',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

function calcAge(dob?: string) {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

function checksAllDone(checks: ClinicalChecks) {
  return Object.values(checks).every(v => v !== null)
}

function checksAllPassed(checks: ClinicalChecks) {
  return Object.values(checks).every(v => v === true)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrescriptionQueue() {
  const { user, supabase } = useAuth()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(DEMO_PRESCRIPTIONS)
  const [selected, setSelected] = useState<Prescription | null>(null)
  const [checks, setChecks] = useState<ClinicalChecks>(BLANK_CHECKS)
  const [interventionType, setInterventionType] = useState('')
  const [interventionNote, setInterventionNote] = useState('')
  const [filterStatus, setFilterStatus] = useState<PrescStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')
  const [showNewRx, setShowNewRx] = useState(false)
  const [newRx, setNewRx] = useState<NewRxForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  // Load from Supabase (if user has org)
  useEffect(() => {
    if (!user || !supabase) return
    supabase
      .from('prescription_queue')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) setPrescriptions(data as Prescription[])
      })
  }, [user, supabase])

  const filtered = useMemo(() => {
    return prescriptions.filter(rx => {
      if (filterStatus !== 'all' && rx.status !== filterStatus) return false
      if (filterPriority !== 'all' && rx.priority !== filterPriority) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        return (
          rx.patient_name.toLowerCase().includes(q) ||
          rx.drug_name.toLowerCase().includes(q) ||
          (rx.ward || '').toLowerCase().includes(q)
        )
      }
      return true
    }).sort((a, b) => {
      const pOrder = { stat: 0, urgent: 1, routine: 2 }
      const sOrder = { pending: 0, reviewing: 1, on_hold: 2, approved: 3, modified: 4, rejected: 5 }
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority]
      return sOrder[a.status as PrescStatus] - sOrder[b.status as PrescStatus]
    })
  }, [prescriptions, filterStatus, filterPriority, searchQ])

  const stats = useMemo(() => ({
    pending:   prescriptions.filter(r => r.status === 'pending').length,
    reviewing: prescriptions.filter(r => r.status === 'reviewing').length,
    stat:      prescriptions.filter(r => r.priority === 'stat' && r.status === 'pending').length,
    done_today: prescriptions.filter(r => {
      if (!r.reviewed_at) return false
      return new Date(r.reviewed_at).toDateString() === new Date().toDateString()
    }).length,
    intervention_rate: (() => {
      const reviewed = prescriptions.filter(r => r.reviewed_at)
      if (!reviewed.length) return 0
      const with_intervention = reviewed.filter(r => r.status === 'modified' || r.status === 'rejected')
      return Math.round((with_intervention.length / reviewed.length) * 100)
    })(),
  }), [prescriptions])

  const handleSelect = useCallback((rx: Prescription) => {
    setSelected(rx)
    setChecks(rx.clinical_checks ?? BLANK_CHECKS)
    setInterventionType(rx.intervention_type ?? '')
    setInterventionNote(rx.intervention_note ?? '')
    // Mark as reviewing
    if (rx.status === 'pending') {
      const updated = { ...rx, status: 'reviewing' as PrescStatus }
      setPrescriptions(p => p.map(r => r.id === rx.id ? updated : r))
      if (user && supabase) {
        supabase.from('prescription_queue').update({ status: 'reviewing', reviewer_id: user.id }).eq('id', rx.id)
      }
    }
  }, [user, supabase])

  const handleDecision = useCallback(async (decision: PrescStatus) => {
    if (!selected) return
    setSaving(true)
    const update: Partial<Prescription> = {
      status: decision,
      reviewed_at: new Date().toISOString(),
      clinical_checks: checks,
      intervention_type: interventionType || undefined,
      intervention_note: interventionNote || undefined,
      reviewer_id: user?.id,
    }
    setPrescriptions(p => p.map(r => r.id === selected.id ? { ...r, ...update } : r))
    if (user && supabase) {
      await supabase.from('prescription_queue').update(update).eq('id', selected.id)
    }
    setSelected(null)
    setSaving(false)
  }, [selected, checks, interventionType, interventionNote, user, supabase])

  const handleAddRx = useCallback(async () => {
    if (!newRx.patient_name || !newRx.drug_name || !newRx.dose) return
    setSaving(true)
    const rx: Prescription = {
      id: Math.random().toString(36).slice(2),
      ...newRx,
      patient_weight: newRx.patient_weight ? +newRx.patient_weight : undefined,
      status: 'pending',
      created_at: new Date().toISOString(),
      org_id: (user as any)?.org_id ?? 'demo',
    }
    setPrescriptions(p => [rx, ...p])
    if (user && supabase) {
      await supabase.from('prescription_queue').insert([{ ...rx, id: undefined }])
    }
    setNewRx(BLANK_FORM)
    setShowNewRx(false)
    setSaving(false)
  }, [newRx, user, supabase])

  const upN = <K extends keyof NewRxForm>(k: K) => (v: NewRxForm[K]) => setNewRx(f => ({ ...f, [k]: v }))

  const toggleCheck = (key: keyof ClinicalChecks, val: boolean) => {
    setChecks(c => ({ ...c, [key]: c[key] === val ? null : val }))
  }

  const checksProgress = Object.values(checks).filter(v => v !== null).length
  const allChecked = checksAllDone(checks)
  const allPassed = checksAllPassed(checks)
  const hasFailed = Object.values(checks).some(v => v === false)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '14px 20px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: 'white', margin: 0 }}>
              Fila de Validação Farmacêutica
            </h1>
            <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
              Revisão clínica · Intervenção · Audit trail
            </p>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {[
              { label: 'STAT pendentes', value: stats.stat, color: '#dc2626' },
              { label: 'Pendentes', value: stats.pending, color: '#ca8a04' },
              { label: 'Em revisão', value: stats.reviewing, color: '#2563eb' },
              { label: 'Validados hoje', value: stats.done_today, color: '#16a34a' },
              { label: 'Taxa intervenção', value: `${stats.intervention_rate}%`, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '6px 12px', background: '#1e293b', borderRadius: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowNewRx(true)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#0d9488', color: 'white', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>
            + Nova prescrição
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Queue list ──────────────────────────────────────────────── */}
        <div style={{ width: 380, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: 'white' }}>

          {/* Filters */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="🔍 Pesquisar doente ou medicamento…"
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8,
                border: '1px solid #e2e8f0', fontSize: 12, background: '#f8fafc',
                color: '#0f172a', fontFamily: 'inherit', outline: 'none',
                marginBottom: 8, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 5 }}>
              {(['all', 'pending', 'reviewing', 'approved', 'modified', 'rejected'] as const).map(s => {
                const meta = s === 'all' ? null : STATUS_META[s]
                const count = s === 'all' ? prescriptions.length : prescriptions.filter(r => r.status === s).length
                return (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{
                    padding: '3px 7px', borderRadius: 5, border: `1px solid ${filterStatus === s ? (meta?.color ?? '#0d9488') : '#e2e8f0'}`,
                    background: filterStatus === s ? ((meta?.bg ?? '#f0fdfa')) : 'white', cursor: 'pointer',
                    fontSize: 10, fontWeight: filterStatus === s ? 700 : 500,
                    color: filterStatus === s ? (meta?.color ?? '#0d9488') : '#64748b', fontFamily: 'inherit',
                  }}>
                    {s === 'all' ? 'Tudo' : meta?.icon} {count}
                  </button>
                )
              })}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Nenhuma prescrição encontrada
              </div>
            ) : (
              filtered.map(rx => {
                const meta = STATUS_META[rx.status]
                const pm = PRIORITY_META[rx.priority]
                const age = calcAge(rx.patient_dob)
                const isSelected = selected?.id === rx.id
                return (
                  <div key={rx.id} onClick={() => handleSelect(rx)} style={{
                    padding: '12px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                    background: isSelected ? '#f0fdfa' : 'white',
                    borderLeft: `3px solid ${isSelected ? '#0d9488' : rx.priority === 'stat' ? '#dc2626' : rx.priority === 'urgent' ? '#ca8a04' : 'transparent'}`,
                    transition: 'all 0.1s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{rx.patient_name}</span>
                        {age !== null && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 5 }}>{age}a</span>}
                        {rx.ward && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 5 }}>{rx.ward}{rx.bed ? ` · ${rx.bed}` : ''}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: pm.color, background: `${pm.color}15`, padding: '1px 5px', borderRadius: 3 }}>
                          {pm.label}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, background: meta.bg, padding: '1px 5px', borderRadius: 3 }}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                      {rx.drug_name} {rx.dose} — {rx.route} {rx.frequency}
                    </div>
                    {rx.indication && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{rx.indication}</div>}
                    <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 3 }}>
                      {rx.prescriber && `Dr. ${rx.prescriber} · `}{timeAgo(rx.created_at)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Review panel ────────────────────────────────────────────── */}
        {selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  {selected.patient_name}
                  {calcAge(selected.patient_dob) !== null && <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>{calcAge(selected.patient_dob)} anos</span>}
                  {selected.patient_weight && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 6 }}>{selected.patient_weight} kg</span>}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {selected.ward}{selected.bed && ` · Cama ${selected.bed}`} · Médico: {selected.prescriber || '—'}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{
                width: 28, height: 28, borderRadius: 7, background: '#f1f5f9', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Prescription details */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📋 Prescrição
                    <span style={{ fontSize: 9, fontWeight: 700, color: PRIORITY_META[selected.priority].color, background: `${PRIORITY_META[selected.priority].color}15`, padding: '1px 6px', borderRadius: 3, marginLeft: 'auto' }}>
                      {PRIORITY_META[selected.priority].label}
                    </span>
                  </div>
                  {[
                    { l: 'Medicamento', v: selected.drug_name, bold: true },
                    { l: 'Dose', v: selected.dose, bold: true },
                    { l: 'Via', v: selected.route },
                    { l: 'Frequência', v: selected.frequency },
                    { l: 'Indicação', v: selected.indication ?? '—' },
                    { l: 'Duração', v: selected.duration ?? '—' },
                    { l: 'Prescrito', v: timeAgo(selected.created_at) },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>{r.l}</span>
                      <span style={{ fontWeight: r.bold ? 700 : 500, color: '#0f172a' }}>{r.v}</span>
                    </div>
                  ))}
                </div>

                {/* Clinical Checklist */}
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    ✅ Verificação Clínica
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>{checksProgress}/9</span>
                  </div>
                  <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${(checksProgress / 9) * 100}%`, height: '100%', background: hasFailed ? '#dc2626' : allChecked ? '#16a34a' : '#2563eb', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {CHECK_ITEMS.map(item => {
                      const val = checks[item.key]
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <button onClick={() => toggleCheck(item.key, true)} title="OK" style={{
                            width: 22, height: 22, borderRadius: 5, border: `1px solid ${val === true ? '#16a34a' : '#e2e8f0'}`,
                            background: val === true ? '#16a34a' : 'white', cursor: 'pointer',
                            color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✓</button>
                          <button onClick={() => toggleCheck(item.key, false)} title="Problema" style={{
                            width: 22, height: 22, borderRadius: 5, border: `1px solid ${val === false ? '#dc2626' : '#e2e8f0'}`,
                            background: val === false ? '#dc2626' : 'white', cursor: 'pointer',
                            color: 'white', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✗</button>
                          <span style={{ fontSize: 11, color: val === false ? '#dc2626' : val === true ? '#16a34a' : '#374151', fontWeight: val !== null ? 600 : 400 }} title={item.tooltip}>
                            {item.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Intervention */}
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>📝 Intervenção Farmacêutica</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Tipo de intervenção</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <button onClick={() => setInterventionType('')} style={{
                      padding: '4px 9px', borderRadius: 6, border: `1px solid ${!interventionType ? '#0d9488' : '#e2e8f0'}`,
                      background: !interventionType ? '#f0fdfa' : 'white', cursor: 'pointer',
                      fontSize: 11, color: !interventionType ? '#0d9488' : '#64748b', fontFamily: 'inherit',
                    }}>Nenhuma</button>
                    {INTERVENTION_TYPES.map(t => (
                      <button key={t} onClick={() => setInterventionType(t)} style={{
                        padding: '4px 9px', borderRadius: 6, border: `1px solid ${interventionType === t ? '#7c3aed' : '#e2e8f0'}`,
                        background: interventionType === t ? '#faf5ff' : 'white', cursor: 'pointer',
                        fontSize: 11, color: interventionType === t ? '#7c3aed' : '#64748b', fontFamily: 'inherit',
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Nota de intervenção</label>
                  <textarea
                    value={interventionNote}
                    onChange={e => setInterventionNote(e.target.value)}
                    placeholder="Descreva a intervenção realizada, fundamentação clínica e acção tomada…"
                    rows={3}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
                      fontSize: 12, resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                      boxSizing: 'border-box', color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              {/* Decision buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={saving || !allChecked || hasFailed}
                  onClick={() => handleDecision(interventionType ? 'modified' : 'approved')}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 9, border: 'none',
                    background: !allChecked || hasFailed ? '#f1f5f9' : '#16a34a',
                    color: !allChecked || hasFailed ? '#94a3b8' : 'white',
                    cursor: !allChecked || hasFailed ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  {interventionType ? '✏️ Aprovar com modificação' : '✅ Aprovar prescrição'}
                </button>
                <button
                  disabled={saving}
                  onClick={() => handleDecision('rejected')}
                  style={{
                    padding: '11px 18px', borderRadius: 9, border: '1px solid #fecaca',
                    background: '#fef2f2', color: '#dc2626',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  ❌ Rejeitar
                </button>
                <button
                  disabled={saving}
                  onClick={() => handleDecision('on_hold')}
                  style={{
                    padding: '11px 14px', borderRadius: 9, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#64748b',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  ⏸
                </button>
              </div>

              {!allChecked && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                  Complete todos os itens da verificação clínica para aprovar ({checksProgress}/9)
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>Seleccionar prescrição para validar</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Clique numa prescrição na lista para iniciar a revisão</div>
          </div>
        )}
      </div>

      {/* New Rx Modal */}
      {showNewRx && (
        <>
          <div onClick={() => setShowNewRx(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(600px, 94vw)', background: 'white', borderRadius: 16,
            boxShadow: '0 24px 80px rgba(0,0,0,0.18)', zIndex: 201, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Nova Prescrição</div>
              <button onClick={() => setShowNewRx(false)} style={{ width: 28, height: 28, borderRadius: 7, background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {[
                  { k: 'patient_name' as const, l: 'Nome do doente*', p: 'Maria Silva' },
                  { k: 'patient_dob' as const, l: 'Data nascimento', p: '', t: 'date' },
                  { k: 'patient_weight' as const, l: 'Peso (kg)', p: '70' },
                  { k: 'ward' as const, l: 'Serviço/Enfermaria', p: 'Medicina A' },
                  { k: 'bed' as const, l: 'Cama', p: '204-1' },
                  { k: 'prescriber' as const, l: 'Médico prescritor', p: 'Dr. Silva' },
                  { k: 'drug_name' as const, l: 'Medicamento*', p: 'Amoxicilina' },
                  { k: 'dose' as const, l: 'Dose*', p: '500 mg' },
                  { k: 'route' as const, l: 'Via*', p: 'oral' },
                  { k: 'frequency' as const, l: 'Frequência*', p: '3×/dia' },
                  { k: 'indication' as const, l: 'Indicação', p: 'Infecção urinária' },
                  { k: 'duration' as const, l: 'Duração', p: '7 dias' },
                ].map(f => (
                  <div key={f.k} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.l}</label>
                    <input
                      type={f.t || 'text'}
                      value={newRx[f.k] as string}
                      onChange={e => upN(f.k)(e.target.value as any)}
                      placeholder={f.p}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prioridade</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['routine', 'urgent', 'stat'] as Priority[]).map(pr => (
                    <button key={pr} onClick={() => upN('priority')(pr)} style={{
                      flex: 1, padding: '7px', borderRadius: 7,
                      border: `1px solid ${newRx.priority === pr ? PRIORITY_META[pr].color : '#e2e8f0'}`,
                      background: newRx.priority === pr ? `${PRIORITY_META[pr].color}12` : 'white',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      color: newRx.priority === pr ? PRIORITY_META[pr].color : '#64748b', fontFamily: 'inherit',
                    }}>
                      {PRIORITY_META[pr].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewRx(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button
                onClick={handleAddRx}
                disabled={saving || !newRx.patient_name || !newRx.drug_name || !newRx.dose}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: !newRx.patient_name || !newRx.drug_name ? '#f1f5f9' : '#0d9488',
                  color: !newRx.patient_name || !newRx.drug_name ? '#94a3b8' : 'white',
                  cursor: !newRx.patient_name || !newRx.drug_name ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                Adicionar à fila
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
