import { redirect } from 'next/navigation'

// /risco foi eliminada (o utilizador reportou que os dados não eram fiáveis).
// As funções úteis vivem agora noutros sítios: verificação de medicação em
// /interactions e a visão agregada em /saude360. Mantemos este redirect só para
// não partir links antigos.
export const metadata = { robots: { index: false, follow: false } }

export default function RiscoRemovido() {
  redirect('/saude360')
}
