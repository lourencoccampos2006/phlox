import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

type VisionMode = 'prescription' | 'drug_id' | 'symptom' | 'lab_results' | 'drug_list' | 'skin_lesion' | 'skin_condition_progress'

const PROMPTS: Record<VisionMode, string> = {
  prescription: `Analyze this medical prescription or medication packaging image.
Extract ALL medication information visible.
Return ONLY valid JSON with no markdown, no explanation:
{
  "medications": [
    {
      "name": "medication name as shown",
      "active": "active ingredient",
      "dose": "dose if visible",
      "instructions": "dosing instructions if visible"
    }
  ],
  "confidence": "high",
  "notes": "any other relevant information"
}
If nothing visible: {"medications": [], "confidence": "low", "notes": "No medications found"}`,

  drug_id: `Identify the medication in this image (box, blister, label, or pill).
Return ONLY valid JSON with no markdown:
{
  "drug_name": "generic/INN name in English e.g. ibuprofen",
  "brand_name": "brand name if visible e.g. Brufen",
  "dose": "dose if visible",
  "confidence": "high"
}
If not identifiable: {"drug_name": null, "brand_name": null, "dose": null, "confidence": "low"}`,

  symptom: `Describe the health-related content of this image in European Portuguese.
Return ONLY valid JSON with no markdown:
{
  "description": "what is visible in Portuguese",
  "possible_symptom": "most likely medical symptom",
  "severity_hint": "mild",
  "see_doctor_urgently": false
}`,

  lab_results: `Extract laboratory test results from this image.
Return ONLY valid JSON with no markdown:
{
  "values": [{"test": "name", "value": "result", "unit": "unit", "reference": "range", "status": "normal"}],
  "date": "date if visible",
  "lab_name": "lab name if visible"
}`,

  drug_list: `List ALL medication names visible in this image.
Return ONLY valid JSON with no markdown:
{
  "drugs": ["drug1 generic name in English", "drug2"],
  "confidence": "high"
}`,

  skin_lesion: `You are a dermatology-informed image assessment tool (NOT a diagnostic device — this is informational triage support only). Assess the skin lesion/mole visible in this image using the ABCDE criteria used for melanoma risk screening. Be conservative: when uncertain, lean toward flagging for professional review rather than reassurance.
Return ONLY valid JSON with no markdown, values in European Portuguese where they are text:
{
  "lesion_detected": true,
  "asymmetry": "descrição curta — simétrico ou assimétrico, e porquê",
  "border": "descrição curta — bordo regular ou irregular/mal definido",
  "color": "descrição curta — cor uniforme ou várias tonalidades (castanho, preto, vermelho, azulado)",
  "diameter_estimate_mm": número ou null se não for possível estimar,
  "evolution_note": "se houver contexto de fotos anteriores fornecido, descreve o que mudou; caso contrário null",
  "risk_score": número de 0 a 100 (mais alto = mais preocupante),
  "risk_level": "baixo" | "moderado" | "alto",
  "recommendation": "frase curta e clara sobre o que fazer a seguir",
  "confidence": "high" | "medium" | "low"
}
Se a imagem não mostrar claramente uma lesão de pele (desfocada, mal enquadrada, ou não é pele): {"lesion_detected": false, "asymmetry": null, "border": null, "color": null, "diameter_estimate_mm": null, "evolution_note": null, "risk_score": null, "risk_level": null, "recommendation": "Não foi possível identificar uma lesão de pele nesta imagem — tenta uma foto mais próxima e bem iluminada.", "confidence": "low"}
IMPORTANTE: "lesion_detected": false significa que ESTA foto falhou — não é uma leitura válida. NUNCA a uses para concluir que "antes não havia lesão" ou para calcular uma evolução. Se o contexto fornecido mencionar uma foto anterior, assume que essa foto anterior foi uma leitura real e válida (o sistema nunca dá contexto de uma leitura falhada).`,

  skin_condition_progress: `Ajudas alguém a ACOMPANHAR A PROGRESSÃO de uma condição de pele JÁ DIAGNOSTICADA por um médico (ex: hidradenite supurativa, eczema, psoríase, uma ferida em tratamento). Isto NÃO é rastreio de risco de cancro de pele — é acompanhamento calmo e informativo de uma doença já conhecida e em tratamento. Tom controlado, descritivo, nunca alarmista. Só sinalizas "ver o médico" perante sinais de alerta CLAROS e específicos (não por rotina, não "para ter a certeza").
Return ONLY valid JSON with no markdown, values in European Portuguese:
{
  "lesion_detected": true,
  "description": "descrição curta e objetiva do que se vê agora (tamanho aproximado, cor, inflamação/vermelhidão, drenagem ou pus, crosta, sinais de cicatrização)",
  "trend": "melhoria" | "estavel" | "a_agravar",
  "trend_note": "se houver foto anterior no contexto, o que mudou concretamente desde então; caso contrário null",
  "doctor_flag": true ou false — true APENAS perante sinais de alerta claros e específicos (ex: sinais de infeção a espalhar-se, febre referida, dor súbita muito mais intensa, drenagem com mau cheiro, área a crescer rapidamente) — nunca por rotina ou por "mais vale prevenir",
  "doctor_reason": "se doctor_flag=true, o motivo específico e curto; caso contrário null",
  "confidence": "high" | "medium" | "low"
}
Se a imagem não mostrar claramente a zona a acompanhar: {"lesion_detected": false, "description": null, "trend": null, "trend_note": null, "doctor_flag": false, "doctor_reason": null, "confidence": "low"}
IMPORTANTE: tal como no rastreio de risco, "lesion_detected": false é uma foto falhada — nunca a interpretes como "a condição desapareceu" nem uses isso para calcular tendência.`,
}

