'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const PLANS = {
  student: {
    name: 'Student',
    monthly: { price: '3,99€', period: '/mês', priceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_MONTHLY || 'student_monthly' },
    annual:  { price: '2,99€', period: '/mês · faturado anualmente', priceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_ANNUAL || 'student_annual' },
    color: '#7c3aed',
    features: [
      'Tudo do plano Grátis sem limites',
      'Phlox Arena — ligas Bronze a Diamante',
      'Phlox OSCE — 6 cursos, AI como doente',
      'Phlox Hive — inteligência colectiva',
      'Plataforma de estudo — 10 domínios, 200+ tópicos',
      'Flashcards com repetição espaçada (SRS)',
      'Casos clínicos — todas as áreas',
      'AI Tutor socrático',
      'Modo Exame — formato nacional',
      'Turno Virtual — 16 especialidades',
      'Histórico ilimitado · Sem anúncios',
    ],
  },
  pro: {
    name: 'Pro',
    monthly: { price: '14,99€', period: '/mês', priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || 'pro_monthly' },
    annual:  { price: '11,99€', period: '/mês · faturado anualmente', priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL || 'pro_annual' },
    color: '#0d6e42',
    features: [
      'Tudo do Student',
      'Phlox Ward — ficha clínica colaborativa',
      'Phlox Connect — comunicação inter-profissional',
      'Phlox Rounds — ronda farmacêutica + PCNE',
      'Phlox Care Plan — plano farmacológico',
      'Phlox Consulta — copiloto bidirecional',
      'Doentes e Utentes ilimitados',
      'MAR digital por turno',
      'Reconciliação Medicamentosa',
      'Export PDF · Relatórios mensais',
      'Phlox AI Clínico Pro',
    ],
  },
} as const

type PlanKey = keyof typeof PLANS

function CheckoutContent() {
  const { user, loading, supabase } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planKey = (searchParams.get('plan') || 'student') as PlanKey
  const plan = PLANS[planKey] || PLANS.student
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/checkout?plan=' + planKey)
  }, [user, loading, router, planKey])

  const handleCheckout = async () => {
    if (!user) return
    setProcessing(true)
    setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const priceId = billing === 'monthly' ? plan.monthly.priceId : plan.annual.priceId
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ priceId, plan: planKey, billing }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Erro ao criar sessão de pagamento')
      }
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
      setProcessing(false)
    }
  }

  const current = billing === 'monthly' ? plan.monthly : plan.annual

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 560, margin: '0 auto' }}>

        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Checkout</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Plano {plan.name}
          </h1>
        </div>

        {/* Billing toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, gap: 4, marginBottom: 20 }}>
          {(['monthly', 'annual'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)}
              style={{ flex: 1, padding: '9px', background: billing === b ? 'white' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-sans)', boxShadow: billing === b ? 'var(--shadow-xs)' : 'none', transition: 'all 0.15s' }}>
              {b === 'monthly' ? 'Mensal' : <span>Anual <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700 }}>−25%</span></span>}
            </button>
          ))}
        </div>

        {/* Plan card */}
        <div style={{ background: 'white', border: `2px solid ${plan.color}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 4, background: plan.color }} />
          <div style={{ padding: '22px 22px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: 'var(--ink)', fontWeight: 400 }}>{current.price}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{current.period}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill={plan.color} style={{ flexShrink: 0, marginTop: 2 }}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-strip alert-strip-red" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>
          </div>
        )}

        {/* Checkout button */}
        <button onClick={handleCheckout} disabled={processing || !user}
          style={{ width: '100%', padding: '15px', background: processing ? 'var(--bg-3)' : plan.color, color: processing ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, cursor: processing ? 'wait' : 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, transition: 'all 0.15s' }}>
          {processing ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A processar...</> : `Activar plano ${plan.name} →`}
        </button>

        <div style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
          Pagamento seguro via Stripe · Cancela quando quiseres<br />
          Sem período de fidelização · Faturação no início de cada período
        </div>

        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Ao prosseguir aceitas os{' '}
          <Link href="/terms" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Termos de Serviço</Link>
          {' '}e a{' '}
          <Link href="/privacy" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Política de Privacidade</Link>.
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function CheckoutPage() {
  return <Suspense fallback={null}><CheckoutContent /></Suspense>
}