// lib/homeIntelligence.ts
// O CÉREBRO do /inicio. Em vez de um menu fixo, decide a "próxima coisa certa"
// para esta pessoa, AGORA — consoante o modo, a hora, e os dados reais (medicação
// por tomar, consulta a chegar, vitais, estudo). Devolve UM foco principal +
// algumas ações secundárias. Determinístico, sem IA, instantâneo.

import { ptHour } from '@/lib/ptTime'

export interface FocusCard {
  id: string
  kind: 'urgent' | 'today' | 'suggest' | 'welcome'
  title: string                 // frase humana, curta
  sub?: string
  href: string
  cta: string
  icon: string                  // nome do ícone (resolvido no componente)
}

export interface QuickAction { href: string; icon: string; label: string; sub: string }

// ─── Dados que o /inicio carrega e passa para aqui ──────────────────────────────
export interface HomeData {
  firstName: string
  // medicação
  medsCount: number
  dosesDueNow: number           // tomas marcadas para esta janela do dia, ainda não feitas
  dosesTakenToday: number
  dosesTotalToday: number
  nextDoseLabel?: string        // ex "Ramipril às 9h"
  // saúde
  lastVitalDaysAgo?: number | null
  // agenda
  nextAppt?: { title: string; inDays: number } | null
  // estudo
  studyStreak?: number
  studyXpToday?: number
  studyGoal?: number
  weakArea?: string | null
  cardsDue?: number             // cartões de repetição espaçada a rever hoje (de /api/study/cards)
  // cuidador — o alerta de vigilância mais urgente (de family_alerts/caregiverWatch)
  caregiverAlert?: { who: string; title: string; detail?: string; href: string } | null
  // pessoal — o alerta de saúde próprio mais urgente (de healthAlerts/healthTrends)
  healthAlert?: { level: 'high' | 'medium' | 'low'; title: string; detail?: string; href: string; cta?: string } | null
  // pessoal — "a minha saúde esta semana" (tendências determinísticas)
  week?: { weightDelta?: number | null; bpTrend?: 'up' | 'down' | 'flat' | null; adherencePct?: number | null; vitalsCount?: number; symptomsCount?: number } | null
  // estado geral
  hasAnyData: boolean           // já fez seja o que for? (senão = boas-vindas)
}

