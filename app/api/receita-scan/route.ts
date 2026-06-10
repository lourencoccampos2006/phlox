// app/api/receita-scan/route.ts
// Foto da receita / caixas → lista de medicação estruturada, pronta a importar.
// O momento "uau": uma foto organiza toda a medicação (ideal para cuidadores).
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null) as { image?: string; mimeType?: string } | null
  if (!body?.image) return NextResponse.json({ error: 'Foto obrigatória' }, { status: 400 })

  const prompt = `És farmacêutico português. Esta foto é de uma RECEITA MÉDICA ou de CAIXAS de medicamentos.
Lê com atenção e extrai TODOS os medicamentos visíveis. Para cada um, identifica nome, dose e posologia se constar.
Reconhece marcas portuguesas (Ben-u-ron, Brufen, Concor, Sintrom…) e DCIs.
Se for uma receita, lê a posologia escrita. Se forem caixas, lê o que está na embalagem.

Responde APENAS JSON válido, PT-PT:
{
  "kind": "receita" | "caixas",
  "meds": [
    {
      "name": "nome do medicamento como aparece",
      "active": "princípio ativo (DCI) se souberes",
      "dose": "ex: 500mg, 5mg",
      "frequency": "ex: 1x/dia, 8/8h, ao deitar — só se constar",
      "notes": "observações relevantes da receita (ex: 'em jejum'), opcional"
    }
  ],
  "confidence": "alta" | "media" | "baixa",
  "warning": "se a foto estiver ilegível ou incompleta, di-lo aqui (opcional)"
}
Se não conseguires ler, devolve meds: [] e confidence baixa.`

  try {
    const res = await callGeminiVisionJSON<any>(prompt, body.image, body.mimeType || 'image/jpeg', { maxTokens: 1600 })
    if (!res || !Array.isArray(res.meds)) throw new Error('Não consegui ler a foto.')
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível ler a foto. Tenta com mais luz e foco.' }, { status: 500 })
  }
}
