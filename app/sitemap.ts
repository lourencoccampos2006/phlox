import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'

// Só CONTEÚDO real entra no sitemap. Dizer ao Google "as minhas boas páginas
// são estas" melhora a proporção conteúdo/lixo (ver app/robots.ts).
// Mantém em sincronia com ARTICLES em app/blog/page.tsx.
const BLOG_SLUGS = [
  'interacoes-comuns-a-evitar',
  'dose-paracetamol-crianca',
  'ibuprofeno-varfarina',
  'metformina-alcool',
  'antibioticos-em-gravidez',
  'hipericao-medicamentos',
  'medicamentos-idosos-lista-beers',
  'ajuste-dose-insuficiencia-renal',
  'organizar-medicacao-idoso',
  'sinais-desidratacao-idosos',
  'como-ler-receita-medica',
  'medicamentos-sem-receita-cuidados',
  'como-guardar-medicamentos-casa',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // IMPORTANTE p/ AdSense: só pomos no sitemap páginas que ao Googlebot têm
  // CONTEÚDO REAL em HTML (renderizadas no servidor, com texto). As ferramentas
  // (/interactions, /ai, /calculators...) são apps 'use client' — ao crawler
  // aparecem quase vazias, e isso conta como "thin content". Por isso ficam de
  // fora do sitemap (continuam acessíveis, só não as anunciamos como conteúdo).
  const corePages: Array<{
    url: string
    priority: number
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  }> = [
    { url: '/',              priority: 1.0, changeFrequency: 'weekly' },
    { url: '/blog',          priority: 0.9, changeFrequency: 'weekly' },
    { url: '/guias',         priority: 0.8, changeFrequency: 'monthly' },
    { url: '/centro-de-dia', priority: 0.7, changeFrequency: 'monthly' },
    { url: '/about',         priority: 0.5, changeFrequency: 'yearly' },
    { url: '/pricing',       priority: 0.5, changeFrequency: 'monthly' },
    { url: '/privacy',       priority: 0.3, changeFrequency: 'yearly' },
    { url: '/terms',         priority: 0.3, changeFrequency: 'yearly' },
  ]

  const blogPages = BLOG_SLUGS.map(slug => ({
    url: `/blog/${slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  }))

  return [...corePages, ...blogPages].map(p => ({
    url: `${BASE}${p.url}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
}
