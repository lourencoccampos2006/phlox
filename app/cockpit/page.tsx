'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'pharmacist' | 'pharmacist_director' | 'nurse' | 'coordinator' | 'doctor' | 'administrator'
type InstitutionType = 'hospital' | 'clinic' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'health_center'
type AlertLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'
type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue'

interface Alert {
  id: string; level: AlertLevel; title: string; body: string
  action_label?: string; action_href?: string; time?: string; patient?: string; ward?: string
}

interface Task {
  id: string; priority: 'urgent' | 'normal' | 'low'; status: TaskStatus
  title: string; detail?: string; patient?: string; ward?: string
  due?: string; category: 'clinical' | 'admin' | 'quality' | 'team'
  action_href?: string
}

interface Metric {
  label: string; value: string | number; unit?: string; trend?: number
  trend_label?: string; color: string; bg: string; action_href?: string
  sub?: string; icon: string
}

interface TeamMember {
  name: string; role: string; status: 'on_shift' | 'break' | 'off'; service?: string; until?: string
}

// ─── Demo Data per role ───────────────────────────────────────────────────────

function getDemoAlerts(role: Role): Alert[] {
  if (role === 'pharmacist' || role === 'pharmacist_director') return [
    { id:'a1', level:'critical', title:'STAT pendente há 28 min', body:'Cefepima 2g IV/q8h — João Silva (UCI-3)', patient:'João Silva', ward:'UCI-3', action_label:'Validar agora', action_href:'/prescription-queue', time:'28 min' },
    { id:'a2', level:'critical', title:'Monitorização TDM vencida', body:'Vancomicina sem nível há >24h — 2 doentes: A. Ferreira (UCI-3), M. Lima (Cirurgia 2)', action_label:'Ver TDM', action_href:'/pk-dosing', time:'24h+' },
    { id:'a3', level:'high', title:'Rutura de stock — Pip/Tazo 4g', body:'Esgotado. Alternativa disponível: Ceftazidima 2g IV ou Meropenem 1g IV.', action_label:'Gerir formulário', action_href:'/drug-intelligence', time:'3h' },
    { id:'a4', level:'high', title:'3 Reconciliações urgentes', body:'Doentes internados há >24h sem reconciliação: R. Lima (Med B), C. Mendes (Cardio), F. Oliveira (UCI)', action_label:'Reconciliar', action_href:'/patients', time:'8h' },
    { id:'a5', level:'medium', title:'Alerta STOPP v3 detectado', body:'Digoxina 250mcg — Fernanda Oliveira, 91 anos. Dose superior a 125mcg/dia em idoso ≥70a.', action_label:'Ver doente', action_href:'/patients', time:'hoje' },
    { id:'a6', level:'info', title:'Formulário actualizado', body:'Adicionado Vedolizumab (Entyvio 300mg IV) — biológicos para DII. Aprovado CFT 17/05.', time:'2h' },
  ]
  if (role === 'nurse') return [
    { id:'n1', level:'critical', title:'Dose não administrada — STAT', body:'Cefepima 2g IV — João Silva (UCI-3) — prescrita há 35 min, ainda não administrada', patient:'João Silva', ward:'UCI-3', action_label:'Registar MAR', action_href:'/mar', time:'35 min' },
    { id:'n2', level:'high', title:'4 doses em atraso (>30 min)', body:'Turno da manhã: doses das 8h com atraso. Ver MAR para detalhes.', action_label:'Abrir MAR', action_href:'/mar', time:'45 min' },
    { id:'n3', level:'high', title:'Valor crítico de laboratório', body:'Potássio 2.8 mEq/L — António Ferreira (UCI-3). Médico notificado. Reposição pendente.', patient:'António Ferreira', ward:'UCI-3', time:'1h' },
    { id:'n4', level:'medium', title:'Sinais vitais por registar', body:'8 doentes sem sinais vitais registados desde as 6h. Rotina das 10h a iniciar.', action_label:'Registar vitais', action_href:'/turno', time:'10h' },
  ]
  if (role === 'coordinator') return [
    { id:'c1', level:'critical', title:'UCI — Capacidade crítica', body:'UCI com 97% de ocupação (14/15 camas). 2 transferências pendentes para Medicina.', time:'agora' },
    { id:'c2', level:'high', title:'Falta de cobertura turno tarde', body:'Enfermeira Rita Santos faltou. Serviço de Medicina A sem cobertura a partir das 14h.', action_label:'Gerir equipa', action_href:'/team', time:'3h' },
    { id:'c3', level:'high', title:'12 altas previstas hoje', body:'Medicina A: 6 altas · Cirurgia: 4 altas · Cardiologia: 2 altas. Medicação de alta pendente.', action_label:'Ver doentes', action_href:'/turno', time:'hoje' },
    { id:'c4', level:'medium', title:'Reunião PPCIRA às 15h', body:'Apresentação de dados de antibioterapia — DDD e resistências Q1 2026. Dados disponíveis em /quality.', action_label:'Ver qualidade', action_href:'/quality', time:'15h00' },
  ]
  return [
    { id:'d1', level:'critical', title:'Orçamento mensal a 97%', body:'Medicamentos biológicos excederam previsão em €14.200. Mês ainda tem 11 dias.', action_label:'Análise custo', action_href:'/drug-intelligence', time:'hoje' },
    { id:'d2', level:'high', title:'DDD antibióticos ↑18% vs alvo', body:'DDD carbapénemos: 12.4/100PD vs alvo institucional de ≤10. CFT a notificar.', action_label:'Ver DDD', action_href:'/drug-intelligence', time:'semanal' },
    { id:'d3', level:'medium', title:'Acreditação JCI — prazo 60 dias', body:'3 indicadores abaixo do benchmark: taxa intervenção, tempo de reconciliação, DDD carbapenemos.', action_label:'Dashboard qualidade', action_href:'/quality', time:'60 dias' },
  ]
}

