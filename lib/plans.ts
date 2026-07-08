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
    id: 'free', name: 'Base', tagline: 'Para experimentar — com anúncios', price: { monthly: 0, annual: 0, annualTotal: 0 },
    rank: 0, ads: true, color: '#475569', cta: 'Começar grátis', href: '/login', audience: 'individual',
    features: [
      'Ferramentas essenciais do teu perfil',
      'Phlox Scan — 3 fotos/dia',
      'Verificar interações (3/dia)',
      'Perguntar à IA de saúde (3/dia)',
      'Lembretes de toma básicos',
      'Com anúncios discretos',
    ],
  },
  {
    id: 'student', name: 'Plus', tagline: 'Para estudantes de saúde — sem anúncios', price: { monthly: 3.99, annual: 3.19, annualTotal: 38.28 },
    rank: 1, ads: false, color: '#7c3aed', cta: 'Escolher Plus', href: '/checkout?plan=student', audience: 'individual',
    features: [
      'Tudo do Base, sem anúncios',
      'Estudo sem limites: flashcards e quiz sobre qualquer tema',
      'Arena de casos, AI Tutor e caso clínico evolutivo',
      'OSCE simulado em todos os cursos',
      'Interpretar análises e ECGs com IA · Atlas 3D',
      'Estágio: acompanhar horas, doentes e diário',
      'Limites mais altos nas ferramentas de saúde (30/dia)',
    ],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Para quem leva a saúde a sério — pessoas e cuidadores', price: { monthly: 12.99, annual: 10.39, annualTotal: 124.68 },
    rank: 2, ads: false, highlight: true, badge: 'Mais popular', color: '#0d6e42', cta: 'Escolher Pro', href: '/checkout?plan=pro', audience: 'individual',
    features: [
      'Tudo sem anúncios e sem limites diários',
      'Lembretes de toma no telemóvel (push) + confirmação',
      'Phlox Scan e IA de saúde ilimitados',
      'Chat com a tua medicação — pergunta em português',
      'A tua história de saúde: medicação, análises e sintomas ao longo do tempo',
      'Partilhar a tua saúde com família e médico (QR)',
      'Cuidar da família: várias pessoas, sem falhas',
      'Suporte prioritário',
    ],
  },
  {
    id: 'clinic', name: 'Institucional', tagline: 'Para centros de dia e lares', price: { monthly: 149, annual: 124.08, annualTotal: 1489 },
    rank: 3, ads: false, color: '#1d4ed8', cta: 'Criar a minha instituição', href: '/onboarding', audience: 'organization',
    features: [
      'Painel do dia montado de raiz para centro de dia ou lar',
      'Presenças, refeições, humor, atividades e medicação num só sítio',
      'Portal das famílias: veem o dia sem ter de ligar',
      'Medicação casa ↔ centro, sem dose a dobrar nem falhada',
      'Equipa e utentes ilimitados, com dados em tempo real',
      'Rondas, stock, faturação e relatórios de qualidade',
    ],
  },
]

// ─── Limites diários por plano (ferramentas "grátis · limitado") ──────────────
// Base apertado de propósito (experimentar, não viver nele). Plus = estudante:
// limites de saúde modestos mas estudo SEM limite (gerido no gating, não aqui).
// Pro/Institucional = sem limites.
const LIMITS: Record<PlanId, Record<string, number>> = {
  free:    { interactions: 3, ai: 3, drug_reference: 5, labs: 3, scan: 3, medicamento: 5, chat_med: 3 },
  student: { interactions: 15, ai: 15, drug_reference: 50, labs: 30, scan: 15, medicamento: 30, chat_med: 10 },
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
