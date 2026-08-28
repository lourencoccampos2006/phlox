// ─── Phlox plans — camada de apresentação (IDs mantêm-se p/ Stripe/BD/gating) ──
// IDs reais: free | student | pro | clinic   →   Nomes novos: Base | Plus | Pro | Institucional
//
// ── SEM ANÚNCIOS, EM PLANO NENHUM (2026-08-28) ────────────────────────────
// O plano gratuito distinguia-se por ter publicidade. Deixou de ter, e o campo
// `ads` foi removido. Três razões:
//
//   1. Vende-se a lares e centros de dia por contacto direto. Um diretor que
//      abre o Phlox e vê anúncios da Google ao lado de dados de utentes tira
//      uma conclusão sobre a seriedade do produto, e não é boa. Isso custa mais
//      do que a publicidade rendia.
//   2. Conteúdo de saúde é a categoria mais difícil de monetizar com anúncios e
//      a mais fácil de ver recusada.
//   3. "Sem anúncios" nunca fez ninguém pagar. Faz o plano gratuito parecer pior
//      sem fazer o pago parecer melhor.
//
// A escada passa a assentar em três degraus que se sentem no uso:
//   ALCANCE   — quantas pessoas: o Base é para uma, o Pro é para quem cuida de
//               outra, o Institucional é para uma equipa.
//   INSISTÊNCIA — o Base lembra quando a app está aberta; o Pro toca no
//               telemóvel com a app fechada. Numa app de medicação é a
//               diferença entre a dose ser tomada e não ser.
//   PROVA     — o Pro produz o documento que se leva ao médico.
//
// Nenhum destes degraus tira nada a quem não paga. O registo de saúde de quem
// usa o plano gratuito fica guardado sem prazo — apagar histórico clínico para
// forçar um upgrade não se faz.

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
    id: 'free', name: 'Base', tagline: 'Grátis para sempre, para uma pessoa', price: { monthly: 0, annual: 0, annualTotal: 0 },
    rank: 0, color: '#475569', cta: 'Começar grátis', href: '/login', audience: 'individual',
    features: [
      'Um perfil — o seu',
      'Medicação e horários, com lembretes no ecrã',
      'Verificar interações (3 por dia)',
      'Perguntar à IA de saúde (3 por dia)',
      'Phlox Scan — 3 fotografias por dia',
      'O registo de saúde guardado, sem prazo',
    ],
  },
  {
    id: 'student', name: 'Plus', tagline: 'Para estudantes de saúde', price: { monthly: 3.99, annual: 3.19, annualTotal: 38.28 },
    rank: 1, color: '#7c3aed', cta: 'Escolher Plus', href: '/checkout?plan=student', audience: 'individual',
    features: [
      'Estudo sem limites: flashcards e quiz sobre qualquer tema',
      'Arena de casos, AI Tutor e caso clínico evolutivo',
      'OSCE simulado em todos os cursos',
      'Interpretar análises e ECGs com IA · Atlas 3D',
      'Estágio: acompanhar horas, doentes e diário',
      // Sem número: os limites do Plus não são todos iguais (15/dia nas
      // interações e na IA, 30 nas análises, 50 na referência de medicamentos).
      // A copy antiga dizia "30/dia" para tudo, o que não era verdade.
      'Limites mais altos nas ferramentas de saúde',
    ],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Para quem cuida de si ou de alguém', price: { monthly: 12.99, annual: 10.39, annualTotal: 124.68 },
    rank: 2, highlight: true, badge: 'Mais popular', color: '#0d6e42', cta: 'Escolher Pro', href: '/checkout?plan=pro', audience: 'individual',
    features: [
      'Lembretes que tocam no telemóvel, mesmo com a aplicação fechada',
      'Um segundo perfil para quem cuida consigo — a outra pessoa edita a medicação e regista sinais, sem pagar',
      'Sem limites diários em nenhuma ferramenta',
      'A sua medicação revista pelo motor de regras clínicas dos profissionais, explicado em português simples',
      'Relatório mensal, em PDF, para levar ao médico',
      'O registo de saúde completo em PDF, ou por QR na consulta',
      'Suporte prioritário',
    ],
  },
  {
    // 2026-08-16 (decisão do Fernando): institucional deixou de ser self-serve
    // — venda direta, ele fala com cada lar/centro de dia e dá o acesso à
    // medida. cta/href já não apontam para checkout/onboarding automático,
    // só para contacto (ver app/pricing/page.tsx, app/comecar-instituicao,
    // app/api/org/setup — criação de org exige institution_signup_approved).
    id: 'clinic', name: 'Institucional', tagline: 'Para centros de dia e lares', price: { monthly: 149, annual: 124.08, annualTotal: 1489 },
    rank: 3, color: '#1d4ed8', cta: 'Falar connosco', href: 'mailto:suporte@phloxclinical.com?subject=Institui%C3%A7%C3%A3o%20-%20Phlox%20Clinical', audience: 'organization',
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
  free:    { interactions: 3, ai: 3, drug_reference: 5, labs: 3, scan: 3, medicamento: 5, chat_med: 3, preparar_consulta: 2 },
  student: { interactions: 15, ai: 15, drug_reference: 50, labs: 30, scan: 15, medicamento: 30, chat_med: 10, preparar_consulta: 5 },
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
