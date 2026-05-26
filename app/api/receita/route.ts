import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "Decifrar a receita médica" — foto da receita → explica cada medicamento em
// linguagem simples e monta um horário de tomas. Para o doente/família.

interface RxItem {
  name: string; what_for: string; how: string; times: string[]; with_food: string; caution: string
}
interface RxResult { meds: RxItem[]; summary: string; warnings: string[] }

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 12, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.imageBase64) return NextResponse.json({ error: 'Foto da receita obrigatória' }, { status: 400 })

  const prompt = `És um farmacêutico português que ajuda um doente (ou familiar) a perceber a sua receita médica. Lê a fotografia da receita e explica em linguagem MUITO simples, sem termos técnicos.

Responde APENAS com JSON válido (sem markdown), PT-PT:
{
  "meds": [
    {
      "name": "nome do medicamento e dose como está na receita",
      "what_for": "para que serve, em palavras simples (ex: 'para baixar a tensão')",
      "how": "como tomar em linguagem simples (ex: 'um comprimido de manhã')",
      "times": ["manhã","almoço","jantar","deitar"],
      "with_food": "em jejum | com a refeição | indiferente",
      "caution": "1 cuidado importante para o doente, ou '' "
    }
  ],
  "summary": "resumo tranquilizador de 1-2 frases sobre o conjunto da medicação",
  "warnings": ["aviso se algo está ilegível ou pouco claro na receita"]
}

Regras:
- "times" só com os momentos do dia em que se toma (subconjunto de manhã/almoço/jantar/deitar). Se 1x/dia sem hora → ["manhã"].
- NÃO inventes. Se um campo é ilegível, deixa vazio e regista em warnings.
- Linguagem de quem explica a um avô, com calma e clareza.
- Esta leitura é de APOIO e deve ser confirmada com o farmacêutico/médico.`

  try {
    const result = await callGeminiVisionJSON<RxResult>(prompt, body.imageBase64, body.mimeType || 'image/jpeg', { maxTokens: 1600 })
    if (!result.meds) result.meds = []
    return NextResponse.json({ ...result, disclaimer: 'Leitura de apoio por IA — confirma sempre com a receita original e o teu farmacêutico.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível ler a receita. Tenta uma foto mais nítida.' }, { status: 500 })
  }
}
