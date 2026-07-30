// app/api/voice-log/extract/route.ts
// Passo 2 de 3 do "Regista falando": a partir da transcrição já REVISTA pelo
// utilizador (nunca do áudio cru), propõe ações estruturadas — nunca grava
// nada aqui. Mesmo padrão do Copilot (app/api/copilot-chat/route.ts):
// "proposedAction" que só se torna escrita real depois de confirmação
// explícita (app/api/voice-log/commit). Âmbito DELIBERADAMENTE limitado a
// refeições/enfermagem-acompanhamento/serviços de apoio nesta primeira
// versão — medicação e ocorrências ficam de fora por agora: são demasiado
// sensíveis para arriscar numa extração por IA sobre uma transcrição de
// ambiente ruidoso (ver nota de robustez no VoiceLogger).
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'
import { aiJSON } from '@/lib/ai'

export const runtime = 'nodejs'

type Shift = 'manha' | 'tarde' | 'noite'

interface RawAction {
  domain: 'nutrition' | 'health_checkin' | 'support_service'
  summary: string
  payload: Record<string, any>
}

const SYSTEM = `Ajudas uma equipa de um centro de dia/lar português a transformar uma frase falada durante a ronda em registos estruturados.

Extrai APENAS o que foi dito EXPLICITAMENTE. Nunca inventes nem infiras o que não foi dito — na dúvida, não incluas o campo. Se a frase não tocar em nenhum dos 3 assuntos abaixo, devolve uma lista vazia.

Os 3 assuntos possíveis (nunca extraias medicação nem ocorrências/quedas — isso fica sempre para registo manual):

1. "nutrition" — o que a pessoa comeu/bebeu. Campos possíveis: breakfast/lunch/dinner (0, 25, 50, 75 ou 100 — a % da refeição que comeu, arredonda ao valor mais próximo destes 5; "comeu tudo"=100, "comeu bem"=75, "comeu pouco"=25, "recusou"/"não comeu nada"=0), appetite ("Bom"|"Razoável"|"Fraco"|"Recusou"), fluid_ml (número, só se mencionar quantidade de líquido).
2. "health_checkin" — enfermagem básica ou acompanhamento de saúde feito à pessoa (NÃO administração de medicação). Campos: kind ("enfermagem"|"acompanhamento"), notes (resumo curto do que foi feito/observado, em PT-PT, começa por maiúscula), duration_min (só se mencionar tempo).
3. "support_service" — pedido de roupa/transporte/outro serviço de apoio. Campos: kind ("roupa"|"transporte"|"outro"), notes (detalhe curto).

Devolve APENAS JSON: {"actions": [{"domain": "...", "summary": "frase curta em PT-PT para mostrar num cartão de confirmação, ex: 'Almoço: comeu bem (75%)'", "payload": {...}}]}`

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Registo por voz')

  const body = await req.json().catch(() => null) as any
  const transcript = String(body?.transcript || '').trim().slice(0, 2000)
  const patientId = String(body?.patient_id || '')
  if (!transcript) return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório.' }, { status: 400 })

  // A RLS do próprio cliente autenticado é a barreira real: se a pessoa não
  // tiver acesso a este utente, a linha simplesmente não aparece.
  const db = sb(req)
  const { data: patient } = await db.from('patients').select('id,name').eq('id', patientId).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Sem acesso a esta pessoa.' }, { status: 403 })

  try {
    const result = await aiJSON<{ actions: RawAction[] }>([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Pessoa: ${patient.name}\nTranscrição: "${transcript}"` },
    ], { maxTokens: 600, temperature: 0.1 })

    const actions = (Array.isArray(result?.actions) ? result.actions : [])
      .filter(a => a && ['nutrition', 'health_checkin', 'support_service'].includes(a.domain) && a.payload)
      .slice(0, 6)

    return NextResponse.json({ patient: { id: patient.id, name: patient.name }, actions })
  } catch (err: any) {
    console.error('[phlox:voice-log/extract]', err?.message)
    return NextResponse.json({ error: 'Não foi possível interpretar o que foi dito. Tenta descrever de forma mais direta.' }, { status: 502 })
  }
}
