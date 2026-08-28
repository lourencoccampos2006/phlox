import type { MetadataRoute } from 'next'
import { CONTEUDO, ARTIGOS, DOMINIO } from '@/lib/seoRoutes'

// O sitemap é a lista do que queremos indexado. Só entra aqui o que tem texto
// real renderizado no servidor — uma ferramenta 'use client' aparece vazia ao
// crawler e anunciá-la como conteúdo só dilui a qualidade média.
//
// As listas vivem em lib/seoRoutes.ts, partilhadas com o robots e com os
// cabeçalhos. Antes estavam duplicadas aqui e divergiram.

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date()

  const paginas = CONTEUDO.map((p) => ({
    url: `${DOMINIO}${p.url}`,
    priority: p.prioridade,
    changeFrequency: p.frequencia,
    lastModified: agora,
  }))

  const artigos = ARTIGOS.map((a) => ({
    url: `${DOMINIO}/blog/${a.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(a.data),
  }))

  return [...paginas, ...artigos]
}
