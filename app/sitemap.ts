import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'

// Só CONTEÚDO real entra no sitemap. Dizer ao Google "as minhas boas páginas
// são estas" melhora a proporção conteúdo/lixo (ver app/robots.ts).
// Mantém em sincronia com ARTICLES em app/blog/page.tsx — datas iguais às de lá,
// para o lastModified refletir a publicação real (não "hoje" em todas sempre,
// o que é um sinal de baixa confiança para o Google).
const BLOG_POSTS = [
  { slug: 'interacoes-comuns-a-evitar', date: '2026-01-15' },
  { slug: 'dose-paracetamol-crianca', date: '2025-12-10' },
  { slug: 'ibuprofeno-varfarina', date: '2025-11-22' },
  { slug: 'metformina-alcool', date: '2026-02-01' },
  { slug: 'antibioticos-em-gravidez', date: '2026-02-15' },
  { slug: 'hipericao-medicamentos', date: '2026-01-28' },
  { slug: 'medicamentos-idosos-lista-beers', date: '2026-03-01' },
  { slug: 'ajuste-dose-insuficiencia-renal', date: '2026-02-20' },
  { slug: 'organizar-medicacao-idoso', date: '2026-06-15' },
  { slug: 'sinais-desidratacao-idosos', date: '2026-06-15' },
  { slug: 'como-ler-receita-medica', date: '2026-06-20' },
  { slug: 'medicamentos-sem-receita-cuidados', date: '2026-06-18' },
  { slug: 'como-guardar-medicamentos-casa', date: '2026-06-16' },
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

  const blogPages = BLOG_POSTS.map(post => ({
    url: `/blog/${post.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(post.date),
  }))

  return [
    ...corePages.map(p => ({ ...p, url: `${BASE}${p.url}`, lastModified: now })),
    ...blogPages.map(p => ({ ...p, url: `${BASE}${p.url}` })),
  ]
}
