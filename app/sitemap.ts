import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-pi.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const publicPages: Array<{
    url: string
    priority: number
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  }> = [
    { url: '/',              priority: 1.0, changeFrequency: 'weekly' },
    { url: '/interactions',  priority: 0.9, changeFrequency: 'monthly' },
    { url: '/ai',            priority: 0.9, changeFrequency: 'monthly' },
    { url: '/calculators',   priority: 0.8, changeFrequency: 'monthly' },
    { url: '/bula',          priority: 0.8, changeFrequency: 'monthly' },
    { url: '/study',         priority: 0.7, changeFrequency: 'monthly' },
    { url: '/ferramentas',   priority: 0.7, changeFrequency: 'weekly' },
    { url: '/sobre',         priority: 0.5, changeFrequency: 'yearly' },
    { url: '/login',         priority: 0.4, changeFrequency: 'yearly' },
  ]

  return publicPages.map(p => ({
    url: `${BASE}${p.url}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
}
