import { renderShareCard, cardSize, SHARE_CARDS } from '@/lib/shareCard'

export const runtime = 'edge'
export const alt = 'Ibuprofeno + Varfarina: o perigo — Phlox'
export const size = cardSize
export const contentType = 'image/png'

export default function Card() {
  return renderShareCard(SHARE_CARDS['ibuprofeno-varfarina'])
}
