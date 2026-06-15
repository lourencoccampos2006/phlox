import { renderShareCard, cardSize, SHARE_CARDS } from '@/lib/shareCard'

export const runtime = 'edge'
export const alt = 'Organizar a medicação de um idoso — Phlox'
export const size = cardSize
export const contentType = 'image/png'

export default function Card() {
  return renderShareCard(SHARE_CARDS['organizar-medicacao-idoso'])
}
