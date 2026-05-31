import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVision } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan } from '@/lib/planGate'

// POST /api/ai-vision — análise multimodal: imagem (base64) + pergunta opcional.
// Para o Phlox AI permitir enviar fotos (medicamento, bula, análise, ferida, etc).
// Devolve resposta em texto (markdown).

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 12, 60_000).allowed) return rateLimitResponse()

  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const imageBase64: string = body?.imageBase64 || ''
  const mimeType: string = body?.mimeType || 'image/jpeg'
  const question: string = String(body?.question || '').slice(0, 1500).trim()
  const experienceMode: string = body?.experienceMode || 'personal'

  if (!imageBase64 || imageBase64.length < 100) {
    return NextResponse.json({ error: 'Imagem em falta' }, { status: 400 })
  }
  if (imageBase64.length > 8_000_000) {
    return NextResponse.json({ error: 'Imagem demasiado grande (máx ~6 MB)' }, { status: 413 })
  }

  // Persona resumida — visão é mais conservadora
  const persona =
    experienceMode === 'clinical' ? 'Profissional de saúde. Linguagem técnica DCI/INN, guidelines DGS/INFARMED.'
    : experienceMode === 'student' ? 'Estudante. Explica com mecanismo, efeito clínico e relevância prática.'
    : experienceMode === 'caregiver' ? 'Cuidador familiar. Linguagem simples; quando agir, quando ir ao médico.'
    : 'Utilizador comum. Linguagem clara, sem jargão, em 3-5 frases.'

  const prompt = `És o Phlox AI a analisar uma imagem enviada por um utilizador em Portugal.
${persona}

REGRAS:
- Português de Portugal (pt-PT).
- Se for embalagem/bula: identifica o medicamento (DCI), dose, forma, indicação. Se não tens certeza absoluta, di-lo.
- Se for ferida / pele / sinal corporal: descreve com prudência, sem diagnosticar. Indica quando procurar ajuda médica.
- Se for análise/exame: ajuda a perceber o significado dos parâmetros visíveis.
- Se NÃO conseguires identificar nada útil: di-lo claramente em vez de inventar.
- Markdown leve (negrito, listas, headings ## quando útil).
- NUNCA dizer "consulte um profissional" como única resposta — dá a informação útil que tens primeiro.
${question ? `\nPERGUNTA DO UTILIZADOR: ${question}` : '\n(Sem pergunta — descreve o que vês e o que é útil saber.)'}`

  try {
    const text = await callGeminiVision(prompt, imageBase64, mimeType, { maxTokens: 1200, temperature: 0.1 })
    return NextResponse.json({ ok: true, text, plan })
  } catch (e: any) {
    return NextResponse.json({ error: `Visão indisponível: ${String(e?.message || e).slice(0, 200)}` }, { status: 503 })
  }
}
