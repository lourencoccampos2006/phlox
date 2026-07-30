// app/api/voice-log/extract/route.ts
// Passo 2 de 3 do "Regista falando": a partir da transcrição já REVISTA pelo
// utilizador (nunca do áudio cru), propõe ações estruturadas — nunca grava
// nada aqui. Mesmo padrão do Copilot (app/api/copilot-chat/route.ts):
// "proposedAction" que só se torna escrita real depois de confirmação
// explícita (app/api/voice-log/commit).
//
// Medicação (2026-07-30, a pedido de Fernando): a IA NUNCA inventa o nome de
// um medicamento — só pode escolher de entre a lista real da medicação ATIVA
// desta pessoa (fornecida no prompt), e mesmo assim o servidor volta a
// confirmar a correspondência por nome antes de aceitar a ação (nunca confia
// cegamente no que a IA disse) — se não houver correspondência clara, a ação
// é descartada em vez de arriscar. Ocorrências/quedas continuam de fora desta
// versão — a única das 4 áreas sem um caminho de registo manual estruturado
// e específico já existente para comparar/confirmar a extração.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'
import { aiJSON } from '@/lib/ai'

export const runtime = 'nodejs'

interface RawAction {
  domain: 'nutrition' | 'health_checkin' | 'support_service' | 'medication'
  summary: string
  payload: Record<string, any>
}

const BASE_SYSTEM = `Ajudas uma equipa de um centro de dia/lar português a transformar uma frase falada durante a ronda em registos estruturados.

Extrai APENAS o que foi dito EXPLICITAMENTE. Nunca inventes nem infiras o que não foi dito — na dúvida, não incluas o campo nem a ação. Se a frase não tocar em nenhum dos assuntos abaixo, devolve uma lista vazia.

Os assuntos possíveis (nunca extraias ocorrências/quedas — isso fica sempre para registo manual):

1. "nutrition" — o que a pessoa comeu/bebeu. Campos possíveis: breakfast/lunch/dinner (0, 25, 50, 75 ou 100 — a % da refeição que comeu, arredonda ao valor mais próximo destes 5; "comeu tudo"=100, "comeu bem"=75, "comeu pouco"=25, "recusou"/"não comeu nada"=0), appetite ("Bom"|"Razoável"|"Fraco"|"Recusou"), fluid_ml (número, só se mencionar quantidade de líquido).
2. "health_checkin" — enfermagem básica ou acompanhamento de saúde (NÃO administração de medicação). Campos: kind ("enfermagem"|"acompanhamento"), notes (resumo curto do que foi feito/observado, em PT-PT, começa por maiúscula), duration_min (só se mencionar tempo).
3. "support_service" — pedido de roupa/transporte/outro serviço de apoio. Campos: kind ("roupa"|"transporte"|"outro"), notes (detalhe curto).`

const MED_SYSTEM = `
4. "medication" — administração de um medicamento da lista de medicação ATIVA desta pessoa, fornecida abaixo. Campos: med_name (copia EXATAMENTE o nome como aparece na lista fornecida — nunca escrevas um nome que não esteja na lista), status ("administered" se foi dado/tomado, "refused" se recusou, "held" se foi propositadamente suspenso/não dado por decisão clínica). Se o medicamento mencionado não corresponder claramente a NENHUM da lista, NÃO cries a ação — não adivinhes qual seria.`

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

  const { data: meds } = await db.from('patient_meds').select('id,name,dose').eq('patient_id', patientId).eq('active', true)
  const activeMeds = meds || []

  const domains = ['nutrition', 'health_checkin', 'support_service']
  let system = BASE_SYSTEM
  if (activeMeds.length > 0) {
    domains.push('medication')
    system += MED_SYSTEM + `\n\nMedicação ativa desta pessoa (usa o nome EXATAMENTE como aqui):\n` + activeMeds.map(m => `- ${m.name}${m.dose ? ` (${m.dose})` : ''}`).join('\n')
  }
  system += `\n\nDevolve APENAS JSON: {"actions": [{"domain": "...", "summary": "frase curta em PT-PT para mostrar num cartão de confirmação, ex: 'Almoço: comeu bem (75%)'", "payload": {...}}]}`

  try {
    const result = await aiJSON<{ actions: RawAction[] }>([
      { role: 'system', content: system },
      { role: 'user', content: `Pessoa: ${patient.name}\nTranscrição: "${transcript}"` },
    ], { maxTokens: 700, temperature: 0.1 })

    const rawActions = (Array.isArray(result?.actions) ? result.actions : [])
      .filter(a => a && domains.includes(a.domain) && a.payload)
      .slice(0, 6)

    // Medicação: o servidor volta a confirmar a correspondência por nome —
    // nunca confia só na palavra da IA. Sem correspondência clara → descarta.
    const actions = rawActions.map(a => {
      if (a.domain !== 'medication') return a
      const spoken = String(a.payload?.med_name || '').trim().toLowerCase()
      const match = activeMeds.find(m => m.name.toLowerCase() === spoken)
        || activeMeds.find(m => m.name.toLowerCase().includes(spoken) || spoken.includes(m.name.toLowerCase()))
      if (!match || !['administered', 'refused', 'held'].includes(a.payload?.status)) return null
      return { ...a, payload: { med_id: match.id, med_name: match.name, status: a.payload.status } }
    }).filter((a): a is RawAction => a !== null)

    return NextResponse.json({ patient: { id: patient.id, name: patient.name }, actions })
  } catch (err: any) {
    console.error('[phlox:voice-log/extract]', err?.message)
    return NextResponse.json({ error: 'Não foi possível interpretar o que foi dito. Tenta descrever de forma mais direta.' }, { status: 502 })
  }
}
