// seoRoutes.ts — a fonte ÚNICA de verdade sobre o que o Google pode ver.
//
// Antes isto vivia espalhado: uma lista no app/robots.ts, outra no
// app/sitemap.ts, e nada nos cabeçalhos. As listas divergiram, e o site acabou a
// bloquear as suas próprias páginas boas. Agora há um ficheiro só, importado
// pelos três sítios.
//
// ── A DISTINÇÃO QUE INTERESSA, E QUE ESTAVA ERRADA ────────────────────────
// `Disallow` no robots.txt significa "não rastreies". NÃO significa "tira do
// índice". Uma página que já esteja indexada fica lá, e como o Google deixa de
// a poder rastrear, nunca mais lá volta para descobrir que devia sair.
//
// Foi exatamente isso que aconteceu aqui: em junho bloqueámos ~230 rotas de
// aplicação que já tinham sido indexadas. Ficaram presas no índice, a contar
// para a proporção de páginas finas que o AdSense avalia, e sem hipótese de
// saírem.
//
// A forma certa de tirar uma página do índice é DEIXAR RASTREAR e servir
// `noindex`. O Google volta lá, vê a instrução, e remove-a.
//
// Por isso:
//   PRIVADAS  → Disallow no robots. Nunca foram indexáveis e não têm de ser
//               rastreadas (endpoints de API, autenticação, administração).
//   APP       → rastreáveis, mas com X-Robots-Tag: noindex nos cabeçalhos.
//               É o que as tira do índice e as mantém fora dele.
//   CONTEUDO  → o que queremos indexado. Vai para o sitemap.

/** Nem rastrear. Não são páginas — são mecanismos. */
export const PRIVADAS = [
  '/api/',
  '/auth/',
  '/admin',
]

/**
 * A aplicação. Rastreável de propósito, para o Google poder ler o `noindex` e
 * as remover do índice onde já lá estejam.
 *
 * São prefixos: '/mymeds' cobre '/mymeds' e '/mymeds/o-que-seja'.
 */
export const APP = [
  // entrada e definições
  '/login', '/onboarding', '/settings', '/checkout', '/inicio', '/tudo',
  // ferramentas pessoais
  '/mymeds', '/vitals', '/perfil', '/timeline', '/sintomas', '/guardados',
  '/scan', '/labs', '/health-import', '/passport', '/comecar',
  // estudo
  '/study', '/study360', '/arena', '/osce', '/exam', '/modo-exame', '/decisao',
    // institucional / clínico
  '/painel', '/painel-dono', '/cockpit', '/cockpit-legacy', '/patients',
  '/residentes', '/census', '/turno', '/mar', '/care-log',
  '/care-plans', '/prescription', '/receita',
  '/reconciliacao', '/handover', '/nota-clinica', '/soap', '/triagem',
  '/quality', '/incidents', '/radar', '/vigia', '/guardiao', '/carga',
  '/autonomia', '/tendencias', '/adherencia', '/auditoria',
  '/agenda', '/calendario', '/schedule', '/equipa', '/team', '/teams',
  '/faturacao', '/faturacao-config', '/crm', '/stock', '/gestao',
  '/organizacao', '/dashboard', '/dashboard-institucional',
  // família
  '/familia', '/familia360', '/family', '/saude360', '/clinico360',
  // integrações e dados
  '/sso', '/sso-config', '/api-keys', '/api-docs', '/webhooks', '/integracoes',
  '/automacoes', '/exportar-dados', '/importar', '/migrar', '/connect', '/vault',
  // redirects e stubs de partilha
  '/partilhar/', '/r/', '/v/', '/c/', '/link', '/share', '/shared',
  '/telemed', '/telemedicina', '/avaliar',
]

/**
 * Conteúdo público. É isto que queremos no Google, e é isto que vai ao sitemap.
 *
 * A regra para entrar aqui: a página tem de ter TEXTO REAL renderizado no
 * servidor. Uma ferramenta 'use client' aparece vazia ao crawler e entra na
 * lista de cima, não nesta.
 */
export const CONTEUDO: Array<{
  url: string
  prioridade: number
  frequencia: 'daily' | 'weekly' | 'monthly' | 'yearly'
}> = [
  { url: '/',                    prioridade: 1.0, frequencia: 'weekly' },
  { url: '/blog',                prioridade: 0.9, frequencia: 'weekly' },
  { url: '/guias',               prioridade: 0.8, frequencia: 'monthly' },
  { url: '/centro-de-dia',       prioridade: 0.8, frequencia: 'monthly' },
  { url: '/pricing',             prioridade: 0.7, frequencia: 'monthly' },
  { url: '/about',               prioridade: 0.5, frequencia: 'yearly' },
  { url: '/seguranca',           prioridade: 0.4, frequencia: 'yearly' },
  { url: '/privacy',             prioridade: 0.3, frequencia: 'yearly' },
  { url: '/terms',               prioridade: 0.3, frequencia: 'yearly' },
  { url: '/cookies',             prioridade: 0.2, frequencia: 'yearly' },
  { url: '/dispositivo-medico',  prioridade: 0.3, frequencia: 'yearly' },
  { url: '/subprocessadores',    prioridade: 0.2, frequencia: 'yearly' },
]

/**
 * Os artigos do blog. Manter em sincronia com app/blog/page.tsx.
 * A data é a da última revisão a sério — não "hoje", que é sinal de pouca
 * confiança para o Google quando todas as páginas mudam todos os dias.
 */
export const ARTIGOS = [
  { slug: 'interacoes-comuns-a-evitar',        data: '2026-01-15' },
  { slug: 'dose-paracetamol-crianca',          data: '2025-12-10' },
  { slug: 'ibuprofeno-varfarina',              data: '2025-11-22' },
  { slug: 'metformina-alcool',                 data: '2026-02-01' },
  { slug: 'antibioticos-em-gravidez',          data: '2026-02-15' },
  { slug: 'hipericao-medicamentos',            data: '2026-01-28' },
  { slug: 'medicamentos-idosos-lista-beers',   data: '2026-03-01' },
  { slug: 'ajuste-dose-insuficiencia-renal',   data: '2026-02-20' },
  { slug: 'organizar-medicacao-idoso',         data: '2026-06-15' },
  { slug: 'sinais-desidratacao-idosos',        data: '2026-06-15' },
  { slug: 'como-ler-receita-medica',           data: '2026-06-20' },
  { slug: 'medicamentos-sem-receita-cuidados', data: '2026-06-18' },
  { slug: 'como-guardar-medicamentos-casa',    data: '2026-06-16' },
]

/** O domínio. Havia código a apontar para `phlox.health`, que não é o site. */
export const DOMINIO = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'
