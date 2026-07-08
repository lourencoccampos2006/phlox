import type { Metadata } from 'next'

// A página /pricing é um client component, por isso os metadados vivem aqui.
// (O layout raiz aplica o template '%s | Phlox'.)
export const metadata: Metadata = {
  title: 'Preços',
  description: 'Comece grátis. Plus para estudar, Pro para cuidar da sua saúde e da família, Institucional para centros de dia e lares — equipa e utentes ilimitados.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
