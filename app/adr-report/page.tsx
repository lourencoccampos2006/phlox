'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface ADRResult {
  who_umc_causality: string
  who_umc_score: number | null
  seriousness: string
  seriousness_criteria: string[]
  meddra_term: string
  soc: string
  mechanism: string
  similar_reports: string
  recommendations: string[]
  infarmed_report_required: boolean
  infarmed_deadline_days: number
  summary: string
  disclaimer: string
}

const CAUSALITY_COLOR: Record<string, string> = {
  'Definida': '#059669',
  'Provável': '#d97706',
  'Possível': '#2563eb',
  'Improvável': '#6b7280',
  'Inclassificável': '#6b7280',
}

export default function ADRReportPage() {
  const { user, supabase } = useAuth()
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [form, setForm] = useState({
    suspected_drug: '',
    reaction: '',
    onset_date: '',
    action_taken: '',
    outcome: '',
    patient_age: '',
    patient_sex: '',
    other_drugs: '',
  })
  const [result, setResult] = useState<ADRResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  const analyze = async () => {
    if (!form.suspected_drug.trim() || !form.reaction.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/adr-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ ...form, patient_age: form.patient_age ? Number(form.patient_age) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro na análise'); return }
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro de ligação')
    } finally {
      setLoading(false)
    }
  }

  const copyReport = () => {
    if (!result) return
    const text = `NOTIFICAÇÃO DE REAÇÃO ADVERSA A MEDICAMENTO
Gerado via Phlox — ${new Date().toLocaleDateString('pt-PT')}

MEDICAMENTO SUSPEITO: ${form.suspected_drug}
REAÇÃO: ${form.reaction}
DOENTE: ${form.patient_age ? form.patient_age + ' anos' : '?'} · ${form.patient_sex || '?'}

CAUSALIDADE WHO-UMC: ${result.who_umc_causality}${result.who_umc_score ? ` (score ${result.who_umc_score}/9)` : ''}
GRAVIDADE: ${result.seriousness}
TERMO MedDRA: ${result.meddra_term}
SOC: ${result.soc}

MECANISMO: ${result.mechanism}

RECOMENDAÇÕES:
${result.recommendations.map(r => `• ${r}`).join('\n')}

NARRATIVA: ${result.summary}

${result.infarmed_report_required ? `⚠️ NOTIFICAÇÃO INFARMED OBRIGATÓRIA — prazo: ${result.infarmed_deadline_days} dias` : 'Notificação ao INFARMED não obrigatória (mas recomendada)'}

${result.disclaimer}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40 }}>🔬</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Notificação de RAM</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para analisar e reportar reações adversas.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Farmacovigilância</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>Notificação de Reação Adversa</div>
            </div>
            <ProfileSelector onChange={p => setActiveProfileState(p)} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 560 }}>
            Analisa a causalidade, classifica pela WHO-UMC e gera a narrativa para reportar ao INFARMED.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Form */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>📋 Dados da notificação</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Medicamento suspeito *</div>
                  <input value={form.suspected_drug} onChange={e => setForm(p => ({ ...p, suspected_drug: e.target.value }))}
                    placeholder="Ex: Lisinopril 10mg" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Data de início da reação</div>
                  <input type="date" value={form.onset_date} onChange={e => setForm(p => ({ ...p, onset_date: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Descrição da reação adversa *</div>
                <textarea value={form.reaction} onChange={e => setForm(p => ({ ...p, reaction: e.target.value }))}
                  placeholder="Descreve a reação: sintomas, intensidade, duração, impacto na vida diária..."
                  rows={4} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Idade do doente</div>
                  <input type="number" value={form.patient_age} onChange={e => setForm(p => ({ ...p, patient_age: e.target.value }))}
                    placeholder="Ex: 67" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Sexo</div>
                  <select value={form.patient_sex} onChange={e => setForm(p => ({ ...p, patient_sex: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', background: 'white' }}>
                    <option value="">—</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Resultado</div>
                  <select value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', background: 'white' }}>
                    <option value="">—</option>
                    <option value="Recuperado">Recuperado</option>
                    <option value="A recuperar">A recuperar</option>
                    <option value="Não recuperado">Não recuperado</option>
                    <option value="Recuperado com sequelas">Com sequelas</option>
                    <option value="Morte">Morte</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Ação tomada</div>
                <input value={form.action_taken} onChange={e => setForm(p => ({ ...p, action_taken: e.target.value }))}
                  placeholder="Ex: Medicamento suspenso, dose reduzida, internamento..."
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Outros medicamentos concomitantes</div>
                <input value={form.other_drugs} onChange={e => setForm(p => ({ ...p, other_drugs: e.target.value }))}
                  placeholder="Ex: Metformina, Atorvastatina, Aspirina..."
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
                  ⚠️ {error}
                </div>
              )}

              <button onClick={analyze} disabled={loading || !form.suspected_drug.trim() || !form.reaction.trim()} style={{
                padding: '13px', background: (loading || !form.suspected_drug.trim() || !form.reaction.trim()) ? '#9ca3af' : '#0f172a',
                color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: (loading || !form.suspected_drug.trim() || !form.reaction.trim()) ? 'default' : 'pointer',
              }}>
                {loading ? '⏳ A analisar...' : '🔬 Analisar RAM · Classificação WHO-UMC'}
              </button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* INFARMED alert */}
              {result.infarmed_report_required && (
                <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24 }}>🚨</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Notificação INFARMED obrigatória</div>
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                      Esta RAM grave deve ser notificada ao INFARMED em {result.infarmed_deadline_days} dias.
                      {' '}<a href="https://extranet.infarmed.pt/INFARMEWEB" target="_blank" rel="noopener noreferrer" style={{ color: '#991b1b', fontWeight: 700 }}>Portal RAM →</a>
                    </div>
                  </div>
                </div>
              )}

              {/* Causality card */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ background: '#0f172a', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Causalidade WHO-UMC</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: CAUSALITY_COLOR[result.who_umc_causality] || '#10b981' }}>{result.who_umc_causality}</div>
                  </div>
                  {result.who_umc_score && (
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 16 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>{result.who_umc_score}/9</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Score</div>
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: result.seriousness === 'Grave' ? '#f87171' : '#6ee7b7', fontWeight: 700 }}>{result.seriousness}</div>
                    {result.seriousness_criteria.length > 0 && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{result.seriousness_criteria.slice(0, 2).join(' · ')}</div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Termo MedDRA (PT)</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{result.meddra_term || '—'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>System Organ Class</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{result.soc || '—'}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mecanismo</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{result.mechanism}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recomendações</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {result.recommendations.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Narrative */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>📄 Narrativa para notificação</div>
                  <button onClick={copyReport} style={{ padding: '7px 14px', background: copied ? '#10b981' : 'var(--bg-2)', color: copied ? 'white' : 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {copied ? '✓ Copiado' : '📋 Copiar tudo'}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, background: 'var(--bg-2)', padding: '12px 16px', borderRadius: 8, fontFamily: 'var(--font-mono)' }}>
                  {result.summary}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-5)', fontStyle: 'italic' }}>
                  {result.disclaimer}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