function getDemoTasks(role: Role): Task[] {
  if (role === 'pharmacist') return [
    { id:'t1', priority:'urgent', status:'pending', title:'Validar prescrição STAT — Cefepima 2g IV', detail:'João Silva, UCI-3 · Prescrito há 28 min', patient:'João Silva', ward:'UCI-3', category:'clinical', action_href:'/prescription-queue', due:'agora' },
    { id:'t2', priority:'urgent', status:'pending', title:'Nível de vancomicina — A. Ferreira (UCI-3)', detail:'Último nível há 26h. Colher antes das 10h. AUC/MIC a calcular.', patient:'A. Ferreira', ward:'UCI-3', category:'clinical', action_href:'/pk-dosing', due:'10:00' },
    { id:'t3', priority:'urgent', status:'pending', title:'Reconciliação — Rosa Lima, Medicina B 210-4', detail:'Admitida às 08h12. 7 medicamentos em ambulatório. Suspensão de anticoagulante a confirmar.', category:'clinical', action_href:'/patients', due:'12:00' },
    { id:'t4', priority:'normal', status:'pending', title:'Consulta farmacêutica — M. Santos, Med A', detail:'Doença renal crónica · Revisão de ajuste de doses · Sala 2A, 14h00', category:'clinical', action_href:'/oracle', due:'14:00' },
    { id:'t5', priority:'normal', status:'pending', title:'Nível de fenitoína — C. Mendes (Cardio)', detail:'Nível solicitado pela equipa. Albumina = 2.8 g/dL → aplicar Sheiner-Tozer.', category:'clinical', action_href:'/pk-dosing', due:'16:00' },
    { id:'t6', priority:'normal', status:'pending', title:'Relatório DDD antibióticos — Maio 2026', detail:'Prazo amanhã 12h para PPCIRA.', category:'admin', action_href:'/drug-intelligence', due:'amanhã' },
    { id:'t7', priority:'low', status:'done', title:'Validação matinal — 12 prescrições', detail:'3 intervenções (2 doses ajustadas, 1 substituição genérico). Taxa intervenção 25%.', category:'clinical', due:'09:00' },
    { id:'t8', priority:'low', status:'done', title:'Revisão nota clínica — F. Oliveira', detail:'SOAP documentado. Intervenção aceite pela equipa.', category:'clinical', due:'09:30' },
  ]
  if (role === 'nurse') return [
    { id:'n1', priority:'urgent', status:'pending', title:'Administrar Cefepima 2g IV — J. Silva (UCI-3)', detail:'STAT prescrita há 35 min. Reconstituir em 100mL NaCl 0.9%, infundir 30 min.', category:'clinical', action_href:'/mar', due:'agora' },
    { id:'n2', priority:'urgent', status:'pending', title:'Reposição de K — A. Ferreira (UCI-3)', detail:'K+ = 2.8 mEq/L. Protocolo KCl 20mEq em 100mL/1h via central. Confirmar via médico.', category:'clinical', action_href:'/electrolytes', due:'agora' },
    { id:'n3', priority:'normal', status:'pending', title:'Sinais vitais — Ronda das 10h', detail:'8 doentes por avaliar. Prioridade: UCI-3 e Medicina A.', category:'clinical', due:'10:00' },
    { id:'n4', priority:'normal', status:'pending', title:'Registo MAR — Turno manhã (doses 8h)', detail:'4 doses ainda não registadas. Ver lista em MAR.', category:'clinical', action_href:'/mar', due:'10:30' },
  ]
  if (role === 'coordinator') return [
    { id:'c1', priority:'urgent', status:'pending', title:'Substituir cobertura tarde — Medicina A', detail:'Contactar lista de substituição. Confirmar até 12h para serviço das 14h.', category:'team', action_href:'/team', due:'12:00' },
    { id:'c2', priority:'urgent', status:'pending', title:'Planear transferências de UCI', detail:'2 doentes para Medicina. Confirmar camas disponíveis. Coordenar com equipa médica.', category:'clinical', action_href:'/turno', due:'11:00' },
    { id:'c3', priority:'normal', status:'pending', title:'Preparar dados PPCIRA — reunião 15h', detail:'DDD antibióticos Q1 2026. Exportar de /quality.', category:'admin', action_href:'/quality', due:'14:00' },
    { id:'c4', priority:'normal', status:'pending', title:'12 altas — coordenar medicação de saída', detail:'Garantir prescrição de alta disponível. Farmácia notificada?', category:'clinical', due:'17:00' },
  ]
  return [
    { id:'d1', priority:'urgent', status:'pending', title:'Análise de desvio orçamental — Biológicos', detail:'Reunião com aprovisionamento às 14h. Preparar análise de custo vs. DDD.', category:'admin', action_href:'/drug-intelligence', due:'14:00' },
    { id:'d2', priority:'normal', status:'pending', title:'Resposta a INFARMED — notificação RAM', detail:'Prazo: 15/06. 2 casos pendentes de documentação adicional.', category:'admin', due:'15/06' },
    { id:'d3', priority:'normal', status:'pending', title:'Revisão indicadores JCI', detail:'3 indicadores abaixo do alvo. Plano de melhoria a submeter.', category:'quality', action_href:'/quality', due:'semana' },
  ]
}

