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

/** Uma morada → coordenadas, tentando do mais preciso para o mais grosseiro.
 *  Moradas portuguesas escritas à mão falham muito no Nominatim quando vão
 *  inteiras ("R. das Flores 12, 2745-123 Queluz"); o código postal e a
 *  localidade quase sempre acertam. Devolve também a precisão, para o mapa
 *  poder dizer se aquilo é a porta ou a zona. */
async function geocodificar(morada: string): Promise<{ lat: number; lon: number; precisao: string } | null> {
  const bruto = morada.trim().slice(0, 200)
  if (!bruto) return null

  const cp = bruto.match(/\b\d{4}-\d{3}\b/)?.[0] || bruto.match(/\b\d{4}\b/)?.[0] || ''
  // Tudo o que vem depois do código postal costuma ser a localidade.
  const localidade = cp
    ? bruto.slice(bruto.indexOf(cp) + cp.length).replace(/^[\s,.-]+/, '').split(/[,\n]/)[0].trim()
    : bruto.split(',').map(x => x.trim()).filter(Boolean).pop() || ''

  const tentativas: { q: string; precisao: string }[] = [
    { q: bruto, precisao: 'morada' },
    // sem o número de porta, que é onde falha mais
    { q: bruto.replace(/\b(n\.?º?|no\.?)?\s*\d{1,4}\s*(,|$)/i, ' '), precisao: 'rua' },
    ...(cp && localidade ? [{ q: `${cp} ${localidade}`, precisao: 'código postal' }] : []),
    ...(cp ? [{ q: cp, precisao: 'código postal' }] : []),
    ...(localidade ? [{ q: localidade, precisao: 'localidade' }] : []),
  ]

  for (const t of tentativas) {
    const q = t.q.trim()
    if (q.length < 3) continue
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=pt&format=json&limit=1&addressdetails=0`
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-PT' } })
      if (r.ok) {
        const j = await r.json()
        const p = Array.isArray(j) ? j[0] : null
        const lat = Number(p?.lat), lon = Number(p?.lon)
        // Portugal continental + ilhas. Fora disto é engano, não resultado.
        if (!isNaN(lat) && !isNaN(lon) && lat > 30 && lat < 43 && lon > -32 && lon < -6) {
          return { lat, lon, precisao: t.precisao }
        }
      }
    } catch { /* tenta a etapa seguinte */ }
    await esperar(1100)   // política do Nominatim: 1 pedido por segundo
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
