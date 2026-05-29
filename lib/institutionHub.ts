// lib/institutionHub.ts
// Fonte única de verdade do ECOSSISTEMA por tipo de instituição.
// Cada instituição vê o seu cockpit como um TODO: clínica, operações/gestão,
// secretaria & doentes (incluindo quem ainda não usa Phlox), legal/conformidade,
// e equipa/pessoas — com ferramentas adaptadas a cada função.
//
// O cockpit lê daqui. Manter organizado por SECÇÕES para nunca ficar confuso de usar.

import type { InstitutionType, ClinicalRole } from './useClinicPrefs'

export type HubTool = {
  href: string
  label: string
  desc: string
  icon: string            // emoji leve — sinalética, não decoração
  roles?: ClinicalRole[]  // se presente, só aparece para estas funções (vazio/ausente = todas)
  isNew?: boolean         // marca "Novo" no cockpit
  accent?: string         // cor de destaque opcional
}

export type HubSectionId = 'clinica' | 'operacoes' | 'secretaria' | 'legal' | 'equipa'

export type HubSection = {
  id: HubSectionId
  title: string
  hint: string
  tools: HubTool[]
}

export const SECTION_META: Record<HubSectionId, { title: string; hint: string; color: string; bg: string }> = {
  clinica:    { title: 'Clínica & cuidado',        hint: 'Apoio à decisão e ao acto clínico',           color: '#dc2626', bg: '#fef2f2' },
  operacoes:  { title: 'Operações & gestão',       hint: 'Fazer a instituição funcionar todos os dias', color: '#2563eb', bg: '#eff6ff' },
  secretaria: { title: 'Secretaria & doentes',     hint: 'Atendimento, marcações e quem só passa lá',    color: '#0d9488', bg: '#f0fdfa' },
  legal:      { title: 'Legal & conformidade',     hint: 'RGPD, consentimentos, auditorias e registos',  color: '#7c3aed', bg: '#faf5ff' },
  equipa:     { title: 'Equipa & pessoas',         hint: 'Da secretaria à limpeza — todos incluídos',    color: '#ca8a04', bg: '#fffbeb' },
}

// ── Ferramentas reutilizáveis (referenciadas por várias instituições) ──────────
const T = {
  // Clínica
  atendimentos:  (desc: string): HubTool => ({ href: '/atendimentos', label: 'Registar atendimento', desc, icon: '📝' }),
  soap:          { href: '/soap', label: 'Nota clínica SOAP', desc: 'Estruturar a consulta em segundos', icon: '🩺', roles: ['doctor', 'nurse'] as ClinicalRole[] },
  interactions:  { href: '/interactions', label: 'Verificar interações', desc: 'Cruzar a medicação do utente', icon: '⚗️' },
  rastreios:     { href: '/rastreios', label: 'Rastreios & vacinas', desc: 'Plano DGS por idade/sexo/risco', icon: '🛡️' },
  indicacao:     { href: '/indicacao', label: 'Indicação farmacêutica', desc: 'Aconselhar ao balcão com segurança', icon: '💊' },
  patients:      { href: '/patients', label: 'Fichas de doentes', desc: 'Histórico clínico completo', icon: '🗂️' },
  rounds:        { href: '/rounds', label: 'Ronda por risco', desc: 'Doentes ordenados por prioridade', icon: '📈' },
  reconciliacao: { href: '/reconciliacao', label: 'Reconciliação terapêutica', desc: 'Antes/depois da transição de cuidados', icon: '🔄', roles: ['pharmacist', 'doctor', 'nurse'] as ClinicalRole[] },

  // Operações & gestão (NOVAS / existentes)
  vendas:     { href: '/vendas', label: 'Ponto de venda', desc: 'POS com código de barras e recibo', icon: '🧾', isNew: true },
  tarefas:    { href: '/tarefas-equipa', label: 'Tarefas da equipa', desc: 'Quadro de tarefas — todas as funções', icon: '✅', isNew: true },
  stock:      { href: '/stock', label: 'Stock & validades', desc: 'Existências, prazos e ruturas', icon: '📦', isNew: true },
  schedule:   { href: '/schedule', label: 'Escalas & turnos', desc: 'Quem está de serviço', icon: '🗓️' },
  team:       { href: '/team', label: 'Equipa', desc: 'Membros, funções e contactos', icon: '👥' },
  roi:        { href: '/roi', label: 'Indicadores & ROI', desc: 'Atividade e impacto', icon: '💹', roles: ['administrator', 'coordinator', 'pharmacist_director'] as ClinicalRole[] },

  // Secretaria & doentes (NOVAS)
  salaEspera: { href: '/sala-espera', label: 'Sala de espera', desc: 'Check-in e fila — mesmo sem conta Phlox', icon: '🪑', isNew: true },
  agenda:     { href: '/agenda', label: 'Agenda & marcações', desc: 'Consultas e tempos de espera', icon: '📅' },
  healthpass: { href: '/health-pass', label: 'Health Pass (QR)', desc: 'Ler o resumo de saúde de quem chega', icon: '🔖' },

  // Legal & conformidade (NOVAS)
  consentimentos: { href: '/consentimentos', label: 'Consentimentos & RGPD', desc: 'Gerar e arquivar consentimentos', icon: '📋', isNew: true },
  conformidade:   { href: '/conformidade', label: 'Conformidade & auditoria', desc: 'Checklist legal do tipo de instituição', icon: '⚖️', isNew: true },
  incidents:      { href: '/incidents', label: 'Ocorrências', desc: 'Registar e seguir incidentes', icon: '⚠️' },
}