function getDemoMetrics(role: Role): Metric[] {
  if (role === 'pharmacist') return [
    { label: 'Fila de Validação', value: 7, sub: '2 STAT', color: '#dc2626', bg: '#fef2f2', trend: 2, trend_label: 'vs ontem', action_href: '/prescription-queue', icon: '📬' },
    { label: 'TDM Hoje', value: 4, sub: '2 vanco · 1 feni · 1 amino', color: '#7c3aed', bg: '#faf5ff', action_href: '/pk-dosing', icon: '🔬' },
    { label: 'Reconciliações', value: '3/8', sub: 'admissões hoje', color: '#ca8a04', bg: '#fffbeb', trend: -2, trend_label: 'vs ontem', action_href: '/patients', icon: '🔄' },
    { label: 'Taxa Intervenção', value: '28.3%', unit: '', sub: '+3.1% vs mês anterior', color: '#16a34a', bg: '#f0fdf4', trend: 3.1, action_href: '/quality', icon: '📊' },
    { label: 'DDD Antibióticos', value: '78.2', unit: '/100PD', sub: '↓5.4% vs semana anterior', color: '#2563eb', bg: '#eff6ff', trend: -5.4, action_href: '/drug-intelligence', icon: '💉' },
    { label: 'Budget Medicamentos', value: '94.2%', sub: '89% do mês decorrido', color: '#ca8a04', bg: '#fffbeb', action_href: '/drug-intelligence', icon: '💶' },
  ]
  if (role === 'nurse') return [
    { label: 'Doses Pendentes', value: 4, sub: '3 atrasadas >30 min', color: '#dc2626', bg: '#fef2f2', trend: -2, action_href: '/mar', icon: '💊' },
    { label: 'MAR Hoje', value: '34/42', sub: 'administrações registadas', color: '#16a34a', bg: '#f0fdf4', action_href: '/mar', icon: '📝' },
    { label: 'Sinais Vitais', value: '6/14', sub: 'doentes avaliados', color: '#ca8a04', bg: '#fffbeb', action_href: '/turno', icon: '❤️' },
    { label: 'Doentes no Turno', value: 14, sub: '2 críticos · 4 vigilância', color: '#7c3aed', bg: '#faf5ff', action_href: '/turno', icon: '👥' },
  ]
  if (role === 'coordinator') return [
    { label: 'Ocupação UCI', value: '97%', sub: '14/15 camas', color: '#dc2626', bg: '#fef2f2', icon: '🏥' },
    { label: 'Altas Previstas', value: 12, sub: 'hoje', color: '#ca8a04', bg: '#fffbeb', action_href: '/turno', icon: '📤' },
    { label: 'Equipa Turno', value: '18/20', sub: '2 ausências', color: '#ca8a04', bg: '#fffbeb', action_href: '/team', icon: '👥' },
    { label: 'Reconciliações', value: '5 por fazer', sub: '>24h sem fazer', color: '#dc2626', bg: '#fef2f2', action_href: '/patients', icon: '🔄' },
    { label: 'MAR — Omissões', value: 4, sub: 'turno manhã', color: '#ca8a04', bg: '#fffbeb', action_href: '/mar', icon: '📝' },
    { label: 'Satisfação Doente', value: '4.6/5', sub: 'último trimestre', color: '#16a34a', bg: '#f0fdf4', icon: '⭐' },
  ]
  return [
    { label: 'Custo Medicamento', value: '+12%', sub: 'vs. orçamento mês', color: '#dc2626', bg: '#fef2f2', trend: 12, action_href: '/drug-intelligence', icon: '💶' },
    { label: 'DDD Carbapenemos', value: '12.4', unit: '/100PD', sub: 'alvo: ≤10', color: '#dc2626', bg: '#fef2f2', action_href: '/drug-intelligence', icon: '💉' },
    { label: 'Taxa Intervenção', value: '28.3%', sub: 'benchmark ESCP: 25-35%', color: '#16a34a', bg: '#f0fdf4', action_href: '/quality', icon: '📊' },
    { label: 'Eventos Adversos', value: 2, sub: 'este mês · 0 graves', color: '#ca8a04', bg: '#fffbeb', action_href: '/quality', icon: '⚠️' },
    { label: 'Staff FTE', value: '22/24', sub: '2 vagas abertas', color: '#ca8a04', bg: '#fffbeb', action_href: '/team', icon: '👥' },
    { label: 'Acreditação JCI', value: '87%', sub: '3 indicadores < alvo', color: '#ca8a04', bg: '#fffbeb', action_href: '/quality', icon: '🏆' },
  ]
}

