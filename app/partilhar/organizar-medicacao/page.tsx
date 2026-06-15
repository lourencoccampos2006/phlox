import { redirect } from 'next/navigation'

// Rota só para gerar a imagem partilhável (opengraph-image.tsx ao lado).
export default function Page() {
  redirect('/blog/organizar-medicacao-idoso')
}
