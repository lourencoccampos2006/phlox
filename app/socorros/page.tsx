// /socorros — Removida 2026-06-01 (fundida em /saude-agora). /saude-agora foi
// depois também removida 2026-08-09. Mantido como redirect por links antigos.
import { redirect } from 'next/navigation'
export default function SocorrosRedirect() { redirect('/sintomas') }
