import type { Metadata } from 'next'

/**
 * ── UM INQUÉRITO PARTILHADO NÃO VAI PARA O GOOGLE ──────────────────────────
 *
 * O `robots.ts` já diz aos motores para não rastrearem `/i/`. Isso resolve
 * metade do problema: quem obedece ao ficheiro não entra. Quem não obedece —
 * e quem já tiver o endereço guardado de outra forma — entra à mesma.
 *
 * O `noindex` é a outra metade: diz «viste, mas não guardes». Os dois juntos
 * são o que mantém um link de seis caracteres fora de uma página de
 * resultados. E isso importa por uma razão prática e não por privacidade: se
 * o inquérito de uma casa aparecer numa pesquisa, qualquer pessoa pode
 * responder-lhe — e a média de satisfação dessa casa passa a incluir gente que
 * nunca lá pôs os pés.
 *
 * O título é genérico de propósito: um separador de browser aberto no
 * telemóvel de alguém não tem de dizer o nome de um lar.
 */
export const metadata: Metadata = {
  title: 'Inquérito de satisfação',
  description: 'Responder a um inquérito de satisfação.',
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutDoInquerito({ children }: { children: React.ReactNode }) {
  return children
}
