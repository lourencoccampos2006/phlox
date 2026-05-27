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

  // Categorias da Sketchfab relevantes para saúde/ciência (restringe o universo de resultados).
  const CATEGORIES = 'science-technology,medical'
  // Palavras-âncora: garantem contexto de saúde mesmo num termo curto ("heart").
  const anchored = /\b(anat|medic|surg|bone|skull|organ|cell|molecul|dna|protein|virus|bacteria|neuron|brain|heart|skelet|muscle|tooth|dental|cardio|respir|anatomy)/i.test(q)
    ? q : `${q} anatomy`

  // Termos que indicam claramente conteúdo FORA do tema (filtragem defensiva).
  const BLOCK = /\b(burj|khalifa|building|tower|car|vehicle|weapon|gun|sword|anime|manga|character|game|pok[eé]mon|minecraft|robot|spaceship|dragon|sword|castle|house|furniture|chair|shoe|sneaker|logo|phone|laptop|camera|drone|tank|plane|aircraft|boat|ship|guitar|piano)\b/i
  // Termos que confirmam que É de saúde/ciência.
  const ALLOW = /\b(anat|anatomy|medic|surg|clinic|bone|skull|cranium|organ|heart|cardiac|lung|pulmon|kidney|renal|liver|hepat|brain|cerebr|neuron|nerve|spine|vertebr|skelet|muscle|tendon|joint|knee|shoulder|hip|tooth|teeth|dental|molar|jaw|mandible|cell|mitochond|nucleus|dna|rna|gene|protein|enzyme|molecul|atom|virus|viral|bacteri|microb|antibody|blood|vessel|artery|vein|stomach|intestin|digest|pancreas|embryo|fetus|eye|ear|skin|histolog|patholog|physiolog|biolog|chemist|science|body|human|animal|dog|cat|horse|equine|canine|feline)\b/i

  const url = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(anchored)}&categories=${CATEGORIES}&downloadable=false&count=40&sort_by=-likeCount`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } })
    if (!res.ok) return NextResponse.json({ error: 'Serviço 3D indisponível. Tenta novamente.' }, { status: 502 })
    const data = await res.json()
    const models = (data.results || [])
      .filter((m: any) => {
        const hay = `${m.name || ''} ${(m.tags || []).map((t: any) => t.name || t.slug || '').join(' ')} ${(m.categories || []).map((c: any) => c.name || '').join(' ')}`.toLowerCase()
        if (BLOCK.test(hay)) return false       // exclui temas claramente fora
        return ALLOW.test(hay)                  // inclui só o que confirma saúde/ciência
      })
      .map((m: any) => ({
        uid: m.uid,
        name: m.name,
        author: m.user?.displayName || m.user?.username || '',
        thumb: (m.thumbnails?.images || []).sort((a: any, b: any) => (a.width || 0) - (b.width || 0)).find((i: any) => (i.width || 0) >= 200)?.url || m.thumbnails?.images?.[0]?.url || '',
        faces: m.faceCount || 0,
        embed: `https://sketchfab.com/models/${m.uid}/embed?autospin=0.3&ui_theme=dark&ui_infos=0&ui_controls=1`,
        link: m.viewerUrl || `https://sketchfab.com/3d-models/${m.uid}`,
      }))
      .filter((m: any) => m.uid)
      .slice(0, 24)
    return NextResponse.json({ models })
  } catch {
    return NextResponse.json({ error: 'Não foi possível pesquisar modelos 3D.' }, { status: 500 })
  }
}
