import { redirect } from 'next/navigation'

// /organizar foi substituído pelo Phlox Scan, que faz tudo o que esta página
// fazia (foto da receita/caixas → lista de medicação) e muito mais.
export default function OrganizarRedirect() {
  redirect('/scan')
}
