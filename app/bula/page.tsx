import { redirect } from 'next/navigation'

// A ferramenta de Bula foi eliminada (estava fundida e confusa). O Phlox Scan
// (/scan) faz o mesmo: foto da bula/folheto → explicação em linguagem simples.
// Mantemos este redirect só para não partir links antigos.
export const metadata = { robots: { index: false, follow: false } }

export default function BulaRemovida() {
  redirect('/scan')
}
