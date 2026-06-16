// app/api/scan/route.ts
// Phlox Scan — uma foto de QUALQUER coisa de saúde. A IA identifica o tipo e age:
// receita/caixa → medicação; análise → interpreta; relatório → resume simples;
// folheto/bula → explica. "O Shazam da saúde."
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON, aiJSON } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { enforceDailyLimit } from '@/lib/serverLimit'

export const maxDuration = 45

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  // Limite diário server-side (Base/Plus). Pro/Institucional = ilimitado.
  const gate = await enforceDailyLimit(req, 'scan')
  if (!gate.ok) return gate.response!
  const body = await req.json().catch(() => null) as { image?: string; mimeType?: string; text?: string } | null
  if (!body?.image && !body?.text) return NextResponse.json({ error: 'Imagem ou documento obrigatório' }, { status: 400 })

  const prompt = `És um assistente de saúde português. Recebes ${body?.text ? 'o TEXTO de um documento' : 'UMA foto'} que pode ser qualquer coisa relacionada com saúde. PRIMEIRO identifica o que é, DEPOIS interpreta de forma útil, em PT-PT e linguagem simples.

Tipos possíveis (kind):
- "receita": receita médica → extrai os medicamentos.
- "medicamento": caixa/embalagem de medicamento → identifica e explica.
- "analise": análise ao sangue/urina/exame laboratorial → interpreta os valores (normal/alterado e o que significa).
- "relatorio": relatório/carta médica → resume em linguagem simples o essencial.
- "bula": folheto/bula → explica o principal.
- "outro": outra coisa de saúde → descreve e orienta.
- "nao_saude": não tem a ver com saúde.

Responde APENAS JSON válido:
{
  "kind": "<um dos acima>",
  "title": "título curto do que identificaste",
  "summary": "explicação clara e útil em 2-5 frases, linguagem simples",
  "meds": [ { "name": "...", "dose": "...", "frequency": "..." } ],   // só se receita/medicamento
  "values": [ { "name": "ex: Hemoglobina", "value": "13.5", "status": "normal|baixo|alto", "note": "o que significa" } ],  // só se análise
  "bullets": ["pontos-chave, se útil"],
  "action": { "label": "texto do botão de ação sugerido", "route": "/interactions|/mymeds|/medicamento|/labs|/bula" },
  "warning": "alerta se algo precisa de atenção médica (opcional)",
  "confidence": "alta|media|baixa"
}
Preenche só os campos relevantes ao tipo. Se for análise com valores alterados importantes, mete um "warning". NUNCA dês diagnóstico definitivo — orienta para o médico quando apropriado.`

  try {
    let res: any
    if (body.image) {
      res = await callGeminiVisionJSON<any>(prompt, body.image, body.mimeType || 'image/jpeg', { maxTokens: 1800 })
    } else {
      res = await aiJSON<any>([
        { role: 'system', content: prompt },
        { role: 'user', content: `Documento:\n${(body.text || '').slice(0, 12000)}` },
      ], { maxTokens: 1800 })
    }
    if (!res || !res.kind) throw new Error('Não consegui interpretar.')
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não consegui ler. Tenta com mais luz e foco.' }, { status: 500 })
  }
}
