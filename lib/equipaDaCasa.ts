// lib/equipaDaCasa.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quem trabalha nesta casa — uma vez, e para todos os sítios que perguntam.
//
// ── PORQUE É QUE ISTO É UM FICHEIRO ────────────────────────────────────────
// «É necessário haver em várias ferramentas a atribuição de um responsável.»
//
// «Várias ferramentas» quer dizer que a mesma pergunta — quem é que há para
// escolher? — passa a ser feita em meia dúzia de páginas. A ronda já a fazia,
// com dezoito linhas copiadas para dentro dela: perfil → org → org_members →
// perfis_visiveis, com dois recuos pelo meio para o caso de alguma falhar.
//
// Copiar essas dezoito linhas para cada sítio novo é garantir que dentro de um
// mês há cinco versões, e que a que se corrige não é a que está a correr.
//
// ── DUAS CONSULTAS, E O NOME NÃO VEM DA `profiles` ─────────────────────────
// `org_members` diz quem pertence à casa; `perfis_visiveis` diz como se
// chamam. A segunda é uma VISTA com nove colunas (sprint168) — ler a
// `profiles` diretamente devolvia o perfil inteiro de cada colega, com email,
// NIF e identificador do Stripe, a quem só queria escrever «Ana» num botão.
//
// ── E É PARTILHADA ENTRE PÁGINAS ───────────────────────────────────────────
// Passa por `leituraPartilhada`: três componentes na mesma página que peçam a
// equipa fazem uma consulta, não três. No plano gratuito do Supabase o tecto é
// o número de chamadas, e esta é de uma lista que muda uma vez por mês.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { leituraPartilhada } from './leituraPartilhada'
import { perfisDe } from './perfisVisiveis'

export interface MembroDaCasa {
  id: string
  nome: string
}

/** As iniciais, para o círculo. «Ana Maria Costa» → «AC». */
export function iniciais(nome: string): string {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Uma cor estável para cada pessoa.
 *
 * Estável é o ponto: a Ana tem de ser sempre da mesma cor, em todas as páginas
 * e em todas as sessões, senão a cor não ajuda a reconhecer ninguém — só
 * decora. Por isso sai do `id`, que não muda, e não de uma posição numa lista,
 * que muda sempre que entra alguém.
 */
const CORES = ['var(--amber)', 'var(--green)', 'var(--blue)', 'var(--red)', 'var(--blue)', 'var(--red)']
export function corDe(id: string): string {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0
  return CORES[n % CORES.length]
}

/** A lista, para quem está no servidor ou fora de um componente. */
export async function equipaDaCasa(supabase: any, orgId: string | null): Promise<MembroDaCasa[]> {
  if (!orgId) return []
  return leituraPartilhada(`equipa:${orgId}`, async () => {
    const { data, error } = await supabase
      .from('org_members').select('user_id').eq('org_id', orgId).eq('active', true)
    if (error || !data?.length) return []

    const perfis = await perfisDe(supabase, data.map((m: any) => m.user_id), 'id, name, display_name')
    return perfis
      .map(p => ({ id: p.id, nome: p.name || p.display_name || 'Colega' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  })
}

/** A mesma lista, para um componente. */
export function useEquipa(supabase: any, orgId: string | null) {
  const [membros, setMembros] = useState<MembroDaCasa[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    if (!orgId) { setMembros([]); setCarregando(false); return }
    setCarregando(true)
    equipaDaCasa(supabase, orgId)
      .then(l => { if (vivo) { setMembros(l); setCarregando(false) } })
      // Sem equipa não se escolhe ninguém, e a página continua a funcionar
      // para tudo o resto. Uma lista de nomes que não veio não deita abaixo um
      // turno.
      .catch(() => { if (vivo) { setMembros([]); setCarregando(false) } })
    return () => { vivo = false }
  }, [supabase, orgId])

  // Memorizado, e não `return { membros, carregando }`.
  //
  // Um objeto novo a cada render é a diferença entre uma página e uma página
  // que não abre: quem puser isto num `useCallback([equipa])` fica com uma
  // dependência que muda sempre, e o efeito volta a correr a cada render. Já
  // aconteceu aqui — um hook assim deu 1089 pedidos em seis segundos, e a
  // aplicação parecia avariada sem dar erro nenhum.
  //
  // `scripts/check-hooks-estaveis.mjs` apanhou esta exacta linha.
  return useMemo(() => ({ membros, carregando }), [membros, carregando])
}
