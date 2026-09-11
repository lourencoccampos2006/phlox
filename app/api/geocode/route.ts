// app/api/geocode/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Converte moradas em coordenadas, UMA vez, e guarda-as na ficha da pessoa.
//
// Usa o Nominatim (OpenStreetMap): sem chave, sem custo, sem contrato. Em troca
// tem uma regra de uso séria — no máximo um pedido por segundo e um
// User-Agent que nos identifique. Ambas cumpridas aqui.
//
// O que NÃO se faz: nunca se inventa uma coordenada. Se o Nominatim não
// encontrar a morada, a pessoa fica sem ponto e o mapa di-lo em vez de a pôr
// num sítio aproximado. Um ponto errado num mapa de transportes manda uma
// carrinha para o sítio errado.
//
// Corre a pedido (a página chama quando encontra gente por converter), nunca
// automaticamente em massa.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { separarMorada } from '@/lib/morada'

export const runtime = 'nodejs'
export const maxDuration = 60

const UA = 'PhloxClinical/1.0 (software de apoio a lares e centros de dia; contacto: suporte@phloxclinical.com)'
const MAX_POR_PEDIDO = 12

async function autenticar(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return { sb, user: data.user }
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Achado { lat: number; lon: number; precisao: string; encontrado?: string }

/** Portugal continental + ilhas. Fora disto e engano, nao resultado. */
function dentroDePortugal(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && lat > 30 && lat < 43 && lon > -32 && lon < -6
}

/** Nominatim em modo ESTRUTURADO: cada peca da morada no seu campo.
 *  E esta a diferenca que faz "rua + localidade" chegar. A pesquisa por texto
 *  livre falha muito com moradas escritas a mao; com os campos separados, o
 *  Nominatim sabe o que e via e o que e terra, e acerta. */
async function nominatimEstruturado(
  campos: { street?: string; city?: string; postalcode?: string },
  precisao: string,
): Promise<Achado | null> {
  const qs = new URLSearchParams({ country: 'Portugal', format: 'json', limit: '1', addressdetails: '1' })
  for (const [k, v] of Object.entries(campos)) if (v) qs.set(k, v)
  if (!campos.street && !campos.city && !campos.postalcode) return null
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-PT' },
    })
    if (!r.ok) return null
    const j = await r.json()
    const p = Array.isArray(j) ? j[0] : null
    const lat = Number(p?.lat), lon = Number(p?.lon)
    if (!dentroDePortugal(lat, lon)) return null
    return { lat, lon, precisao, encontrado: String(p?.display_name || '').slice(0, 160) }
  } catch { return null }
}

/** O Photon (tambem do OpenStreetMap, mas com pesquisa difusa) apanha moradas
 *  com erros de escrita e abreviaturas que o Nominatim recusa. Sem chave e sem
 *  custo, como o outro. So entra depois de as tentativas estruturadas falharem. */
