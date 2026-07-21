'use client'

// /exportar-saude — Exportar o meu Registo de Saúde (Pro, item D20 da
// auditoria). Um dump completo e estruturado (medicação, vitais, sintomas,
// análises) para levar a qualquer médico — diferente do /passport (cartão de
// emergência mínimo) e do /relatorio (resumo curado por IA): aqui é o
// histórico completo em bruto, sem interpretação.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

const ACCENT = '#0f172a'
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

interface Med { name: string; dose?: string; frequency?: string; started_at?: string }
interface Vital { recorded_at: string; bp_sys?: number; bp_dia?: number; hr?: number; spo2?: number; weight?: number; glucose?: number; temp?: number }
interface Symptom { at: string; symptoms?: string[]; pain?: number; temperature?: number; notes?: string }
interface LabRecord { date: string; lab_name?: string; values: { name: string; value: string; unit?: string; reference?: string; status?: string }[] }
interface ExportData { meds: Med[]; vitals: Vital[]; symptoms: Symptom[]; labs: LabRecord[]; generated_at: string }
interface ShareSession { token: string; pin: string; expires_at: string }

export default function ExportarSaudePage() {
  const { user, supabase } = useAuth() as any
  const [data, setData] = useState<ExportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // ── Partilhar por QR — mesma sessão temporária (QR+PIN) do /passport,
  // pedida com as secções que este registo cobre (meds/vitais/sintomas; as
  // análises não fazem parte do vocabulário de secções do Health Pass).
  const [session, setSession] = useState<ShareSession | null>(null)
  const [creating, setCreating] = useState(false)
  const [shareErr, setShareErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/health-export', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setData(j)
    } catch (e: any) { setErr(e.message || 'Não foi possível carregar o teu registo.') }
    finally { setLoading(false) }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function createShare() {
    setCreating(true); setShareErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/health-pass/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ sections: ['meds', 'vitals', 'symptoms'], minutes: 30 }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Não foi possível gerar o QR.')
      setSession(j)
    } catch (e: any) { setShareErr(e.message || 'Não foi possível gerar o QR.') }
    finally { setCreating(false) }
  }

  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = session ? `${shareOrigin}/hp/${session.token}` : ''
  const shareExpired = session ? new Date(session.expires_at).getTime() < Date.now() : false

  function exportPDF() {
    if (!data) return
    printDoc({
      docTitle: `Registo de Saúde — ${user?.name || ''}`,
      docSubtitle: `Gerado em ${new Date(data.generated_at).toLocaleDateString('pt-PT')} · para entregar ao médico`,
      meta: [
        { label: 'medicamentos', value: String(data.meds.length) },
        { label: 'registos vitais', value: String(data.vitals.length) },
      ],
      sections: [
        {
          heading: `Medicação atual (${data.meds.length})`,
          records: data.meds.length ? data.meds.map(m => ({ title: m.name, meta: [m.dose, m.frequency, m.started_at ? `desde ${new Date(m.started_at).toLocaleDateString('pt-PT')}` : ''].filter(Boolean).join(' · ') })) : [{ title: 'Nenhum medicamento registado' }],
        },
        {
          heading: `Sinais vitais — últimos 12 meses (${data.vitals.length})`,
          records: data.vitals.length ? data.vitals.map(v => ({
            title: new Date(v.recorded_at).toLocaleDateString('pt-PT'),
            meta: [
              v.bp_sys != null ? `TA ${v.bp_sys}/${v.bp_dia ?? '—'}` : '',
              v.hr != null ? `FC ${v.hr}bpm` : '',
              v.spo2 != null ? `SpO₂ ${v.spo2}%` : '',
              v.weight != null ? `${v.weight}kg` : '',
              v.glucose != null ? `Glicemia ${v.glucose}mg/dL` : '',
              v.temp != null ? `${v.temp}°C` : '',
            ].filter(Boolean).join(' · '),
          })) : [{ title: 'Nenhum registo' }],
        },
        {
          heading: `Sintomas — últimos 12 meses (${data.symptoms.length})`,
          records: data.symptoms.length ? data.symptoms.map(s => ({
            title: new Date(s.at).toLocaleDateString('pt-PT'),
            meta: [s.symptoms?.join(', '), s.pain != null ? `dor ${s.pain}/10` : '', s.temperature != null ? `${s.temperature}°C` : ''].filter(Boolean).join(' · '),
            body: s.notes || undefined,
          })) : [{ title: 'Nenhum registo' }],
        },
        {
          heading: `Análises (${data.labs.length} relatório${data.labs.length === 1 ? '' : 's'})`,
          records: data.labs.length ? data.labs.map(l => ({
            title: `${new Date(l.date).toLocaleDateString('pt-PT')}${l.lab_name ? ` · ${l.lab_name}` : ''}`,
            bullets: (l.values || []).map(v => `${v.name}: ${v.value}${v.unit ? ' ' + v.unit : ''}${v.status && v.status !== 'NORMAL' ? ` (${v.status})` : ''}`),
          })) : [{ title: 'Nenhuma análise guardada' }],
        },
      ],
      footerNote: 'Gerado pelo utilizador a partir dos seus próprios dados no Phlox. Documento informativo — não substitui o processo clínico oficial.',
    })
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: ACCENT, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Pro</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Exportar o meu registo de saúde</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>O histórico completo — medicação, vitais, sintomas e análises — num único PDF para levar a qualquer médico.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading && <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />}
        {err && <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', fontSize: 13 }}>{err}</div>}

        {data && !loading && (
          <>
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                {[
                  { label: 'Medicamentos', v: data.meds.length },
                  { label: 'Registos vitais', v: data.vitals.length },
                  { label: 'Sintomas', v: data.symptoms.length },
                  { label: 'Análises', v: data.labs.length },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={exportPDF} style={{ padding: '13px 24px', background: ACCENT, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              📄 Gerar PDF completo
            </button>
            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center' }}>Últimos 12 meses de vitais/sintomas · últimos 20 relatórios de análises · toda a medicação atual.</div>

            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>📲 Ou mostrar por QR</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.55, marginBottom: 12 }}>
                Sem imprimir nada: gera um QR temporário (medicação, vitais e sintomas) para um profissional ler no telemóvel dele. Expira sozinho.
              </div>
              {shareErr && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{shareErr}</div>}
              {session && !shareExpired ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`} alt="QR" style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>PIN de acesso</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: ACCENT, letterSpacing: '0.08em' }}>{session.pin}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>Válido até {new Date(session.expires_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                    <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ padding: '7px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)', marginTop: 4 }}>Copiar link</button>
                  </div>
                </div>
              ) : (
                <button onClick={createShare} disabled={creating} style={{ width: '100%', padding: 12, background: 'white', border: `1.5px solid ${ACCENT}`, color: ACCENT, borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: creating ? 'wait' : 'pointer' }}>
                  {creating ? 'A gerar…' : 'Gerar QR de partilha (30 min)'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
