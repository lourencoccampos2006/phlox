// /socorros — Removida 2026-06-01. Fundida com /triagem em /saude-agora.
import { redirect } from 'next/navigation'
export default function SocorrosRedirect() { redirect('/saude-agora') }
