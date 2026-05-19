'use client'

// app/residentes/page.tsx — Phlox Residentes
// Gestão farmacoterapêutica de residentes de lar de idosos / IPSS.
// O produto que converte lares em clientes institucionais a €199/mês.
//
// Funcionalidades:
// - Lista de residentes com score de risco farmacoterapêutico
// - Revisão automática AI de cada residente
// - Alertas activos por prioridade
// - Histórico de intervenções por residente
// - Relatório mensal para a ACSS / DGS
// - Export PDF por residente ou por instituição

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'CRITICO' | 'ALTO' | 'MODERADO' | 'BAIXO'

interface Resident {
  id: string
  name: string
  age: number
  room: string
  diagnosis: string
  medications: { name: string; dose: string; frequency: string; route?: string }[]
  allergies: string[]
  weight?: number
  creatinine?: number
  last_review?: string
  risk_level?: RiskLevel
  alert_count?: number
  alerts?: Alert[]
  notes?: string
}

interface Alert {
  id: string
  priority: 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'
  category: string
  title: string
  description: string
  action: string
  drugs_involved: string[]
  resolved: boolean
  created_at: string
}

interface ReviewResult {
  overall_risk: RiskLevel
  findings: Alert[]
  positives: string[]
  lab_monitoring: { test: string; frequency: string; reason: string }[]
  pharmacist_note: string
  next_review_weeks: number
}

// ─── Demo data (para utilizadores sem residentes ainda) ───────────────────────
const DEMO_RESIDENTS: Resident[] = [
  {
    id: 'demo-1',
    name: 'Maria João Ferreira',
    age: 84,
    room: '12A',
    diagnosis: 'HTA, IC-FEp, DM2, demência ligeira, osteoporose',
    medications: [
      { name: 'Furosemida', dose: '40mg', frequency: '1x/dia' },
      { name: 'Espironolactona', dose: '25mg', frequency: '1x/dia' },
      { name: 'Ramipril', dose: '5mg', frequency: '1x/dia' },
      { name: 'Bisoprolol', dose: '2.5mg', frequency: '1x/dia' },
      { name: 'Metformina', dose: '500mg', frequency: '2x/dia' },
      { name: 'Alprazolam', dose: '0.5mg', frequency: 'à noite' },
      { name: 'Omeprazol', dose: '20mg', frequency: '1x/dia' },
      { name: 'Alendronato', dose: '70mg', frequency: '1x/semana' },
      { name: 'Colecalciferol', dose: '800 UI', frequency: '1x/dia' },
      { name: 'Ácido acetilsalicílico', dose: '100mg', frequency: '1x/dia' },
    ],
    allergies: ['Penicilina'],
    weight: 58,
    creatinine: 1.4,
    last_review: '2026-03-15',
    risk_level: 'CRITICO',
    alert_count: 4,
  },
  {
    id: 'demo-2',
    name: 'António Manuel Costa',
    age: 79,
    room: '08B',
    diagnosis: 'DPOC moderada, HTA, depressão',
    medications: [
      { name: 'Tiotrópio', dose: '18mcg', frequency: '1x/dia', route: 'inalação' },
      { name: 'Salbutamol', dose: '100mcg', frequency: 'SOS', route: 'inalação' },
      { name: 'Amlodipina', dose: '5mg', frequency: '1x/dia' },
      { name: 'Sertralina', dose: '50mg', frequency: '1x/dia' },
      { name: 'Tramadol', dose: '50mg', frequency: '2x/dia' },
      { name: 'Lorazepam', dose: '1mg', frequency: 'à noite' },
    ],
    allergies: [],
    weight: 72,
    last_review: '2026-02-20',
    risk_level: 'ALTO',
    alert_count: 2,
  },
  {
    id: 'demo-3',
    name: 'Rosa Conceição Silva',
    age: 91,
    room: '15C',
    diagnosis: 'FA permanente, DRC G3b, osteoporose grave',
    medications: [
      { name: 'Apixabano', dose: '2.5mg', frequency: '2x/dia' },
      { name: 'Bisoprolol', dose: '5mg', frequency: '1x/dia' },
      { name: 'Atorvastatina', dose: '10mg', frequency: '1x/dia' },
      { name: 'Omeprazol', dose: '40mg', frequency: '1x/dia' },
      { name: 'Colecalciferol', dose: '1000 UI', frequency: '1x/dia' },
      { name: 'Ibuprofeno', dose: '400mg', frequency: 'SOS' },
    ],
    allergies: [],
    weight: 49,
    creatinine: 2.1,
    last_review: '2026-01-10',
    risk_level: 'CRITICO',
    alert_count: 3,
  },
  {
    id: 'demo-4',
    name: 'Joaquim Rodrigues',
    age: 75,
    room: '03A',
    diagnosis: 'HTA, dislipidemia, ansiedade',
    medications: [
      { name: 'Losartan', dose: '50mg', frequency: '1x/dia' },
      { name: 'Rosuvastatina', dose: '10mg', frequency: '1x/dia' },
      { name: 'Alprazolam', dose: '0.25mg', frequency: 'SOS' },
    ],
    allergies: ['AINEs'],
    last_review: '2026-04-01',
    risk_level: 'MODERADO',
    alert_count: 1,
  },
]

