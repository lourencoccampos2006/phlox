import { NextRequest, NextResponse } from 'next/server'
import { callGeminiVisionJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

interface PrescriptionMed {
  name: string          // DCI / nome do fármaco
  dose: string          // ex: "10 mg", "1 comp."
  frequency: string     // ex: "1x/dia", "2 id"
  indication: string    // se indicado
  shifts: string[]      // subconjunto de ['manha','tarde','noite'] inferido da posologia
  confidence: string    // "alta" | "media" | "baixa"
}
interface PrescriptionAI {
  meds: PrescriptionMed[]
  warnings: string[]    // ilegibilidade, ambiguidades, doses pouco claras
  observations: string
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 12, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.imageBase64) return NextResponse.json({ error: 'Imagem obrigatória' }, { status: 400 })

  const prompt = `És farmacêutico(a) hospitalar a apoiar uma equipa de um lar/ERPI em Portugal.
Analisa esta fotografia de uma PRESCRIÇÃO médica, receita, ou rótulo/caixa de medicamento e extrai a medicação de forma estruturada.

Regras:
- Usa a DCI (substância ativa) quando reconhecível; se só vires a marca, indica a marca.
- "shifts" deve refletir os turnos em que o medicamento deve ser tomado, inferidos da posologia:
  manhã (pequeno-almoço/jejum), tarde (almoço/lanche), noite (jantar/deitar).
  Se for "1x/dia" sem hora indicada → ["manha"]. Se "2x/dia" → ["manha","noite"]. Se "3x/dia" → ["manha","tarde","noite"]. Se não der para inferir → [].
- NÃO inventes. Se um campo for ilegível, deixa-o vazio e regista em "warnings".

Responde APENAS com JSON válido em português de Portugal:
{
  "meds": [
    { "name": "DCI ou marca", "dose": "ex: 10 mg", "frequency": "ex: 1x/dia", "indication": "se indicado ou ''", "shifts": ["manha"], "confidence": "alta|media|baixa" }
  ],
  "warnings": ["aviso sobre legibilidade/ambiguidade", "..."],
  "observations": "nota objetiva (1-2 frases)"
}

Esta extração é de APOIO e tem de ser SEMPRE confirmada por um profissional antes de registar.`

  try {
    const result = await callGeminiVisionJSON<PrescriptionAI>(prompt, body.imageBase64, body.mimeType || 'image/jpeg', { maxTokens: 1500 })
    if (!result.meds) result.meds = []
    return NextResponse.json({ ...result, disclaimer: 'Extração de apoio por IA — confirmar sempre com a prescrição original e o profissional responsável.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível analisar a imagem.' }, { status: 500 })
  }
}
