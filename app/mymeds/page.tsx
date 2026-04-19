'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

const SEVERITY: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  GRAVE:         { label: 'GRAVE',                   color: '#7f1d1d', bg: '#fff5f5', border: '#feb2b2', barColor: '#c53030' },
  MODERADA:      { label: 'MODERADA',                color: '#7c2d12', bg: '#fffaf0', border: '#fbd38d', barColor: '#dd6b20' },
  LIGEIRA:       { label: 'LIGEIRA',                 color: '#5f370e', bg: '#fffff0', border: '#faf089', barColor: '#d69e2e' },
  SEM_INTERACAO: { label: 'SEM INTERAÇÃO CONHECIDA', color: '#1a4731', bg: '#f0fff4', border: '#9ae6b4', barColor: '#276749' },
}

function UpgradeGate({ medCount }: { medCount: number }) {
  return (
    <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '40px 28px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>
        ⚕️
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 10 }}>
        Tens {medCount} medicamentos registados
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 8, maxWidth: 380, margin: '0 auto 8px' }}>
        Com o plano Student, verificamos automaticamente todas as interações entre os teus medicamentos — em segundos.
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
        {medCount >= 2 ? `${medCount * (medCount-1) / 2} combinações possíveis a verificar` : 'Adiciona mais medicamentos no dashboard primeiro'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          Desbloquear — Student 3,99€/mês →
        </Link>
        <Link href="/dashboard?tab=meds" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 20px', borderRadius: 6, fontSize: 13, border: '1px solid var(--border-2)' }}>
          Gerir medicamentos
        </Link>
      </div>
    </div>
  )
}

export default function MyMedsCheckPage() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<any[]>([])
  const [medsLoading, setMedsLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const plan = user?.plan || 'free'
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  useEffect(() => {
    if (!user) return
    supabase.from('personal_meds').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setMeds(data || []); setMedsLoading(false) })
  }, [user, supabase])

  const checkAll = async () => {
    if (meds.length < 2) return
    setChecking(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs: meds.map(m => m.name) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      setCheckedAt(new Date())
      // Save to history
      supabase.from('search_history').insert({
        user_id: user!.id,
        type: 'interaction',
        query: meds.map(m => m.name).join(' + '),
        result_severity: data.severity,
        result_source: data.source,
      }).then(() => {})
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally {
      setChecking(false)
    }
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>💊</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12 }}>A tua medicação, verificada</h1>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
              Cria uma conta, regista os teus medicamentos e verifica automaticamente se existe alguma interação entre eles.
            </p>
            <Link href="/login" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
              Criar conta grátis →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sev = result ? (SEVERITY[result.severity] ?? SEVERITY['SEM_INTERACAO']) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>
            A tua medicação
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 0 }}>
            Verifica interações entre todos os medicamentos que tomas.
          </p>
        </div>

        <div className="two-col" style={{ alignItems: 'start' }}>

          {/* LEFT — Med list */}
          <div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Os teus medicamentos</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>{medsLoading ? '...' : `${meds.length} medicamentos registados`}</div>
                </div>
                <Link href="/dashboard?tab=meds" style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                  Editar →
                </Link>
              </div>

              {medsLoading && (
                <div style={{ padding: '20px' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bg-3)' }}>
                      <div className="skeleton" style={{ height: 13, width: 140 }} />
                      <div className="skeleton" style={{ height: 13, width: 70 }} />
                    </div>
                  ))}
                </div>
              )}

              {!medsLoading && meds.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 16 }}>Ainda não tens medicamentos registados.</p>
                  <Link href="/dashboard?tab=meds" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>
                    Adicionar medicamentos →
                  </Link>
                </div>
              )}

              {!medsLoading && meds.length > 0 && (
                <div>
                  {meds.map((med, i) => (
                    <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < meds.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{med.name}</div>
                        {(med.dose || med.frequency) && (
                          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {[med.dose, med.frequency].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <Link href={`/drugs/${med.name.toLowerCase().replace(/\s+/g, '-')}`}
                        style={{ fontSize: 11, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                        Info →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!medsLoading && meds.length >= 2 && isStudent && (
              <button onClick={checkAll} disabled={checking}
                style={{ width: '100%', background: checking ? 'var(--bg-3)' : 'var(--green)', color: checking ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 6, padding: '14px', fontSize: 15, fontWeight: 600, cursor: checking ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {checking ? 'A verificar interações...' : `Verificar ${meds.length} medicamentos →`}
              </button>
            )}
          </div>

          {/* RIGHT — Result or gate */}
          <div>
            {!isStudent && !medsLoading && meds.length > 0 && (
              <UpgradeGate medCount={meds.length} />
            )}

            {isStudent && !result && !checking && !error && meds.length >= 2 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-2)', marginBottom: 8 }}>Pronto para verificar</div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
                  Clica em "Verificar" para analisar todas as interações entre os teus {meds.length} medicamentos.
                </p>
              </div>
            )}

            {checking && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-3)', padding: '16px 20px' }}>
                  <div className="skeleton" style={{ height: 10, width: 180, marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 20, width: 120 }} />
                </div>
                <div style={{ padding: '20px' }}>
                  {['RxNorm / NIH', 'OpenFDA', 'Análise IA'].map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? 'var(--green)' : 'var(--border-2)', animation: i === 0 ? 'pulse 1s infinite' : 'none' }} />
                      <span style={{ fontSize: 13, color: i === 0 ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '20px' }}>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {result && sev && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: sev.barColor, padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.15em', marginBottom: 4 }}>RESULTADO DA VERIFICAÇÃO</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', fontWeight: 700, marginBottom: 4 }}>{sev.label}</div>
                  {checkedAt && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-mono)' }}>
                      Verificado às {checkedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div style={{ padding: '20px' }}>
                  <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderLeft: `4px solid ${sev.barColor}`, borderRadius: 4, padding: '14px 16px', marginBottom: 20 }}>
                    <p style={{ fontSize: 14, color: sev.color, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{result.summary}</p>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                    {[
                      { label: 'Mecanismo', value: result.mechanism },
                      { label: 'Consequências', value: result.consequences },
                      { label: 'Recomendação', value: result.recommendation },
                    ].filter(r => r.value).map(({ label, value }, i, arr) => (
                      <div key={label} className="info-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '11px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                        </div>
                        <div style={{ padding: '11px 16px' }}>
                          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pro upsell — PDF report */}
                  {plan !== 'pro' && plan !== 'clinic' && (
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2 }}>📄 Exportar relatório PDF</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Para levar ao médico ou guardar no processo. Plano Pro.</div>
                      </div>
                      <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Ver Pro →
                      </Link>
                    </div>
                  )}

                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    Informação educacional. Consulta sempre o teu médico ou farmacêutico.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}