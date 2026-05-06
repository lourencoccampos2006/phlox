'use client'

// ─── NOVO: app/rounds/page.tsx ─── Phlox Rounds
// Ronda farmacêutica digital completa.
// Lista de doentes ordenada por score de risco.
// Análise automática ao abrir cada doente.
// Registo de intervenção farmacêutica no formato PCNE.
// Relatório mensal de actividade.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

// ─── PCNE Classification v9.1 (simplified) ───────────────────────────────────
const PCNE_PROBLEMS = [
  { code: 'P1', label: 'Efeito adverso', sub: 'Reacção adversa a medicamento' },
  { code: 'P2', label: 'Falha terapêutica', sub: 'Falha ou ineficácia do tratamento' },
  { code: 'P3', label: 'Custo desnecessário', sub: 'Custo excessivo ou genérico disponível' },
]

const PCNE_CAUSES = [
  { code: 'C1', label: 'Selecção do fármaco', sub: 'Escolha inadequada do medicamento' },
  { code: 'C2', label: 'Forma/dose', sub: 'Dose, forma farmacêutica ou duração inadequadas' },
  { code: 'C3', label: 'Selecção do doente', sub: 'Medicamento contraindicado' },
  { code: 'C4', label: 'Logística', sub: 'Medicamento não disponível / erro de dispensação' },
  { code: 'C5', label: 'Monitorização', sub: 'Ausência de monitorização de efeito ou efeito adverso' },
  { code: 'C6', label: 'Adesão', sub: 'Doente não toma / usa incorrectamente' },
  { code: 'C8', label: 'Outros', sub: 'Outra causa' },
]

const PCNE_INTERVENTIONS = [
  { code: 'I0', label: 'Nenhuma intervenção' },
  { code: 'I1', label: 'Informação ao doente / cuidador' },
  { code: 'I2', label: 'Informação ao médico' },
  { code: 'I2.1', label: 'Proposta de alteração de dose' },
  { code: 'I2.2', label: 'Proposta de suspensão do fármaco' },
  { code: 'I2.3', label: 'Proposta de novo fármaco' },
  { code: 'I3', label: 'Intervenção na prescrição efectuada' },
  { code: 'I4', label: 'Intervenção na dispensa efectuada' },
]

const PCNE_OUTCOMES = [
  { code: 'O0', label: 'Desconhecido', color: 'var(--ink-4)' },
  { code: 'O1', label: 'Problema resolvido', color: '#0d6e42' },
  { code: 'O2', label: 'Resolvido parcialmente', color: '#d97706' },
  { code: 'O3', label: 'Não resolvido — sem cooperação', color: '#dc2626' },
  { code: 'O4', label: 'Não resolvido — intervenção não aceite', color: '#dc2626' },
  { code: 'O5', label: 'Não aplicável', color: 'var(--ink-4)' },
]

interface Patient {
  id: string; name: string; age: number|null; sex: string|null
  weight: number|null; creatinine: number|null
  conditions: string|null; allergies: string|null; notes: string|null
}

interface PatientMed {
  id: string; name: string; dose: string|null; frequency: string|null; indication: string|null
}

interface PatientAlert {
  type: string; severity: 'grave'|'moderada'|'info'; message: string; action: string
}

interface PCNEIntervention {
  id: string
  patient_id: string
  patient_name: string
  date: string
  problem_code: string
  cause_code: string
  intervention_code: string
  outcome_code: string
  description: string
  recommendation: string
  accepted: boolean|null
  pharmacist: string
}

interface RiskScore {
  score: number   // 0-100
  level: 'critical'|'high'|'moderate'|'low'
  alerts: PatientAlert[]
  summary: string
}

