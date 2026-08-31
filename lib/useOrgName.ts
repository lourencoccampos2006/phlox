'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'

/**
 * O nome REAL da instituição, como está na base de dados.
 *
 * ── PORQUE É QUE ISTO PASSOU A EXISTIR ────────────────────────────────────
 * O cabeçalho mostrava `blueprint.productName` — "O seu Centro de Dia", "O seu
 * Lar". Isso é a categoria, não a casa: dava o mesmo texto a toda a gente que
 * usa o produto. Quem trabalha num sítio quer ver o nome do sítio.
 *
 * Guardamos o valor em sessionStorage para o nome não piscar em cada navegação
 * — é um pedido por sessão em vez de um por página, e o nome de uma instituição
 * não muda no meio de um turno.
 *
 * Enquanto não chega, e quando não há organização (conta individual a
 * experimentar), devolve null. Quem chama decide o que pôr no lugar — o
 * cabeçalho usa o nome da categoria, que é honesto: não há casa nenhuma para
 * nomear.
 */
export function useOrgName(): string | null {
  const { supabase } = useAuth() as any
  const { orgId } = useOrgScope()
  const [nome, setNome] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId || !supabase) { setNome(null); return }

    const chave = `phlox-org-nome-${orgId}`
    try {
      const guardado = sessionStorage.getItem(chave)
      if (guardado) { setNome(guardado); return }
    } catch { /* modo privado — segue sem cache */ }

    let vivo = true
    supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
      .then(({ data }: any) => {
        if (!vivo) return
        const n = (data?.name || '').trim()
        if (!n) return
        setNome(n)
        try { sessionStorage.setItem(chave, n) } catch { /* ignora */ }
      }, () => { /* sem permissão ou sem tabela: fica null */ })

    return () => { vivo = false }
  }, [orgId, supabase])

  return nome
}
