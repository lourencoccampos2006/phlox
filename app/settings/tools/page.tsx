// /settings/tools — Removida em 2026-06-01.
// A personalização das ferramentas vive agora dentro de /settings (tab
// "Ferramentas") — não há mais uma página separada.
import { redirect } from 'next/navigation'

export default function SettingsToolsRedirect() {
  redirect('/settings?tab=ferramentas')
}
