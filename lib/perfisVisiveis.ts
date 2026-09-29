// lib/perfisVisiveis.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os nomes das pessoas, sem trazer o resto do perfil atrás.
//
// ── PORQUE E QUE ISTO E UM FICHEIRO ─────────────────────────────────────────
// Há três sítios no browser que precisam do NOME de outra pessoa: o painel
// administrativo, a ronda e o directório profissional. Os três liam a tabela
// `profiles`, que devolvia o perfil inteiro — email, NIF, número de utente de
// saúde, identificador do Stripe.
//
// O sprint168 fecha a tabela e cria a vista `perfis_visiveis` com as nove
// colunas que os outros podem ver. Isto é a porta única para ela.
//
// ── O RECUO, E PORQUE É TEMPORÁRIO ──────────────────────────────────────────
// Entre este código sair e o SQL correr há uma janela em que a vista ainda não
// existe. Sem recuo, a ronda mostrava «Colega» em toda a gente e ninguém sabia
// quem era quem — uma correção que parte o produto enquanto espera não é uma
// correção.
//
// Por isso: tenta a vista; se ela não existir, lê a tabela como antes. Quando
// o sprint168 correr, o recuo deixa de ser alcançável sozinho — a tabela passa
// a devolver só a própria linha — e pode sair daqui.
// ─────────────────────────────────────────────────────────────────────────────

export type PerfilVisivel = {
  id: string
  name?: string | null
  display_name?: string | null
  avatar?: string | null
  connect_handle?: string | null
  professional_role?: string | null
  institution?: string | null
  speciality?: string | null
}

/** A vista não existe? (Migração por correr — não é uma avaria.) */
const naoExiste = (e: any) =>
  e?.code === '42P01' || e?.code === 'PGRST205'
  || /does not exist|could not find the table/i.test(e?.message || '')

/**
 * Os perfis de um conjunto de pessoas, só com o que os outros podem ver.
 *
 * `colunas` tem de conter apenas colunas da vista. Pedir `email` aqui não
 * devolve nada depois do sprint168 — e é esse o objetivo.
 */
export async function perfisDe(
  supabase: any, ids: string[], colunas = 'id, name',
): Promise<PerfilVisivel[]> {
  if (!ids.length) return []

  const daVista = await supabase.from('perfis_visiveis').select(colunas).in('id', ids)
  if (!daVista.error) return daVista.data || []
  if (!naoExiste(daVista.error)) return []

  // Recuo enquanto o sprint168 não corre.
  const daTabela = await supabase.from('profiles').select(colunas).in('id', ids)
  return daTabela.error ? [] : (daTabela.data || [])
}

/** Um mapa de id → nome, que é o que quase todos os sítios querem. */
export async function nomesDe(
  supabase: any, ids: string[], porOmissao = 'Colega',
): Promise<Map<string, string>> {
  const perfis = await perfisDe(supabase, ids, 'id, name, display_name')
  return new Map(perfis.map(p => [p.id, p.name || p.display_name || porOmissao]))
}