// ─── OpenAI GPT-4o Vision fallback ───────────────────────────────────────────
async function tryOpenAIVision(imageBase64: string, mimeType: string, prompt: string): Promise<any | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // cheaper than gpt-4o, still excellent for OCR/drug id
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' } }
          ]
        }]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!res.ok) return null

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) return null

    // Extract JSON
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}


export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurado. Vai ao Cloudflare → Workers & Pages → o teu worker → Settings → Variables e adiciona GEMINI_API_KEY.' },
        { status: 503 }
      )
    }

    // Parse body — check size first
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Imagem demasiado grande. A imagem deve ser comprimida antes de enviar (máx. ~2MB).' },
        { status: 413 }
      )
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Pedido inválido — não é JSON válido' }, { status: 400 })
    }

    if (!body?.image) {
      return NextResponse.json({ error: 'Campo "image" obrigatório (base64)' }, { status: 400 })
    }

    const mode: VisionMode = body.mode || 'drug_id'
    const mimeType: string = body.mimeType || 'image/jpeg'

    // skin_lesion/skin_condition_progress são as únicas modalidades Pro deste
    // endpoint (as restantes servem /scan e afins, gratuitas/limitadas noutro
    // sítio) — gate aqui, específico ao modo.
    if (mode === 'skin_lesion' || mode === 'skin_condition_progress') {
      const { plan } = await getUserPlan(req)
      if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Rastreio Visual')
    }

    if (!PROMPTS[mode]) {
      return NextResponse.json({ error: `Modo "${mode}" inválido` }, { status: 400 })
    }
    // Contexto opcional (ex: skin_lesion usa isto para comparar com a foto anterior da mesma track).
    const prompt = body.context ? `${PROMPTS[mode]}\n\nContexto adicional: ${String(body.context).slice(0, 800)}` : PROMPTS[mode]

    const imageSizeKB = Math.round((body.image.length * 3) / 4 / 1024)

    if (imageSizeKB > 8000) {
      return NextResponse.json(
        { error: `Imagem demasiado grande (${imageSizeKB}KB). Comprime a foto antes de enviar.` },
        { status: 413 }
      )
    }

    // Build Gemini request
    const geminiBody = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: body.image } }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    let geminiRes: Response
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: AbortSignal.timeout(45000)
      })
    } catch (fetchErr: any) {
      console.error('Gemini fetch error:', fetchErr?.message)
      if (fetchErr?.name === 'TimeoutError') {
        return NextResponse.json({ error: 'Tempo limite excedido. Tenta com uma imagem mais pequena.' }, { status: 504 })
      }
      return NextResponse.json({ error: `Erro de ligação ao Gemini: ${fetchErr?.message}` }, { status: 502 })
    }

    // Parse Gemini response
    const geminiData = await geminiRes.json().catch(() => null)

    if (!geminiRes.ok) {
      const errorMsg = geminiData?.error?.message || `HTTP ${geminiRes.status}`
      const errorStatus = geminiData?.error?.status || ''

      console.error(`Gemini error: ${geminiRes.status} ${errorStatus} - ${errorMsg}`)

      if (geminiRes.status === 429) {
        // Try OpenAI GPT-4o as fallback
        const openaiResult = await tryOpenAIVision(body.image, mimeType, prompt)
        if (openaiResult) return NextResponse.json({ ...openaiResult, mode, success: true, provider: 'openai' })
        return NextResponse.json(
          { error: 'Quota de visão esgotada (Gemini e OpenAI). Usa a opção de texto manual enquanto regularizas.' },
          { status: 429 }
        )
      }
      if (geminiRes.status === 400) {
        return NextResponse.json(
          { error: `Imagem rejeitada pelo Gemini: ${errorMsg}. Tenta uma foto diferente (JPG ou PNG, bem iluminada).` },
          { status: 400 }
        )
      }
      if (geminiRes.status === 403) {
        return NextResponse.json(
          { error: `Chave API inválida ou sem permissões. Verifica GEMINI_API_KEY no Cloudflare.` },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: `Gemini retornou erro ${geminiRes.status}: ${errorMsg}` },
        { status: 500 }
      )
    }

    // Check for safety blocks
    const candidate = geminiData?.candidates?.[0]
    if (candidate?.finishReason === 'SAFETY') {
      return NextResponse.json(
        { error: 'Imagem bloqueada por filtros de segurança do Gemini. Tenta outra foto.' },
        { status: 400 }
      )
    }
    if (candidate?.finishReason === 'RECITATION') {
      return NextResponse.json(
        { error: 'Resposta bloqueada por direitos de autor. Tenta outra foto.' },
        { status: 400 }
      )
    }

    const rawText = candidate?.content?.parts?.[0]?.text || ''
    if (!rawText) {
      return NextResponse.json(
        { error: 'Gemini devolveu resposta vazia. Tenta com uma foto mais nítida e bem iluminada.' },
        { status: 500 }
      )
    }

    // Parse JSON from response
    let parsed: any
    try {
      // Try direct parse first (when responseMimeType: application/json is honoured)
      parsed = JSON.parse(rawText)
    } catch {
      // Fallback: extract JSON from text
      const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const objMatch = clean.match(/\{[\s\S]*\}/)
      const arrMatch = clean.match(/\[[\s\S]*\]/)
      const match = objMatch || arrMatch
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          console.error('JSON parse failed. Raw response:', rawText.slice(0, 500))
          return NextResponse.json(
            { error: 'Não foi possível interpretar a resposta. Tenta com uma foto mais nítida.' },
            { status: 500 }
          )
        }
      } else {
        console.error('No JSON in response:', rawText.slice(0, 500))
        return NextResponse.json(
          { error: `Resposta inesperada do Gemini: "${rawText.slice(0, 100)}". Tenta novamente.` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ ...parsed, mode, success: true, imageSizeKB })

  } catch (err: any) {
    console.error('Vision route unexpected error:', err?.message, err?.stack)
    return NextResponse.json(
      { error: `Erro inesperado: ${err?.message || 'tenta novamente'}` },
      { status: 500 }
    )
  }
}