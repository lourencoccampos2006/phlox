import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'


const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6h

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const term = q.trim().toLowerCase()
  const cached = cache.get(term)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const [labelRes, adverseRes] = await Promise.allSettled([
      fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(term)}"&limit=1`, { signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(term)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`, { signal: AbortSignal.timeout(8000) }),
    ])

    const labelData = labelRes.status === 'fulfilled' && labelRes.value.ok ? await labelRes.value.json() : null
    const adverseData = adverseRes.status === 'fulfilled' && adverseRes.value.ok ? await adverseRes.value.json() : null

    let drug = labelData?.results?.[0]

    if (!drug) {
      // Fallback: pesquisa por nome comercial
      const brandRes = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(term)}"&limit=1`, { signal: AbortSignal.timeout(8000) })
      const brandData = brandRes.ok ? await brandRes.json() : null
      drug = brandData?.results?.[0]
      if (!drug) return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })
    }

    const raw = formatDrug(drug, adverseData, term)

    // Traduz as secções clínicas para português
    const translated = await translateToPortuguese(raw)

    cache.set(term, { result: translated, timestamp: Date.now() })
    return NextResponse.json(translated)

  } catch (error: any) {
    console.error('Drugs route error:', error?.message)
    return NextResponse.json({ error: 'Erro ao pesquisar. Tenta novamente.' }, { status: 500 })
  }
}

function formatDrug(drug: any, adverseData: any, term: string) {
  return {
    generic_name: drug.openfda?.generic_name?.[0] || term,
    brand_names: drug.openfda?.brand_name || [],
    manufacturer: drug.openfda?.manufacturer_name?.[0] || '',
    indications: drug.indications_and_usage?.[0] || '',
    dosage: drug.dosage_and_administration?.[0] || '',
    contraindications: drug.contraindications?.[0] || '',
    warnings: drug.warnings?.[0] || drug.warnings_and_cautions?.[0] || '',
    adverse_reactions: drug.adverse_reactions?.[0] || '',
    top_adverse_events: adverseData?.results?.slice(0, 10) || [],
  }
}

function truncateForTranslation(text: string, maxChars = 1200): string {
  if (!text || text.length <= maxChars) return text
  // Corta no último ponto antes do limite para não cortar a meio de uma frase
  const cut = text.slice(0, maxChars)
  const lastDot = cut.lastIndexOf('.')
  return lastDot > maxChars * 0.7 ? cut.slice(0, lastDot + 1) + ' [...]' : cut + ' [...]'
}

async function translateToPortuguese(drug: any): Promise<any> {
  // Campos a traduzir (só os que têm conteúdo)
  const toTranslate: Record<string, string> = {}
  for (const key of ['indications', 'dosage', 'contraindications', 'warnings', 'adverse_reactions']) {
    if (drug[key]) toTranslate[key] = truncateForTranslation(drug[key])
  }

  if (Object.keys(toTranslate).length === 0) return drug

  try {
    const prompt = Object.entries(toTranslate)
      .map(([k, v]) => `### ${k}\n${v}`)
      .join('\n\n')

    const translations = await aiJSON<Record<string, string>>([
      {
        role: 'system',
        content: 'És um tradutor técnico médico-farmacêutico inglês→português europeu (PT-PT). Traduz o texto clínico mantendo rigor técnico. Usa terminologia farmacêutica portuguesa correcta. Responde APENAS com JSON válido sem markdown, com exactamente as mesmas chaves que recebes: {"indications":"...","dosage":"...","contraindications":"...","warnings":"...","adverse_reactions":"..."}. Inclui apenas as chaves que existem no input. Nunca omitas informação clínica importante.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], { maxTokens: 3000, temperature: 0.1, preferFast: true })

    return {
      ...drug,
      ...translations,
      _translated: true,
    }
  } catch (e: any) {
    // Se a tradução falhar, retorna o original em inglês sem quebrar
    console.warn('Translation failed, returning English:', e?.message)
    return { ...drug, _translated: false }
  }
}