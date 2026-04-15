// app/robots.ts
// Este ficheiro vai para: app/robots.ts
// Gera automaticamente /robots.txt
//
// O truque de GEO está aqui:
// A maioria dos sites BLOQUEIA os crawlers de IA (GPTBot, Google-Extended, etc.)
// Nós fazemos o OPOSTO — convidamos explicitamente todos os crawlers de IA
// Isto significa que o ChatGPT, Gemini, Perplexity e Claude podem ler e CITAR as nossas páginas
// quando alguém perguntar sobre medicamentos — tráfego sem pagar nada

import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Regra geral — permite tudo excepto APIs
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/'],
      },
      // ChatGPT — permite crawling para GEO
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/api/'],
      },
      // Google Gemini — permite crawling para GEO
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/api/'],
      },
      // Perplexity AI — permite crawling para GEO
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/api/'],
      },
      // Claude (Anthropic) — permite crawling para GEO
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: ['/api/'],
      },
      // Meta AI — permite crawling para GEO
      {
        userAgent: 'Meta-ExternalAgent',
        allow: '/',
        disallow: ['/api/'],
      },
      // Common Crawl — usado para treinar modelos de IA
      {
        userAgent: 'CCBot',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}