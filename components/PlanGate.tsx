'use client'

// PlanGate — bloqueia o ACESSO a uma página/ferramenta quando o plano é insuficiente.
// Diferente do UpgradePrompt (que trata de limites diários): isto impede um utilizador
// de plano inferior de usar uma ferramenta paga, mostrando um ecrã de upgrade.
// Uso: <PlanGate min="pro" tool="Reconciliação Terapêutica">...conteúdo...</PlanGate>

import { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { PLANS, planById, planName, type PlanId } from '@/lib/plans'

const RANK: Record<string, number> = { free: 0, student: 1, pro: 2, clinic: 3 }

export default function PlanGate({ min, tool, children, note }: {
  min: PlanId            // plano mínimo necessário
  tool: string           // nome da ferramenta (para a mensagem)
  children: ReactNode
  note?: string          // explicação opcional do valor
}) {
  const { user, loading } = useAuth() as any

  if (loading) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="skeleton" style={{ width: 280, height: 120, borderRadius: 14 }} />
    </div>
  }

  const plan = (user?.plan || 'free') as string
  const ok = (RANK[plan] ?? 0) >= (RANK[min] ?? 99)
  if (ok) return <>{children}</>

  const target = planById(min)
  const isOrg = min === 'clinic'

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 'min(460px, 100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px', textAlign: 'center', boxShadow: '0 12px 50px rgba(8,12,24,0.08)' }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: target.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={target.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: target.color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Funcionalidade {planName(min)}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, margin: '0 0 10px', letterSpacing: '-0.02em' }}>{tool}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>
          {note || `Esta ferramenta faz parte do plano ${planName(min)}.`} {user ? `O teu plano atual é ${planName(plan)}.` : 'Inicia sessão e faz upgrade para a usares.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {isOrg ? (
            <Link href="/organizacao" style={{ padding: '13px 18px', background: target.color, color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Conhecer o plano Institucional
            </Link>
          ) : (
            <Link href={`/checkout?plan=${min}`} style={{ padding: '13px 18px', background: target.color, color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Obter {planName(min)} — {target.price.monthly.toFixed(2).replace('.', ',')}€/mês
            </Link>
          )}
          <Link href="/pricing" style={{ padding: '11px', background: 'none', color: 'var(--ink-4)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Ver todos os planos
          </Link>
        </div>
      </div>
    </div>
  )
}
