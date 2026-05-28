import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Indicação farmacêutica (farmácia comunitária) — protocolo de aconselhamento ao balcão.
// Para PROFISSIONAL: rigor, dose concreta, critérios de referenciação. PT-PT.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const complaint = String(body?.complaint || '').trim().slice(0, 400)
  if (!complaint) return NextResponse.json({ error: 'Descreve a queixa do utente' }, { status: 400 })
  const ctx = String(body?.context || '').trim().slice(0, 400) // idade, gravidez, crónicos, medicação, alergias

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És farmacêutico(a) comunitário(a) experiente em Portugal a apoiar um colega no atendimento ao balcão (protocolo de indicação farmacêutica). Rigor clínico, dose concreta, e critérios claros de quando NÃO indicar e referenciar ao médico. PT-PT.

Responde APENAS com JSON válido (sem markdown):
{
  "assessment": "avaliação breve da situação (1-2 frases)",
  "suitable_for_self_care": true/false,
  "recommended": [
    { "name": "marca PT mais comum (ex: 'Ben-u-ron')", "active": "DCI", "dose": "dose adulto concreta (ex: '1000 mg de 8/8h, máx 3g/dia')", "duration": "duração máxima de automedicação", "notes": "nota prática ou ''" }
  ],
  "non_pharmacological": ["medida não farmacológica concreta"],
  "refer_if": ["critério de referenciação ao médico / sinal de alarme"],
  "counseling": ["ponto de aconselhamento a transmitir ao utente"],
  "follow_up": "quando reavaliar / regressar à farmácia"
}

Regras:
- Adapta TUDO ao contexto (idade, gravidez/amamentação, crónicos, medicação atual, alergias).
- Dose SEMPRE concreta; nunca "conforme indicação médica".
- Se a situação não é para automedicar (suitable_for_self_care=false): recommended pode ficar vazio e refer_if extenso.
- Considera interações com a medicação indicada no contexto.`,
      },
      { role: 'user', content: `Queixa: ${complaint}${ctx ? `\nContexto do utente: ${ctx}` : ''}` },
    ], { maxTokens: 1300, temperature: 0 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