const RISK_STYLE = {
  critical: { label:'CRÍTICO',  color:'#991b1b', bg:'#fee2e2', border:'#fca5a5', dot:'#dc2626' },
  high:     { label:'ALTO',     color:'#854d0e', bg:'#fef9c3', border:'#fde68a', dot:'#d97706' },
  moderate: { label:'MODERADO', color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', dot:'#3b82f6' },
  low:      { label:'BAIXO',    color:'#0d6e42', bg:'#f0fdf5', border:'#bbf7d0', dot:'#16a34a' },
}

function calcCrCl(p: Patient): number|null {
  if (!p.age || !p.weight || !p.creatinine) return null
  return Math.round(((140-p.age)*p.weight*(p.sex==='F'?0.85:1))/(72*p.creatinine)*10)/10
}

// ─── Patient row in the list ──────────────────────────────────────────────────

function PatientRow({ patient, risk, selected, onSelect }: {
  patient: Patient & { meds_count: number }
  risk: RiskScore|null
  selected: boolean
  onSelect: () => void
}) {
  const rs = risk ? RISK_STYLE[risk.level] : null
  return (
    <button onClick={onSelect}
      style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:selected?'#eff6ff':'white', border:`1px solid ${selected?'#bfdbfe':'transparent'}`, borderRadius:0, cursor:'pointer', textAlign:'left', borderBottom:'1px solid var(--bg-3)', transition:'background 0.1s', fontFamily:'var(--font-sans)' }}>
      {/* Risk indicator */}
      <div style={{ width:8, height:8, borderRadius:'50%', background:rs?.dot||'var(--bg-3)', flexShrink:0 }} />
      {/* Avatar */}
      <div style={{ width:36, height:36, borderRadius:'50%', background:rs?.bg||'var(--bg-2)', display:'flex', alignItems:'center', justifyContent:'center', color:rs?.color||'var(--ink-4)', fontSize:13, fontWeight:700, flexShrink:0, border:`1px solid ${rs?.border||'var(--border)'}` }}>
        {patient.name.charAt(0).toUpperCase()}
      </div>
      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{patient.name}</div>
        <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:1 }}>
          {[patient.age?`${patient.age}a`:null, patient.sex, `${patient.meds_count} med.`].filter(Boolean).join(' · ')}
        </div>
      </div>
      {/* Score */}
      {risk && (
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:rs?.color, fontFamily:'var(--font-serif)' }}>{risk.score}</div>
          <div style={{ fontSize:8, fontFamily:'var(--font-mono)', color:rs?.color, textTransform:'uppercase', letterSpacing:'0.08em' }}>{rs?.label}</div>
        </div>
      )}
      {!risk && <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--ink-4)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />}
    </button>
  )
}

// ─── PCNE Form ────────────────────────────────────────────────────────────────

