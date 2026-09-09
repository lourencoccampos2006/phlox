// lib/setupCodes.ts
// ─────────────────────────────────────────────────────────────────────────────
// A tradução dos códigos que o cliente vê para o que realmente falta.
//
// O cliente vê `PHX-K7` e mais nada. Quem receber esse código — o Fernando, ou
// eu — olha para esta tabela e sabe ao certo o que correr. É o meio-termo que
// ele pediu: discreto para fora, exato para dentro.
//
// Os códigos são curtos, sem sequência óbvia e sem qualquer pista sobre a
// tecnologia. Nunca reutilizar um código para outra coisa: um código antigo
// pode chegar-nos meses depois, num screenshot.
// ─────────────────────────────────────────────────────────────────────────────

export const SETUP_CODES = {
  'PHX-B2': 'sprint21_stock.sql — tabela stock_items (existências e validades)',
  'PHX-C4': 'sprint98_resident_requests.sql — pedidos e observações do utente',
  'PHX-D6': 'sprint105_team_comms.sql — mural da equipa (team_messages)',
  'PHX-E1': 'sprint112_family_profile_shares.sql — partilha de perfis de família',
  'PHX-F8': 'sprint118_shift_coverage.sql — cobertura de turnos / vagas',
  'PHX-G3': 'sprint125_patient_photo.sql — coluna photo_url + bucket de fotografias',
  'PHX-H5': 'sprint126_support_transport_schedules.sql — transportes recorrentes',
  'PHX-J9': 'sprint127_meal_planning.sql — biblioteca de pratos e plano de ementas',
  'PHX-K7': 'sprint130_diabetic_prep_psychosocial.sql — preparação da medicação, reforço alimentar e notas psico-sociais',
  'PHX-L2': 'sprint131_recurring_services.sql — serviços recorrentes (roupa, fim de semana, noite)',
  'PHX-M4': 'sprint134_adl_reviews.sql — revisões de autonomia (adl_reviews)',
  'PHX-N8': 'sprint135_meal_courses.sql — momentos da refeição (sopa/prato/sobremesa)',
  'PHX-P1': 'sprint53_sessions_mfa.sql — sessões e autenticação em dois passos',
  'PHX-S3': 'sprint137_activity_log.sql — livro de registos (activity_log)',
  'PHX-T5': 'sprint136_geo.sql — coordenadas para o mapa de transportes',
  'PHX-V7': 'sprint141_daily_case_and_shift.sql — caso do dia + turnos em curso (shift_checkins)',
  'PHX-R6': 'chave de serviço em falta no ambiente (SUPABASE_SERVICE_ROLE_KEY)',
} as const

export type CodigoSetup = keyof typeof SETUP_CODES

export function detalheDoCodigo(c: CodigoSetup): string {
  return SETUP_CODES[c] || 'código desconhecido'
}

/** Erro de tabela/coluna em falta — o sinal de uma migração por aplicar. */
export function eFaltaDeSetup(erro: any): boolean {
  const m = String(erro?.message || erro || '')
  return /does not exist|schema cache|relation .* does not/i.test(m)
}
