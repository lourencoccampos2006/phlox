import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.image) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'Serviço de visão não disponível' }, { status: 503 })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analisa esta imagem de um medicamento. Identifica o nome do medicamento principal visível (nome da caixa, blister, ou rótulo).
Responde APENAS com JSON sem markdown:
{
  "drug_name": "nome do medicamento em inglês (DCI/genérico se possível) — ex: ibuprofen, metformin, omeprazole",
  "brand_name": "nome comercial se visível — ex: Brufen, Voltaren",
  "confidence": "high" | "medium" | "low"
}
Se não conseguires identificar nenhum medicamento, responde: {"drug_name": null, "brand_name": null, "confidence": "low"}`
              },
              { inline_data: { mime_type: body.mimeType || 'image/jpeg', data: body.image } }
            ]
          }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 200 }
        })
      }
    )
    const geminiData = await res.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e: any) {
    return NextResponse.json({ drug_name: null, error: e.message }, { status: 500 })
  }
}