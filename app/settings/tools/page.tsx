// /settings/tools — Removida em 2026-06-01.
// Apontava para /settings?tab=ferramentas. Essa aba foi por sua vez removida a
// 2026-09-16 (controlava partes do /inicio que deixaram de existir), por isso
// isto levava a uma aba morta. Agora vai para o /settings e pronto.
import { redirect } from 'next/navigation'

export default function SettingsToolsRedirect() {
  redirect('/settings')
}
