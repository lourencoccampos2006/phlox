import type { NextConfig } from 'next'
import { APP } from './lib/seoRoutes'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com',
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          // camera/microfone permitidos só na própria origem (scanner de código
          // de barras, gravação de aula). Geolocalização e pagamentos bloqueados.
          // NUNCA pôr camera=() — isso bloqueia o getUserMedia das nossas features.
          { key: 'Permissions-Policy',       value: 'camera=(self), microphone=(self), geolocation=(), payment=()' },
        ],
      },
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|webp|woff|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },

      // ── A PEÇA QUE FALTAVA PARA LIMPAR O ÍNDICE ────────────────────────
      // As ~230 rotas de aplicação servem `noindex`. É isto — e não o
      // `Disallow` do robots.txt — que tira uma página do índice do Google.
      // O robots.txt só impede o rastreio: uma página já indexada fica lá para
      // sempre, porque o Google deixa de a poder revisitar para ver que devia
      // sair. Ver o comentário longo em lib/seoRoutes.ts.
      //
      // A lista vem de lá, partilhada com o app/robots.ts, para as duas não
      // voltarem a divergir — foi essa divergência que pôs o site a bloquear
      // as suas próprias páginas boas.
      ...APP.map((prefixo) => ({
        source: `${prefixo.replace(/\/$/, '')}/:caminho*`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      // Os prefixos acima cobrem '/mymeds/o-que-seja' mas não '/mymeds' seco.
      ...APP.map((prefixo) => ({
        source: prefixo.replace(/\/$/, ''),
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ]
  },

  async redirects() {
    return [
      // As páginas /interactions/<par> eram geradas para QUALQUER slug, com
      // respostas de FAQ que não respondiam nada ("verifique com o verificador
      // da Phlox"). Isso é o padrão de "doorway page" que a Google penaliza
      // desde março de 2024, e duas delas competiam com artigos do blog sobre
      // exatamente o mesmo par. A rota foi removida; estes 301 mandam o que
      // houvesse indexado para o artigo a sério.
      { source: '/interactions/ibuprofeno-varfarina', destination: '/blog/ibuprofeno-varfarina', permanent: true },
      { source: '/interactions/metformina-alcool',    destination: '/blog/metformina-alcool',    permanent: true },
      { source: '/interactions/hipericao-medicamentos', destination: '/blog/hipericao-medicamentos', permanent: true },
      { source: '/interactions/:par',                 destination: '/interactions',              permanent: false },

      // Redirects que estavam a ser feitos em JavaScript no cliente. Um redirect
      // em cliente custa um carregamento inteiro e o Google trata-o pior que um
      // 301 — passa a ser feito no servidor.
      { source: '/calculators', destination: '/calculos', permanent: true },
      { source: '/aprender',    destination: '/study',    permanent: true },
    ]
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  compress: true,
  poweredByHeader: false,
}

export default nextConfig