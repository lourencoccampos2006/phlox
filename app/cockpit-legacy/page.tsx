import { redirect } from 'next/navigation'

// /cockpit-legacy era o cockpit institucional antigo. O atual é /painel (montado
// do institutionBlueprint por tipo). Esta página não estava ligada a lado nenhum.
// Redirect para não partir eventuais links antigos. (Ronda 10)
export const metadata = { robots: { index: false, follow: false } }

export default function CockpitLegacyRedirect() {
  redirect('/painel')
}
