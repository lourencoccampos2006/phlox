// lib/healthGoals.ts
// Objetivo de Saúde — a espinha de personalização do Pro (Ronda 3). O motivo
// real da pessoa estar no Phlox: reconfigura planos e funcionalidades à volta
// disso, em vez de tratar toda a gente do mesmo modo dentro do mesmo modo de
// experiência. Guardado em profiles.health_goal (+ health_goal_detail texto
// livre, usado por 'manage_chronic' para o nome da doença).

export type HealthGoal = 'lose_weight' | 'manage_chronic' | 'caregiving' | 'recover' | 'wellness'

export interface HealthGoalMeta { id: HealthGoal; label: string; icon: string; desc: string; color: string }

export const HEALTH_GOALS: HealthGoalMeta[] = [
  { id: 'lose_weight',    label: 'Perder peso',            icon: '⚖️', desc: 'Plano de dieta e exercício contextualizado à tua medicação', color: '#0d9488' },
  { id: 'manage_chronic', label: 'Gerir uma doença crónica', icon: '🩺', desc: 'Acompanhamento focado numa condição específica', color: '#1d4ed8' },
  { id: 'caregiving',     label: 'Cuidar de alguém',       icon: '🤝', desc: 'Funcionalidades avançadas de cuidador', color: '#b45309' },
  { id: 'recover',        label: 'Recuperar de um evento', icon: '🏥', desc: 'Cirurgia, internamento ou evento agudo recente', color: '#7c3aed' },
  { id: 'wellness',       label: 'Bem-estar geral',        icon: '🌱', desc: 'Sem foco específico — só cuidar melhor de mim', color: '#0d6e42' },
]

export function goalMeta(goal: string | null | undefined): HealthGoalMeta | null {
  return HEALTH_GOALS.find(g => g.id === goal) || null
}
