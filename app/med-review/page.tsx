'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'

interface Finding {
  id: string
  priority: Priority
  category: 'interacao' | 'duplicacao' | 'monitorização' | 'contraindicacao' | 'dose' | 'adesao' | 'positivo'
  title: string
  description: string
  action: string
  drugs_involved: string[]
  evidence?: string
}

interface MedReview {
  generated_at: string
  patient_summary: string
  overall_risk: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO'
  medications_reviewed: string[]
  findings: Finding[]
  positives: string[]
  lab_monitoring: { test: string; frequency: string; reason: string }[]
  follow_up: string
  pharmacist_note: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Priority, { bg: string; border: string; color: string; dot: string; label: string }> = {
  CRITICA: { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444', label: 'CRÍTICA' },
  ALTA:    { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b', label: 'ALTA' },
  MEDIA:   { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a5f', dot: '#3b82f6', label: 'MÉDIA' },
  INFO:    { bg: '#f0fdf4', border: '#bbf7d0', color: '#14532d', dot: '#22c55e', label: 'INFO' },
}

const RISK_STYLE = {
  BAIXO:   { bg: '#f0fdf4', border: '#86efac', color: '#14532d', bar: '#22c55e' },
  MODERADO:{ bg: '#fffbeb', border: '#fde68a', color: '#78350f', bar: '#f59e0b' },
  ALTO:    { bg: '#fff7ed', border: '#fdba74', color: '#7c2d12', bar: '#f97316' },
  CRITICO: { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', bar: '#ef4444' },
}

const CAT_ICON: Record<Finding['category'], string> = {
  interacao:        '⚡',
  duplicacao:       '♊',
  monitorização:    '🔬',
  contraindicacao:  '🚫',
  dose:             '💊',
  adesao:           '📅',
  positivo:         '✓',
}

function UpgradeGate() {
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
        🔬
      </div>
      <div style={{ display: 'inline-block', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 12px', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
        Revisão Clínica de Medicação
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 8 }}>
        O serviço que farmacêuticos clínicos fazem manualmente — automatizado. Análise completa do teu perfil farmacológico com priorização de riscos, alertas de monitorização e relatório exportável.
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 28 }}>
        No privado custa €50-200 por sessão. No Pro é ilimitado.
      </p>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
        {[
          '🔴 Identifica interações críticas no teu perfil completo',
          '🟡 Detecta duplicações terapêuticas e doses inadequadas',
          '🔬 Lista os exames laboratoriais que deves fazer e quando',
          '📄 Gera relatório PDF para levar ao teu médico',
          '🔔 Alerta automático quando adicionas novo medicamento',
        ].map(item => (
          <div key={item} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 14, color: 'var(--ink-2)' }}>
            {item}
          </div>
        ))}
      </div>
      <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 32px', borderRadius: 6, fontSize: 15, fontWeight: 600 }}>
        Upgrade para Pro — 12,99€/mês →
      </Link>
      <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12, fontFamily: 'var(--font-mono)' }}>Cancela quando quiseres.</p>
    </div>
  )
}

