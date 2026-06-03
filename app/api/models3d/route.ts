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
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (process.env.SKETCHFAB_API_TOKEN) headers.Authorization = `Token ${process.env.SKETCHFAB_API_TOKEN}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers })
    if (!res.ok) {
      // Sketchfab inacessível — devolve uma lista curada de recursos 3D alternativos
      // para garantir que a ferramenta nunca aparece vazia ao utilizador.
      return NextResponse.json({
        models: FALLBACK_MODELS(q),
        fallback: true,
        notice: 'Pesquisa Sketchfab temporariamente indisponível — a mostrar recursos curados.',
      })
    }
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
    return NextResponse.json({
      models: FALLBACK_MODELS(q),
      fallback: true,
      notice: 'Sem acesso à pesquisa 3D agora — recursos curados disponíveis.',
    })
  }
}

// Lista curada de modelos 3D / atlas anatómicos de acesso livre.
// Usada quando a API da Sketchfab está inacessível, devolvendo conteúdo útil
// em vez de uma mensagem de erro.
function FALLBACK_MODELS(_q: string) {
  return [
    { uid: 'biodigital-human', name: 'BioDigital Human (gratuito com registo)',
      author: 'BioDigital', faces: 0, thumb: '',
      embed: 'https://human.biodigital.com/widgets/',
      link: 'https://human.biodigital.com/' },
    { uid: 'zanatomy', name: 'Z-Anatomy (atlas anatómico open-source)',
      author: 'Z-Anatomy', faces: 0, thumb: '',
      embed: 'https://www.z-anatomy.com/',
      link: 'https://www.z-anatomy.com/' },
    { uid: 'visiblebody', name: 'Visible Body (apresentação)',
      author: 'Visible Body', faces: 0, thumb: '',
      embed: 'https://www.visiblebody.com/learn',
      link: 'https://www.visiblebody.com/' },
    { uid: 'nih3d', name: 'NIH 3D Print Exchange — anatomia',
      author: 'NIH', faces: 0, thumb: '',
      embed: 'https://3d.nih.gov/discover?search=anatomy',
      link: 'https://3d.nih.gov/' },
    { uid: 'kenhub', name: 'Kenhub — atlas anatómico interactivo',
      author: 'Kenhub', faces: 0, thumb: '',
      embed: 'https://www.kenhub.com/',
      link: 'https://www.kenhub.com/' },
    { uid: 'radiopaedia', name: 'Radiopaedia — imagens médicas',
      author: 'Radiopaedia', faces: 0, thumb: '',
      embed: 'https://radiopaedia.org/cases',
      link: 'https://radiopaedia.org/' },
  ]
}
