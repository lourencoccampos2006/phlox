import { redirect } from 'next/navigation'

// A /dashboard era uma segunda "home" antiga (slóganes por modo). A home oficial
// é a /inicio — adapta-se ao modo, mostra as ferramentas ativas e o hub clínico.
// Mantemos este redirect para não partir links/bookmarks antigos.
export default function DashboardRedirect() {
  redirect('/inicio')
}
