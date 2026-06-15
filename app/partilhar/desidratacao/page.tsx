import { redirect } from 'next/navigation'

// Rota só para gerar a imagem partilhável (opengraph-image.tsx ao lado).
// Quem abrir o link vai para o artigo completo.
export default function Page() {
  redirect('/blog/sinais-desidratacao-idosos')
}
