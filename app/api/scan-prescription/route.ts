import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit } from '@/lib/rateLimit'

interface ExtractedMed {
  name: string
  dose: string | null
  frequency: string | null
  indication: string | null
}

const PROMPT = `Analisa esta imagem. Pode ser uma receita médica, embalagem de medicamento, ou lista de medicamentos.

Extrai TODOS os medicamentos visíveis. Para cada um, devolve:
- name: nome do medicamento (DCI / princípio ativo preferencialmente, ou nome comercial se for o único visível)
- dose: dose (ex: "500mg", "10mg/ml", "5mg") ou null se não visível
- frequency: frequência de toma (ex: "1x/dia", "2x/dia", "de 8 em 8h") ou null se não visível
- indication: indicação/diagnóstico se visível (ex: "diabetes", "hipertensão") ou null

Devolve APENAS um array JSON. Sem texto adicional. Exemplo:
[{"name":"Metformina","dose":"500mg","frequency":"2x/dia","indication":"diabetes"},{"name":"Ramipril","dose":"5mg","frequency":"1x/dia","indication":null}]

Se a imagem não contiver medicamentos reconhecíveis, devolve [].`

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const limited = checkRateLimit(ip, 10, 60_000)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { image: string; mimeType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const { image, mimeType = 'image/jpeg' } = body
  if (!image) return NextResponse.json({ error: 'Imagem em falta' }, { status: 400 })

  // Strip data URL prefix if present
  const base64 = image.replace(/^data:image\/[a-z]+;base64,/, '')

  try {
    const medications = await callGeminiVisionJSON<ExtractedMed[]>(
      PROMPT, base64, mimeType, { maxTokens: 800 }
    )
    // Validate and sanitise
    const safe = (Array.isArray(medications) ? medications : [])
      .filter(m => m && typeof m.name === 'string' && m.name.trim().length > 0)
      .map(m => ({
        name: String(m.name).trim().slice(0, 100),
        dose: m.dose ? String(m.dose).trim().slice(0, 50) : null,
        frequency: m.frequency ? String(m.frequency).trim().slice(0, 80) : null,
        indication: m.indication ? String(m.indication).trim().slice(0, 100) : null,
      }))
    return NextResponse.json({ medications: safe })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao analisar imagem' }, { status: 500 })
  }
}
