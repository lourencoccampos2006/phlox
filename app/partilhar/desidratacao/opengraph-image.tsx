import { renderShareCard, cardSize, SHARE_CARDS } from '@/lib/shareCard'

// Cartão partilhável (1080x1080) — ver lib/shareCard.tsx para o design e dados.
export const runtime = 'edge'
export const alt = 'Sinais de desidratação em idosos — Phlox'
export const size = cardSize
export const contentType = 'image/png'

export default function Card() {
  return renderShareCard(SHARE_CARDS['sinais-desidratacao-idosos'])
}
