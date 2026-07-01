import { redirect } from 'next/navigation'

// /dashboard-institucional foi substituído por /painel-dono (o painel do dono,
// mantido e por instituição). Esta página antiga duplicava-o e não estava ligada
// a lado nenhum. Mantemos o redirect para não partir links antigos. (Ronda 10)
export const metadata = { robots: { index: false, follow: false } }

export default function DashboardInstitucionalRedirect() {
  redirect('/painel-dono')
}
