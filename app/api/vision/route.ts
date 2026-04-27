// /app/api/vision/route.ts
// Central vision endpoint - handles ALL image analysis for Phlox
// Supports: prescription, drug_id, symptom, lab_results

import { NextRequest, NextResponse } from 'next/server'

type VisionMode = 'prescription' | 'drug_id' | 'symptom' | 'lab_results' | 'drug_list'

const PROMPTS: Record<VisionMode, string> = {
  prescription: `You are analyzing a medical prescription or medication packaging image. 
Extract ALL medication information visible. 
Respond with ONLY valid JSON (no markdown, no explanation, just the JSON object):
{
  "medications": [
    {
      "name": "medication name as shown",
      "active": "active ingredient if identifiable",
      "dose": "dose visible",
      "instructions": "dosing instructions if visible"
    }
  ],
  "confidence": "high|medium|low",
  "notes": "any other relevant clinical information visible"
}
If no medications are visible, return: {"medications": [], "confidence": "low", "notes": "No medications identified"}`,

  drug_id: `Identify the medication in this image (box, blister, label, or pill).
Respond with ONLY valid JSON (no markdown):
{
  "drug_name": "generic/INN name in English (e.g. ibuprofen)",
  "brand_name": "brand name if visible (e.g. Brufen)",
  "dose": "dose if visible",
  "confidence": "high|medium|low"
}
If no medication is identifiable, return: {"drug_name": null, "brand_name": null, "dose": null, "confidence": "low"}`,

  symptom: `Describe what you see in this medical/health image in Portuguese (European Portuguese).
Focus on: visible symptoms, skin conditions, wounds, rashes, swelling, or any health-relevant observations.
Respond with ONLY valid JSON (no markdown):
{
  "description": "clear description in Portuguese of what is visible",
  "possible_symptom": "the most likely medical symptom this represents",
  "severity_hint": "mild|moderate|severe|unknown",
  "see_doctor_urgently": true or false
}`,

  lab_results: `This image shows laboratory test results. Extract all values.
Respond with ONLY valid JSON (no markdown):
{
  "values": [
    {"test": "test name", "value": "result", "unit": "unit", "reference": "reference range if visible", "status": "normal|high|low|unknown"}
  ],
  "date": "date if visible",
  "lab_name": "laboratory name if visible"
}`,

  drug_list: `List ALL medication names visible in this image.
Respond with ONLY valid JSON (no markdown):
{
  "drugs": ["drug1 in English", "drug2 in English"],
  "confidence": "high|medium|low"
}`
}

async function callGemini(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado. Adiciona nas variáveis do Cloudflare.')

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } }
      ]
    }],
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.0
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    }
  )

  if (res.status === 429) throw new Error('Serviço sobrecarregado. Tenta daqui a 30 segundos.')
  if (res.status === 403) throw new Error('Chave API inválida. Verifica GEMINI_API_KEY no Cloudflare.')
  if (res.status === 400) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Imagem inválida: ${err?.error?.message || 'formato não suportado. Tenta JPG ou PNG.'}`)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Erro Gemini ${res.status}: ${err?.error?.message || 'tenta novamente'}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    // Check for safety blocks
    const finishReason = data.candidates?.[0]?.finishReason
    if (finishReason === 'SAFETY') throw new Error('Imagem bloqueada por filtros de segurança. Tenta outra foto.')
    throw new Error('Resposta vazia. Tenta com uma foto mais nítida e bem iluminada.')
  }

  return text
}

function extractJSON(text: string): any {
  // Remove markdown code blocks
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  
  // Try direct parse first
  try {
    return JSON.parse(clean)
  } catch {}
  
  // Find JSON object
  const objMatch = clean.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch {}
  }
  
  // Find JSON array
  const arrMatch = clean.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch {}
  }
  
  throw new Error('Não foi possível interpretar a resposta. Tenta com uma foto mais nítida.')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    
    if (!body?.image) {
      return NextResponse.json({ error: 'Imagem obrigatória (campo "image" em base64)' }, { status: 400 })
    }
    
    const mode: VisionMode = body.mode || 'drug_id'
    const mimeType = body.mimeType || 'image/jpeg'
    
    if (!PROMPTS[mode]) {
      return NextResponse.json({ error: `Modo inválido: ${mode}` }, { status: 400 })
    }
    
    const rawText = await callGemini(body.image, mimeType, PROMPTS[mode])
    const result = extractJSON(rawText)
    
    return NextResponse.json({ ...result, mode, success: true })
    
  } catch (err: any) {
    console.error('Vision route error:', err?.message)
    return NextResponse.json(
      { error: err.message || 'Erro ao processar imagem. Tenta novamente.' },
      { status: err.message?.includes('configurado') ? 503 : 500 }
    )
  }
}