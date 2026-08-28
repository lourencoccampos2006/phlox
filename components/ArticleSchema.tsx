// components/ArticleSchema.tsx
// JSON-LD reutilizável para os artigos de saúde.
//
// ── PORQUE MUDOU DE `Article` PARA `MedicalWebPage` ───────────────────────
// O tipo `Article` serve para qualquer texto. Para conteúdo de saúde, o
// schema.org tem um tipo próprio que aceita os campos que a Google procura
// nesta categoria: quem reviu (`reviewedBy`), quando foi revisto
// (`lastReviewed`) e em que fontes assenta (`citation`).
//
// O autor também deixou de ser uma Organização e passou a ser uma Pessoa. Uma
// organização não demonstra competência nenhuma, e conteúdo médico sem pessoa
// por trás é o que as instruções aos avaliadores da Google mandam classificar
// no fundo da escala.
//
// `reviewedBy` só aparece quando existe mesmo um revisor em lib/autoria.ts.
// Declarar revisão clínica que não aconteceu, num artigo sobre doses, seria
// mentir em dados estruturados — que é das poucas coisas que a Google trata
// como spam ativo, e não apenas como baixa qualidade.
//
// Conteúdo 100% estático (sem input do utilizador) → o dangerouslySetInnerHTML
// aqui é seguro: serializamos um objeto que construímos nós, com JSON.stringify.

import { EDITOR, REVISOR_CLINICO, type Fonte } from '@/lib/autoria'
import { DOMINIO } from '@/lib/seoRoutes'

export default function ArticleSchema({
  slug,
  headline,
  description,
  datePublished,
  dateModified,
  fontes = [],
}: {
  slug: string
  headline: string
  description: string
  datePublished: string
  dateModified?: string
  /** As fontes reais do artigo. Aparecem como `citation` no schema. */
  fontes?: Fonte[]
}) {
  const url = `${DOMINIO}/blog/${slug}`
  const revisto = dateModified || datePublished

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline,
    description,
    inLanguage: 'pt-PT',
    author: {
      '@type': 'Person',
      name: EDITOR.nome,
      jobTitle: EDITOR.papel,
      ...(EDITOR.url ? { url: EDITOR.url } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Phlox',
      url: DOMINIO,
      logo: { '@type': 'ImageObject', url: `${DOMINIO}/icons/icon-512.png` },
    },
    datePublished,
    dateModified: revisto,
    lastReviewed: revisto,
    url,
    mainEntityOfPage: url,
  }

  if (REVISOR_CLINICO) {
    schema.reviewedBy = {
      '@type': 'Person',
      name: REVISOR_CLINICO.nome,
      jobTitle: REVISOR_CLINICO.papel,
      ...(REVISOR_CLINICO.url ? { url: REVISOR_CLINICO.url } : {}),
    }
  }

  if (fontes.length) {
    schema.citation = fontes.map((f) => ({
      '@type': 'WebPage',
      name: f.nome,
      description: f.descricao,
      url: f.url,
    }))
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
}
