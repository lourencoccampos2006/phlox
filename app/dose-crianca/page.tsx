'use client'

// ─── NOVO: app/dose-crianca/page.tsx ───
// Calculadora de Dose Pediátrica — gratuita, sem login.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface DosePedResult {
  medicamento: string
  dose_calculada: string
  calculo_mostrado: string
  frequencia: string
  duracao: string
  forma_farmaceutica: string
  alertas_pediatricos: string[]
  contraindicado: boolean
  alternativa?: string
  observacoes: string
}

export default function DoseCriancaPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    medicamento: '',
    peso: '',
    idade_anos: '',
    idade_meses: '',
    indicacao: '',
  })
  const [result, setResult] = useState<DosePedResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = form.medicamento.trim() && form.peso && parseFloat(form.peso) > 0

  async function calculate() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/dose-crianca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicamento: form.medicamento.trim(),
          peso: parseFloat(form.peso),
          idade_anos: form.idade_anos ? parseInt(form.idade_anos) : undefined,
          idade_meses: form.idade_meses ? parseInt(form.idade_meses) : undefined,
          indicacao: form.indicacao.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '11px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', marginBottom: 4, display: 'block' as const }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body" style={{ maxWidth: 680 }}>

        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
            Gratuito · Sem conta necessária
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10 }}>
            Calculadora de Dose Pediátrica
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 540 }}>
            Calcula a dose correcta por mg/kg para crianças, com a forma farmacêutica adequada à idade e alertas pediátricos específicos.
          </p>
        </div>

        {/* Formulário */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '22px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Medicamento *</label>
              <input value={form.medicamento} onChange={e => setForm(f => ({ ...f, medicamento: e.target.value }))}
                placeholder="Ex: Amoxicilina, Ibuprofeno, Paracetamol..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Peso (kg) *</label>
              <input value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))}
                placeholder="Ex: 18.5" type="number" step="0.1" min="0.5" max="150" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Idade — anos</label>
              <input value={form.idade_anos} onChange={e => setForm(f => ({ ...f, idade_anos: e.target.value }))}
                placeholder="Ex: 5" type="number" min="0" max="17" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Idade — meses</label>
              <input value={form.idade_meses} onChange={e => setForm(f => ({ ...f, idade_meses: e.target.value }))}
                placeholder="Ex: 8" type="number" min="0" max="11" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Indicação (opcional)</label>
              <input value={form.indicacao} onChange={e => setForm(f => ({ ...f, indicacao: e.target.value }))}
                placeholder="Ex: Otite, febre, faringite estreptocócica..." style={inputStyle} />
            </div>
          </div>

          <button onClick={calculate} disabled={!canSubmit || loading}
            style={{ width: '100%', padding: '13px', background: canSubmit && !loading ? 'var(--ink)' : 'var(--bg-3)', color: canSubmit && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: canSubmit && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
            {loading ? 'A calcular...' : 'Calcular dose'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div>
            {/* Alerta contraindicação */}
            {result.contraindicado && (
              <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
                  {result.medicamento} contraindicado nesta faixa etária
                </div>
                {result.alternativa && (
                  <div style={{ fontSize: 13, color: '#7f1d1d' }}>
                    <strong>Alternativa recomendada:</strong> {result.alternativa}
                  </div>
                )}
              </div>
            )}

            {/* Dose principal */}
            {!result.contraindicado && (
              <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 10, padding: '20px', marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
                  {result.medicamento}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 14 }}>
                  {[
                    { label: 'Dose por toma', value: result.dose_calculada },
                    { label: 'Frequência', value: result.frequencia },
                    { label: 'Duração', value: result.duracao },
                    { label: 'Forma farmacêutica', value: result.forma_farmaceutica },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3, fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Cálculo mostrado */}
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--green-light)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
                  {result.calculo_mostrado}
                </div>
              </div>
            )}

            {/* Alertas pediátricos */}
            {result.alertas_pediatricos?.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#d97706', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>
                  Alertas pediátricos
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.alertas_pediatricos.map((a, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Observações */}
            {result.observacoes && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Observações</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.observacoes}</p>
              </div>
            )}

            {/* Aviso + CTA perfil */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>Confirma sempre com o farmacêutico ou médico</div>
              <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>Esta calculadora é um auxiliar de referência. As doses podem variar consoante a indicação, função renal, e outros medicamentos concomitantes.</div>
            </div>

            {user && (
              <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                  Guardar no perfil de uma criança?
                </div>
                <Link href="/perfis" style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, border: '1px solid var(--green)', padding: '6px 12px', borderRadius: 5, flexShrink: 0 }}>
                  Ver perfis →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Aviso legal */}
        <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Calculadora de referência baseada em guidelines pediátricas. Não substitui a avaliação clínica. Confirma sempre as doses com o farmacêutico ou pediatra responsável.
        </div>
      </div>
    </div>
  )
}
