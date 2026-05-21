'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs, ROLE_META, INST_META, type ClinicalRole, type InstitutionType } from '@/lib/useClinicPrefs'

type AlertLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Alert {
  id: string; level: AlertLevel; title: string; body: string
  action_label?: string; action_href?: string; time?: string
}

interface Task {
  id: string; priority: 'urgent' | 'normal' | 'low'
  title: string; detail?: string; category: 'clinical' | 'admin' | 'quality' | 'team'
  action_href?: string; due?: string
}

interface TeamMember {
  id: string; name: string; role: string | null
  status: 'on_shift' | 'break' | 'off' | 'sick' | 'vacation'
  unit: string | null; shift: string | null
}

interface Shortage {
  id: string; drug: string; severity: string; since: string | null
  expected_resolution: string | null; alternatives: string[]
  affected_units: string[]; reason: string | null; generic: string | null
}

interface SafetyEvent {
  id: string; type: string | null; severity: string | null
  unit: string | null; description: string | null; drug: string | null
  status: string; harm: boolean; date: string
}

interface Intervention {
  id: string; type: string | null; count: number; accepted: number
  value_eur: number; date: string
}

interface Training {
  id: string; name: string; category: string | null; date: string | null
  mandatory: boolean; seats_total: number; seats_taken: number
}

interface MarRecord {
  id: string; patient_id: string; shift: string; date: string
  status: 'administered' | 'refused' | 'held' | null
}
interface CareRecordLight { id: string; patient_id: string; shift: string; date: string }
interface AssessmentLight { id: string; patient_id: string; scale: string; score: number; date: string }

