import { redirect } from 'next/navigation'

// Stub: só existe para gerar a imagem partilhável (opengraph-image.tsx ao lado).
// noindex — não é conteúdo, é uma porta para o artigo.
export const metadata = { robots: { index: false, follow: false } }

export default function Page() {
  redirect('/blog/antibioticos-em-gravidez')
}
