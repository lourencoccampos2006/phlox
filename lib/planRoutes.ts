// lib/planRoutes.ts
// Mapa de ROTAS → plano mínimo necessário. Usado pelo ClientLayout para bloquear o
// acesso a ferramentas pagas (não basta esconder o botão — a página tem de bloquear).
// Mantém-se conservador: só ferramentas claramente pagas entram aqui.

import type { PlanId } from './plans'
import { TOOLS, type ToolPlan } from './toolRegistry'

export interface PlanRoute { prefix: string; min: PlanId; tool: string; note?: string }

// Mapa do plano da ferramenta (registry) → plano mínimo de acesso.
// 'free'/'free_limited' não bloqueiam; 'student'→student; 'pro'→pro.
// Ferramentas clínicas são 'pro' no registry mas exigem org → tratadas como pro.
const TOOL_PLAN_TO_MIN: Record<ToolPlan, PlanId | null> = {
  free: null, free_limited: null, student: 'student', pro: 'pro',
}

// Ordenado do mais específico para o mais genérico (o 1º match ganha).
export const PLAN_ROUTES: PlanRoute[] = [
  // ── Institucional ──
  { prefix: '/api-keys', min: 'clinic', tool: 'Chaves de API', note: 'API pública com chaves rotáveis, scopes e rate limit por chave.' },
  { prefix: '/sso-config', min: 'clinic', tool: 'SSO Empresarial', note: 'SAML/OIDC com Microsoft Entra ID, Google Workspace e Okta.' },

  // ── Pro (individual avançado) ──
  { prefix: '/motor-clinico', min: 'pro', tool: 'Decision Engine', note: 'Motor de regras clínicas determinístico, com 25+ regras (STOPP/Beers/renal/QTc/anticolinérgico).' },
  { prefix: '/vigia', min: 'pro', tool: 'Vigia Clínico do Lar', note: 'Vigilância farmacológica automática de todos os residentes — interações, STOPP/Beers, polimedicação, priorizado por risco.' },
  { prefix: '/copiloto', min: 'pro', tool: 'AI Copilot clínico', note: 'IA ancorada no Decision Engine — cita cada recomendação por id de regra.' },
  { prefix: '/insights', min: 'pro', tool: 'Phlox Insights', note: 'Benchmarks anonimizados contra o pool do mesmo tipo de instituição.' },
  { prefix: '/reconciliacao', min: 'pro', tool: 'Reconciliação Terapêutica', note: 'Reconciliação de medicação na transição de cuidados.' },
  { prefix: '/simulador', min: 'student', tool: 'Simulador Clínico & OSCE', note: 'Casos clínicos e OSCE com avaliação.' },
  { prefix: '/med-review', min: 'pro', tool: 'Revisão da Medicação', note: 'Revisão farmacoterapêutica avançada.' },
  { prefix: '/tpn', min: 'pro', tool: 'Nutrição Parentérica (TPN)', note: 'Cálculo e validação de TPN.' },
  { prefix: '/stopp-start', min: 'pro', tool: 'STOPP/START', note: 'Critérios de prescrição potencialmente inapropriada.' },
  { prefix: '/labs', min: 'student', tool: 'Interpretação de Análises', note: 'Leitura guiada de análises.' },

  // ── Estudo (Plus) ──
  { prefix: '/simulador', min: 'student', tool: 'Simulador Clínico' },
  { prefix: '/osce', min: 'student', tool: 'OSCE' },
  { prefix: '/arena', min: 'student', tool: 'Arena de Estudo' },
  { prefix: '/tutor', min: 'student', tool: 'AI Tutor' },
  { prefix: '/exam', min: 'student', tool: 'Quiz / Teste' },
  { prefix: '/modo-exame', min: 'student', tool: 'Modo Exame', note: 'Plano de contagem decrescente até ao exame, com revisão espaçada e sprint final.' },
  { prefix: '/study/professor', min: 'student', tool: 'Modo Professor', note: 'Ensinas o Phlox e ele descobre as tuas lacunas.' },
  { prefix: '/study/exame', min: 'student', tool: 'Gerador de exame', note: 'Prevê o teu exame a partir das tuas sebentas e corrige respostas de desenvolvimento.' },
  { prefix: '/estagio', min: 'student', tool: 'Estágio' },
  { prefix: '/study360', min: 'student', tool: 'Estudo 360°' },
  // ── Estudo (Pro) — RAG pessoal ──
  { prefix: '/study/documentos', min: 'pro', tool: 'Os meus documentos (IA)', note: 'Carrega as tuas sebentas e pergunta — a IA responde com base no teu material.' },
]

export function planForRoute(pathname: string): PlanRoute | null {
  // 1) Regras explícitas (com notas/mensagens à medida) — primeiro match ganha.
  for (const r of PLAN_ROUTES) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) return r
  }
  // 2) Fallback automático ao registry — fecha ferramentas pagas não listadas acima
  //    (evita acesso por URL/pesquisa). Encontra a ferramenta de id mais específico
  //    (mais longo) que casa o caminho.
  //    IMPORTANTE: alguns ids existem em DUAS entradas (ex: /food-drug free em modo
  //    pessoal E pro em modo clínico). Se EXISTE alguma entrada gratuita para esse
  //    id, NÃO bloqueamos — o acesso fica aberto (a navegação por modo trata do resto).
  let bestId = ''
  let bestMin: PlanId | null = null
  let anyFreeForBestId = false
  for (const t of TOOLS) {
    if (!(pathname === t.id || pathname.startsWith(t.id + '/'))) continue
    if (t.id.length > bestId.length) {
      bestId = t.id
      bestMin = TOOL_PLAN_TO_MIN[t.plan]
      anyFreeForBestId = TOOL_PLAN_TO_MIN[t.plan] === null
    } else if (t.id === bestId) {
      if (TOOL_PLAN_TO_MIN[t.plan] === null) anyFreeForBestId = true
    }
  }
  if (bestId && bestMin && !anyFreeForBestId) {
    const label = TOOLS.find(t => t.id === bestId)?.label || 'Funcionalidade'
    return { prefix: bestId, min: bestMin, tool: label }
  }
  return null
}
