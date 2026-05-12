// app/api/labs/route.ts — REESCRITO
// Fix: aceitar text, lab_text E pdf_base64 (todos os campos que o frontend usa)
// Fix: o frontend usa 'text' mas a rota esperava 'lab_text' — unificado

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON, callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { userId } = await getUserPlan(req)

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  // ── Aceitar qualquer dos campos de texto que o frontend possa enviar ─────────
  let labText: string = body.text || body.lab_text || body.raw_text || ''

  // ── PDF via base64 ────────────────────────────────────────────────────────────
  if (body.pdf_base64) {
    // Usar Gemini Vision para extrair texto do PDF
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      // Fallback: tentar interpretar como text placeholder
      labText = `[PDF de análises clínicas — a interpretar]`
    } else {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  {
                    text: `Este é um PDF de análises clínicas laboratoriais. Extrai TODOS os valores analíticos que encontras.
Para cada parâmetro, extrai: nome, valor, unidade e intervalo de referência se disponível.
Inclui também: data da colheita, laboratório, nome do doente se visível.
Responde APENAS com o texto bruto dos resultados, em formato lista clara. Não analises — apenas extrai.`
                  },
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: body.pdf_base64
                    }
                  }
                ]
              }],
              generationConfig: { maxOutputTokens: 2000, temperature: 0.0 }
            })
          }
        )
        const gd = await geminiRes.json()
        const extracted = gd.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (extracted.trim().length > 20) {
          labText = extracted
        } else {
          return NextResponse.json({ error: 'Não foi possível extrair texto do PDF. Tenta copiar e colar o texto directamente.' }, { status: 422 })
        }
      } catch (_e: any) {
        return NextResponse.json({ error: 'Erro ao processar o PDF. Tenta copiar e colar o texto das análises.' }, { status: 500 })
      }
    }
  }

  if (!labText || labText.trim().length < 10) {
    return NextResponse.json({ error: 'Resultados de análises obrigatórios. Cola o texto ou faz upload do PDF.' }, { status: 400 })
  }

  const cleanedText = labText.trim().slice(0, 8000)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico internista e farmacologista clínico a interpretar resultados de análises clínicas para o doente — não para outro médico.

O teu objectivo: dado um conjunto de resultados de análises, produzir uma interpretação completa, honesta e útil em português europeu (PT-PT) que o doente possa compreender e usar.

Responde APENAS com JSON válido sem markdown:
{
  "patient_summary": "perfil clínico inferido dos resultados em 1 frase",
  "lab_name": "nome do laboratório se encontrado no texto",
  "date": "data da colheita se encontrada (formato YYYY-MM-DD)",
  "collection_date": "data legível se encontrada",
  "overall_status": "TUDO_NORMAL"|"ATENÇÃO"|"CONSULTA_RECOMENDADA"|"CONSULTA_URGENTE",
  "values": [
    {
      "name": "nome do parâmetro em português",
      "value": "valor encontrado",
      "unit": "unidade",
      "reference": "intervalo de referência se disponível",
      "status": "NORMAL"|"ALTO"|"BAIXO"|"CRITICO_ALTO"|"CRITICO_BAIXO",
      "interpretation": "o que este valor significa para esta pessoa — 1-2 frases directas, sem jargão",
      "clinical_significance": "BAIXA"|"MEDIA"|"ALTA"|"CRITICA",
      "drug_connection": "medicamentos que possam explicar o valor — opcional",
      "follow_up": "quando repetir ou o que fazer — opcional"
    }
  ],
  "flags": ["parâmetro fora do normal em formato curto — ex: 'Hemoglobina baixa'"],
  "key_findings": ["achado importante em linguagem simples — 1 frase directa"],
  "questions_for_doctor": ["pergunta específica que o doente deve fazer ao médico"],
  "lifestyle_suggestions": ["sugestão prática que o doente pode implementar"],
  "drug_interactions_found": [
    { "drug": "medicamento", "affected_value": "parâmetro", "explanation": "relação clara" }
  ],
  "when_to_repeat": "quando fazer próximas análises",
  "summary": "resumo em 2-3 frases para o doente",
  "reassurance": "mensagem tranquilizadora se resultados maioritariamente normais — opcional"
}

Regras:
- CRITICO: requer atenção médica imediata (K+ > 6.5, Hb < 7, glicemia > 500, troponina elevada)
- Interpretações específicas ao valor — não genéricas
- key_findings máximo 5
- Se o texto for de PDF e tiver ruído/erros OCR, interpreta o melhor que conseguires`,
      },
      {
        role: 'user',
        content: `Interpreta estes resultados de análises clínicas:\n\n${cleanedText}`,
      },
    ], { maxTokens: 2500, temperature: 0.05 })

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Labs route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao interpretar análises. Tenta novamente.' }, { status: 500 })
  }
}