// lib/consentTemplates.ts
// Modelos de consentimento (RGPD e procedimentos). Texto orientador em PT-PT.
// Os campos {NOME} e {INSTITUICAO} são preenchidos no momento da emissão.
// Não substitui validação jurídica; serve para padronizar e arquivar.

import type { InstitutionType } from './useClinicPrefs'

export type ConsentTemplate = { kind: string; label: string; icon: string; body: string }

const RGPD: ConsentTemplate = {
  kind: 'rgpd', label: 'Proteção de dados (RGPD)', icon: '🔐',
  body: `Eu, {NOME}, declaro que fui informado(a) de que {INSTITUICAO} recolhe e trata os meus dados pessoais e de saúde com a finalidade de prestação de cuidados, gestão clínica e cumprimento de obrigações legais.

Fui informado(a) de que:
• Os meus dados são tratados de forma confidencial e segura;
• Tenho direito de acesso, retificação, apagamento e portabilidade dos meus dados;
• Posso retirar este consentimento a qualquer momento, sem prejuízo da licitude do tratamento anterior;
• Os dados são conservados pelo período legalmente exigido.

Autorizo o tratamento dos meus dados nos termos acima descritos.`,
}

const IMAGEM: ConsentTemplate = {
  kind: 'imagem', label: 'Captação de imagem', icon: '📷',
  body: `Eu, {NOME}, autorizo {INSTITUICAO} a captar e utilizar imagens (fotografia/vídeo) para fins exclusivamente clínicos e de registo no processo, com garantia de confidencialidade e não divulgação a terceiros sem novo consentimento.`,
}

const PROCEDIMENTO: ConsentTemplate = {
  kind: 'procedimento', label: 'Procedimento / ato clínico', icon: '🩺',
  body: `Eu, {NOME}, declaro que me foi explicado, em linguagem que compreendi, o procedimento proposto, os seus benefícios, riscos, alternativas e consequências de não o realizar. Tive oportunidade de colocar questões e foram esclarecidas.

Consinto livre e esclarecidamente na realização do procedimento em {INSTITUICAO}.`,
}

const VACINA: ConsentTemplate = {
  kind: 'vacina', label: 'Administração de vacina', icon: '💉',
  body: `Eu, {NOME}, fui informado(a) sobre a vacina a administrar, os seus benefícios e possíveis reações adversas. Confirmei o meu estado de saúde atual e ausência de contraindicações conhecidas.

Consinto na administração da vacina em {INSTITUICAO}.`,
}

const FARMACEUTICO: ConsentTemplate = {
  kind: 'farmaceutico', label: 'Serviço farmacêutico / MTM', icon: '💊',
  body: `Eu, {NOME}, autorizo {INSTITUICAO} a registar e tratar os dados relativos à minha medicação no âmbito de serviços farmacêuticos (revisão da medicação, indicação, acompanhamento), com a finalidade de melhorar a segurança e eficácia da terapêutica.`,
}

const ERPI: ConsentTemplate = {
  kind: 'erpi', label: 'Cuidados em ERPI / plano individual', icon: '🤝',
  body: `Eu, {NOME} (ou representante legal), declaro ter sido informado(a) sobre o plano individual de cuidados, a partilha de informação clínica entre a equipa de {INSTITUICAO} e, quando autorizado, com a família designada.

Consinto na prestação de cuidados e no tratamento dos dados necessários para o efeito.`,
}

const FAMILIA: ConsentTemplate = {
  kind: 'familia', label: 'Partilha com a família', icon: '👪',
  body: `Eu, {NOME}, autorizo {INSTITUICAO} a partilhar informação sobre o meu estado de saúde com a(s) pessoa(s) por mim designada(s) como contacto de família/cuidador, para fins de acompanhamento e comunicação.`,
}

const BY_INST: Record<InstitutionType, ConsentTemplate[]> = {
  pharmacy_community: [RGPD, FARMACEUTICO, IMAGEM],
  pharmacy_hospital:  [RGPD, FARMACEUTICO],
  health_center:      [RGPD, PROCEDIMENTO, VACINA, IMAGEM],
  clinic:             [RGPD, PROCEDIMENTO, IMAGEM],
  hospital:           [RGPD, PROCEDIMENTO, IMAGEM],
  nursing_home:       [RGPD, ERPI, FAMILIA, IMAGEM],
  day_care:           [RGPD, FAMILIA, IMAGEM, FARMACEUTICO],
}

export function consentTemplatesFor(institution: InstitutionType): ConsentTemplate[] {
  return BY_INST[institution] || [RGPD, PROCEDIMENTO, IMAGEM]
}

export function fillConsent(body: string, name: string, institution: string): string {
  return body.replace(/\{NOME\}/g, name || '________________').replace(/\{INSTITUICAO\}/g, institution || 'a instituição')
}