const INST_QUICK_TOOLS: Record<InstitutionType, { icon: string; label: string; href: string }[]> = {
  hospital: [
    { icon: '🔬', label: 'Console PK',    href: '/pk-dosing' },
    { icon: '💉', label: 'Antibióticos',  href: '/antibiotics' },
    { icon: '🧴', label: 'Nutrição NP',   href: '/tpn' },
    { icon: '🚨', label: 'Urgência',      href: '/emergency-doses' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
  pharmacy_hospital: [
    { icon: '🔬', label: 'Console PK',    href: '/pk-dosing' },
    { icon: '🧪', label: 'IV Compat.',    href: '/iv-compatibility' },
    { icon: '🧴', label: 'Nutrição NP',   href: '/tpn' },
    { icon: '🚨', label: 'Urgência',      href: '/emergency-doses' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
  pharmacy_community: [
    { icon: '🔍', label: 'Interações',    href: '/interactions' },
    { icon: '📋', label: 'Aconselhamento',href: '/counseling' },
    { icon: '💊', label: 'Info Fármaco',  href: '/drug-info' },
    { icon: '🔄', label: 'Reconciliação', href: '/reconciliacao' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
  nursing_home: [
    { icon: '📋', label: 'Avaliações',    href: '/assessments' },
    { icon: '📓', label: 'Reg. Diários',  href: '/care-log' },
    { icon: '🔁', label: 'Pass. Turno',   href: '/handover' },
    { icon: '🛑', label: 'STOPP/START',   href: '/stopp-start' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
  clinic: [
    { icon: '🔍', label: 'Interações',    href: '/interactions' },
    { icon: '🔄', label: 'Reconciliação', href: '/reconciliacao' },
    { icon: '💊', label: 'Info Fármaco',  href: '/drug-info' },
    { icon: '🗒️', label: 'Nota Clínica', href: '/nota-clinica' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
  health_center: [
    { icon: '🔍', label: 'Interações',    href: '/interactions' },
    { icon: '🔄', label: 'Reconciliação', href: '/reconciliacao' },
    { icon: '💊', label: 'Info Fármaco',  href: '/drug-info' },
    { icon: '🗒️', label: 'Nota Clínica', href: '/nota-clinica' },
    { icon: '⚠️', label: 'Notif. RAM',    href: '/adr-report' },
    { icon: '🔗', label: 'Connect',       href: '/connect' },
  ],
}

const ALERT_META: Record<AlertLevel, { color: string; bg: string; border: string; icon: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🚨', label: 'CRÍTICO' },
  high:     { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', icon: '🔴', label: 'ALTO' },
  medium:   { color: '#ca8a04', bg: '#fffbeb', border: '#fde68a', icon: '🟡', label: 'ATENÇÃO' },
  low:      { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '🔵', label: 'INFO' },
  info:     { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', icon: '💡', label: 'INFO' },
}

function formatDate(d: string | null) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) } catch { return d }
}

function daysUntil(d: string | null) {
  if (!d) return null
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  return diff
}

export default function Cockpit() {
  const { user, supabase } = useAuth() as any
  const { role, institution, setRole, setInstitution } = useClinicPrefs()
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  const [team, setTeam] = useState<TeamMember[]>([])
  const [shortages, setShortages] = useState<Shortage[]>([])
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [patientCount, setPatientCount] = useState<number>(0)
  const [marRecords, setMarRecords] = useState<MarRecord[]>([])
  const [careRecordsToday, setCareRecordsToday] = useState<CareRecordLight[]>([])
  const [assessmentsRecent, setAssessmentsRecent] = useState<AssessmentLight[]>([])

  // Sync role from org profile on first load (only if not already set by user)
  useEffect(() => {
    if (user) {
      const orgRole = (user as any).org_role
      const saved = localStorage.getItem('phlox-clinic-role')
      if (!saved && orgRole) {
        const map: Record<string, ClinicalRole> = { admin: 'pharmacist_director', nurse: 'nurse', coordinator: 'coordinator', pharmacist: 'pharmacist' }
        if (map[orgRole]) setRole(map[orgRole])
      }
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !supabase) return
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    Promise.all([
      supabase.from('team_members').select('id,name,role,status,unit,shift').eq('user_id', user.id),
      supabase.from('drug_shortages').select('id,drug,generic,severity,since,expected_resolution,alternatives,affected_units,reason').eq('user_id', user.id).neq('severity', 'resolved'),
      supabase.from('safety_events').select('id,type,severity,unit,description,drug,status,harm,date').eq('user_id', user.id).neq('status', 'closed'),
      supabase.from('pharma_interventions').select('id,type,count,accepted,value_eur,date').eq('user_id', user.id).gte('date', monthStart),
      supabase.from('training_sessions').select('id,name,category,date,mandatory,seats_total,seats_taken').eq('user_id', user.id).gte('date', today).order('date'),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([t, s, e, i, tr, p]) => {
      setTeam(t.data ?? [])
      setShortages(s.data ?? [])
      setSafetyEvents(e.data ?? [])
      setInterventions(i.data ?? [])
      setTrainings(tr.data ?? [])
      setPatientCount(p.count ?? 0)
      setLoading(false)
    })
  }, [user, supabase])

  useEffect(() => {
    if (!user || !supabase || institution !== 'nursing_home') return
    const today = new Date().toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    Promise.all([
      supabase.from('mar_records').select('id,patient_id,shift,date,status').eq('user_id', user.id).eq('date', today),
      supabase.from('care_records').select('id,patient_id,shift,date').eq('user_id', user.id).eq('date', today),
      supabase.from('assessments').select('id,patient_id,scale,score,date').eq('user_id', user.id).gte('date', monthAgo),
    ]).then(([mar, care, assess]) => {
      setMarRecords(mar.data ?? [])
      setCareRecordsToday(care.data ?? [])
      setAssessmentsRecent(assess.data ?? [])
    })
  }, [user, supabase, institution])

  const alerts = useMemo((): Alert[] => {
    const list: Alert[] = []
    for (const s of shortages) {
      if (s.severity === 'critical') {
        list.push({
          id: `shortage-${s.id}`, level: 'critical',
          title: `Rutura crítica — ${s.drug}`,
          body: s.alternatives?.length ? `Alternativas: ${s.alternatives.join(', ')}` : (s.reason ?? 'Sem alternativas registadas'),
          action_label: 'Gerir formulário', action_href: '/drug-intelligence',
          time: s.since ? `desde ${formatDate(s.since)}` : undefined,
        })
      } else if (s.severity === 'severe') {
        list.push({
          id: `shortage-${s.id}`, level: 'high',
          title: `Rutura grave — ${s.drug}`,
          body: s.alternatives?.length ? `Alternativas: ${s.alternatives.join(', ')}` : (s.reason ?? ''),
          action_label: 'Ver farmacoterapia', action_href: '/drug-intelligence',
          time: s.since ? `desde ${formatDate(s.since)}` : undefined,
        })
      }
    }
    for (const ev of safetyEvents) {
      const isHigh = ev.severity === 'critical' || ev.harm
      list.push({
        id: `event-${ev.id}`,
        level: isHigh ? 'critical' : ev.severity === 'high' ? 'high' : 'medium',
        title: `Evento de segurança${ev.type ? ` — ${ev.type}` : ''}`,
        body: ev.description ?? (ev.drug ? `Medicamento envolvido: ${ev.drug}` : 'Sem descrição'),
        action_label: 'Ver qualidade', action_href: '/quality',
        time: formatDate(ev.date),
      })
    }
    return list.filter(a => !dismissedAlerts.has(a.id))
  }, [shortages, safetyEvents, dismissedAlerts])

  const tasks = useMemo((): Task[] => {
    const list: Task[] = []
    for (const s of shortages.filter(x => x.severity === 'critical' || x.severity === 'severe')) {
      list.push({
        id: `task-shortage-${s.id}`,
        priority: s.severity === 'critical' ? 'urgent' : 'normal',
        title: `Gerir rutura: ${s.drug}`,
        detail: s.alternatives?.length ? `Alternativas disponíveis: ${s.alternatives.join(', ')}` : 'Identificar alternativas terapêuticas',
        category: 'clinical', action_href: '/drug-intelligence',
      })
    }
    for (const ev of safetyEvents.filter(e => e.status === 'open')) {
      list.push({
        id: `task-event-${ev.id}`,
        priority: ev.harm ? 'urgent' : 'normal',
        title: `Investigar evento: ${ev.type ?? 'Evento adverso'}`,
        detail: ev.description ?? (ev.unit ? `Serviço: ${ev.unit}` : undefined),
        category: 'quality', action_href: '/quality',
        due: formatDate(ev.date),
      })
    }
    for (const tr of trainings.filter(t => t.mandatory)) {
      const days = daysUntil(tr.date)
      if (days !== null && days <= 14) {
        list.push({
          id: `task-training-${tr.id}`,
          priority: days <= 3 ? 'urgent' : 'low',
          title: `Formação obrigatória: ${tr.name}`,
          detail: `${tr.seats_total - tr.seats_taken} vagas restantes`,
          category: 'team',
          due: tr.date ? formatDate(tr.date) : undefined,
        })
      }
    }
    if (institution === 'nursing_home') {
      const h = new Date().getHours()
      const shiftKey = h >= 7 && h < 14 ? 'manha' : h >= 14 && h < 21 ? 'tarde' : 'noite'
      const shiftLabel = shiftKey === 'manha' ? 'Manhã' : shiftKey === 'tarde' ? 'Tarde' : 'Noite'
      const assessedIds = new Set(assessmentsRecent.map(a => a.patient_id))
      const unassessed = Math.max(0, patientCount - assessedIds.size)
      const careThisShift = careRecordsToday.filter(c => c.shift === shiftKey).length
      const marDone = marRecords.filter(m => m.status === 'administered').length
      const marTotal = marRecords.length
      if (unassessed > 0) {
        list.push({ id: 'nh-assessments', priority: unassessed > 3 ? 'urgent' : 'normal', title: `Avaliar residentes: ${unassessed} sem avaliação nos últimos 30 dias`, category: 'clinical', action_href: '/assessments' })
      }
      if (patientCount > 0 && careThisShift < patientCount * 0.8) {
        list.push({ id: 'nh-care', priority: 'normal', title: `Completar registos do turno ${shiftLabel}`, detail: `${patientCount - careThisShift} de ${patientCount} residentes sem registo diário`, category: 'clinical', action_href: '/care-log' })
      }
      if (marTotal > 0 && marDone < marTotal) {
        list.push({ id: 'nh-mar', priority: marDone < marTotal * 0.5 ? 'urgent' : 'normal', title: `MAR: ${marTotal - marDone} dose${marTotal - marDone !== 1 ? 's' : ''} não registada${marTotal - marDone !== 1 ? 's' : ''}`, detail: `${marDone}/${marTotal} doses registadas hoje`, category: 'clinical', action_href: '/mar' })
      }
    }
    return list.filter(t => !completedTasks.has(t.id))
  }, [shortages, safetyEvents, trainings, completedTasks, institution, assessmentsRecent, careRecordsToday, marRecords, patientCount])

  const metrics = useMemo(() => {
    const onShift = team.filter(m => m.status === 'on_shift').length
    const criticalShortages = shortages.filter(s => s.severity === 'critical').length
    const openEvents = safetyEvents.filter(e => e.status === 'open').length
    const totalInterventions = interventions.reduce((s, i) => s + i.count, 0)
    const totalValue = interventions.reduce((s, i) => s + i.value_eur, 0)
    const acceptedInterventions = interventions.reduce((s, i) => s + i.accepted, 0)
    const acceptRate = totalInterventions > 0 ? Math.round((acceptedInterventions / totalInterventions) * 100) : 0
    const nextTraining = trainings.find(t => t.mandatory)

    const patientLabel = institution === 'nursing_home' ? 'Residentes' : institution === 'pharmacy_community' ? 'Clientes' : institution === 'health_center' ? 'Utentes' : 'Doentes'
    return [
      { label: patientLabel, value: patientCount, sub: patientCount > 0 ? 'Registados no sistema' : 'Adicionar o primeiro →', color: '#1d4ed8', bg: '#eff6ff', action_href: '/patients', icon: '🗂️' },
      { label: 'Equipa de turno', value: team.length ? `${onShift}/${team.length}` : '—', sub: `${team.length - onShift} fora de turno`, color: onShift < team.length * 0.7 ? '#dc2626' : '#16a34a', bg: '#f0fdf4', action_href: '/team', icon: '👥' },
      { label: 'Ruturas activas', value: shortages.length, sub: criticalShortages > 0 ? `${criticalShortages} crítica${criticalShortages !== 1 ? 's' : ''}` : 'Sem ruturas críticas', color: criticalShortages > 0 ? '#dc2626' : '#ca8a04', bg: criticalShortages > 0 ? '#fef2f2' : '#fffbeb', action_href: '/drug-intelligence', icon: '⚠️' },
      { label: 'Eventos de segurança', value: openEvents, sub: openEvents > 0 ? 'Pendentes de revisão' : 'Sem eventos pendentes', color: openEvents > 0 ? '#ea580c' : '#16a34a', bg: openEvents > 0 ? '#fff7ed' : '#f0fdf4', action_href: '/quality', icon: '🛡️' },
      { label: 'Intervenções (mês)', value: totalInterventions, sub: totalInterventions > 0 ? `${acceptRate}% aceites · €${totalValue.toFixed(0)}` : 'Nenhuma registada', color: '#2563eb', bg: '#eff6ff', action_href: '/quality', icon: '📊' },
      { label: 'Próxima formação', value: nextTraining ? (daysUntil(nextTraining.date) ?? '—') : '—', unit: nextTraining ? ' dias' : '', sub: nextTraining ? nextTraining.name : 'Nenhuma obrigatória pendente', color: '#7c3aed', bg: '#faf5ff', action_href: '/team', icon: '🎓' },
    ]
  }, [team, shortages, safetyEvents, interventions, trainings])

  const nursingMetrics = useMemo(() => {
    if (institution !== 'nursing_home') return []
    const h = new Date().getHours()
    const shiftKey = h >= 7 && h < 14 ? 'manha' : h >= 14 && h < 21 ? 'tarde' : 'noite'
    const shiftLabel = shiftKey === 'manha' ? 'Manhã' : shiftKey === 'tarde' ? 'Tarde' : 'Noite'
    const marTotal = marRecords.length
    const marDone = marRecords.filter(m => m.status === 'administered').length
    const marPct = marTotal > 0 ? Math.round((marDone / marTotal) * 100) : null
    const careThisShift = careRecordsToday.filter(c => c.shift === shiftKey).length
    const carePct = patientCount > 0 ? Math.round((careThisShift / patientCount) * 100) : 0
    const assessedIds = new Set(assessmentsRecent.map(a => a.patient_id))
    const unassessed = Math.max(0, patientCount - assessedIds.size)
    const highRiskIds = new Set(assessmentsRecent.filter(a =>
      (a.scale === 'barthel' && a.score <= 60) ||
      (a.scale === 'morse' && a.score >= 25) ||
      (a.scale === 'braden' && a.score <= 14)
    ).map(a => a.patient_id))
    const onShift = team.filter(m => m.status === 'on_shift').length
    return [
      { label: 'Residentes', value: patientCount, unit: '', sub: patientCount > 0 ? 'No sistema' : 'Adicionar primeiro →', color: '#1d4ed8', bg: '#eff6ff', action_href: '/patients', icon: '🏠' },
      { label: 'MAR hoje', value: marTotal > 0 ? `${marDone}/${marTotal}` : '—', unit: '', sub: marPct !== null ? `${marPct}% administradas` : 'Sem registos MAR', color: marPct !== null && marPct < 80 ? '#dc2626' : '#16a34a', bg: marPct !== null && marPct < 80 ? '#fef2f2' : '#f0fdf4', action_href: '/mar', icon: '💊' },
      { label: `Reg. ${shiftLabel}`, value: careThisShift, unit: '', sub: patientCount > 0 ? `${carePct}% completos` : 'Sem residentes', color: carePct >= 80 ? '#16a34a' : '#ca8a04', bg: carePct >= 80 ? '#f0fdf4' : '#fffbeb', action_href: '/care-log', icon: '📓' },
      { label: 'Aval. pendentes', value: unassessed, unit: '', sub: unassessed > 0 ? 'Sem avaliação (30d)' : 'Todos avaliados', color: unassessed > 0 ? '#ea580c' : '#16a34a', bg: unassessed > 0 ? '#fff7ed' : '#f0fdf4', action_href: '/assessments', icon: '📋' },
      { label: 'Alto risco', value: highRiskIds.size, unit: '', sub: highRiskIds.size > 0 ? 'Requer atenção esp.' : 'Sem alto risco', color: highRiskIds.size > 0 ? '#7c3aed' : '#16a34a', bg: highRiskIds.size > 0 ? '#faf5ff' : '#f0fdf4', action_href: '/assessments', icon: '⚠️' },
      { label: 'Equipa turno', value: team.length ? `${onShift}/${team.length}` : '—', unit: '', sub: `Turno ${shiftLabel}`, color: '#0d9488', bg: '#f0fdfa', action_href: '/team', icon: '👥' },
    ]
  }, [institution, patientCount, marRecords, careRecordsToday, assessmentsRecent, team])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const roleMeta = ROLE_META[role]
  const instMeta = INST_META[institution]
  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const highCount = alerts.filter(a => a.level === 'high').length

  const teamOnShift = team.filter(m => m.status === 'on_shift')
  const teamOther = team.filter(m => m.status !== 'on_shift').slice(0, 3)
  const displayTeam = [...teamOnShift, ...teamOther].slice(0, 6)

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Command Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px' }}>

          {/* Row 1: greeting + status badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: 2 }}>
                {greeting}{user ? `, ${(user as any).name?.split(' ')[0] ?? ''}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize' }}>{dateStr}</div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {criticalCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#dc262618', border: '1px solid #dc262640', borderRadius: 20 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>{criticalCount} crítico{criticalCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {highCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#ea580c12', border: '1px solid #ea580c30', borderRadius: 20 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>{highCount} {highCount !== 1 ? 'alertas' : 'alerta'}</span>
                </div>
              )}
              {!loading && criticalCount === 0 && highCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#16a34a12', border: '1px solid #16a34a30', borderRadius: 20 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Tudo em ordem</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: role/institution + quick links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setShowRoleSelector(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155',
              cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleMeta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: roleMeta.color }}>{roleMeta.label}</span>
              <span style={{ fontSize: 11, color: '#475569' }}>· {instMeta.label}</span>
              <span style={{ fontSize: 10, color: '#475569' }}>▾</span>
            </button>

            <div className="cockpit-quick-links">
              {((): { label: string; href: string }[] => {
                if (institution === 'pharmacy_community') return [
                  { label: 'Clientes', href: '/patients' },
                  { label: 'Interações', href: '/interactions' },
                  { label: 'Connect', href: '/connect' },
                ]
                if (institution === 'nursing_home') return [
                  { label: 'Residentes', href: '/patients' },
                  { label: 'MAR', href: '/mar' },
                  { label: 'Avaliações', href: '/assessments' },
                  { label: 'Reg. Diários', href: '/care-log' },
                  { label: 'Pass. Turno', href: '/handover' },
                ]
                return [
                  { label: 'Doentes', href: '/patients' },
                  { label: 'MAR', href: '/mar' },
                  { label: 'Ronda', href: '/rounds' },
                  { label: 'Connect', href: '/connect' },
                ]
              })().map(l => (
                <Link key={l.href} href={l.href} style={{
                  padding: '6px 12px',
                  background: 'transparent', border: '1px solid #334155', borderRadius: 8,
                  textDecoration: 'none', fontSize: 12, fontWeight: 600, color: '#94a3b8',
                  whiteSpace: 'nowrap', transition: 'all 0.1s',
                }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {showRoleSelector && (
            <div style={{ marginTop: 12, padding: '14px 16px', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Função</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(Object.entries(ROLE_META) as [ClinicalRole, typeof ROLE_META[ClinicalRole]][]).map(([id, m]) => (
                      <button key={id} onClick={() => { setRole(id); setShowRoleSelector(false) }} style={{
                        padding: '5px 10px', borderRadius: 7, border: `1px solid ${role === id ? m.color : '#334155'}`,
                        background: role === id ? `${m.color}20` : 'transparent', cursor: 'pointer',
                        fontSize: 11, fontWeight: role === id ? 700 : 500, color: role === id ? m.color : '#64748b', fontFamily: 'inherit',
                      }}>{m.icon} {m.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tipo de Instituição</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(Object.entries(INST_META) as [InstitutionType, typeof INST_META[InstitutionType]][]).map(([id, m]) => (
                      <button key={id} onClick={() => { setInstitution(id); setShowRoleSelector(false) }} style={{
                        padding: '5px 10px', borderRadius: 7, border: `1px solid ${institution === id ? '#0d9488' : '#334155'}`,
                        background: institution === id ? '#0d948820' : 'transparent', cursor: 'pointer',
                        fontSize: 11, fontWeight: institution === id ? 700 : 500, color: institution === id ? '#0d9488' : '#64748b', fontFamily: 'inherit',
                      }}>{m.icon} {m.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: 14 }}>
            A carregar dados do cockpit...
          </div>
        )}

        {!loading && (
          <>
            {/* Alerts */}
            {alerts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: criticalCount > 0 ? '#dc2626' : '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 900 }}>{alerts.length}</span>
                  Alertas activos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {alerts.map(alert => {
                    const m = ALERT_META[alert.level]
                    return (
                      <div key={alert.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 14px', background: m.bg,
                        border: `1px solid ${m.border}`, borderRadius: 10,
                        borderLeft: `4px solid ${m.color}`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 900, color: m.color, textTransform: 'uppercase', letterSpacing: '0.08em', background: `${m.color}18`, padding: '1px 6px', borderRadius: 3 }}>{m.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{alert.title}</span>
                            {alert.time && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{alert.time}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{alert.body}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {alert.action_label && alert.action_href && (
                            <Link href={alert.action_href} style={{
                              padding: '5px 12px', borderRadius: 7, background: m.color, color: 'white',
                              fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                            }}>{alert.action_label} →</Link>
                          )}
                          <button onClick={() => setDismissedAlerts(s => new Set([...s, alert.id]))} style={{
                            width: 26, height: 26, borderRadius: 6, background: `${m.color}15`,
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: m.color, fontSize: 12,
                          }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!loading && alerts.length === 0 && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>Nenhum alerta activo. Tudo em ordem.</span>
              </div>
            )}

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
              {(institution === 'nursing_home' ? nursingMetrics : metrics).map(m => {
                const card = (
                  <div key={m.label} style={{
                    background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 20, width: 36, height: 36, borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {m.icon}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</span>
                      {m.unit && <span style={{ fontSize: 11, color: '#94a3b8' }}>{m.unit}</span>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>{m.label}</div>
                    {m.sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{m.sub}</div>}
                  </div>
                )
                if (m.action_href) return <Link key={m.label} href={m.action_href} style={{ textDecoration: 'none' }}>{card}</Link>
                return <div key={m.label}>{card}</div>
              })}
            </div>

            {/* Main content */}
            <div className="cockpit-main" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }}>

              {/* Tasks */}
              <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✅</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Acções prioritárias</span>
                    {tasks.length > 0 && (
                      <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                        {tasks.filter(t => t.priority === 'urgent').length} urgentes
                      </span>
                    )}
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Sem acções pendentes</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>Não há ruturas críticas, eventos de segurança abertos ou formações urgentes.</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Link href="/drug-intelligence" style={{ padding: '8px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}>
                        Farmacoterapia →
                      </Link>
                      <Link href="/quality" style={{ padding: '8px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}>
                        Qualidade →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {tasks.map(task => {
                      const catColors: Record<string, string> = { clinical: '#2563eb', admin: '#64748b', quality: '#7c3aed', team: '#0d9488' }
                      const prioColors: Record<string, string> = { urgent: '#dc2626', normal: '#ca8a04', low: '#64748b' }
                      return (
                        <div key={task.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 18px', borderBottom: '1px solid #f8fafc',
                          background: task.priority === 'urgent' ? '#fffbeb' : 'white',
                        }}>
                          <button onClick={() => setCompletedTasks(s => new Set([...s, task.id]))} style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                            border: `2px solid ${prioColors[task.priority]}`,
                            background: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                              {task.priority === 'urgent' && (
                                <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>URGENTE</span>
                              )}
                              <span style={{ fontSize: 9, fontWeight: 700, color: catColors[task.category], background: `${catColors[task.category]}10`, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
                                {task.category}
                              </span>
                              {task.due && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>{task.due}</span>}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{task.title}</div>
                            {task.detail && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{task.detail}</div>}
                          </div>
                          {task.action_href && (
                            <Link href={task.action_href} style={{
                              padding: '4px 10px', borderRadius: 6, background: '#f8fafc',
                              border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600,
                              color: '#374151', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
                            }}>Abrir →</Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Team */}
                <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 16 }}>👥</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Equipa hoje</span>
                    </div>
                    <Link href="/team" style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>Gerir →</Link>
                  </div>

                  {displayTeam.length === 0 ? (
                    <div style={{ padding: '24px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                      Sem membros de equipa registados.<br />
                      <Link href="/team" style={{ color: '#0d9488', fontWeight: 700 }}>Adicionar equipa →</Link>
                    </div>
                  ) : (
                    displayTeam.map(member => (
                      <div key={member.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: member.status === 'on_shift' ? '#f0fdfa' : member.status === 'break' ? '#fffbeb' : '#f8fafc',
                          border: `2px solid ${member.status === 'on_shift' ? '#0d9488' : member.status === 'break' ? '#ca8a04' : '#e2e8f0'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: member.status === 'on_shift' ? '#0d9488' : '#64748b',
                        }}>
                          {member.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{member.unit ?? member.role ?? ''}</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                          color: member.status === 'on_shift' ? '#16a34a' : member.status === 'break' ? '#ca8a04' : '#64748b',
                          background: member.status === 'on_shift' ? '#f0fdf4' : member.status === 'break' ? '#fffbeb' : '#f8fafc',
                        }}>
                          {member.status === 'on_shift' ? '🟢 turno' : member.status === 'break' ? '🟡 pausa' : member.status === 'sick' ? '🔴 baixa' : member.status === 'vacation' ? '🔵 férias' : '⚫ off'}
                        </span>
                      </div>
                    ))
                  )}
                  <div style={{ padding: '10px 18px' }}>
                    <Link href="/team" style={{
                      display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8,
                      background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12,
                      fontWeight: 600, color: '#0d9488', textDecoration: 'none',
                    }}>Ver escala completa →</Link>
                  </div>
                </div>

                {/* Quick tools — institution-specific */}
                <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Ferramentas Rápidas</div>
                    <Link href="/toolkit" style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>Ver todas →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {INST_QUICK_TOOLS[institution].map(t => (
                      <Link key={t.href} href={t.href} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        borderRadius: 9, border: '1px solid #f1f5f9', textDecoration: 'none',
                        background: '#fafafa',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f1f5f9' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#fafafa' }}
                      >
                        <span style={{ fontSize: 16 }}>{t.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{t.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Shift summary */}
                <div style={{ padding: '14px 16px', background: '#0f172a', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Resumo actual</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Alertas activos', value: alerts.length.toString(), color: criticalCount > 0 ? '#f87171' : '#86efac' },
                      { label: 'Acções pendentes', value: tasks.filter(t => t.priority === 'urgent').length.toString(), color: '#fde68a' },
                      { label: 'Equipa turno', value: team.length ? `${team.filter(m => m.status === 'on_shift').length}/${team.length}` : '—', color: '#a78bfa' },
                      { label: 'Turno', value: hour < 8 ? 'Noite' : hour < 16 ? 'Manhã' : 'Tarde', color: '#22d3ee' },
                    ].map(s => (
                      <div key={s.label} style={{ padding: '10px 12px', background: '#1e293b', borderRadius: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <style>{`
              .cockpit-quick-links {
                display: flex;
                gap: 6px;
                flex-wrap: nowrap;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
              }
              @media (max-width: 768px) {
                .cockpit-main { grid-template-columns: 1fr !important; }
                .cockpit-quick-links { gap: 5px; }
              }
              @media (max-width: 480px) {
                .cockpit-main > div:last-child { display: none; }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  )
}
