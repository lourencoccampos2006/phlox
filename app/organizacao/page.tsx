import { redirect } from 'next/navigation'

// O antigo "Hub da organização" (grab-bag genérico com telemedicina, CRM, BI,
// automações, hospital…) foi eliminado. Cada tipo de instituição tem agora o SEU
// cockpit, montado a partir do blueprint (lib/institutionBlueprint.ts) e servido
// em /painel. Este redirect mantém os links/atalhos antigos a funcionar.
export const metadata = { robots: { index: false, follow: false } }

export default function OrganizacaoRedirect() {
  redirect('/painel')
}
