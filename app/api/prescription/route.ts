import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
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

  const systemPrompt = `És um farmacêutico comunitário em Portugal a explicar uma receita médica a um doente sem formação médica. O teu objectivo é que o doente perceba exactamente o que tomou, porquê, como e o que observar.

Responde APENAS em português europeu (PT-PT) com JSON válido sem markdown:
{
  "medications": [
    {
      "name": "nome do medicamento como está na receita",
      "active": "substância activa em português",
      "for_what": "para que serve em linguagem simples — 1-2 frases directas",
      "how_to_take": "instruções exactas de como tomar — hora, comida, posição, água",
      "duration": "durante quanto tempo tomar",
      "important_notes": ["nota importante que o doente não pode ignorar"],
      "side_effects_watch": ["efeito adverso para vigiar — em linguagem simples"]
    }
  ],
  "general_advice": ["conselho geral sobre o conjunto da medicação"],
  "questions_for_pharmacist": ["pergunta concreta para fazer ao farmacêutico"],
  "questions_for_doctor": ["pergunta concreta para fazer ao médico na próxima consulta"]
}`

  try {
    let result: any

    if (image) {
      // Use Gemini for image reading (supports vision)
      const geminiKey = process.env.GEMINI_API_KEY
      if (!geminiKey) {
        return NextResponse.json({ error: 'Leitura de imagem não disponível. Cola o texto da receita.' }, { status: 503 })
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `${systemPrompt}\n\nAnalisa esta imagem de receita médica ou caixa de medicamento e responde com o JSON pedido:` },
              { inline_data: { mime_type: mimeType, data: image } },
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
        }),
      })
      const geminiData = await res.json()
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      result = JSON.parse(clean)
    } else {
      result = await aiJSON<any>([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Explica esta receita médica:\n\n${prescription}` },
      ], { maxTokens: 1500, temperature: 0.1 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Prescription error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}