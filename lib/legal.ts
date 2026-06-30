// lib/legal.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fonte ÚNICA e canónica da informação legal do Phlox Clinical. Reutilizada por
// /privacy, /cookies, /terms, /subprocessadores, /dispositivo-medico, o gerador de
// DPA e os disclaimers. Manter ISTO atualizado mantém tudo coerente.
//
// Nota: o Fernando está pré-empresa (Portugal). Os campos de entidade usam
// placeholders honestos até a entidade estar constituída.
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_UPDATED = '30 de junho de 2026'

// Responsável pelo tratamento (Controller). Placeholders enquanto pré-empresa.
export const CONTROLLER = {
  name: 'Phlox Clinical',
  legalEntity: '(entidade a constituir — a indicar quando a sociedade estiver registada)',
  nif: '(a indicar)',
  address: 'Portugal',
  privacyEmail: 'info@phloxclinical.com',
  supportEmail: 'suporte@phloxclinical.com',
  website: 'phloxclinical.com',
}

// Autoridade de controlo (Portugal).
export const SUPERVISORY_AUTHORITY = {
  name: 'Comissão Nacional de Proteção de Dados (CNPD)',
  url: 'https://www.cnpd.pt',
}

export interface Subprocessor {
  name: string
  purpose: string
  location: string            // onde os dados são processados
  transfer?: string           // base p/ transferências fora do EEE, se aplicável
  policyUrl: string
  category: 'infra' | 'payments' | 'email' | 'ai' | 'ads' | 'media'
}

// Lista REAL e completa dos serviços que tratam dados em nome do Phlox.
// (AWS NÃO está aqui de propósito: o AWS_REGION é só uma variável que a Vercel
//  define — a Vercel é que é o subprocessador de infraestrutura.)
export const SUBPROCESSORS: Subprocessor[] = [
  { name: 'Vercel Inc.', purpose: 'Alojamento da aplicação web e entrega de conteúdo', location: 'EUA / UE', transfer: 'Cláusulas Contratuais-Tipo (CCT) + Data Privacy Framework', policyUrl: 'https://vercel.com/legal/privacy-policy', category: 'infra' },
  { name: 'Supabase Inc.', purpose: 'Base de dados (Postgres), autenticação e armazenamento de ficheiros', location: 'União Europeia (Frankfurt)', policyUrl: 'https://supabase.com/privacy', category: 'infra' },
  { name: 'Stripe Payments Europe, Ltd.', purpose: 'Processamento de pagamentos de subscrição', location: 'União Europeia (Irlanda) / EUA', transfer: 'CCT + Data Privacy Framework', policyUrl: 'https://stripe.com/privacy', category: 'payments' },
  { name: 'Resend (Plementia, Inc.)', purpose: 'Envio de emails transacionais (boas-vindas, avisos)', location: 'EUA', transfer: 'Cláusulas Contratuais-Tipo (CCT)', policyUrl: 'https://resend.com/legal/privacy-policy', category: 'email' },
  { name: 'Anthropic, PBC', purpose: 'Modelos de IA (geração de texto de apoio)', location: 'EUA', transfer: 'CCT — sem retenção para treino', policyUrl: 'https://www.anthropic.com/legal/privacy', category: 'ai' },
  { name: 'Google LLC (Gemini API)', purpose: 'Modelos de IA (texto e visão)', location: 'EUA / UE', transfer: 'CCT + Data Privacy Framework', policyUrl: 'https://policies.google.com/privacy', category: 'ai' },
  { name: 'Groq, Inc.', purpose: 'Inferência rápida de modelos de IA', location: 'EUA', transfer: 'Cláusulas Contratuais-Tipo (CCT)', policyUrl: 'https://groq.com/privacy-policy/', category: 'ai' },
  { name: 'OpenAI, L.L.C.', purpose: 'Modelos de IA (alternativa de redundância)', location: 'EUA', transfer: 'CCT — sem retenção para treino (API)', policyUrl: 'https://openai.com/policies/privacy-policy', category: 'ai' },
  { name: 'Google LLC (AdSense)', purpose: 'Publicidade (apenas com o seu consentimento)', location: 'EUA / UE', transfer: 'CCT + Data Privacy Framework', policyUrl: 'https://policies.google.com/technologies/ads', category: 'ads' },
  { name: 'Sketchfab (Epic Games)', purpose: 'Visualização de modelos anatómicos 3D (ferramenta de estudo)', location: 'EUA / UE', policyUrl: 'https://sketchfab.com/privacy', category: 'media' },
]

// Cookies por categoria — para a página de cookies.
export const COOKIE_CATEGORIES = [
  { id: 'essential', name: 'Essenciais', always: true, desc: 'Necessários para iniciar sessão, manter a sessão segura e o funcionamento básico. Não podem ser desligados.', examples: 'Autenticação (Supabase), preferências de interface.' },
  { id: 'ads', name: 'Publicidade', always: false, desc: 'Usados pelo Google AdSense para mostrar anúncios e medir o seu desempenho. Só são ativados se aceitar.', examples: 'Google AdSense.' },
  { id: 'push', name: 'Notificações', always: false, desc: 'Se ativar lembretes, guardamos a sua subscrição de notificações push para lhe avisar às horas certas.', examples: 'Web Push (VAPID).' },
] as const

// ─── Statement canónico de DISPOSITIVO MÉDICO (posição: NÃO é dispositivo) ───
// Usado pelo componente MedicalDisclaimer e pela página /dispositivo-medico.
export const MEDICAL_DEVICE_STATEMENT = {
  short: 'O Phlox é uma ferramenta de organização e de apoio à decisão — não é um dispositivo médico, não faz diagnósticos e não substitui o julgamento de um profissional de saúde.',
  long: [
    'O Phlox Clinical é uma ferramenta de organização da informação e de apoio à decisão, destinada a profissionais, cuidadores, estudantes e ao próprio utilizador.',
    'O Phlox NÃO é um dispositivo médico na aceção do Regulamento (UE) 2017/745 (MDR). Não se destina a diagnosticar, prevenir, monitorizar, prever, prognosticar, tratar ou atenuar doenças.',
    'O Phlox limita-se a reunir, organizar e apresentar informação que o utilizador ou a equipa registam, e a destacar o que sai do padrão definido — para que a pessoa qualificada decida. Não toma decisões clínicas nem estratifica risco clínico de forma autónoma.',
    'Toda a avaliação, interpretação e decisão clínica é da responsabilidade do profissional de saúde. Em caso de emergência, contacte o 112.',
  ],
}
