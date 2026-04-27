import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const prescription = String(body?.prescription || '').trim().slice(0, 2000)
  const image = body?.image as string | undefined
  const mimeType = String(body?.mimeType || 'image/jpeg')

  if (!prescription && !image) {
    return NextResponse.json({ error: 'Receita ou imagem obrigatória' }, { status: 400 })
  }

  const JSON_SCHEMA = `Responde APENAS com JSON válido sem markdown, sem texto antes ou depois:
{
  "medications": [
    {
      "name": "nome do medicamento como está na receita",
      "active": "substância activa em português",
      "for_what": "para que serve em linguagem simples — 1-2 frases directas, sem jargão",
      "how_to_take": "instruções exactas de como tomar — hora, comida, posição, água",
      "duration": "durante quanto tempo tomar",
      "important_notes": ["nota importante que não pode ignorar"],
      "side_effects_watch": ["efeito adverso para vigiar — em linguagem simples"]
    }
  ],
  "general_advice": ["conselho geral sobre o conjunto da medicação"],
  "questions_for_pharmacist": ["pergunta concreta para fazer ao farmacêutico"],
  "questions_for_doctor": ["pergunta concreta para fazer ao médico na próxima consulta"]
}`

  const SYSTEM = `És um farmacêutico comunitário em Portugal a explicar uma receita médica a um doente sem formação médica. O teu objectivo é que o doente perceba exactamente o que tomou, porquê, como e o que observar. Usa linguagem simples e directa. ${JSON_SCHEMA}`

  try {
    let result: any

    if (image) {
      const prompt = `${SYSTEM}

Analisa esta imagem — pode ser uma receita médica, uma caixa de medicamento, um blister, ou um rótulo. Identifica todos os medicamentos visíveis e explica cada um conforme o JSON acima. Se não vires medicamentos, responde com medications: [] e explica o que vês em general_advice.`

      result = await callGeminiVisionJSON(prompt, image, mimeType, { maxTokens: 2000 })
    } else {
      result = await aiJSON<any>([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Explica esta receita médica:\n\n${prescription}` },
      ], { maxTokens: 1500, temperature: 0.1 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Prescription error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}