import { redirect } from 'next/navigation'

// Havia duas páginas de diário (/diary e /sintomas) a escrever em tabelas
// diferentes. Unificámos no /sintomas (a oficial: tem perfis de família, dor,
// temperatura, e agora também o gráfico de bem-estar e tendência que existiam
// aqui). Este redirect mantém os links antigos a funcionar. O histórico antigo
// (diary_entries) continua visível na /timeline, que lê ambas as tabelas.
export default function DiaryRedirect() {
  redirect('/sintomas')
}
