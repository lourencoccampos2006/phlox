import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Pesquisa de modelos 3D na Sketchfab (API pública v3, sem token necessário para search).
// Devolve modelos com embed gratuito → atlas 3D real para estudantes.

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 40, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80)
  if (!q) return NextResponse.json({ error: 'Pesquisa vazia' }, { status: 400 })

  // Filtra por modelos com viewer público; restringe a temas de saúde quando possível
  const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(q)}&downloadable=false&count=24&sort_by=-likeCount`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } })
    if (!res.ok) return NextResponse.json({ error: 'Serviço 3D indisponível. Tenta novamente.' }, { status: 502 })
    const data = await res.json()
    const models = (data.results || []).map((m: any) => ({
      uid: m.uid,
      name: m.name,
      author: m.user?.displayName || m.user?.username || '',
      thumb: (m.thumbnails?.images || []).sort((a: any, b: any) => (a.width || 0) - (b.width || 0)).find((i: any) => (i.width || 0) >= 200)?.url || m.thumbnails?.images?.[0]?.url || '',
      faces: m.faceCount || 0,
      embed: `https://sketchfab.com/models/${m.uid}/embed?autospin=0.3&ui_theme=dark&ui_infos=0&ui_controls=1`,
      link: m.viewerUrl || `https://sketchfab.com/3d-models/${m.uid}`,
    })).filter((m: any) => m.uid)
    return NextResponse.json({ models })
  } catch {
    return NextResponse.json({ error: 'Não foi possível pesquisar modelos 3D.' }, { status: 500 })
  }
}