function getDemoTeam(role: Role): TeamMember[] {
  return [
    { name: 'Dra. Ana Rodrigues', role: 'Farmacêutica Clínica', status: 'on_shift', service: 'UCI + Medicina A', until: '17:00' },
    { name: 'Dr. Carlos Melo', role: 'Farmacêutico Clínico', status: 'on_shift', service: 'Cirurgia + Ortopedia', until: '17:00' },
    { name: 'Téc. José Pereira', role: 'Técnico Farmácia', status: 'on_shift', service: 'Dispensação', until: '17:00' },
    { name: 'Téc. Maria Costa', role: 'Técnica Farmácia', status: 'break', service: 'Dispensação', until: '17:00' },
    { name: 'Dr. António Santos', role: 'Director de Farmácia', status: 'on_shift', until: '17:00' },
  ]
}

const ROLE_META: Record<Role, { label: string; icon: string; color: string }> = {
  pharmacist:         { label: 'Farmacêutico Clínico', icon: '🔬', color: '#2563eb' },
  pharmacist_director:{ label: 'Director de Farmácia', icon: '🏛', color: '#7c3aed' },
  nurse:              { label: 'Enfermeiro/a', icon: '👩‍⚕️', color: '#0d9488' },
  coordinator:        { label: 'Coordenador/a de Serviço', icon: '📊', color: '#ca8a04' },
  doctor:             { label: 'Médico/a', icon: '🩺', color: '#dc2626' },
  administrator:      { label: 'Administrador/a', icon: '🏢', color: '#64748b' },
}