// ── Definição por instituição ──────────────────────────────────────────────────
export const INSTITUTION_HUB: Record<InstitutionType, HubSection[]> = {
  // ───────────────────────── FARMÁCIA COMUNITÁRIA ─────────────────────────
  pharmacy_community: [
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Balcão e quem passa lá', tools: [
      T.atendimentos('Quem atendeste hoje — sem criar ficha'),
      T.healthpass,
      T.salaEspera,
    ]},
    { id: 'clinica', title: SECTION_META.clinica.title, hint: 'Apoio ao aconselhamento', tools: [
      T.indicacao, T.interactions, T.rastreios,
    ]},
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Gerir a farmácia', tools: [
      T.vendas, T.stock, T.tarefas, T.schedule, T.roi,
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'Obrigações da farmácia', tools: [
      T.conformidade, T.consentimentos, T.incidents,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Técnicos, auxiliares e limpeza', tools: [ T.team, T.tarefas ]},
  ],

  // ───────────────────────── CENTRO DE SAÚDE / USF ─────────────────────────
  health_center: [
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Receção e utentes ocasionais', tools: [
      T.salaEspera, T.agenda, T.atendimentos('Atendimento de quem passou hoje'), T.healthpass,
    ]},
    { id: 'clinica', title: SECTION_META.clinica.title, hint: 'Consulta e prevenção', tools: [
      T.rastreios, T.soap, T.interactions, T.patients,
    ]},
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Gerir a unidade', tools: [
      T.tarefas, T.stock, T.schedule, T.roi,
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'RGPD e registo clínico', tools: [
      T.consentimentos, T.conformidade, T.incidents,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Da receção à enfermagem e limpeza', tools: [ T.team, T.tarefas ]},
  ],

  // ───────────────────────── CLÍNICA ─────────────────────────
  clinic: [
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Receção e marcações', tools: [
      T.salaEspera, T.agenda, T.atendimentos('Registar quem foi atendido'), T.healthpass,
    ]},
    { id: 'clinica', title: SECTION_META.clinica.title, hint: 'Consulta', tools: [
      T.soap, T.patients, T.rastreios, T.interactions,
    ]},
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Gerir a clínica', tools: [
      T.vendas,
      { href: '/faturacao', label: 'Atos & recibos', desc: 'Atos, valores e recibos', icon: '💶', roles: ['administrator', 'coordinator'] },
      T.tarefas, T.stock, T.schedule, T.roi,
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'Consentimentos e RGPD', tools: [
      T.consentimentos, T.conformidade, T.incidents,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Secretaria, técnicos e limpeza', tools: [ T.team, T.tarefas ]},
  ],

  // ───────────────────────── HOSPITAL ─────────────────────────
  hospital: [
    { id: 'clinica', title: SECTION_META.clinica.title, hint: 'Serviço e enfermaria', tools: [
      T.patients, T.rounds, T.soap, T.reconciliacao, T.interactions,
    ]},
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Admissão e quem chega', tools: [
      T.salaEspera, T.atendimentos('Atendimento / contacto registado'), T.healthpass,
    ]},
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Gestão de serviço', tools: [
      T.tarefas, T.stock, T.schedule, T.roi,
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'Consentimentos e segurança', tools: [
      T.consentimentos, T.conformidade, T.incidents,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Equipa multidisciplinar e auxiliares', tools: [ T.team, T.tarefas ]},
  ],

  // ───────────────────────── FARMÁCIA HOSPITALAR ─────────────────────────
  pharmacy_hospital: [
    { id: 'clinica', title: SECTION_META.clinica.title, hint: 'Validação e farmácia clínica', tools: [
      T.reconciliacao, T.interactions, T.patients,
      { href: '/tpn', label: 'Nutrição parentérica (TPN)', desc: 'Cálculo e validação', icon: '🧪', roles: ['pharmacist', 'pharmacist_director'] },
    ]},
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Logística do medicamento', tools: [
      T.stock, T.tarefas, T.schedule, T.roi,
    ]},
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Pedidos e dispensa', tools: [
      T.atendimentos('Dispensa / pedido registado'), T.healthpass,
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'Rastreabilidade e auditoria', tools: [
      T.conformidade, T.incidents, T.consentimentos,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Farmacêuticos, TDT e auxiliares', tools: [ T.team, T.tarefas ]},
  ],

  // ───────────────────────── LAR / ERPI ─────────────────────────
  // O lar mantém o cockpit clínico rico próprio; o hub acrescenta gestão/legal/pessoas.
  nursing_home: [
    { id: 'operacoes', title: SECTION_META.operacoes.title, hint: 'Gerir o lar para além do cuidado', tools: [
      T.tarefas, T.stock, T.schedule, T.roi,
    ]},
    { id: 'secretaria', title: SECTION_META.secretaria.title, hint: 'Famílias e visitas', tools: [
      { href: '/familia', label: 'Portal da família', desc: 'Comunicação com familiares', icon: '👪' },
      T.healthpass, T.atendimentos('Visita externa / contacto registado'),
    ]},
    { id: 'legal', title: SECTION_META.legal.title, hint: 'ERPI: obrigações específicas', tools: [
      T.consentimentos, T.conformidade, T.incidents,
    ]},
    { id: 'equipa', title: SECTION_META.equipa.title, hint: 'Cuidadores, cozinha, limpeza, manutenção', tools: [ T.team, T.tarefas ]},
  ],
}

// Saudação por função para personalizar o cockpit.
export function roleFocusLine(institution: InstitutionType, role: ClinicalRole): string {
  if (role === 'administrator') return 'Visão de gestão: operações, conformidade e indicadores.'
  if (role === 'coordinator') return 'Coordenação: equipa, tarefas e qualidade do serviço.'
  if (role === 'pharmacist_director') return 'Direção técnica: clínica, stock e conformidade.'
  if (role === 'doctor') return 'Foco clínico, com a operação a um toque.'
  if (role === 'nurse') return 'Cuidado e tarefas do turno, sempre à mão.'
  return 'Tudo o que a tua função precisa, num só sítio.'
}

// Filtra as ferramentas visíveis para uma função.
export function visibleTools(section: HubSection, role: ClinicalRole): HubTool[] {
  return section.tools.filter(t => !t.roles || t.roles.length === 0 || t.roles.includes(role))
}
