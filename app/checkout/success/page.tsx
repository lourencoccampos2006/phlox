'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = searchParams.get('plan') || 'student'

  useEffect(() => {
    // Redirect to dashboard after 5s
    const t = setTimeout(() => router.push('/dashboard'), 5000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', padding: 20 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
          ✓
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.02em' }}>
          Bem-vindo ao plano {plan === 'pro' ? 'Pro' : 'Student'}!
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 32 }}>
          O teu pagamento foi processado com sucesso. O teu plano está activo — todas as ferramentas estão disponíveis agora.
        </p>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Começa por aqui</div>
          {(plan === 'pro' ? [
            { href: '/strategy', label: 'Simulador de Estratégia Terapêutica', desc: 'A ferramenta Pro mais poderosa' },
            { href: '/med-review', label: 'Revisão Clínica de Medicação', desc: 'Análise completa + relatório PDF' },
            { href: '/ai', label: 'Phlox AI', desc: 'Farmacologista clínico virtual' },
          ] : [
            { href: '/labs', label: 'Interpretação de Análises', desc: 'A ferramenta mais popular' },
            { href: '/cases', label: 'Casos Clínicos', desc: 'Raciocínio clínico guiado' },
            { href: '/exam', label: 'Modo Exame', desc: 'Prepara-te para os exames' },
          ]).map(({ href, label, desc }) => (
            <Link key={href} href={href}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{desc}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          ))}
        </div>
        <Link href="/dashboard"
          style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Ir para o dashboard →
        </Link>
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Redirigido automaticamente em 5 segundos</div>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-2)' }} />}>
      <SuccessContent />
    </Suspense>
  )
}