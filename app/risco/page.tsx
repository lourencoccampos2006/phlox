import { redirect } from 'next/navigation'

// /risco foi eliminada (o utilizador reportou que os dados não eram fiáveis).
// As funções úteis vivem agora noutros sítios: verificação de medicação em
// /interactions e a visão agregada em /timeline (/saude360 era ela própria um
// redirect para lá — apontamos direto para evitar cadeia). Mantemos este
// redirect só para não partir links antigos.
export const metadata = { robots: { index: false, follow: false } }

export default function RiscoRemovido() {
  redirect('/timeline')
}
