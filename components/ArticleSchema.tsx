// components/ArticleSchema.tsx
// JSON-LD (schema.org Article) reutilizável para os artigos do blog.
// Sinal de E-E-A-T para o Google: diz que a página é um artigo com autor,
// editor e datas — ajuda na indexação e foi um dos pontos fracos para o AdSense.
//
// Conteúdo 100% estático (sem input do utilizador) → o dangerouslySetInnerHTML
// aqui é seguro: serializamos um objeto que construímos nós, com JSON.stringify.

const BASE = 'https://phloxclinical.com'

export default function ArticleSchema({
  slug,
  headline,
  description,
  datePublished,
  dateModified,
}: {
  slug: string
  headline: string
  description: string
  datePublished: string
  dateModified?: string
}) {
  const url = `${BASE}/blog/${slug}`
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    inLanguage: 'pt-PT',
    author: { '@type': 'Organization', name: 'Phlox Clinical', url: BASE },
    publisher: { '@type': 'Organization', name: 'Phlox Clinical', url: BASE },
    datePublished,
    dateModified: dateModified || datePublished,
    url,
    mainEntityOfPage: url,
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}
