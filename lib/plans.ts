// ─── Phlox plans — camada de apresentação (IDs mantêm-se p/ Stripe/BD/gating) ──
// IDs reais: free | student | pro | clinic   →   Nomes novos: Base | Plus | Pro | Institucional
// Free tem anúncios. Upgrade remove anúncios + sobe limites + desbloqueia ferramentas.

export type PlanId = 'free' | 'student' | 'pro' | 'clinic'

export interface PlanDef {
  id: PlanId
  name: string
  tagline: string
  // monthly = €/mês no plano mensal.
  // annual  = €/mês equivalente quando se paga o ano de uma vez.
  // annualTotal = valor REAL cobrado no plano anual (€/ano). Mostrar sempre este
  //               valor ao lado do "/mês" para não enganar (transparência).
  price: { monthly: number; annual: number; annualTotal: number }
  rank: number
  ads: boolean
  badge?: string
  highlight?: boolean
  color: string
  cta: string
  href: string
  features: string[]
  audience: 'individual' | 'organization'
}

export const PLANS: PlanDef[] = [
  {
    id: 'free', name: 'Base', tagline: 'Para começar — com anúncios', price: { monthly: 0, annual: 0, annualTotal: 0 },
    rank: 0, ads: true, color: '#475569', cta: 'Começar grátis', href: '/login', audience: 'individual',
    features: [
      'Ferramentas essenciais do teu perfil',
      'Verificar interações (5/dia)',
      'Assistente Phlox (5/dia)',
      'Perceber bulas e análises (limitado)',
      'Com anúncios discretos',
    ],
  },
  {
    id: 'student', name: 'Plus', tagline: 'Mais ferramentas, sem anúncios', price: { monthly: 3.99, annual: 3.19, annualTotal: 38.28 },
    rank: 1, ads: false, color: '#7c3aed', cta: 'Escolher Plus', href: '/checkout?plan=student', audience: 'individual',
    features: [
      'Tudo do Base, sem anúncios',
      'Limites muito mais altos (50/dia)',
      'Estudo: Arena, flashcards, AI Tutor',
      'Relatórios e objetivos de saúde',
      'Histórico guardado',
    ],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Tudo desbloqueado, sem limites', price: { monthly: 12.99, annual: 10.39, annualTotal: 124.68 },
    rank: 2, ads: false, highlight: true, badge: 'Mais popular', color: '#0d6e42', cta: 'Escolher Pro', href: '/checkout?plan=pro', audience: 'individual',
    features: [
      'Tudo do Plus, sem limites',
      'IA clínica avançada',
      'Simulador clínico e OSCE',
      'Todas as ferramentas individuais',
      'Suporte prioritário',
    ],
  },
  {
    id: 'clinic', name: 'Institucional', tagline: 'Para lares, farmácias e organizações', price: { monthly: 149, annual: 124.08, annualTotal: 1489 },
    rank: 3, ads: false, color: '#1d4ed8', cta: 'Falar connosco', href: '/connect', audience: 'organization',
    features: [
      'Espaço clínico completo da organização',
      'Personalização: logo, cores, protocolos, horários',
      'Painel de gestão, MAR, feridas, escalas',
      'Equipa, residentes/doentes ilimitados',
      'Dados em tempo real entre toda a equipa',
      'Relatórios e impressões profissionais',
    ],
  },
]

// ─── Limites diários por plano (ferramentas "grátis · limitado") ──────────────
const LIMITS: Record<PlanId, Record<string, number>> = {
  free:    { interactions: 5, ai: 5, drug_reference: 10, labs: 3, bula: 10, tutor: 5, arena: 3 },
  student: { interactions: 50, ai: 50, drug_reference: 100, labs: 30, bula: 100, tutor: 50, arena: 30 },
  pro:     {},
  clinic:  {},
}

export const planById = (id: PlanId | string | null | undefined): PlanDef =>
  PLANS.find(p => p.id === id) || PLANS[0]
export const planName = (id: PlanId | string | null | undefined): string => planById(id as PlanId).name

export function limitFor(plan: PlanId | string | null | undefined, key: string): number {
  const id = (plan as PlanId) || 'free'
  if (id === 'pro' || id === 'clinic') return Infinity
  return LIMITS[id]?.[key] ?? Infinity
}

export function formatPrice(v: number): string {
  return v === 0 ? 'Grátis' : `${v.toFixed(2).replace('.', ',')}€`
}
