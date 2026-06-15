import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'

// IMPORTANTE: este é o ÚNICO robots do site. Não criar public/robots.txt
// (o ficheiro estático ganharia a este e os dois entram em conflito).
//
// Estratégia: o phlox tem ~250 rotas, mas só ~20 são CONTEÚDO público real.
// As restantes são a aplicação (ferramentas atrás de login, dashboards,
// redirects), que ao Googlebot aparecem vazias. Deixar o Google rastrear tudo
// faz com que veja um mar de páginas finas → "Low value content" no AdSense.
// Por isso bloqueamos a app e deixamos rastrear só o conteúdo.

// Conteúdo público que QUEREMOS indexado (espelha o sitemap).
const ALLOW = [
  '/',
  '/blog',
  '/interactions',
  '/ai',
  '/calculators',
  '/centro-de-dia',
  '/about',
  '/sobre',
  '/aprender',
  '/study',
  '/pricing',
  '/privacy',
  '/terms',
  '/trust',
  '/seguranca',
  '/changelog',
  '/login',
]

// App / ferramentas / redirects / áreas privadas — NÃO indexar.
const DISALLOW = [
  '/api/',
  '/auth/',
  '/admin',
  '/dashboard',
  '/dashboard-institucional',
  '/checkout',
  '/onboarding',
  '/settings',
  '/partilhar/',     // stubs de redirect só p/ gerar imagem partilhável
  '/r/',
  '/v/',
  '/link',
  '/share',
  '/shared',
  // áreas de aplicação / clínicas (atrás de login, vazias p/ o crawler)
  '/mymeds', '/vitals', '/perfil', '/perfis', '/patients', '/rounds',
  '/turno', '/mar', '/arena', '/painel', '/cockpit', '/cockpit-legacy',
  '/portal-familia', '/familia', '/familia360', '/saude360', '/clinico360',
  '/study360', '/care-log', '/care-plans', '/residentes', '/census',
  '/scan', '/labs', '/health-import', '/health-pass', '/passport',
  '/prescription', '/prescription-queue', '/receita', '/reconciliacao',
  '/handover', '/nota-clinica', '/soap', '/triagem', '/telemed',
  '/telemedicina', '/agenda', '/calendario', '/calendario-meds',
  '/faturacao', '/faturacao-config', '/crm', '/stock', '/gestao',
  '/organizacao', '/equipa', '/team', '/teams', '/sso', '/sso-config',
  '/api-keys', '/webhooks', '/integracoes', '/automacoes', '/exportar-dados',
  '/importar', '/migrar', '/connect', '/vault', '/guardados',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOW,
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
