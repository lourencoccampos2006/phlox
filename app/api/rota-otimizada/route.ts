// app/api/rota-otimizada/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// A rota a sério: tempos de viagem reais por estrada, e a melhor ordem para ir
// buscar as pessoas.
//
// Usa o OSRM público (Open Source Routing Machine, sobre OpenStreetMap): sem
// chave, sem custo. Dois serviços:
//   • /trip  — resolve o problema do caixeiro-viajante. Dá a ORDEM ótima
//              começando e acabando na instituição, os tempos entre paragens,
//              e a geometria real das estradas.
//   • /route — quando a ordem é para respeitar (as horas combinadas mandam),
//              dá só os tempos e a geometria dessa ordem.
//
// Porque é que isto importa: com cinco utentes a ordem "óbvia" costuma estar
// certa; com trinta, não está — e a diferença entre a melhor ordem e uma ordem
// qualquer são dezenas de minutos de carrinha todos os dias.
//
// A geometria vem em GeoJSON e é desenhada tal como é. O mapa deixa de ser
// pontos ligados por linhas retas e passa a mostrar as estradas verdadeiras,
// sem um único azulejo de terceiros — o desenho continua a ser nosso.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 45

const OSRM = 'https://router.project-osrm.org'
const MAX_PARAGENS = 40   // limite prático do serviço público

interface Ponto { id: string; lat: number; lon: number }

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null) as {
    casa?: { lat: number; lon: number } | null
    paragens?: Ponto[]
    otimizar?: boolean
  } | null

  const paragens = (body?.paragens || []).filter(p =>
    p && typeof p.lat === 'number' && typeof p.lon === 'number').slice(0, MAX_PARAGENS)
  if (paragens.length < 1) return NextResponse.json({ error: 'Sem paragens com coordenadas.' }, { status: 400 })

  const casa = body?.casa && typeof body.casa.lat === 'number' ? body.casa : null
  // O OSRM quer lon,lat — ao contrário de toda a gente. Trocar aqui e não
  // pensar mais nisso.
  const pontos: (Ponto | { id?: string; lat: number; lon: number })[] = casa ? [{ ...casa, id: undefined }, ...paragens] : paragens
  const coords = pontos.map(p => `${p.lon},${p.lat}`).join(';')

  try {
    if (body?.otimizar && paragens.length >= 2) {
      // source=first: começa na casa (ou na primeira paragem, se não houver
      // casa). roundtrip=true: volta ao ponto de partida, que é o que uma
      // carrinha faz mesmo.
      const url = `${OSRM}/trip/v1/driving/${coords}?source=first&roundtrip=true&overview=full&geometries=geojson&annotations=duration`
      const r = await fetch(url, { headers: { 'User-Agent': 'PhloxClinical/1.0' } })
      if (!r.ok) throw new Error(`OSRM ${r.status}`)
      const j = await r.json()
      if (j.code !== 'Ok' || !j.trips?.[0]) throw new Error(j.message || 'sem rota')

      const trip = j.trips[0]
      // `waypoints[i].waypoint_index` é a posição de cada ponto na rota ótima.
      const ordem = (j.waypoints || [])
        .map((w: any, i: number) => ({ i, pos: w.waypoint_index }))
        .sort((a: any, b: any) => a.pos - b.pos)
        .map((x: any) => x.i)
        .filter((i: number) => !casa || i > 0)          // a casa não é paragem
        .map((i: number) => pontos[i].id ?? null)
        .filter(Boolean)

      // Duração de cada troço, na ordem em que aparecem as pernas da viagem.
      const pernas = (trip.legs || []).map((l: any) => Math.round((l.duration || 0) / 60))

      return NextResponse.json({
        ordem,
        minutosTotal: Math.round((trip.duration || 0) / 60),
        kmTotal: Number(((trip.distance || 0) / 1000).toFixed(1)),
        pernas,
        geometria: trip.geometry?.coordinates || [],   // [[lon,lat], …]
        otimizada: true,
      })
    }

    // Ordem tal como veio (as horas mandam): só tempos e geometria.
    const url = `${OSRM}/route/v1/driving/${coords}${casa ? ';' + `${casa.lon},${casa.lat}` : ''}?overview=full&geometries=geojson`
    const r = await fetch(url, { headers: { 'User-Agent': 'PhloxClinical/1.0' } })
    if (!r.ok) throw new Error(`OSRM ${r.status}`)
    const j = await r.json()
    if (j.code !== 'Ok' || !j.routes?.[0]) throw new Error(j.message || 'sem rota')

    const rota = j.routes[0]
    return NextResponse.json({
      ordem: paragens.map(p => p.id),
      minutosTotal: Math.round((rota.duration || 0) / 60),
      kmTotal: Number(((rota.distance || 0) / 1000).toFixed(1)),
      pernas: (rota.legs || []).map((l: any) => Math.round((l.duration || 0) / 60)),
      geometria: rota.geometry?.coordinates || [],
      otimizada: false,
    })
  } catch (e: any) {
    // Sem rota calculada o mapa continua a desenhar-se com linhas retas — só
    // não mostra tempos. Nunca se inventa uma duração.
    return NextResponse.json({ error: String(e?.message || e).slice(0, 120) }, { status: 502 })
  }
}