const INST_META: Record<InstitutionType, { label: string; icon: string }> = {
  hospital:          { label: 'Hospital', icon: '🏥' },
  clinic:            { label: 'Clínica / Centro de Saúde', icon: '🏠' },
  pharmacy_hospital: { label: 'Farmácia Hospitalar', icon: '⚗️' },
  pharmacy_community:{ label: 'Farmácia Comunitária', icon: '🏪' },
  nursing_home:      { label: 'Lar / ERPI', icon: '🤝' },
  health_center:     { label: 'Centro de Saúde', icon: '🌿' },
}

const ALERT_META: Record<AlertLevel, { color: string; bg: string; border: string; icon: string; label: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '🚨', label: 'CRÍTICO' },
  high:     { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', icon: '🔴', label: 'ALTO' },
  medium:   { color: '#ca8a04', bg: '#fffbeb', border: '#fde68a', icon: '🟡', label: 'ATENÇÃO' },
  low:      { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '🔵', label: 'INFO' },
  info:     { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', icon: '💡', label: 'INFO' },
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Cockpit() {
  const { user } = useAuth()
  const [role, setRole] = useState<Role>('pharmacist')
  const [institution, setInstitution] = useState<InstitutionType>('hospital')
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  // Detect role from user profile
  useEffect(() => {
    if (user) {
      const orgRole = (user as any).org_role
      if (orgRole === 'admin') setRole('pharmacist_director')
      else if (orgRole === 'nurse') setRole('nurse')
      else if (orgRole === 'coordinator') setRole('coordinator')
      else if (orgRole === 'pharmacist') setRole('pharmacist')
    }
  }, [user])

  const alerts = useMemo(() => getDemoAlerts(role).filter(a => !dismissedAlerts.has(a.id)), [role, dismissedAlerts])
  const allTasks = useMemo(() => getDemoTasks(role), [role])
  const metrics = useMemo(() => getDemoMetrics(role), [role])
  const team = useMemo(() => getDemoTeam(role), [role])

  const tasks = useMemo(() => {
    return allTasks.map(t => completedTasks.has(t.id) ? { ...t, status: 'done' as TaskStatus } : t)
      .filter(t => taskFilter === 'all' ? true : taskFilter === 'done' ? t.status === 'done' : t.status !== 'done')
  }, [allTasks, completedTasks, taskFilter])

  const pendingCount = allTasks.filter(t => t.status !== 'done' && !completedTasks.has(t.id)).length
  const doneCount = allTasks.filter(t => t.status === 'done' || completedTasks.has(t.id)).length

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const highCount = alerts.filter(a => a.level === 'high').length

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const roleMeta = ROLE_META[role]
  const instMeta = INST_META[institution]

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>

      {/* ── Command Header ─────────────────────────────────────────────── */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '14px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

            {/* Left: greeting + role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                    {greeting}{user ? `, ${(user as any).name?.split(' ')[0] ?? ''}` : ''}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>·</span>
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{dateStr}</span>
                </div>
                <button onClick={() => setShowRoleSelector(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 0', marginTop: 2,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: roleMeta.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: roleMeta.color }}>{roleMeta.icon} {roleMeta.label}</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>· {instMeta.icon} {instMeta.label}</span>
                  <span style={{ fontSize: 10, color: '#334155', marginLeft: 2 }}>▾</span>
                </button>
              </div>
            </div>

            {/* Center: alert pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              {criticalCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#dc262620', border: '1px solid #dc262640', borderRadius: 20 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>{criticalCount} crítico{criticalCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {highCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#ea580c15', border: '1px solid #ea580c30', borderRadius: 20 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>{highCount} {highCount !== 1 ? 'alertas' : 'alerta'}</span>
                </div>
              )}
              {criticalCount === 0 && highCount === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#16a34a15', border: '1px solid #16a34a30', borderRadius: 20 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Sem alertas críticos</span>
                </div>
              )}
            </div>

            {/* Right: quick links */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: 'Validação', href: '/prescription-queue', icon: '📬' },
                { label: 'MAR', href: '/mar', icon: '📝' },
                { label: 'Ronda', href: '/rounds', icon: '📋' },
                { label: 'Turno', href: '/turno', icon: '🏥' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                  textDecoration: 'none', fontSize: 11, fontWeight: 600, color: '#94a3b8',
                  transition: 'all 0.1s',
                }}>
                  {l.icon} {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Role selector dropdown */}
          {showRoleSelector && (
            <div style={{ marginTop: 12, padding: '14px 16px', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Função</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([id, m]) => (
                      <button key={id} onClick={() => { setRole(id); setShowRoleSelector(false) }} style={{
                        padding: '5px 10px', borderRadius: 7, border: `1px solid ${role === id ? m.color : '#334155'}`,
                        background: role === id ? `${m.color}20` : 'transparent', cursor: 'pointer',
                        fontSize: 11, fontWeight: role === id ? 700 : 500, color: role === id ? m.color : '#64748b', fontFamily: 'inherit',
                      }}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tipo de Instituição</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(Object.entries(INST_META) as [InstitutionType, typeof INST_META[InstitutionType]][]).map(([id, m]) => (
                      <button key={id} onClick={() => setInstitution(id)} style={{
                        padding: '5px 10px', borderRadius: 7, border: `1px solid ${institution === id ? '#0d9488' : '#334155'}`,
                        background: institution === id ? '#0d948820' : 'transparent', cursor: 'pointer',
                        fontSize: 11, fontWeight: institution === id ? 700 : 500, color: institution === id ? '#0d9488' : '#64748b', fontFamily: 'inherit',
                      }}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Alerts strip ─────────────────────────────────────────────── */}
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
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: m.bg,
                    border: `1px solid ${m.border}`, borderRadius: 10,
                    borderLeft: `4px solid ${m.color}`,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        }}>
                          {alert.action_label} →
                        </Link>
                      )}
                      <button onClick={() => setDismissedAlerts(s => new Set([...s, alert.id]))} style={{
                        width: 26, height: 26, borderRadius: 6, background: `${m.color}15`,
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: m.color, fontSize: 12, flexShrink: 0,
                      }}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Metrics grid ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
          {metrics.map(m => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

          {/* Task List */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>A fazer hoje</span>
                <span style={{ fontSize: 11, background: pendingCount > 0 ? '#fef2f2' : '#f0fdf4', color: pendingCount > 0 ? '#dc2626' : '#16a34a', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                  {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['pending', 'done', 'all'] as const).map(f => (
                  <button key={f} onClick={() => setTaskFilter(f)} style={{
                    padding: '3px 10px', borderRadius: 6, border: `1px solid ${taskFilter === f ? '#0d9488' : '#e2e8f0'}`,
                    background: taskFilter === f ? '#f0fdfa' : 'white', cursor: 'pointer',
                    fontSize: 11, fontWeight: taskFilter === f ? 700 : 500, color: taskFilter === f ? '#0d9488' : '#64748b', fontFamily: 'inherit',
                  }}>
                    {f === 'pending' ? `Pendentes (${pendingCount})` : f === 'done' ? `Concluídas (${doneCount})` : 'Todas'}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 3, background: '#f1f5f9' }}>
              <div style={{ height: '100%', background: '#0d9488', width: `${(doneCount / allTasks.length) * 100}%`, transition: 'width 0.5s', borderRadius: 2 }} />
            </div>

            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {tasks.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  {taskFilter === 'done' ? '🎉 Nenhuma tarefa concluída ainda' : '✅ Nenhuma tarefa pendente!'}
                </div>
              ) : (
                tasks.map(task => {
                  const isDone = task.status === 'done' || completedTasks.has(task.id)
                  const catColors = { clinical: '#2563eb', admin: '#64748b', quality: '#7c3aed', team: '#0d9488' }
                  const prioColors = { urgent: '#dc2626', normal: '#ca8a04', low: '#64748b' }
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 18px', borderBottom: '1px solid #f8fafc',
                      opacity: isDone ? 0.55 : 1, transition: 'opacity 0.2s',
                      background: task.priority === 'urgent' && !isDone ? '#fffbeb' : 'white',
                    }}>
                      <button
                        onClick={() => setCompletedTasks(s => {
                          const n = new Set(s)
                          isDone ? n.delete(task.id) : n.add(task.id)
                          return n
                        })}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 2,
                          border: `2px solid ${isDone ? '#16a34a' : prioColors[task.priority]}`,
                          background: isDone ? '#16a34a' : 'white', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                          fontSize: 11, fontWeight: 800,
                        }}
                      >{isDone ? '✓' : ''}</button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {task.priority === 'urgent' && !isDone && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>URGENTE</span>
                          )}
                          <span style={{ fontSize: 9, fontWeight: 700, color: catColors[task.category], background: `${catColors[task.category]}10`, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
                            {task.category}
                          </span>
                          {task.due && (
                            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>
                              {task.due}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: isDone ? 400 : 600, color: isDone ? '#94a3b8' : '#0f172a', textDecoration: isDone ? 'line-through' : 'none' }}>
                          {task.title}
                        </div>
                        {task.detail && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{task.detail}</div>
                        )}
                      </div>

                      {task.action_href && !isDone && (
                        <Link href={task.action_href} style={{
                          padding: '4px 10px', borderRadius: 6, background: '#f8fafc',
                          border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600,
                          color: '#374151', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
                        }}>
                          Abrir →
                        </Link>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Team status */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>👥</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Equipa hoje</span>
                </div>
                <Link href="/team" style={{ fontSize: 11, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>Gerir →</Link>
              </div>
              {team.map(member => (
                <div key={member.name} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: member.status === 'on_shift' ? '#f0fdfa' : member.status === 'break' ? '#fffbeb' : '#f8fafc',
                    border: `2px solid ${member.status === 'on_shift' ? '#0d9488' : member.status === 'break' ? '#ca8a04' : '#e2e8f0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: member.status === 'on_shift' ? '#0d9488' : '#64748b',
                  }}>
                    {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{member.service || member.role}</div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                    color: member.status === 'on_shift' ? '#16a34a' : member.status === 'break' ? '#ca8a04' : '#64748b',
                    background: member.status === 'on_shift' ? '#f0fdf4' : member.status === 'break' ? '#fffbeb' : '#f8fafc',
                  }}>
                    {member.status === 'on_shift' ? '🟢 turno' : member.status === 'break' ? '🟡 pausa' : '⚫ off'}
                  </span>
                </div>
              ))}
              <div style={{ padding: '10px 18px' }}>
                <Link href="/team" style={{
                  display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8,
                  background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600,
                  color: '#0d9488', textDecoration: 'none',
                }}>
                  Ver escala completa →
                </Link>
              </div>
            </div>

            {/* Quick tools */}
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>⚡ Ferramentas Rápidas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { icon: '🔬', label: 'Console PK', href: '/pk-dosing', color: '#7c3aed' },
                  { icon: '💉', label: 'Antibióticos', href: '/antibiotics', color: '#dc2626' },
                  { icon: '🧪', label: 'Nutrição NP', href: '/tpn', color: '#0d9488' },
                  { icon: '⚡', label: 'Urgência', href: '/emergency-doses', color: '#ea580c' },
                  { icon: '📊', label: 'Qualidade', href: '/quality', color: '#2563eb' },
                  { icon: '💊', label: 'Formulário', href: '/drug-intelligence', color: '#16a34a' },
                ].map(t => (
                  <Link key={t.href} href={t.href} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    borderRadius: 9, border: '1px solid #f1f5f9', textDecoration: 'none',
                    background: '#fafafa', transition: 'all 0.1s',
                  }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{t.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Shift summary */}
            <div style={{ padding: '14px 16px', background: '#0f172a', borderRadius: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Resumo do dia</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Tarefas concluídas', value: `${doneCount}/${allTasks.length}`, color: '#22d3ee' },
                  { label: 'Alertas activos', value: alerts.length.toString(), color: criticalCount > 0 ? '#f87171' : '#86efac' },
                  { label: 'Equipa de turno', value: `${team.filter(t => t.status === 'on_shift').length}/${team.length}`, color: '#a78bfa' },
                  { label: 'Turno', value: hour < 8 ? 'Noite' : hour < 16 ? 'Manhã' : 'Tarde', color: '#fde68a' },
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
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        a:hover { opacity:0.85; }
      `}</style>
    </div>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  const trendUp = metric.trend !== undefined && metric.trend > 0
  const trendDown = metric.trend !== undefined && metric.trend < 0
  const card = (
    <div style={{
      background: 'white', borderRadius: 12, border: `1px solid ${metric.bg === '#fef2f2' ? '#fecaca' : '#e2e8f0'}`,
      padding: '14px 16px', transition: 'all 0.15s', cursor: metric.action_href ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 20, width: 36, height: 36, borderRadius: 9, background: metric.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {metric.icon}
        </div>
        {metric.trend !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
            color: trendUp ? '#dc2626' : '#16a34a',
            background: trendUp ? '#fef2f2' : '#f0fdf4',
          }}>
            {trendUp ? '↑' : '↓'} {Math.abs(metric.trend)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: metric.color, lineHeight: 1 }}>{metric.value}</span>
        {metric.unit && <span style={{ fontSize: 11, color: '#94a3b8' }}>{metric.unit}</span>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>{metric.label}</div>
      {metric.sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{metric.sub}</div>}
    </div>
  )
  if (metric.action_href) return <Link href={metric.action_href} style={{ textDecoration: 'none' }}>{card}</Link>
  return card
}
