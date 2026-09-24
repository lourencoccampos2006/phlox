'use client'

// components/institution/Contadores.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Os distintivos com números, e quem os vai buscar.
//
// ── UM PEDIDO, NÃO DEZASSEIS ────────────────────────────────────────────────
// Os números aparecem no menu lateral, nas pastas do painel e no menu do
// telemóvel — três sítios, ao mesmo tempo, com os mesmos números. Se cada um
// fosse buscá-los por si, eram três vezes dezasseis consultas por cada
// mudança de página.
//
// Por isso há um contexto: o shell busca uma vez, e quem precisar lê daí.
//
// ── QUANDO É QUE SE VAI BUSCAR OUTRA VEZ ───────────────────────────────────
// Ao entrar, ao mudar de página (com um travão de 30 segundos), e de dois em
// dois minutos enquanto o separador estiver à frente. Quando o separador está
// escondido, pára — ninguém precisa de contagens frescas de uma janela que
// está atrás de outras, e um portátil de turno agradece.
//
// ── PORQUE É QUE O PRIMEIRO ECRÃ NÃO ESPERA POR ISTO ───────────────────────
// Os números não são a página: são uma pista. Enquanto não chegam, não há
// distintivo nenhum — nem «0», nem um esqueleto a piscar, que é a forma mais
// rápida de fazer uma interface parecer lenta. Aparecem quando chegam.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { CONTADORES, contadorDe } from '@/lib/contadores'

interface Valor {
  numeros: Record<string, number>
  /** Marca uma ferramenta como vista e tira-lhe o número de imediato. */
  marcarVista: (id: string) => void
}

const Ctx = createContext<Valor>({ numeros: {}, marcarVista: () => {} })

export function useContadores() { return useContext(Ctx) }

/** O href desta ferramenta corresponde ao endereço em que estou? */
function correspondeAoEndereco(href: string, pathname: string, params: URLSearchParams): boolean {
  const [base, query] = href.split('?')
  if (pathname !== base && !pathname.startsWith(base + '/')) return false
  if (!query) return true
  // Um href com query (`/equipa?tab=mural`) só corresponde se os parâmetros
  // estiverem mesmo lá: quem abre /equipa nas escalas não leu o mural.
  for (const [k, v] of new URLSearchParams(query)) {
    if (params.get(k) !== v) return false
  }
  return true
}

export function ContadoresProvider({ children }: { children: React.ReactNode }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [numeros, setNumeros] = useState<Record<string, number>>({})
  const ultimaBusca = useRef(0)
  const orgId = scope.orgId

  const buscar = useCallback(async (forcar = false) => {
    if (!orgId || !user) return
    if (!forcar && Date.now() - ultimaBusca.current < 30_000) return
    ultimaBusca.current = Date.now()
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao?.session?.access_token
      if (!token) return
      const r = await fetch(`/api/contadores?org=${encodeURIComponent(orgId)}&tipo=${institution}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) return
      const j = await r.json()
      // Substitui em vez de fundir: uma ferramenta que deixou de responder tem
      // de perder o número, não ficar com o da vez passada.
      setNumeros(j.numeros || {})
    } catch {
      // Uma contagem que não chegou não é um erro para mostrar a ninguém. Os
      // distintivos ficam como estavam e tenta-se outra vez daqui a pouco.
    }
  }, [orgId, user, supabase, institution])

  // Ao entrar e a cada mudança de página.
  useEffect(() => { buscar() }, [buscar, pathname])

  // De dois em dois minutos, só com o separador à frente.
  useEffect(() => {
    if (!orgId) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') buscar()
    }, 120_000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') buscar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [buscar, orgId])

  const marcarVista = useCallback(async (id: string) => {
    // O número desaparece já, antes de o servidor responder. Quem acabou de
    // abrir a página não quer ver o aviso de que ela tem coisas novas.
    setNumeros(prev => {
      if (!(id in prev)) return prev
      const copia = { ...prev }; delete copia[id]; return copia
    })
    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao?.session?.access_token
      if (!token) return
      await fetch('/api/contadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ferramenta: id, org: orgId }),
      })
    } catch { /* fica por marcar; volta a aparecer na próxima busca */ }
  }, [supabase, orgId])

  // Entrar numa ferramenta marca-a como vista. Fica aqui, e não em cada uma
  // das dezoito páginas: uma página nova ganha isto de borla, e nenhuma se
  // esquece de o fazer.
  useEffect(() => {
    const aqui = CONTADORES.find(c =>
      (c.tipo === 'novidades' || c.comMarcador) &&
      correspondeAoEndereco(c.href, pathname, searchParams))
    if (aqui) marcarVista(aqui.id)
  }, [pathname, searchParams, marcarVista])

  return <Ctx.Provider value={{ numeros, marcarVista }}>{children}</Ctx.Provider>
}

/**
 * O número ao lado de uma ferramenta. Não devolve nada quando não há nada a
 * dizer — um «0» é ruído com aparência de informação.
 */
export function Distintivo({ href, cor }: { href: string; cor?: string }) {
  const { numeros } = useContadores()
  const c = contadorDe(href, numeros)
  if (!c) return null
  return (
    <span
      title={c.frase}
      aria-label={c.frase}
      style={{
        marginLeft: 'auto', flexShrink: 0,
        minWidth: 20, height: 20, padding: '0 6px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 999, background: cor || '#dc2626', color: '#fff',
        fontSize: 11, fontWeight: 800, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
      {c.n > 99 ? '99+' : c.n}
    </span>
  )
}

/**
 * O número de uma PASTA de ferramentas: a soma do que está lá dentro.
 *
 * Uma pasta fechada esconde as ferramentas todas. Sem isto, o número de uma
 * ocorrência por fechar só aparecia a quem já tivesse aberto a pasta certa —
 * ou seja, a quem já soubesse que ele lá estava.
 */
export function DistintivoDaPasta({ hrefs, cor }: { hrefs: string[]; cor?: string }) {
  const { numeros } = useContadores()
  let total = 0
  const partes: string[] = []
  for (const href of hrefs) {
    const c = contadorDe(href, numeros)
    if (c) { total += c.n; partes.push(c.frase) }
  }
  if (!total) return null
  const frase = partes.join(' · ')
  return (
    <span
      title={frase}
      aria-label={frase}
      style={{
        flexShrink: 0, minWidth: 20, height: 20, padding: '0 6px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 999, background: cor || '#dc2626', color: '#fff',
        fontSize: 11, fontWeight: 800, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
      {total > 99 ? '99+' : total}
    </span>
  )
}
