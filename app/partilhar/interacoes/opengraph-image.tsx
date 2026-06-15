import { renderShareCard, cardSize, SHARE_CARDS } from '@/lib/shareCard'

export const runtime = 'edge'
export const alt = 'Interações perigosas a evitar — Phlox'
export const size = cardSize
export const contentType = 'image/png'

export default function Card() {
  return renderShareCard(SHARE_CARDS['interacoes-comuns-a-evitar'])
}
