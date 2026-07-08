// /institucional — a página institucional atual é /centro-de-dia (foco: centro
// de dia e lar). A antiga vendia farmácia/hospital/clínica (Ward/Connect/Rounds),
// tudo arquivado. Redirect permanente para não partir links antigos.
// (Ronda 1 — limpeza para apresentação.)
import { redirect } from 'next/navigation'

export default function InstitucionalPage() {
  redirect('/centro-de-dia')
}