// ─── Risk styles ──────────────────────────────────────────────────────────────
const RISK_STYLE: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  CRITICO:  { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', label: 'Crítico' },
  ALTO:     { color: '#92400e', bg: '#fffbeb', border: '#fde68a', label: 'Alto' },
  MODERADO: { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', label: 'Moderado' },
  BAIXO:    { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0', label: 'Baixo' },
}

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  CRITICA: { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', dot: '#dc2626' },
  ALTA:    { color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#d97706' },
  MEDIA:   { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  INFO:    { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0', dot: '#16a34a' },
}

// ─── Resident card ────────────────────────────────────────────────────────────
function ResidentCard({
  resident,
  onSelect,
  onReview,
  reviewing,
}: {
  resident: Resident
  onSelect: () => void
  onReview: () => void
  reviewing: boolean
}) {
  const rs = RISK_STYLE[resident.risk_level || 'BAIXO']
  const daysSinceReview = resident.last_review
    ? Math.floor((Date.now() - new Date(resident.last_review).getTime()) / 86400000)
    : null
  const reviewOverdue = daysSinceReview !== null && daysSinceReview > 90

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>

      {/* Risk bar */}
      <div style={{ height: 3, background: rs.color }} />

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{resident.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 2 }}>
              {resident.age}a · Quarto {resident.room}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {rs.label}
            </span>
            {resident.alert_count !== undefined && resident.alert_count > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#991b1b', background: '#fee2e2', padding: '1px 6px', borderRadius: 3 }}>
                {resident.alert_count} alerta{resident.alert_count > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Diagnosis */}
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
          {resident.diagnosis}
        </div>

        {/* Med count + last review */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
            {resident.medications.length} medicamento{resident.medications.length !== 1 ? 's' : ''}
          </span>
          {daysSinceReview !== null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: reviewOverdue ? '#991b1b' : 'var(--ink-5)', background: reviewOverdue ? '#fee2e2' : 'transparent', padding: reviewOverdue ? '1px 5px' : 0, borderRadius: 3 }}>
              {reviewOverdue ? `revisão em atraso (${daysSinceReview}d)` : `revista há ${daysSinceReview}d`}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onSelect}
            style={{ flex: 1, padding: '8px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', transition: 'all 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}>
            Ver perfil
          </button>
          <button onClick={onReview} disabled={reviewing}
            style={{ flex: 1, padding: '8px', background: reviewing ? 'var(--bg-3)' : (reviewOverdue ? '#991b1b' : 'var(--green)'), color: reviewing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, cursor: reviewing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}>
            {reviewing ? 'A rever...' : 'Rever AI'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Resident detail panel ────────────────────────────────────────────────────
function ResidentDetail({ resident, review, onBack, onReview, reviewing }: {
  resident: Resident
  review: ReviewResult | null
  onBack: () => void
  onReview: () => void
  reviewing: boolean
}) {
  const handlePrint = () => {
    if (!review) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8">
    <title>Revisão Farmacoterapêutica — ${resident.name}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #111; padding: 24px; max-width: 780px; margin: 0 auto; }
      h1 { font-size: 16px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 12px; }
      h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #666; margin: 16px 0 6px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10px; color: #555; }
      .risk { display: inline-block; font-weight: 700; padding: 2px 8px; border-radius: 3px; font-size: 10px; letter-spacing: .08em; }
      .finding { margin-bottom: 8px; padding: 8px 10px; border-radius: 4px; border-left: 3px solid; break-inside: avoid; }
      .finding-title { font-weight: 700; font-size: 11px; margin-bottom: 3px; }
      .finding-desc { font-size: 10px; margin-bottom: 3px; }
      .finding-action { font-size: 10px; font-style: italic; }
      .med-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      .med-table th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #ddd; padding: 4px 6px; color: #888; }
      .med-table td { padding: 4px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
      .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }
      @media print { body { padding: 12px; } }
    </style></head><body>
    <div class="header">
      <div><strong>REVISÃO FARMACOTERAPÊUTICA</strong> — Phlox Residentes</div>
      <div>${new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <h1>${resident.name}</h1>
    <p><strong>Idade:</strong> ${resident.age} anos &nbsp;&nbsp; <strong>Quarto:</strong> ${resident.room} &nbsp;&nbsp; <strong>Diagnósticos:</strong> ${resident.diagnosis}</p>
    ${resident.allergies.length ? `<p><strong style="color:#dc2626">Alergias:</strong> ${resident.allergies.join(', ')}</p>` : ''}
    <span class="risk" style="background:${RISK_STYLE[review.overall_risk].bg};color:${RISK_STYLE[review.overall_risk].color};border:1px solid ${RISK_STYLE[review.overall_risk].border}">
      Risco ${RISK_STYLE[review.overall_risk].label}
    </span>
    <h2>Medicação (${resident.medications.length} fármacos)</h2>
    <table class="med-table">
      <tr><th>Medicamento</th><th>Dose</th><th>Frequência</th><th>Via</th></tr>
      ${resident.medications.map(m => `<tr><td>${m.name}</td><td>${m.dose}</td><td>${m.frequency}</td><td>${m.route || 'oral'}</td></tr>`).join('')}
    </table>
    <h2>Alertas e Observações (${review.findings.length})</h2>
    ${review.findings.map(f => {
      const ps = PRIORITY_STYLE[f.priority]
      return `<div class="finding" style="background:${ps.bg};border-color:${ps.color}">
        <div class="finding-title" style="color:${ps.color}">[${f.priority}] ${f.title}</div>
        <div class="finding-desc">${f.description}</div>
        <div class="finding-action">→ ${f.action}</div>
      </div>`
    }).join('')}
    ${review.lab_monitoring.length ? `<h2>Monitorização Analítica</h2>
    <table class="med-table">
      <tr><th>Análise</th><th>Frequência</th><th>Motivo</th></tr>
      ${review.lab_monitoring.map(l => `<tr><td>${l.test}</td><td>${l.frequency}</td><td>${l.reason}</td></tr>`).join('')}
    </table>` : ''}
    ${review.pharmacist_note ? `<h2>Nota do Farmacêutico</h2><p>${review.pharmacist_note}</p>` : ''}
    <div class="footer">
      <span>Gerado por Phlox Residentes · phlox-pi.vercel.app</span>
      <span>Próxima revisão recomendada: ${review.next_review_weeks} semanas</span>
    </div>
    <div style="margin-top:20px;border-top:1px solid #ddd;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#999">
      <span>Farmacêutico(a) responsável: _______________________</span>
      <span>Assinatura: _______________________</span>
    </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar à lista
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {review && (
            <button onClick={handlePrint}
              style={{ padding: '8px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir relatório
            </button>
          )}
          <button onClick={onReview} disabled={reviewing}
            style={{ padding: '8px 16px', background: reviewing ? 'var(--bg-3)' : 'var(--green)', color: reviewing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: reviewing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
            {reviewing ? 'A analisar...' : '↻ Nova revisão AI'}
          </button>
        </div>
      </div>

      {/* Patient header */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{resident.name}</h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
              {resident.age} anos · Quarto {resident.room}
              {resident.weight && ` · ${resident.weight} kg`}
              {resident.creatinine && ` · Cr ${resident.creatinine} mg/dL`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>{resident.diagnosis}</div>
            {resident.allergies.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                {resident.allergies.map(a => <span key={a} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 4 }}>Alergia: {a}</span>)}
              </div>
            )}
          </div>
          {review && (
            <div style={{ ...RISK_STYLE[review.overall_risk], padding: '8px 16px', borderRadius: 8, border: `1px solid ${RISK_STYLE[review.overall_risk].border}` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>Risco global</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 400 }}>{RISK_STYLE[review.overall_risk].label}</div>
            </div>
          )}
        </div>

        {/* Medications table */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Medicação ({resident.medications.length} fármacos)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {resident.medications.map((med, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', gap: 8, padding: '8px 10px', background: i % 2 === 0 ? 'var(--bg-2)' : 'white', borderRadius: 5, fontSize: 13, color: 'var(--ink)' }}>
                <span style={{ fontWeight: 600 }}>{med.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{med.dose}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{med.frequency}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>{med.route || 'oral'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review results */}
      {!review && !reviewing && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 10 }}>Sem revisão recente</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
            Clica em "Nova revisão AI" para analisar automaticamente a medicação deste residente.
          </p>
          <button onClick={onReview}
            style={{ padding: '12px 28px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Analisar com AI
          </button>
        </div>
      )}

      {reviewing && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>A analisar medicação</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>Verificar interações, doses, duplicações e monitorização necessária...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {review && !reviewing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Alerts */}
          {review.findings.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Alertas e observações — {review.findings.length} encontrados
                </div>
              </div>
              <div style={{ padding: '16px' }}>
                {review.findings
                  .sort((a, b) => ['CRITICA', 'ALTA', 'MEDIA', 'INFO'].indexOf(a.priority) - ['CRITICA', 'ALTA', 'MEDIA', 'INFO'].indexOf(b.priority))
                  .map((f, i) => {
                    const ps = PRIORITY_STYLE[f.priority]
                    return (
                      <div key={i} style={{ background: ps.bg, border: `1px solid ${ps.border}`, borderLeft: `3px solid ${ps.dot}`, borderRadius: 8, padding: '14px 16px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: ps.color, lineHeight: 1.3 }}>{f.title}</div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: ps.color, background: 'rgba(255,255,255,0.5)', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, marginLeft: 8 }}>{f.priority}</span>
                        </div>
                        <p style={{ fontSize: 13, color: ps.color, lineHeight: 1.65, margin: '0 0 8px', opacity: 0.9 }}>{f.description}</p>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: ps.color, background: 'rgba(255,255,255,0.4)', padding: '6px 10px', borderRadius: 5 }}>
                          <span style={{ flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontWeight: 600 }}>{f.action}</span>
                        </div>
                        {f.drugs_involved?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {f.drugs_involved.map(d => <span key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: ps.color, background: 'rgba(255,255,255,0.5)', border: '1px solid currentColor', padding: '1px 6px', borderRadius: 3, opacity: 0.7 }}>{d}</span>)}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Lab monitoring */}
          {review.lab_monitoring.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Monitorização analítica necessária</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {review.lab_monitoring.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 2fr', gap: 12, padding: '10px 20px', background: i % 2 === 0 ? 'white' : 'var(--bg-2)', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{l.test}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 4, textAlign: 'center' }}>{l.frequency}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{l.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pharmacist note */}
          {review.pharmacist_note && (
            <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderLeft: '3px solid var(--green)', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Nota do Farmacêutico</div>
              <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.75, margin: '0 0 10px' }}>{review.pharmacist_note}</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                Próxima revisão recomendada: {review.next_review_weeks} semanas
              </div>
            </div>
          )}

          {/* Positives */}
          {review.positives?.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Aspectos positivos da medicação</div>
              {review.positives.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < review.positives.length - 1 ? 6 : 0 }}>
                  <span style={{ color: '#0d6e42', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResidentesPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [residents, setResidents] = useState<Resident[]>([])
  const [selected, setSelected] = useState<Resident | null>(null)
  const [reviews, setReviews] = useState<Record<string, ReviewResult>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  const plan = (user as any)?.plan || 'free'
  const orgId = (user as any)?.org_id || null
  const canUse = plan === 'pro' || plan === 'clinic'

  useEffect(() => {
    if (!user) return
    if (!canUse) { setLoading(false); return }
    loadResidents()
  }, [user])

  const loadResidents = async () => {
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      if (!token) throw new Error('Sem sessão')
      // Try to load from DB — fall back to demo
      const { data, error: dbErr } = await supabase
        .from('residents')
        .select('*')
        .eq('org_id', orgId || user?.id)
        .order('name')
      if (dbErr || !data || data.length === 0) {
        setResidents(DEMO_RESIDENTS)
        setIsDemo(true)
      } else {
        setResidents(data)
      }
    } catch (_e: any) {
      setResidents(DEMO_RESIDENTS)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }

  const reviewResident = useCallback(async (resident: Resident) => {
    setReviewing(resident.id)
    setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/residentes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: resident.name,
          age: resident.age,
          diagnosis: resident.diagnosis,
          medications: resident.medications,
          allergies: resident.allergies,
          weight: resident.weight,
          creatinine: resident.creatinine,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro')
      const data: ReviewResult = await res.json()
      setReviews(prev => ({ ...prev, [resident.id]: data }))
      // Update risk level
      setResidents(prev => prev.map(r =>
        r.id === resident.id
          ? { ...r, risk_level: data.overall_risk, alert_count: data.findings.filter(f => f.priority === 'CRITICA' || f.priority === 'ALTA').length, last_review: new Date().toISOString() }
          : r
      ))
    } catch (e: any) {
      setError(e.message || 'Erro ao rever. Tenta novamente.')
    } finally {
      setReviewing(null)
    }
  }, [supabase])

  const filteredResidents = residents.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.room.toLowerCase().includes(search.toLowerCase()) || r.diagnosis.toLowerCase().includes(search.toLowerCase())
    const matchRisk = riskFilter === 'all' || r.risk_level === riskFilter
    return matchSearch && matchRisk
  })

  const stats = {
    total: residents.length,
    critical: residents.filter(r => r.risk_level === 'CRITICO').length,
    high: residents.filter(r => r.risk_level === 'ALTO').length,
    overdue: residents.filter(r => {
      if (!r.last_review) return true
      return Math.floor((Date.now() - new Date(r.last_review).getTime()) / 86400000) > 90
    }).length,
    totalMeds: residents.reduce((s, r) => s + r.medications.length, 0),
  }

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 600 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 36px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, marginBottom: 12 }}>Phlox Residentes</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 8, maxWidth: 420, margin: '0 auto 12px' }}>
            Gestão farmacoterapêutica completa dos residentes do teu lar ou IPSS.
          </p>
          <ul style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.9, margin: '0 0 28px', textAlign: 'left', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', padding: '0 0 0 20px' }}>
            <li>Revisão AI de todos os residentes em segundos</li>
            <li>Alertas por prioridade: crítico, alto, médio</li>
            <li>Monitorização analítica necessária por residente</li>
            <li>Relatórios imprimíveis por residente para o médico</li>
            <li>Dashboard de risco da instituição</li>
            <li>Histórico de revisões farmacoterapêuticas</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/pricing"
              style={{ padding: '12px 28px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Ver plano Pro →
            </Link>
            <Link href="/institucional"
              style={{ padding: '12px 20px', background: 'white', color: 'var(--ink-2)', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}>
              Plano Institucional
            </Link>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body">

        {/* Demo banner */}
        {isDemo && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#92400e' }}>
              <strong>Modo demonstração</strong> — a ver residentes de exemplo. Para usar com os teus residentes reais, importa a lista abaixo.
            </div>
            <button onClick={() => setShowAddForm(true)}
              style={{ padding: '6px 14px', background: '#b45309', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Importar residentes reais
            </button>
          </div>
        )}

        {selected ? (
          <ResidentDetail
            resident={selected}
            review={reviews[selected.id] || null}
            onBack={() => setSelected(null)}
            onReview={() => reviewResident(selected)}
            reviewing={reviewing === selected.id}
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Plano Institucional</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10 }}>Phlox Residentes</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 560 }}>
                Revisão farmacoterapêutica automatizada de todos os residentes. Identifica riscos, prioriza intervenções, gera relatórios para o médico.
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Total de residentes', value: stats.total, color: 'var(--ink)', bg: 'white' },
                { label: 'Risco crítico', value: stats.critical, color: '#991b1b', bg: '#fee2e2' },
                { label: 'Risco alto', value: stats.high, color: '#92400e', bg: '#fffbeb' },
                { label: 'Revisão em atraso', value: stats.overdue, color: '#1e40af', bg: '#eff6ff' },
                { label: 'Total de fármacos', value: stats.totalMeds, color: 'var(--ink-2)', bg: 'var(--bg-2)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Search + filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, quarto ou diagnóstico..."
                style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              {(['all', 'CRITICO', 'ALTO', 'MODERADO', 'BAIXO'] as const).map(r => (
                <button key={r} onClick={() => setRiskFilter(r)}
                  style={{ padding: '8px 14px', border: `1.5px solid ${riskFilter === r ? (r === 'all' ? 'var(--ink)' : RISK_STYLE[r as RiskLevel]?.color || 'var(--ink)') : 'var(--border)'}`, borderRadius: 8, background: riskFilter === r ? (r === 'all' ? 'var(--ink)' : RISK_STYLE[r as RiskLevel]?.bg || 'var(--bg-2)') : 'white', color: riskFilter === r ? (r === 'all' ? 'white' : RISK_STYLE[r as RiskLevel]?.color || 'var(--ink)') : 'var(--ink-4)', fontSize: 12, fontWeight: riskFilter === r ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.12s' }}>
                  {r === 'all' ? 'Todos' : r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
              <button onClick={() => reviewResident(filteredResidents[0])} disabled={!!reviewing || filteredResidents.length === 0}
                style={{ padding: '8px 16px', background: reviewing ? 'var(--bg-3)' : '#7c3aed', color: reviewing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: reviewing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                {reviewing ? 'A rever...' : 'Rever todos com AI'}
              </button>
            </div>

            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>{error}</div>}

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 12 }}>
                {filteredResidents.map(r => (
                  <ResidentCard key={r.id} resident={r}
                    onSelect={() => setSelected(r)}
                    onReview={() => reviewResident(r)}
                    reviewing={reviewing === r.id} />
                ))}
                {filteredResidents.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--ink-4)', fontSize: 14 }}>
                    Nenhum residente encontrado com esses filtros.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}