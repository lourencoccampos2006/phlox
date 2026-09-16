// /ferramentas — Removida em 2026-06-01.
// O hub central de ferramentas é o /tudo; o /inicio ficou com uma acao e uma
// lista curta (2026-09-16).
// Redirecionamos para evitar 404 em links antigos.
import { redirect } from 'next/navigation'

export default function FerramentasRedirect() {
  redirect('/inicio')
}
