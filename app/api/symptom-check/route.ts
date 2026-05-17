import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

interface ADRSuspicion {
  suspected_drug: string
  symptom: string
  probability: 'alta' | 'moderada' | 'baixa'
  mechanism: string
  action: 'manter_vigilancia' | 'avisar_medico' | 'urgente' | 'nao_relacionado'
  evidence: 'documentado' | 'possivel' | 'especulativo'
  who_umc: string | null
}

interface ADRResponse {
  suspicions: ADRSuspicion[]
  overall_safety: 'seguro' | 'monitorizar' | 'consultar_medico' | 'urgente'
  message: string
  disclaimer: string
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 8, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { symptoms: string; medications: { name: string; dose?: string | null; frequency?: string | null }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const { symptoms, medications } = body
  if (!symptoms?.trim()) return NextResponse.json({ error: 'Descreve os sintomas' }, { status: 400 })
  if (!medications?.length) return NextResponse.json({ error: 'Lista de medicamentos em falta' }, { status: 400 })

  const medList = medications.slice(0, 20).map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`).join('\n')

  const systemPrompt = `És um farmacologista clínico especialista em farmacovigilância. A tua missão é correlacionar sintomas reportados pelo utilizador com os medicamentos que toma.

MEDICAMENTOS ACTUAIS DO UTILIZADOR:
${medList}

SINTOMAS REPORTADOS:
${symptoms.trim().slice(0, 500)}

Analisa cuidadosamente e devolve um objecto JSON com:
{
  "suspicions": [
    {
      "suspected_drug": "nome do medicamento",
      "symptom": "sintoma específico correlacionado",
      "probability": "alta" | "moderada" | "baixa",
      "mechanism": "mecanismo em linguagem simples (max 1 frase)",
      "action": "manter_vigilancia" | "avisar_medico" | "urgente" | "nao_relacionado",
      "evidence": "documentado" | "possivel" | "especulativo",
      "who_umc": "código WHO-UMC de causalidade ou null"
    }
  ],
  "overall_safety": "seguro" | "monitorizar" | "consultar_medico" | "urgente",
  "message": "mensagem em PT-PT para o utilizador (max 2 frases, linguagem simples)",
  "disclaimer": "nota que este não é um diagnóstico médico e que devem consultar o médico/farmacêutico"
}

Regras:
- Só inclui suspeitas com probabilidade ≥ baixa e evidence ≥ possivel
- Se os sintomas não têm relação com nenhum medicamento, devolve suspicions: [] e overall_safety: "seguro"
- Se overall_safety é "urgente", a message deve dizer explicitamente para ir às urgências
- Máximo 5 suspeitas
- Exemplos de ADRs documentados: tosse seca (IECA), hipoglicémia (insulina/sulfonilureias), hipopotassemia (diuréticos), bradicardia (beta-bloqueadores), confusão (benzodiazepinas), fotossensibilidade (tetraciclinas/amiodarona), diarreia (antibióticos)
- Responde APENAS JSON sem markdown`

  try {
    const result = await aiJSON<ADRResponse>(
      [{ role: 'user', content: systemPrompt }],
      { maxTokens: 1000 }
    )
    // Sanitise
    const safe: ADRResponse = {
      suspicions: (Array.isArray(result?.suspicions) ? result.suspicions : [])
        .slice(0, 5)
        .filter((s: any) => s?.suspected_drug && s?.symptom)
        .map((s: any) => ({
          suspected_drug: String(s.suspected_drug).slice(0, 100),
          symptom: String(s.symptom).slice(0, 200),
          probability: ['alta', 'moderada', 'baixa'].includes(s.probability) ? s.probability : 'baixa',
          mechanism: String(s.mechanism || '').slice(0, 300),
          action: ['manter_vigilancia', 'avisar_medico', 'urgente', 'nao_relacionado'].includes(s.action) ? s.action : 'manter_vigilancia',
          evidence: ['documentado', 'possivel', 'especulativo'].includes(s.evidence) ? s.evidence : 'possivel',
          who_umc: s.who_umc ? String(s.who_umc).slice(0, 20) : null,
        })),
      overall_safety: ['seguro', 'monitorizar', 'consultar_medico', 'urgente'].includes(result?.overall_safety) ? result.overall_safety : 'monitorizar',
      message: String(result?.message || '').slice(0, 400),
      disclaimer: String(result?.disclaimer || 'Esta análise não substitui a avaliação de um profissional de saúde.').slice(0, 300),
    }
    return NextResponse.json(safe)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro na análise' }, { status: 500 })
  }
}
