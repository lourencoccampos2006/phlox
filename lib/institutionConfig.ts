// lib/institutionConfig.ts
// Fonte única de VERDADE sobre o que cada tipo de instituição É e PRECISA.
// Todas as páginas (gestão, faturação, agenda, etc.) leem daqui para se adaptarem,
// em vez de assumirem "lar". Vocabulário + capacidades + modelo de receita.

import type { InstitutionType } from './useClinicPrefs'

export type RevenueModel =
  | 'monthly_fee'     // mensalidades + comparticipação (lar/ERPI)
  | 'pos_sales'       // vendas ao balcão / caixa diária (farmácia)
  | 'fee_for_service' // atos / recibos por consulta (clínica, CSP, hospital privado)
  | 'internal'        // sem faturação ao doente (farmácia hospitalar, hospital público)

export interface InstitutionConfig {
  // Vocabulário
  personNoun: string        // "Residente" | "Utente" | "Doente"
  personNounPlural: string
  personShort: string       // singular curto para KPIs
  personNounIndef: string   // "um residente" | "um utente" — para frases
  unitNoun: string          // "Lar" | "Farmácia" | "Clínica" | ...
  // Vocabulário fino das ferramentas (evita "Residente"/"Evento do lar" hardcoded)
  noPersonEventLabel: string   // opção "sem pessoa associada" na agenda/eventos
  appointmentNoun: string      // "Marcação" | "Atendimento" | "Consulta"
  appointmentNounPlural: string
  roomLabel: string            // "Quarto" | "Posto" | "Gabinete" | "—"
  addPersonCta: string         // "Adicionar residente" | "Adicionar utente"
  emptyPeopleMsg: string       // mensagem quando não há pessoas ainda
  // Capacidades (que módulos fazem sentido)
  hasBeds: boolean          // ocupação de camas/quartos
  hasShifts: boolean        // turnos manhã/tarde/noite
  hasMAR: boolean           // administração de medicação
  hasWounds: boolean        // gestão de feridas
  hasWaitingRoom: boolean   // sala de espera / fila
  hasAppointments: boolean  // agenda de marcações
  hasWalkins: boolean       // pessoas que só passam lá (sem ficha fixa)
  hasFamilies: boolean      // portal de famílias
  hasDispensing: boolean    // dispensa de medicamentos
  hasScreenings: boolean    // rastreios & vacinas
  // Receita
  revenue: RevenueModel
  currencyFlow: string      // descrição curta do fluxo de dinheiro
}

const CFG: Record<InstitutionType, InstitutionConfig> = {
  nursing_home: {
    personNoun: 'Residente', personNounPlural: 'Residentes', personShort: 'Residentes', personNounIndef: 'um residente', unitNoun: 'Lar / ERPI',
    noPersonEventLabel: 'Evento do lar', appointmentNoun: 'Marcação', appointmentNounPlural: 'Marcações',
    roomLabel: 'Quarto', addPersonCta: 'Adicionar residente', emptyPeopleMsg: 'Ainda não há residentes registados.',
    hasBeds: true, hasShifts: true, hasMAR: true, hasWounds: true, hasWaitingRoom: false,
    hasAppointments: true, hasWalkins: false, hasFamilies: true, hasDispensing: false, hasScreenings: false,
    revenue: 'monthly_fee', currencyFlow: 'Mensalidades e comparticipações',
  },
  day_care: {
    // Centro de Dia: o utente vem de dia e volta a casa à noite. Não há camas
    // nem turno da noite. A medicação é só a do horário do dia. A família vê o
    // utente todos os dias — o portal de famílias é central.
    personNoun: 'Utente', personNounPlural: 'Utentes', personShort: 'Utentes', personNounIndef: 'um utente', unitNoun: 'Centro de Dia',
    noPersonEventLabel: 'Evento do centro', appointmentNoun: 'Marcação', appointmentNounPlural: 'Marcações',
    roomLabel: 'Sala', addPersonCta: 'Adicionar utente', emptyPeopleMsg: 'Ainda não há utentes registados.',
    hasBeds: false, hasShifts: false, hasMAR: true, hasWounds: false, hasWaitingRoom: false,
    hasAppointments: true, hasWalkins: false, hasFamilies: true, hasDispensing: false, hasScreenings: false,
    revenue: 'monthly_fee', currencyFlow: 'Mensalidades e comparticipações',
  },
  pharmacy_community: {
    personNoun: 'Utente', personNounPlural: 'Utentes', personShort: 'Utentes', personNounIndef: 'um utente', unitNoun: 'Farmácia',
    noPersonEventLabel: 'Evento da farmácia', appointmentNoun: 'Atendimento', appointmentNounPlural: 'Atendimentos',
    roomLabel: 'Posto', addPersonCta: 'Adicionar utente', emptyPeopleMsg: 'Ainda não há utentes com ficha.',
    hasBeds: false, hasShifts: true, hasMAR: false, hasWounds: false, hasWaitingRoom: true,
    hasAppointments: false, hasWalkins: true, hasFamilies: false, hasDispensing: true, hasScreenings: true,
    revenue: 'pos_sales', currencyFlow: 'Vendas e dispensa ao balcão',
  },
  clinic: {
    personNoun: 'Doente', personNounPlural: 'Doentes', personShort: 'Doentes', personNounIndef: 'um doente', unitNoun: 'Clínica',
    noPersonEventLabel: 'Evento da clínica', appointmentNoun: 'Consulta', appointmentNounPlural: 'Consultas',
    roomLabel: 'Gabinete', addPersonCta: 'Adicionar doente', emptyPeopleMsg: 'Ainda não há doentes registados.',
    hasBeds: false, hasShifts: false, hasMAR: false, hasWounds: false, hasWaitingRoom: true,
    hasAppointments: true, hasWalkins: true, hasFamilies: false, hasDispensing: false, hasScreenings: true,
    revenue: 'fee_for_service', currencyFlow: 'Atos clínicos e recibos',
  },
  health_center: {
    personNoun: 'Utente', personNounPlural: 'Utentes', personShort: 'Utentes', personNounIndef: 'um utente', unitNoun: 'Centro de Saúde / USF',
    noPersonEventLabel: 'Evento da unidade', appointmentNoun: 'Consulta', appointmentNounPlural: 'Consultas',
    roomLabel: 'Gabinete', addPersonCta: 'Adicionar utente', emptyPeopleMsg: 'Ainda não há utentes registados.',
    hasBeds: false, hasShifts: true, hasMAR: false, hasWounds: false, hasWaitingRoom: true,
    hasAppointments: true, hasWalkins: true, hasFamilies: false, hasDispensing: false, hasScreenings: true,
    revenue: 'fee_for_service', currencyFlow: 'Atos e taxas moderadoras',
  },
}

export function institutionConfig(institution: InstitutionType): InstitutionConfig {
  return CFG[institution] || CFG.clinic
}

export const REVENUE_LABEL: Record<RevenueModel, string> = {
  monthly_fee: 'Mensalidades',
  pos_sales: 'Vendas & Caixa',
  fee_for_service: 'Atos & Recibos',
  internal: 'Distribuição interna',
}