async function photon(texto: string, precisao: string): Promise<Achado | null> {
  const q = texto.trim()
  if (q.length < 3) return null
  try {
    // A caixa delimitadora e o centro empurram os resultados para Portugal —
    // sem isto, "Rua do Sol" devolve uma rua no Brasil.
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=pt&limit=1`
      + `&bbox=-31.6,32.3,-6.1,42.3&lat=39.6&lon=-8.0`
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) return null
    const j = await r.json()
    const f = j?.features?.[0]
    const lon = Number(f?.geometry?.coordinates?.[0]), lat = Number(f?.geometry?.coordinates?.[1])
    if (!dentroDePortugal(lat, lon)) return null
    const pr = f?.properties || {}
    const nome = [pr.name, pr.street, pr.city, pr.postcode].filter(Boolean).join(', ')
    return { lat, lon, precisao, encontrado: nome.slice(0, 160) }
  } catch { return null }
}

/** Uma morada -> coordenadas, do mais preciso para o mais grosseiro.
 *
 *  A ordem importa. Comeca pela morada inteira com tudo o que ha, e so vai
 *  alargando quando falha. Nunca INVENTA: se nenhuma etapa acertar, a pessoa
 *  fica sem ponto e o mapa di-lo, em vez de a por num sitio aproximado. Um
 *  ponto errado num mapa de transportes manda uma carrinha ao sitio errado. */
async function geocodificar(morada: string): Promise<Achado | null> {
  const m = separarMorada(morada)
  if (!m.bruto) return null

  // Sem o numero de porta: e onde o Nominatim falha mais, e a rua chega para
  // saber a que porta ir.
  const ruaSemNumero = m.rua.replace(/[,\s]*(n\.?º?|no\.?)?\s*\d{1,4}\s*[a-zA-Z]?\s*$/i, '').trim()

  const tentativas: (() => Promise<Achado | null>)[] = [
    () => nominatimEstruturado({ street: m.rua, city: m.localidade, postalcode: m.codigoPostal }, 'morada'),
    () => nominatimEstruturado({ street: m.rua, city: m.localidade }, 'morada'),
    () => nominatimEstruturado({ street: ruaSemNumero, city: m.localidade }, 'rua'),
    () => nominatimEstruturado({ street: ruaSemNumero, postalcode: m.codigoPostal }, 'rua'),
    () => photon([m.rua, m.localidade].filter(Boolean).join(', '), 'rua'),
    () => nominatimEstruturado({ postalcode: m.codigoPostal, city: m.localidade }, 'codigo postal'),
    () => nominatimEstruturado({ city: m.localidade }, 'localidade'),
    () => photon(m.localidade, 'localidade'),
  ]

  for (const tentar of tentativas) {
    const r = await tentar()
    if (r) return r
    await esperar(1100)   // politica do Nominatim: 1 pedido por segundo
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()
  const auth = await autenticar(req)
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { sb } = auth

  const body = await req.json().catch(() => null) as { ids?: string[]; org?: string } | null

  // Converter a INSTITUIÇÃO. Serve para as moradas gravadas antes de a
  // conversão automática existir — sem ter de as reescrever.
  if (body?.org) {
    const { data: org } = await sb.from('organizations').select('id, address').eq('id', body.org).maybeSingle()
    const morada = String((org as any)?.address || '').trim()
    if (!morada) return NextResponse.json({ error: 'A instituição não tem morada.' }, { status: 400 })
    const r = await geocodificar(morada)
    if (!r) return NextResponse.json({ casa: null, erro: 'nao_encontrado' })
    await sb.from('organizations').update({ lat: r.lat, lon: r.lon }).eq('id', body.org)
    return NextResponse.json({ casa: r })
  }

  const ids = (body?.ids || []).filter(x => typeof x === 'string').slice(0, MAX_POR_PEDIDO)
  if (!ids.length) return NextResponse.json({ error: 'Nada para converter.' }, { status: 400 })

  // A RLS trata do acesso: só voltam as pessoas que esta conta pode mesmo ver.
  const { data: pessoas, error } = await sb
    .from('patients').select('id, address, lat, lon, geo_address').in('id', ids)
  if (error) return NextResponse.json({ error: 'Não foi possível ler as moradas.' }, { status: 500 })

  const feitos: { id: string; lat: number; lon: number }[] = []
  const semResultado: string[] = []

  for (const p of (pessoas || []) as any[]) {
    const morada = String(p.address || '').trim()
    if (!morada) continue
    // Já convertida E a morada não mudou desde então.
    if (p.lat != null && p.lon != null && p.geo_address === morada) continue

    const r = await geocodificar(morada)
    if (r) {
      await sb.from('patients').update({
        lat: r.lat, lon: r.lon, geo_source: r.precisao,
        geo_at: new Date().toISOString(), geo_address: morada,
      }).eq('id', p.id)
      feitos.push({ id: p.id, ...r })
    } else {
      // Marca a tentativa para não repetir a mesma morada impossível a cada
      // abertura da página — mas sem coordenadas, que seria inventar.
      await sb.from('patients').update({
        lat: null, lon: null, geo_source: 'nao_encontrado',
        geo_at: new Date().toISOString(), geo_address: morada,
      }).eq('id', p.id)
      semResultado.push(p.id)
    }
    await esperar(1100)   // política de uso do Nominatim: 1 pedido por segundo
  }

  return NextResponse.json({ feitos, semResultado })
}