function PCNEForm({ patient, pharmacist, onSave, onCancel }: {
  patient: Patient
  pharmacist: string
  onSave: (intervention: Omit<PCNEIntervention, 'id'>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    problem_code: 'P1', cause_code: 'C1', intervention_code: 'I2',
    outcome_code: 'O0', description: '', recommendation: '', accepted: null as boolean|null,
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = () => {
    if (!form.description.trim()) return
    onSave({
      patient_id: patient.id,
      patient_name: patient.name,
      date: new Date().toISOString().split('T')[0],
      pharmacist,
      ...form,
    })
  }

  const select_style = { width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none', background:'white' }
  const label_style = { fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:6, display:'block' }

  return (
    <div style={{ background:'white', border:'2px solid #1d4ed8', borderRadius:10, padding:20 }}>
      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#1d4ed8', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:10, height:2, background:'#1d4ed8', borderRadius:1 }} />
        Registo PCNE — {patient.name}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={label_style}>Problema (P)</label>
          <select value={form.problem_code} onChange={e => set('problem_code', e.target.value)} style={select_style}>
            {PCNE_PROBLEMS.map(p => <option key={p.code} value={p.code}>{p.code} — {p.label}</option>)}
          </select>
        </div>
        <div>
          <label style={label_style}>Causa (C)</label>
          <select value={form.cause_code} onChange={e => set('cause_code', e.target.value)} style={select_style}>
            {PCNE_CAUSES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={label_style}>Intervenção (I)</label>
          <select value={form.intervention_code} onChange={e => set('intervention_code', e.target.value)} style={select_style}>
            {PCNE_INTERVENTIONS.map(i => <option key={i.code} value={i.code}>{i.code} — {i.label}</option>)}
          </select>
        </div>
        <div>
          <label style={label_style}>Resultado (O)</label>
          <select value={form.outcome_code} onChange={e => set('outcome_code', e.target.value)} style={select_style}>
            {PCNE_OUTCOMES.map(o => <option key={o.code} value={o.code}>{o.code} — {o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={label_style}>Descrição do problema *</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Descreve o problema farmacoterapêutico identificado..."
          rows={2}
          style={{ ...select_style, resize:'vertical', lineHeight:1.6 }} />
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={label_style}>Recomendação / Intervenção proposta</label>
        <textarea value={form.recommendation} onChange={e => set('recommendation', e.target.value)}
          placeholder="Ex: Substituir ibuprofeno por paracetamol dado risco hemorrágico com rivaroxabano..."
          rows={2}
          style={{ ...select_style, resize:'vertical', lineHeight:1.6 }} />
      </div>

      {form.intervention_code !== 'I0' && (
        <div style={{ marginBottom:14 }}>
          <label style={label_style}>Intervenção aceite pelo médico?</label>
          <div style={{ display:'flex', gap:8 }}>
            {(() => {
              type BtnDef = { label: string; value: boolean|null; clr: string; bg: string }
              const btns: BtnDef[] = [
                { label:'Sim',     value:true,  clr:'#0d6e42',       bg:'#d1fae5' },
                { label:'Não',     value:false, clr:'#dc2626',       bg:'#fee2e2' },
                { label:'Pendente',value:null,  clr:'var(--ink-4)',  bg:'var(--bg-2)' },
              ]
              return btns.map(btn => (
                <button key={btn.label} onClick={() => set('accepted', btn.value)}
                  style={{ padding:'7px 14px', border:`1.5px solid ${form.accepted===btn.value ? btn.clr : 'var(--border)'}`, borderRadius:7, background:form.accepted===btn.value ? btn.bg : 'white', cursor:'pointer', fontSize:12, fontWeight:form.accepted===btn.value ? 700 : 400, color:form.accepted===btn.value ? btn.clr : 'var(--ink-3)', fontFamily:'var(--font-sans)' }}>
                  {btn.label}
                </button>
              ))
            })()}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={handleSave} disabled={!form.description.trim()}
          style={{ flex:1, background:form.description.trim()?'#1d4ed8':'var(--bg-3)', color:form.description.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, padding:'11px', fontSize:13, fontWeight:700, cursor:form.description.trim()?'pointer':'not-allowed', fontFamily:'var(--font-sans)' }}>
          Guardar registo PCNE
        </button>
        <button onClick={onCancel}
          style={{ padding:'11px 16px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Patient detail panel ─────────────────────────────────────────────────────

function PatientPanel({ patient, risk, meds, interventions, pharmacist, supabase, user, onNewIntervention }: {
  patient: Patient; risk: RiskScore|null; meds: PatientMed[]
  interventions: PCNEIntervention[]; pharmacist: string
  supabase: any; user: any; onNewIntervention: (i: PCNEIntervention) => void
}) {
  const [showPCNE, setShowPCNE] = useState(false)
  const [tab, setTab] = useState<'overview'|'meds'|'interventions'>('overview')
  const crcl = calcCrCl(patient)

  const tabStyle = (t: string) => ({
    padding:'8px 14px', background:'none', border:'none',
    borderBottom:`2px solid ${tab===t?'#1d4ed8':'transparent'}`,
    cursor:'pointer', fontSize:11, fontWeight:700,
    color:tab===t?'#1d4ed8':'var(--ink-4)',
    fontFamily:'var(--font-sans)', letterSpacing:'0.04em',
    textTransform:'uppercase' as const, marginBottom:-1, whiteSpace:'nowrap' as const,
  })

  const saveIntervention = async (data: Omit<PCNEIntervention,'id'>) => {
    const { data: saved } = await supabase.from('pcne_interventions').insert({
      ...data, user_id: user.id
    }).select().single()
    if (saved) onNewIntervention(saved)
    setShowPCNE(false)
  }

  const patientInterventions = interventions.filter(i => i.patient_id === patient.id)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Patient header */}
      <div style={{ padding:'18px 20px', background:'#0f172a', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>Doente</div>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'#f8fafc', fontWeight:400, marginBottom:2 }}>{patient.name}</div>
            <div style={{ fontSize:12, color:'#475569', fontFamily:'var(--font-mono)' }}>
              {[patient.age?`${patient.age}a`:null, patient.sex==='M'?'Masc':patient.sex==='F'?'Fem':null, patient.conditions].filter(Boolean).join(' · ')}
            </div>
          </div>
          {risk && (
            <div style={{ background:RISK_STYLE[risk.level].bg, border:`1px solid ${RISK_STYLE[risk.level].border}`, borderRadius:8, padding:'10px 14px', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:28, fontWeight:800, color:RISK_STYLE[risk.level].color, fontFamily:'var(--font-serif)', lineHeight:1 }}>{risk.score}</div>
              <div style={{ fontSize:8, fontFamily:'var(--font-mono)', color:RISK_STYLE[risk.level].color, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:3 }}>Risco {RISK_STYLE[risk.level].label}</div>
            </div>
          )}
        </div>

        {/* Quick clinical data */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            crcl ? `CrCl: ${crcl} mL/min` : null,
            patient.weight ? `Peso: ${patient.weight}kg` : null,
            patient.allergies ? `Alergias: ${patient.allergies}` : null,
          ].filter(Boolean).map(item => (
            <span key={item as string} style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#64748b', background:'#1e293b', padding:'3px 8px', borderRadius:4 }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'white', flexShrink:0, overflowX:'auto' }}>
        <button onClick={() => setTab('overview')} style={tabStyle('overview')}>Visão Geral</button>
        <button onClick={() => setTab('meds')} style={tabStyle('meds')}>Medicação ({meds.length})</button>
        <button onClick={() => setTab('interventions')} style={tabStyle('interventions')}>PCNE ({patientInterventions.length})</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

        {tab==='overview' && (
          <div>
            {/* AI Alerts */}
            {risk && risk.alerts.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>
                  Alertas clínicos — {risk.alerts.length}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {risk.alerts.map((alert, i) => {
                    const s = alert.severity==='grave'?{bg:'#fee2e2',border:'#fca5a5',color:'#991b1b',icon:'🚨'}:alert.severity==='moderada'?{bg:'#fef9c3',border:'#fde68a',color:'#854d0e',icon:'⚠️'}:{bg:'#eff6ff',border:'#bfdbfe',color:'#1d4ed8',icon:'ℹ️'}
                    return (
                      <div key={i} style={{ padding:'12px 14px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:8 }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:5 }}>
                          <span style={{ fontSize:14, flexShrink:0 }}>{s.icon}</span>
                          <div style={{ fontSize:13, fontWeight:700, color:s.color, lineHeight:1.4 }}>{alert.message}</div>
                        </div>
                        <div style={{ fontSize:12, color:s.color, opacity:0.8, lineHeight:1.5, paddingLeft:22 }}>→ {alert.action}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {risk?.summary && (
              <div style={{ padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--ink-3)', lineHeight:1.6, marginBottom:14 }}>
                {risk.summary}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => setShowPCNE(true)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:'#1d4ed8', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                ✏️ Registar intervenção PCNE
              </button>
              <Link href={`/ai?patient=${patient.id}`}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:'white', color:'var(--ink)', border:'1px solid var(--border)', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:700 }}>
                🤖 Consultar AI sobre este doente
              </Link>
              <Link href={`/patients/${patient.id}`}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:'white', color:'var(--ink)', border:'1px solid var(--border)', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:700 }}>
                👤 Ver perfil completo
              </Link>
            </div>

            {showPCNE && (
              <div style={{ marginTop:14 }}>
                <PCNEForm patient={patient} pharmacist={pharmacist}
                  onSave={saveIntervention} onCancel={() => setShowPCNE(false)} />
              </div>
            )}
          </div>
        )}

        {tab==='meds' && (
          <div>
            {meds.length===0 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--ink-4)' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>💊</div>
                <div style={{ fontSize:14 }}>Sem medicamentos registados</div>
                <Link href={`/patients/${patient.id}`} style={{ fontSize:12, color:'#1d4ed8', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700, marginTop:8, display:'block' }}>
                  Adicionar medicamentos →
                </Link>
              </div>
            ) : meds.map((med, i) => (
              <div key={med.id} style={{ padding:'12px 0', borderBottom:i<meds.length-1?'1px solid var(--bg-3)':'none' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:2 }}>{med.name}</div>
                <div style={{ fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                  {[med.dose, med.frequency, med.indication].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='interventions' && (
          <div>
            {!showPCNE && (
              <button onClick={() => setShowPCNE(true)}
                style={{ width:'100%', marginBottom:14, padding:'10px', background:'#eff6ff', border:'1.5px dashed #bfdbfe', borderRadius:8, cursor:'pointer', fontSize:13, color:'#1d4ed8', fontFamily:'var(--font-sans)', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                ✏️ Nova intervenção PCNE
              </button>
            )}
            {showPCNE && (
              <div style={{ marginBottom:14 }}>
                <PCNEForm patient={patient} pharmacist={pharmacist}
                  onSave={saveIntervention} onCancel={() => setShowPCNE(false)} />
              </div>
            )}
            {patientInterventions.length===0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'var(--ink-4)', fontSize:13 }}>Nenhuma intervenção registada para este doente.</div>
            ) : patientInterventions.map((iv, i) => {
              const outcome = PCNE_OUTCOMES.find(o => o.code===iv.outcome_code)
              return (
                <div key={iv.id} style={{ padding:'14px', background:'white', border:'1px solid var(--border)', borderRadius:8, marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {[iv.problem_code, iv.cause_code, iv.intervention_code].map(code => (
                        <span key={code} style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', padding:'2px 6px', borderRadius:3 }}>{code}</span>
                      ))}
                    </div>
                    <span style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)', flexShrink:0 }}>{iv.date}</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.5, marginBottom:5 }}>{iv.description}</div>
                  {iv.recommendation && <div style={{ fontSize:12, color:'#1d4ed8', fontFamily:'var(--font-mono)', marginBottom:6 }}>→ {iv.recommendation}</div>}
                  {outcome && <span style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:outcome.color }}>{outcome.code} — {outcome.label}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RoundsPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<(Patient & { meds_count: number })[]>([])
  const [meds, setMeds] = useState<Record<string, PatientMed[]>>({})
  const [risks, setRisks] = useState<Record<string, RiskScore|'loading'>>({})
  const [interventions, setInterventions] = useState<PCNEIntervention[]>([])
  const [selected, setSelected] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'rounds'|'report'>('rounds')
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0,7))
  const [generatingReport, setGeneratingReport] = useState(false)
  const [report, setReport] = useState<string|null>(null)
  const plan = (user?.plan || 'free') as string
  const isPro = plan==='pro'||plan==='clinic'
  const pharmacist = user?.name || user?.email || 'Farmacêutico'

  const load = useCallback(async () => {
    if (!user || !isPro) { setLoading(false); return }
    const [{ data: ps }, { data: ivs }] = await Promise.all([
      supabase.from('patients').select('*, patient_meds(count)').eq('user_id', user.id),
      supabase.from('pcne_interventions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    const patientsWithCount = (ps||[]).map((p: any) => ({
      ...p,
      meds_count: p.patient_meds?.[0]?.count || 0,
    }))
    setPatients(patientsWithCount)
    setInterventions(ivs||[])
    setLoading(false)

    // Trigger risk analysis for each patient
    patientsWithCount.forEach(async (p: any) => {
      if (!p.id) return
      setRisks(prev => ({ ...prev, [p.id]: 'loading' }))
      const { data: pMeds } = await supabase.from('patient_meds')
        .select('id, name, dose, frequency, indication').eq('patient_id', p.id)
      setMeds(prev => ({ ...prev, [p.id]: pMeds || [] }))

      if ((pMeds||[]).length < 1) {
        setRisks(prev => ({ ...prev, [p.id]: { score:0, level:'low', alerts:[], summary:'Sem medicamentos registados.' } }))
        return
      }

      try {
        const { data: sd } = await supabase.auth.getSession()
        const res = await fetch('/api/patients/analyze', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${sd.session?.access_token}` },
          body: JSON.stringify({ patient: p, medications: (pMeds||[]).map((m: any) => ({ name: m.name, dose: m.dose, frequency: m.frequency })) }),
        })
        const data = await res.json()
        const alerts: PatientAlert[] = data.alerts || []
        const critical = alerts.filter(a => a.severity==='grave').length
        const moderate = alerts.filter(a => a.severity==='moderada').length
        const score = Math.min(100, critical*30 + moderate*15 + Math.min(30, (pMeds||[]).length*3))
        const level = score>=60?'critical':score>=40?'high':score>=20?'moderate':'low'
        setRisks(prev => ({ ...prev, [p.id]: { score, level, alerts, summary: data.summary||'' } }))
      } catch {
        setRisks(prev => ({ ...prev, [p.id]: { score:0, level:'low', alerts:[], summary:'Erro na análise.' } }))
      }
    })
  }, [user, supabase, isPro])

  useEffect(() => { load() }, [load])

  // Sort patients by risk score (highest first)
  const sorted = [...patients].sort((a, b) => {
    const ra = risks[a.id], rb = risks[b.id]
    const sa = (ra && ra !== 'loading') ? (ra as RiskScore).score : -1
    const sb = (rb && rb !== 'loading') ? (rb as RiskScore).score : -1
    return sb - sa
  })

  const selectedPatient = patients.find(p => p.id === selected)
  const selectedRisk = selected && risks[selected] !== 'loading' ? risks[selected] as RiskScore : null
  const selectedMeds = selected ? (meds[selected]||[]) : []

  const generateReport = async () => {
    setGeneratingReport(true)
    const monthInterventions = interventions.filter(i => i.date.startsWith(reportMonth))
    const problemCodes = monthInterventions.reduce((acc: Record<string, number>, i) => {
      acc[i.problem_code] = (acc[i.problem_code]||0) + 1; return acc
    }, {})
    const outcomeCodes = monthInterventions.reduce((acc: Record<string, number>, i) => {
      acc[i.outcome_code] = (acc[i.outcome_code]||0) + 1; return acc
    }, {})
    const accepted = monthInterventions.filter(i => i.accepted === true).length
    const total = monthInterventions.length

    const reportText = `RELATÓRIO DE ACTIVIDADE FARMACÊUTICA — ${reportMonth}
Farmacêutico: ${pharmacist}

SUMÁRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de intervenções PCNE: ${total}
Intervenções aceites pelo médico: ${accepted} (${total>0?Math.round(accepted/total*100):0}%)
Doentes monitorizados: ${patients.length}

DISTRIBUIÇÃO POR TIPO DE PROBLEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(problemCodes).map(([code,n]) => {
  const p = PCNE_PROBLEMS.find(x => x.code===code)
  return `${code} — ${p?.label||'Outro'}: ${n} intervenções`
}).join('\n') || 'Sem dados'}

RESULTADOS DAS INTERVENÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(outcomeCodes).map(([code,n]) => {
  const o = PCNE_OUTCOMES.find(x => x.code===code)
  return `${code} — ${o?.label||'Outro'}: ${n}`
}).join('\n') || 'Sem dados'}

INTERVENÇÕES DETALHADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${monthInterventions.map((iv,i) => `
${i+1}. ${iv.patient_name} — ${iv.date}
   Problema: ${iv.problem_code} | Causa: ${iv.cause_code} | Intervenção: ${iv.intervention_code}
   ${iv.description}
   ${iv.recommendation ? `Recomendação: ${iv.recommendation}` : ''}
   Resultado: ${PCNE_OUTCOMES.find(o=>o.code===iv.outcome_code)?.label||'—'}`).join('\n') || 'Sem intervenções neste período'}

Gerado pelo Phlox Clinical — phlox-clinical.com`

    setReport(reportText)
    setGeneratingReport(false)
  }

  const tabStyle = (t: string, active: boolean) => ({
    padding:'10px 18px', background:'none', border:'none',
    borderBottom:`2px solid ${active?'var(--green)':'transparent'}`,
    cursor:'pointer', fontSize:11, fontWeight:700,
    color:active?'var(--green)':'var(--ink-4)',
    fontFamily:'var(--font-sans)', letterSpacing:'0.04em',
    textTransform:'uppercase' as const, marginBottom:-1, whiteSpace:'nowrap' as const,
  })

  if (!isPro) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏥</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', marginBottom:12 }}>Phlox Rounds</div>
          <p style={{ fontSize:14, color:'var(--ink-4)', lineHeight:1.7, marginBottom:24 }}>
            Ronda farmacêutica digital com lista de doentes por score de risco, análise automática e registo PCNE. Exclusivo Pro / Institucional.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'#1d4ed8', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius:8, fontSize:14, fontWeight:700 }}>
            Activar Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'var(--font-sans)' }}>
      <Header />

      {/* Rounds header */}
      <div style={{ background:'#0f172a', borderBottom:'1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop:20, paddingBottom:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite' }} />
                Phlox Rounds · Ronda farmacêutica
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'#f8fafc', fontWeight:400 }}>
                {new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long' })}
              </div>
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'#f8fafc' }}>{patients.length}</div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em' }}>doentes</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'#dc2626' }}>
                  {Object.values(risks).filter(r => r!=='loading' && (r as RiskScore).level==='critical').length}
                </div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em' }}>críticos</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'#f8fafc' }}>{interventions.filter(i => i.date===new Date().toISOString().split('T')[0]).length}</div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em' }}>interv. hoje</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', borderTop:'1px solid #1e293b' }}>
            <button onClick={() => setTab('rounds')} style={tabStyle('rounds', tab==='rounds')}>Ronda</button>
            <button onClick={() => setTab('report')} style={tabStyle('report', tab==='report')}>Relatório Mensal</button>
          </div>
        </div>
      </div>

      {tab==='rounds' && (
        <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', height:'calc(100vh - 145px)' }} className="rounds-grid">
          {/* Patient list */}
          <div style={{ background:'white', borderRight:'1px solid var(--border)', overflowY:'auto' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                {loading ? 'A analisar...' : `${sorted.length} doentes · ordenados por risco`}
              </div>
              <Link href="/patients" style={{ fontSize:10, color:'#1d4ed8', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700 }}>+ Novo</Link>
            </div>

            {loading ? (
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:8 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height:64, borderRadius:6 }} />)}
              </div>
            ) : sorted.length===0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--ink-4)' }}>
                <div style={{ fontSize:28, marginBottom:10 }}>👤</div>
                <div style={{ fontSize:14, marginBottom:14 }}>Sem doentes ainda</div>
                <Link href="/patients" style={{ fontSize:12, color:'#1d4ed8', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700 }}>
                  Criar primeiro doente →
                </Link>
              </div>
            ) : sorted.map(p => (
              <PatientRow key={p.id} patient={p}
                risk={risks[p.id]!=='loading'?risks[p.id] as RiskScore:null}
                selected={selected===p.id} onSelect={() => setSelected(p.id)} />
            ))}
          </div>

          {/* Detail panel */}
          <div style={{ overflowY:'auto', background:'var(--bg-2)' }}>
            {!selected ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--ink-4)', gap:12 }}>
                <div style={{ fontSize:48 }}>🏥</div>
                <div style={{ fontSize:16, fontWeight:600, color:'var(--ink)' }}>Selecciona um doente</div>
                <div style={{ fontSize:13, color:'var(--ink-4)', textAlign:'center', maxWidth:300, lineHeight:1.6 }}>
                  A lista está ordenada por score de risco. Começa pelos doentes marcados a vermelho.
                </div>
              </div>
            ) : selectedPatient ? (
              <PatientPanel
                patient={selectedPatient} risk={selectedRisk} meds={selectedMeds}
                interventions={interventions} pharmacist={pharmacist}
                supabase={supabase} user={user}
                onNewIntervention={iv => setInterventions(prev => [iv, ...prev])}
              />
            ) : null}
          </div>
        </div>
      )}

      {tab==='report' && (
        <div className="page-container page-body" style={{ maxWidth:760 }}>
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:24, marginBottom:14 }}>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>Relatório Mensal de Actividade</div>

            <div style={{ display:'flex', gap:12, alignItems:'flex-end', marginBottom:20, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Mês</div>
                <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                  style={{ border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none', width:'100%' }} />
              </div>
              <button onClick={generateReport} disabled={generatingReport}
                style={{ padding:'10px 20px', background:'#1d4ed8', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)', opacity:generatingReport?0.7:1, whiteSpace:'nowrap' }}>
                {generatingReport ? 'A gerar...' : '📄 Gerar relatório'}
              </button>
            </div>

            {/* Stats for selected month */}
            {(() => {
              const mi = interventions.filter(i => i.date.startsWith(reportMonth))
              return (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:10, marginBottom:16 }}>
                  {[
                    { label:'Intervenções', value:mi.length, color:'#1d4ed8' },
                    { label:'Aceites', value:mi.filter(i=>i.accepted===true).length, color:'#0d6e42' },
                    { label:'Taxa de aceitação', value:`${mi.length>0?Math.round(mi.filter(i=>i.accepted===true).length/mi.length*100):0}%`, color:'#7c3aed' },
                    { label:'Doentes vistos', value:new Set(mi.map(i=>i.patient_id)).size, color:'#b45309' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'var(--bg-2)', borderRadius:8, padding:'14px' }}>
                      <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:s.color, fontWeight:400 }}>{s.value}</div>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {report && (
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Relatório gerado</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => navigator.clipboard.writeText(report)}
                    style={{ padding:'6px 12px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink-3)' }}>
                    📋 Copiar
                  </button>
                  <button onClick={() => {
                    const win = window.open('', '_blank')
                    if (win) { win.document.write(`<pre style="font-family:monospace;white-space:pre-wrap;padding:32px">${report}</pre>`); win.document.close(); win.print() }
                  }}
                    style={{ padding:'6px 12px', background:'var(--ink)', border:'none', borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'white' }}>
                    🖨 Imprimir
                  </button>
                </div>
              </div>
              <pre style={{ padding:'20px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-2)', lineHeight:1.8, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0, background:'var(--bg-2)' }}>
                {report}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @media(max-width:768px){.rounds-grid{grid-template-columns:1fr!important;height:auto!important}}
      `}</style>
    </div>
  )
}