function NoMeds() {
  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>💊</div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Sem medicamentos no perfil</h2>
      <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
        Adiciona os teus medicamentos no dashboard para gerar a revisão clínica.
      </p>
      <Link href="/dashboard?tab=meds" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
        Adicionar medicamentos →
      </Link>
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <div className="fade-in">
      <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '24px', marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 12, width: 200, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 28, width: 300, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 13, width: 180 }} />
            <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 20 }} />
          </div>
          <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '60%' }} />
        </div>
      ))}
    </div>
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportToPDF(review: MedReview, medNames: string[]) {
  const date = new Date(review.generated_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

  const criticalFindings = review.findings.filter(f => f.priority === 'CRITICA' || f.priority === 'ALTA')
  const otherFindings = review.findings.filter(f => f.priority === 'MEDIA' || f.priority === 'INFO')

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Revisão de Medicação — Phlox</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 3px solid #16a34a; padding-bottom: 20px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
  .logo { font-size: 28px; font-weight: 700; color: #16a34a; }
  .meta { text-align: right; font-family: monospace; font-size: 11px; color: #666; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 14px; font-family: monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #666; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .risk-box { padding: 16px 20px; border-radius: 6px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px; }
  .risk-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
  .meds-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .med-pill { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 3px 10px; font-family: monospace; font-size: 12px; color: #14532d; }
  .finding { border-left: 4px solid; padding: 14px 16px; margin-bottom: 10px; border-radius: 0 6px 6px 0; }
  .finding-title { font-weight: 700; margin-bottom: 6px; font-size: 14px; }
  .finding-desc { font-size: 13px; line-height: 1.6; margin-bottom: 8px; color: #374151; }
  .finding-action { font-size: 12px; font-family: monospace; color: #6b7280; }
  .lab-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .lab-table th { background: #f9fafb; text-align: left; padding: 8px 12px; font-family: monospace; font-size: 11px; letter-spacing: 0.06em; color: #6b7280; }
  .lab-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  .positive { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 8px 12px; margin-bottom: 6px; font-size: 13px; color: #14532d; }
  .disclaimer { margin-top: 32px; padding: 12px 16px; background: #f9fafb; border-radius: 4px; font-size: 11px; font-family: monospace; color: #9ca3af; line-height: 1.6; }
  .pharmacist-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 14px 16px; margin: 16px 0; font-size: 13px; line-height: 1.7; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Phlox Clinical</div>
    <div style="font-size:13px;color:#666;margin-top:4px;">Plataforma Farmacológica Clínica · phlox.health</div>
  </div>
  <div class="meta">
    <div>Revisão de Medicação</div>
    <div>${date}</div>
    <div>Gerado automaticamente por IA</div>
  </div>
</div>

<h1>Revisão Clínica de Medicação</h1>
<p style="font-size:14px;color:#666;margin-top:4px;margin-bottom:20px;">${review.patient_summary}</p>

<div class="risk-box" style="background:${RISK_STYLE[review.overall_risk].bg};border:1px solid ${RISK_STYLE[review.overall_risk].border}">
  <div class="risk-dot" style="background:${RISK_STYLE[review.overall_risk].bar}"></div>
  <div>
    <div style="font-weight:700;font-size:16px;color:${RISK_STYLE[review.overall_risk].color}">Risco Global: ${review.overall_risk}</div>
    <div style="font-size:13px;color:#666;margin-top:2px;">${review.medications_reviewed.length} medicamentos analisados · ${review.findings.length} observações identificadas</div>
  </div>
</div>

<h2>Medicamentos Analisados</h2>
<div class="meds-list">${medNames.map(m => `<div class="med-pill">${m}</div>`).join('')}</div>

${criticalFindings.length > 0 ? `
<h2>⚠ Alertas Prioritários</h2>
${criticalFindings.map(f => `
<div class="finding" style="border-color:${f.priority === 'CRITICA' ? '#ef4444' : '#f59e0b'};background:${f.priority === 'CRITICA' ? '#fff5f5' : '#fffbeb'}">
  <div class="finding-title" style="color:${f.priority === 'CRITICA' ? '#7f1d1d' : '#78350f'}">${CAT_ICON[f.category]} ${f.title}</div>
  <div class="finding-desc">${f.description}</div>
  <div class="finding-action">→ ${f.action}</div>
</div>`).join('')}` : ''}

${otherFindings.length > 0 ? `
<h2>Outras Observações</h2>
${otherFindings.map(f => `
<div class="finding" style="border-color:${PRIORITY_STYLE[f.priority].dot};background:${PRIORITY_STYLE[f.priority].bg}">
  <div class="finding-title" style="color:${PRIORITY_STYLE[f.priority].color}">${CAT_ICON[f.category]} ${f.title}</div>
  <div class="finding-desc">${f.description}</div>
  <div class="finding-action">→ ${f.action}</div>
</div>`).join('')}` : ''}

${review.lab_monitoring.length > 0 ? `
<h2>🔬 Monitorização Laboratorial Recomendada</h2>
<table class="lab-table">
  <thead><tr><th>Parâmetro</th><th>Frequência</th><th>Motivo</th></tr></thead>
  <tbody>${review.lab_monitoring.map(l => `<tr><td><strong>${l.test}</strong></td><td>${l.frequency}</td><td>${l.reason}</td></tr>`).join('')}</tbody>
</table>` : ''}

${review.positives.length > 0 ? `
<h2>✓ Aspectos Positivos</h2>
${review.positives.map(p => `<div class="positive">✓ ${p}</div>`).join('')}` : ''}

<h2>Nota do Farmacologista</h2>
<div class="pharmacist-note">${review.pharmacist_note}</div>

<p style="font-size:13px;color:#374151;margin-top:16px;"><strong>Próximo follow-up:</strong> ${review.follow_up}</p>

<div class="disclaimer">
⚕ Este relatório foi gerado pela plataforma Phlox Clinical (phlox.health) com recurso a inteligência artificial e bases de dados farmacológicas (RxNorm/NIH, OpenFDA). Destina-se a fins educativos e de apoio à decisão clínica. Não substitui a consulta com um médico ou farmacêutico. Partilhe este relatório com o seu profissional de saúde antes de tomar qualquer decisão clínica.
</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `revisao-medicacao-phlox-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MedReviewPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [meds, setMeds] = useState<{ id: string; name: string; dose?: string; frequency?: string }[]>([])
  const [medsLoading, setMedsLoading] = useState(true)
  const [review, setReview] = useState<MedReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('personal_meds').select('*').eq('user_id', user.id)
      .then(({ data }) => { setMeds(data || []); setMedsLoading(false) })
  }, [user, supabase])

  const generateReview = async () => {
    if (meds.length < 1) return
    setLoading(true); setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }

      const res = await fetch('/api/med-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          medications: meds.map(m => ({
            name: m.name,
            dose: m.dose,
            frequency: m.frequency,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar revisão.')
      setReview(data)
      setLastGenerated(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div className="page-container page-body" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 20 }}>Faz login para aceder à revisão clínica de medicação.</p>
          <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>Fazer login →</Link>
        </div>
      </div>
    )
  }

  const riskStyle = review ? RISK_STYLE[review.overall_risk] : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {!isPro && <UpgradeGate />}

        {isPro && !medsLoading && meds.length === 0 && <NoMeds />}

        {isPro && !medsLoading && meds.length > 0 && (
          <div className="interactions-layout">

            {/* LEFT PANEL */}
            <div className="sticky-panel">
            {user && (
              <div style={{ marginBottom: 10 }}>
                <ProfileSelector onChange={async p => {
                  if (!supabase) return
                  const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
                  const col = p.id === 'self' ? 'user_id' : 'profile_id'
                  const id = p.id === 'self' ? (user as any)?.id : p.id
                  const { data } = await supabase.from(table).select('name, dose, frequency, indication').eq(col, id)
                  if (data?.length) {
                    const mappedMeds = data.map((m: any, index: number) => ({
                      id: `${p.id}-${index}`,
                      name: m.name,
                      dose: m.dose,
                      frequency: m.frequency,
                    }))
                    setMeds(mappedMeds)
                  }
                }} />
              </div>
            )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'inline-block', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Revisão Clínica de Medicação</h1>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                  Análise completa do teu perfil farmacológico por IA clínica. Interações, duplicações, monitorização e relatório PDF.
                </p>
              </div>

              {/* Medication list */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {meds.length} medicamentos
                  </div>
                  <Link href="/dashboard?tab=meds" style={{ fontSize: 11, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Editar →</Link>
                </div>
                {meds.map((med, i) => (
                  <div key={med.id} style={{ padding: '10px 16px', borderBottom: i < meds.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{med.name}</div>
                    {med.dose && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{med.dose}</div>}
                  </div>
                ))}
              </div>

              <button onClick={generateReview} disabled={loading}
                style={{ width: '100%', background: loading ? 'var(--bg-3)' : 'var(--green)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 12 }}>
                {loading ? 'A analisar perfil completo...' : review ? 'Gerar nova revisão' : 'Gerar revisão clínica →'}
              </button>

              {lastGenerated && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginBottom: 12 }}>
                  Última revisão: {lastGenerated.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              {review && (
                <button onClick={() => exportToPDF(review, meds.map(m => m.name))}
                  style={{ width: '100%', background: 'white', color: 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  📄 Exportar relatório PDF
                </button>
              )}

              {/* What we analyse */}
              <div style={{ marginTop: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>O QUE ANALISAMOS</div>
                {[
                  ['⚡', 'Interações medicamentosas'],
                  ['♊', 'Duplicações terapêuticas'],
                  ['🚫', 'Contraindicações e critérios Beers'],
                  ['💊', 'Adequação de doses'],
                  ['🔬', 'Monitorização laboratorial'],
                  ['📅', 'Adesão e simplificação'],
                ].map(([icon, label]) => (
                  <div key={label as string} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--ink-3)' }}>
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div>
              {loading && <ReviewSkeleton />}

              {!review && !loading && !error && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '60px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🔬</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10 }}>
                    Revisão clínica ao teu alcance
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto 24px' }}>
                    Clica em "Gerar revisão clínica" para receber uma análise completa do teu perfil farmacológico — o mesmo que um farmacêutico clínico faria numa consulta.
                  </p>
                  <button onClick={generateReview}
                    style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Gerar agora →
                  </button>
                </div>
              )}

              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '20px' }}>
                  <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
                </div>
              )}

              {review && !loading && riskStyle && (
                <div className="fade-in">
                  {/* Risk header */}
                  <div style={{ background: riskStyle.bar, borderRadius: '8px 8px 0 0', padding: '20px 24px', marginBottom: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>PERFIL DE RISCO GLOBAL</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'white', fontWeight: 700, marginBottom: 4 }}>{review.overall_risk}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{review.patient_summary}</div>
                  </div>

                  {/* Stats bar */}
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '14px 24px', display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
                    {[
                      { n: review.findings.filter(f => f.priority === 'CRITICA').length, label: 'Críticas', color: '#ef4444' },
                      { n: review.findings.filter(f => f.priority === 'ALTA').length, label: 'Altas', color: '#f59e0b' },
                      { n: review.findings.filter(f => f.priority === 'MEDIA').length, label: 'Médias', color: '#3b82f6' },
                      { n: review.lab_monitoring.length, label: 'Exames', color: 'var(--green)' },
                    ].map(({ n, label, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color }}>{n}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Findings */}
                  {(['CRITICA', 'ALTA', 'MEDIA', 'INFO'] as Priority[]).map(priority => {
                    const group = review.findings.filter(f => f.priority === priority)
                    if (group.length === 0) return null
                    const s = PRIORITY_STYLE[priority]
                    return (
                      <div key={priority} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.color, fontWeight: 700, letterSpacing: '0.08em' }}>
                            {s.label} — {group.length} observaç{group.length === 1 ? 'ão' : 'ões'}
                          </span>
                        </div>
                        {group.map(f => (
                          <div key={f.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.dot}`, borderRadius: '0 6px 6px 0', padding: '14px 18px', marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>
                                {CAT_ICON[f.category]} {f.title}
                              </div>
                              {f.drugs_involved.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {f.drugs_involved.map(d => (
                                    <span key={d} style={{ fontSize: 10, background: 'white', border: `1px solid ${s.border}`, borderRadius: 3, padding: '2px 7px', fontFamily: 'var(--font-mono)', color: s.color }}>{d}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: '0 0 10px' }}>{f.description}</p>
                            <div style={{ padding: '8px 12px', background: 'white', borderRadius: 4, fontSize: 12, color: 'var(--ink-2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ color: s.dot, flexShrink: 0, fontWeight: 700 }}>→</span>
                              <span>{f.action}</span>
                            </div>
                            {f.evidence && (
                              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Evidência: {f.evidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}

                  {/* Lab monitoring */}
                  {review.lab_monitoring.length > 0 && (
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          🔬 Monitorização laboratorial recomendada
                        </div>
                      </div>
                      {review.lab_monitoring.map((lab, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', borderBottom: i < review.lab_monitoring.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ padding: '11px 16px', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{lab.test}</div>
                          <div style={{ padding: '11px 16px', fontSize: 12, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border)' }}>{lab.frequency}</div>
                          <div style={{ padding: '11px 16px', fontSize: 12, color: 'var(--ink-3)', borderLeft: '1px solid var(--border)' }}>{lab.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Positives */}
                  {review.positives.length > 0 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '16px 18px', marginBottom: 16 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#14532d', letterSpacing: '0.08em', marginBottom: 10 }}>✓ PONTOS POSITIVOS</div>
                      {review.positives.map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: '#14532d' }}>
                          <span style={{ flexShrink: 0, fontWeight: 700 }}>✓</span><span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pharmacist note */}
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px 18px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 8 }}>NOTA DO FARMACOLOGISTA</div>
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: '0 0 10px' }}>{review.pharmacist_note}</p>
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>Próximo follow-up: {review.follow_up}</div>
                  </div>

                  {/* Export */}
                  <button onClick={() => exportToPDF(review, meds.map(m => m.name))}
                    style={{ width: '100%', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginBottom: 12 }}>
                    📄 Exportar relatório para PDF
                  </button>

                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
                    ⚕️ Partilha este relatório com o teu médico ou farmacêutico antes de tomar qualquer decisão clínica.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}