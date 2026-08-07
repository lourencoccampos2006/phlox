// app/api/incidents/structure/route.ts
// Registo rápido de ocorrência (2026-08-07): a equipa escreve uma nota curta
// logo a seguir ao que aconteceu ("a Maria caiu na casa de banho, não se
// magoou mas ficou assustada") e a IA propõe tipo/gravidade/descrição
// estruturada — a pessoa revê e ajusta antes de guardar, nunca é gravado
// sozinho. Mesmo espírito do resto do site: a IA propõe, o profissional
// confirma.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

interface StructuredIncident {
  type: 'fall' | 'medication_error' | 'pressure_ulcer' | 'behavioral' | 'choking' | 'infection' | 'other'
  severity: 'minor' | 'moderate' | 'major' | 'critical'
  description: string
  injuries: string
  action_taken_suggestion: string
}

const TYPES = ['fall', 'medication_error', 'pressure_ulcer', 'behavioral', 'choking', 'infection', 'other']
const SEVERITIES = ['minor', 'moderate', 'major', 'critical']

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { note?: string } | null
  const note = (body?.note || '').trim()
  if (!note) return NextResponse.json({ error: 'Escreve o que aconteceu.' }, { status: 400 })
  if (note.length > 1500) return NextResponse.json({ error: 'Nota demasiado longa.' }, { status: 400 })

  try {
    const out = await aiJSON<StructuredIncident>([
      {
        role: 'system',
        content: `És um assistente que ajuda equipas de lares/centros de dia a estruturar o registo de uma ocorrência (queda, erro de medicação, comportamento, etc.) a partir de uma nota curta e informal escrita por um profissional. Rigor: nunca inventes factos que não estejam na nota (lesões, testemunhas, causas) — se não for dito, deixa em branco ou usa uma frase neutra. NUNCA sub-relates nem sobre-relates a gravidade além do que a nota sugere.
Responde EXCLUSIVAMENTE em JSON:
{
  "type": "uma de: ${TYPES.join('|')}",
  "severity": "uma de: ${SEVERITIES.join('|')} — minor=sem lesão/risco, moderate=lesão ligeira ou risco a vigiar, major=lesão relevante ou intervenção necessária, critical=risco de vida ou dano grave",
  "description": "descrição objetiva e profissional dos factos, 2-4 frases, em PT-PT, baseada SÓ na nota",
  "injuries": "lesões/danos mencionados na nota, ou string vazia se a nota não menciona nenhuma",
  "action_taken_suggestion": "uma sugestão curta e prática do que normalmente se faz a seguir a este tipo de ocorrência (ex: vigilância de sinais vitais, avaliação clínica) — é uma SUGESTÃO para o profissional rever, não um facto"
}`,
      },
      { role: 'user', content: `Nota do profissional: ${note}` },
    ], { maxTokens: 500, temperature: 0.2 })

    if (!TYPES.includes(out.type)) out.type = 'other'
    if (!SEVERITIES.includes(out.severity)) out.severity = 'minor'
    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível estruturar agora.' }, { status: 500 })
  }
}
