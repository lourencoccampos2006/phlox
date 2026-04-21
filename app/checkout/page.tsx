'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Plan config ─────────────────────────────────────────────────────────────

const PLANS = {
  student: {
    name: 'Student',
    monthly: { price: '3,99€', priceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_MONTHLY || '' },
    annual:  { price: '38,28€', priceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_ANNUAL  || '' },
    features: [
      'Tudo do plano Gratuito sem limites',
      'Interpretação de análises clínicas',
      'Phlox AI — Farmacologista clínico',
      'Casos clínicos interactivos',
      'Modo Exame com timer e análise',
      'Flashcards para 24 classes',
      'Histórico ilimitado',
      'Sem anúncios',
    ],
    color: '#7c3aed',
    bg: '#ede9fe',
  },
  pro: {
    name: 'Pro',
    monthly: { price: '12,99€', priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || '' },
    annual:  { price: '124,68€', priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL || '' },
    features: [
      'Tudo do plano Student',
      'Simulador de Estratégia Terapêutica',
      'Protocolo Terapêutico IA',
      'Revisão Clínica de Medicação + PDF',
      'Briefing de Consulta',
      'Ajuste de dose renal ilimitado',
      'Suporte prioritário',
    ],
    color: '#1e40af',
    bg: '#dbeafe',
  },
}

type PlanKey = keyof typeof PLANS

function CheckoutContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planKey = (searchParams.get('plan') || 'student') as PlanKey
  const plan = PLANS[planKey] || PLANS.student

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login?next=/checkout?plan=' + planKey)
  }, [user, loading, planKey, router])

  // Already on this plan or higher
  const currentPlan = user?.plan || 'free'
  const planOrder = ['free', 'student', 'pro', 'clinic']
  const alreadyHas = planOrder.indexOf(currentPlan) >= planOrder.indexOf(planKey)

  const startCheckout = async () => {
    if (!user) return
    setProcessing(true); setError('')
    try {
      const priceId = billing === 'monthly' ? plan.monthly.priceId : plan.annual.priceId
      if (!priceId) {
        setError('Stripe não configurado. Contacta hello@phlox.health para activar a tua conta manualmente.')
        setProcessing(false)
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planKey, userId: user.id, email: user.email }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Erro ao criar sessão de pagamento.')
      window.location.href = data.url
    } catch (e: any) {
      setError(e.message)
      setProcessing(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px 80px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Back */}
        <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-4)', textDecoration: 'none', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
          ← Voltar aos planos
        </Link>

        {/* Card */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {/* Plan header */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'inline-block', background: plan.bg, borderRadius: 20, padding: '3px 12px', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: plan.color, fontWeight: 700, letterSpacing: '0.06em' }}>PLANO {plan.name.toUpperCase()}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {billing === 'monthly' ? plan.monthly.price : plan.annual.price}
              <span style={{ fontSize: 16, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', fontWeight: 400, marginLeft: 6 }}>
                /{billing === 'monthly' ? 'mês' : 'ano'}
              </span>
            </div>
            {billing === 'annual' && (
              <div style={{ fontSize: 13, color: 'var(--green-2)', fontFamily: 'var(--font-mono)' }}>Equivale a {planKey === 'student' ? '3,19€' : '10,39€'}/mês — poupas 20%</div>
            )}
          </div>

          <div style={{ padding: '24px 28px' }}>

            {/* Billing toggle */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Período de facturação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['monthly', 'annual'] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    style={{ padding: '10px 14px', border: `1.5px solid ${billing === b ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: billing === b ? 'var(--green-light)' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: billing === b ? 600 : 400, color: billing === b ? 'var(--green)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span>{b === 'monthly' ? 'Mensal' : 'Anual'}</span>
                    {b === 'annual' && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: billing === 'annual' ? 'var(--green)' : 'var(--ink-4)' }}>Poupa 20%</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Features */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Incluído</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5"/></svg>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Already has plan */}
            {alreadyHas && currentPlan !== 'free' ? (
              <div style={{ padding: '14px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--green-2)', fontWeight: 600 }}>✓ Já tens o plano {currentPlan}</div>
                <Link href="/dashboard" style={{ display: 'block', marginTop: 8, fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Ir para o dashboard →</Link>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ padding: '12px 14px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#742a2a', lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}
                <button onClick={startCheckout} disabled={processing}
                  style={{ width: '100%', padding: '14px', background: processing ? 'var(--bg-3)' : 'var(--green)', color: processing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', transition: 'background 0.15s', marginBottom: 12 }}>
                  {processing ? 'A redirigir para pagamento...' : `Subscrever ${plan.name} — ${billing === 'monthly' ? plan.monthly.price : plan.annual.price}/${billing === 'monthly' ? 'mês' : 'ano'}`}
                </button>
              </>
            )}

            {/* Trust */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {['🔒 Pagamento seguro', '↩ Cancela quando quiseres', '🇵🇹 Factura em PT'].map(t => (
                <span key={t} style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Stripe badge */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Pagamento processado por Stripe · SSL · PCI DSS compliant</span>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-2)' }} />}>
      <CheckoutContent />
    </Suspense>
  )
}