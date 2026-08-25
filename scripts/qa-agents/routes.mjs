// As rotas que os agentes visitam. Editar aqui é o sítio certo para alargar a
// cobertura — o resto do sistema lê daqui.
//
// PÚBLICAS: visitadas sem sessão, em produção e no build local. Nada escreve.
// PRIVADAS: precisam da conta de QA. Só corridas no build local (modo completo),
//           nunca contra produção, para não mexer em dados a sério.

export const PUBLICAS = [
  { path: '/', nome: 'Homepage' },
  { path: '/centro-de-dia', nome: 'Landing Centro de Dia' },
  { path: '/pricing', nome: 'Planos' },
  { path: '/about', nome: 'Sobre' },
  { path: '/trust', nome: 'Confiança' },
  { path: '/seguranca', nome: 'Segurança' },
  { path: '/blog', nome: 'Blog' },
  // Redireciona para /centro-de-dia de propósito (links antigos). Fica na lista
  // para confirmar que o redirecionamento continua de pé.
  { path: '/institucional', nome: 'Institucional (redirect)' },
  { path: '/terms', nome: 'Termos' },
  { path: '/privacy', nome: 'Privacidade' },
  { path: '/login', nome: 'Entrar' },
]

export const PRIVADAS = [
  { path: '/inicio', nome: 'Início' },
  { path: '/radar', nome: 'Radar' },
  { path: '/tendencias', nome: 'Tendências' },
  { path: '/carga', nome: 'Carga' },
  { path: '/autonomia', nome: 'Autonomia' },
  { path: '/mymeds', nome: 'Medicação' },
  { path: '/timeline', nome: 'Registo de saúde' },
  { path: '/settings', nome: 'Definições' },
]

// Erros de consola que NÃO são bugs nossos. Sem esta lista o relatório enche-se
// de ruído de terceiros e deixa de ser lido — que é a forma mais comum destes
// sistemas morrerem.
export const RUIDO_CONSOLA = [
  // Terceiros
  'googlesyndication', 'googletagmanager', 'google-analytics', 'doubleclick',
  'adsbygoogle', 'ERR_BLOCKED_BY_CLIENT', 'favicon.ico',
  'Download the React DevTools',
  'net::ERR_INTERNET_DISCONNECTED',

  // Instrumentação interna do React 19 / Next.js. Verificado em 2026-08-24:
  // vem de react-server-dom-turbopack (flushComponentPerformance), não de
  // código nosso, e não parte a página. Sem isto o relatório assinalava uma
  // "exceção crítica" em várias rotas todos os dias — e um relatório que grita
  // lobo deixa de ser lido.
  'cannot have a negative time stamp',
  'flushComponentPerformance',
]
