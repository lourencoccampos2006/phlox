// lib/legal.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fonte ÚNICA e canónica da informação legal do Phlox Clinical. Reutilizada por
// /privacy, /cookies, /terms, /subprocessadores, /dispositivo-medico, o gerador de
// DPA e os disclaimers. Manter ISTO atualizado mantém tudo coerente.
//
// Nota: o Fernando está pré-empresa (Portugal). Os campos de entidade usam
// placeholders honestos até a entidade estar constituída.
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_UPDATED = '7 de agosto de 2026'

// Responsável pelo tratamento (Controller).
// NOTA (Fernando): preenche legalEntity + nif + address com os dados reais assim
// que a sociedade estiver registada. Até lá, o texto abaixo é honesto e credível
// (entidade em constituição), evitando placeholders que pareçam "por acabar".
export const CONTROLLER = {
  name: 'Phlox Clinical',
  legalEntity: 'Phlox Clinical (entidade em constituição em Portugal)',
  nif: 'a atribuir com o registo da sociedade',
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
  { name: 'Sketchfab (Epic Games)', purpose: 'Visualização de modelos anatómicos 3D (ferramenta de estudo)', location: 'EUA / UE', policyUrl: 'https://sketchfab.com/privacy', category: 'media' },
]

// As categorias de cookies foram removidas em 2026-08-28 com a publicidade.
// Medido nessa data: o site não põe um único cookie, e depois de iniciar sessão
// guarda duas entradas de localStorage estritamente necessárias. Não havendo
// categorias a consentir, uma tabela de categorias só confundia. Ver
// app/cookies/page.tsx.

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
