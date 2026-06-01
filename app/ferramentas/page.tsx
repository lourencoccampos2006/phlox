// /ferramentas — Removida em 2026-06-01.
// O hub central de ferramentas passou a estar no /inicio (lê os toggles do
// utilizador) e a personalização vive dentro de /settings (tab Ferramentas).
// Redirecionamos para evitar 404 em links antigos.
import { redirect } from 'next/navigation'

export default function FerramentasRedirect() {
  redirect('/inicio')
}