function greetWord(): string {
  const h = ptHour()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

export function homeGreeting(firstName: string): string {
  return `${greetWord()}${firstName ? `, ${firstName}` : ''}`
}

// Uma linha de "como estão as coisas" — calma, honesta, nunca alarmista.
export function homeSubline(mode: string, d: HomeData): string {
  if (!d.hasAnyData) {
    return mode === 'student' ? 'Vamos começar a treinar.'
      : mode === 'caregiver' ? 'Vamos organizar quem cuida de si.'
        : 'Vamos pôr a sua saúde em ordem.'
  }
  if (mode === 'student') {
    if (d.studyStreak && d.studyStreak > 1) return `${d.studyStreak} dias seguidos. Continue assim.`
    return 'Pronto para mais uma sessão?'
  }
  if (d.dosesDueNow > 0) return 'Há tomas à espera de si.'
  if (d.dosesTotalToday > 0 && d.dosesTakenToday >= d.dosesTotalToday) return 'Está tudo em dia por hoje. 👏'
  return 'Está tudo calmo. Veja o que precisa.'
}

// ─── O FOCO PRINCIPAL — a única coisa que importa mostrar agora ─────────────────
export function pickFocus(mode: string, d: HomeData): FocusCard {
  // Boas-vindas: ainda não há nada — uma primeira ação clara por modo.
  if (!d.hasAnyData) {
    if (mode === 'student') return { id: 'w-study', kind: 'welcome', title: 'Comece a treinar', sub: 'Um caso clínico, 2 minutos. Veja onde está.', href: '/arena', cta: 'Entrar na Arena', icon: 'trophy' }
    if (mode === 'caregiver') return { id: 'w-fam', kind: 'welcome', title: 'Quem está a cuidar?', sub: 'Crie um espaço para cada pessoa de quem cuida.', href: '/perfis', cta: 'Adicionar pessoa', icon: 'family' }
    return { id: 'w-meds', kind: 'welcome', title: 'Vamos juntar a sua medicação', sub: 'Tire foto à receita — o Phlox trata do resto.', href: '/scan', cta: 'Tirar foto', icon: 'camera' }
  }

  // ESTUDANTE — o melhor próximo passo, por evidência: cartões a rever (repetição
  // espaçada) → reforçar a área fraca → fechar a meta → manter o ritmo.
  if (mode === 'student') {
    // 1) Cartões de repetição espaçada a rever HOJE = o mais alto valor de estudo.
    if (d.cardsDue && d.cardsDue > 0) {
      return { id: 's-due', kind: 'today', title: d.cardsDue === 1 ? '1 cartão para rever hoje' : `${d.cardsDue} cartões para rever hoje`, sub: 'A repetição espaçada fixa o que estudou. Comece por aqui.', href: '/study360?tab=review', cta: 'Rever agora', icon: 'cards' }
    }
    // 2) Reforçar a área mais fraca (agora alimentada por TODA a prática).
    if (d.weakArea) return { id: 's-weak', kind: 'today', title: `Reforce ${d.weakArea}`, sub: 'É onde está a falhar mais. 5 minutos chegam.', href: `/study?mode=quiz&area=${encodeURIComponent(d.weakArea)}`, cta: 'Praticar agora', icon: 'target' }
    // 3) Fechar a meta diária.
    if ((d.studyXpToday || 0) < (d.studyGoal || 50)) return { id: 's-goal', kind: 'today', title: 'Falta pouco para a meta de hoje', sub: 'Um caso na Arena e está feito.', href: '/arena', cta: 'Continuar', icon: 'trophy' }
    // 4) Manter o ritmo.
    return { id: 's-keep', kind: 'suggest', title: 'Mantenha o ritmo', sub: 'Reveja os flashcards de hoje.', href: '/study360?tab=review', cta: 'Rever', icon: 'cards' }
  }

  // CUIDADOR — um familiar a precisar de atenção vem ANTES da própria medicação.
  // (Vem do motor de vigilância / family_alerts; é o "Anjo da Guarda" a antecipar-se.)
  if (mode === 'caregiver' && d.caregiverAlert) {
    return { id: 'c-watch', kind: 'urgent', title: `${d.caregiverAlert.who}: ${d.caregiverAlert.title}`, sub: d.caregiverAlert.detail || 'Toque para ver o que precisa de atenção.', href: d.caregiverAlert.href, cta: 'Ver no Centro de Cuidado', icon: 'family' }
  }

  // PESSOAL — um alerta de saúde GRAVE da própria pessoa vem antes da toma do dia.
  // (Vem do motor determinístico healthAlerts/healthTrends — o Phlox vela por mim.)
  if (mode === 'personal' && d.healthAlert && d.healthAlert.level === 'high') {
    return { id: 'p-health', kind: 'urgent', title: d.healthAlert.title, sub: d.healthAlert.detail || 'Toque para ver o que fazer.', href: d.healthAlert.href, cta: d.healthAlert.cta || 'Ver', icon: 'heart' }
  }

  // PESSOAL / CUIDADOR — saúde e medicação.
  // 1) Tomas à espera AGORA = o mais importante.
  if (d.dosesDueNow > 0) {
    return { id: 'h-dose', kind: 'urgent', title: d.dosesDueNow === 1 ? 'Tem uma toma à espera' : `Tem ${d.dosesDueNow} tomas à espera`, sub: d.nextDoseLabel || 'Toque para ver e marcar como tomado.', href: '/mymeds', cta: 'Ver medicação', icon: 'pill' }
  }
  // 2) Consulta a chegar.
  if (d.nextAppt && d.nextAppt.inDays <= 3) {
    const when = d.nextAppt.inDays === 0 ? 'hoje' : d.nextAppt.inDays === 1 ? 'amanhã' : `em ${d.nextAppt.inDays} dias`
    return { id: 'h-appt', kind: 'today', title: `Consulta ${when}`, sub: `${d.nextAppt.title}. Quer levar tudo organizado?`, href: '/preparar-consulta', cta: 'Preparar consulta', icon: 'calendar' }
  }
  // 3) Vitais há muito tempo.
  if (d.lastVitalDaysAgo != null && d.lastVitalDaysAgo >= 7 && d.medsCount > 0) {
    return { id: 'h-vital', kind: 'suggest', title: 'Há uns dias que não mede a tensão', sub: 'Um registo rápido ajuda a ver como vai.', href: '/vitals', cta: 'Registar agora', icon: 'heart' }
  }
  // 4) Tudo em dia.
  if (d.dosesTotalToday > 0 && d.dosesTakenToday >= d.dosesTotalToday) {
    return { id: 'h-done', kind: 'today', title: 'Tomou tudo o que era para hoje', sub: 'Bom trabalho. Veja se quer registar como se sente.', href: '/sintomas', cta: 'Como me sinto', icon: 'check' }
  }
  // 5) Default calmo.
  return { id: 'h-meds', kind: 'suggest', title: 'A sua medicação', sub: `${d.medsCount} medicamento${d.medsCount !== 1 ? 's' : ''} · horários e lembretes`, href: '/mymeds', cta: 'Abrir', icon: 'pill' }
}

// ─── Ações secundárias — sempre disponíveis, por modo ───────────────────────────
export function quickActions(mode: string): QuickAction[] {
  if (mode === 'student') return [
    { href: '/arena', icon: 'trophy', label: 'Treinar casos', sub: 'Arena' },
    { href: '/study', icon: 'cards', label: 'Flashcards', sub: 'Rever' },
    { href: '/tutor', icon: 'spark', label: 'Tutor', sub: 'Tirar dúvidas' },
    { href: '/aprender', icon: 'book', label: 'Tudo para estudar', sub: 'O meu progresso' },
  ]
  if (mode === 'caregiver') return [
    { href: '/familia', icon: 'family', label: 'A minha família', sub: 'Cada pessoa' },
    { href: '/scan', icon: 'camera', label: 'Foto à receita', sub: 'Organizar' },
    { href: '/interactions', icon: 'shield', label: 'É seguro juntar?', sub: 'Verificar' },
    { href: '/ai', icon: 'spark', label: 'Tenho uma dúvida', sub: 'Perguntar' },
  ]
  return [
    { href: '/mymeds', icon: 'pill', label: 'Os meus comprimidos', sub: 'Lista e horários' },
    { href: '/scan', icon: 'camera', label: 'Foto à receita', sub: 'Organizar' },
    { href: '/ai', icon: 'spark', label: 'Tenho uma dúvida', sub: 'Perguntar' },
    { href: '/saude-agora', icon: 'heart', label: 'Não me sinto bem', sub: 'O que fazer' },
  ]
}
