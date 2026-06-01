// app/api/saude-agora/route.ts
// Unifica /api/triagem + /api/socorros: recebe a queixa, decide o nível
// adequado (112 → primeiros_socorros → urgências → centro_saude → farmácia
// → casa) e devolve o passo-a-passo apropriado a cada nível.
//
// 2026-06-01.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const SYSTEM = `És um conselheiro clínico português a fazer triagem de uma situação descrita por um leigo, em PT-PT.

Decides o NÍVEL de resposta com base na gravidade aparente, e devolves passos práticos e prudentes. Quando há sinais de risco de vida, escolhe "112". Quando o utilizador descreve uma situação que JÁ ACONTECEU e precisa fazer algo imediatamente em casa, escolhe "primeiros_socorros".

Níveis possíveis:
- "112"                  — risco de vida imediato (PCR, AVC, dor no peito típica, anafilaxia grave, hemorragia grave, perda de consciência prolongada, dificuldade respiratória severa).
- "primeiros_socorros"   — emergência em curso onde o utilizador / pessoa precisa de agir já (engasgamento, queimadura, corte com hemorragia, desmaio, convulsão, reação alérgica). Aqui ainda pode ser preciso ligar 112 — incluí em "red_flags_now".
- "urgencias"            — não é emergência mas precisa hospital agora (dor severa, febre alta + sinais de alarme, suspeita de fratura).
- "centro_saude"         — médico nas próximas 24h (febre persistente, otalgia, sintomas gripais com >3 dias).
- "farmacia"             — sintomas ligeiros com MNSRM (dor de cabeça pontual, queimadura ligeira do sol).
- "casa"                 — auto-cuidado (constipação leve, dor menor sem sinais de alarme).

Responde APENAS com JSON:
{
  "level": "<um dos níveis acima>",
  "headline": "frase curta de orientação (ex: 'Liga já 112 — pode ser AVC')",
  "why": "explicação em 1-2 frases simples do porquê deste nível",
  "what_to_do_now": ["passo 1 acionável (ex: 'Senta a pessoa, afrouxa roupa')", "passo 2"],
  "do_not": ["não faças X (ex: 'Não dês de beber')", "..."],
  "red_flags_now": ["sinal que justifica escalar a 112 (ex: 'perde a consciência')", "..."],
  "watch_for": ["sinal a vigiar nas próximas horas"],
  "timeframe": "ex: 'agora', 'nas próximas 2h', 'nas próximas 24h', 'podes esperar 1-2 dias'",
  "reassurance": "1 frase a normalizar / acalmar quando aplicável (opcional)"
}

Regras estritas:
- Língua PT-PT. Sem jargão sem explicação.
- Quando houver QUALQUER dúvida sobre gravidade, sobe o nível. Erra pelo lado da prudência.
- "what_to_do_now" tem 3-6 passos curtos, IMPERATIVOS, executáveis sem treino.
- "do_not" tem 2-4 itens, conhecidos por causar mais dano (ex: queimaduras: "Não rebentes bolhas", "Não apliques gelo").
- "red_flags_now" são SEMPRE específicos — quando devem ligar 112 mesmo nesta situação.
- Nunca dês diagnóstico. Nunca prescrevas medicamento por nome.
- Se a queixa é demasiado vaga, pede esclarecimento em "why" e usa "centro_saude" + timeframe="contacta o SNS 24 (808 24 24 24)".`

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const { allowed } = checkRateLimit(ip, 20, 60_000)
  if (!allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const complaint = String(body?.complaint || '').trim().slice(0, 500)
  if (!complaint) return NextResponse.json({ error: 'Descreve o que se passa.' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: complaint },
    ], { maxTokens: 1200, temperature: 0 })
    if (!result?.level) throw new Error('Resposta inválida.')
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro a processar. Em situação grave liga 112.' }, { status: 500 })
  }
}
