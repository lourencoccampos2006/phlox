import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan, userId } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('cases', plan)

  const body = await req.json().catch(() => null)
  if (!body?.lab_text || String(body.lab_text).trim().length < 20) {
    return NextResponse.json({ error: 'Resultados de análises obrigatórios' }, { status: 400 })
  }

  const labText = String(body.lab_text).trim().slice(0, 5000)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico internista e farmacologista clínico a interpretar resultados de análises clínicas para o doente — não para outro médico.

O teu objectivo é: dado um conjunto de resultados de análises, produzir uma interpretação completa, honesta e útil em português europeu (PT-PT) que o doente possa realmente compreender e usar.

Responde APENAS com JSON válido sem markdown:
{
  "patient_summary": "perfil clínico inferido dos resultados em 1 frase (ex: 'Adulto com pré-diabetes, défice de vitamina D e dislipidemia ligeira')",
  "collection_date": "data se encontrada no texto — opcional",
  "overall_status": "TUDO_NORMAL" | "ATENÇÃO" | "CONSULTA_RECOMENDADA" | "CONSULTA_URGENTE",
  "values": [
    {
      "name": "nome do parâmetro em português",
      "value": "valor encontrado",
      "unit": "unidade",
      "reference": "intervalo de referência",
      "status": "NORMAL" | "ALTO" | "BAIXO" | "CRITICO_ALTO" | "CRITICO_BAIXO",
      "interpretation": "o que este valor significa para esta pessoa em linguagem simples — 1-2 frases directas, sem jargão médico",
      "clinical_significance": "BAIXA" | "MEDIA" | "ALTA" | "CRITICA",
      "drug_connection": "se houver medicamentos mencionados que possam explicar o valor — opcional",
      "follow_up": "quando repetir ou o que fazer — opcional"
    }
  ],
  "key_findings": [
    "achado 1 mais importante em linguagem completamente simples — 1 frase directa",
    "achado 2",
    "achado 3"
  ],
  "questions_for_doctor": [
    "Pergunta exacta e específica que o doente deve fazer ao médico na próxima consulta"
  ],
  "lifestyle_suggestions": [
    "Sugestão prática que o doente pode implementar já — dieta, exercício, estilo de vida"
  ],
  "drug_interactions_found": [
    {
      "drug": "medicamento que pode afectar estes resultados",
      "affected_value": "parâmetro afectado",
      "explanation": "explicação clara da relação"
    }
  ],
  "when_to_repeat": "recomendação de quando fazer as próximas análises",
  "reassurance": "se os resultados forem maioritariamente normais, uma mensagem tranquilizadora honesta — opcional"
}

Regras críticas:
- CRITICO_ALTO/CRITICO_BAIXO = requer atenção médica imediata (ex: K+ > 6.5, hemoglobina < 7, glicemia > 500)
- Sê sempre honesto — se algo é preocupante, diz claramente mas sem alarmismo desnecessário
- As interpretações devem ser específicas ao valor, não genéricas ("pode indicar anemia" é mau, "a tua hemoglobina está ligeiramente abaixo do normal, o que pode causar cansaço mais facilmente" é bom)
- key_findings máximo 5, apenas o mais relevante
- questions_for_doctor: perguntas que o médico de família vai achar úteis e específicas, não genéricas
- lifestyle_suggestions: apenas acções concretas e baseadas nos resultados específicos deste doente
- Se não reconheceres um parâmetro, inclui-o com status NORMAL e interpretação "Parâmetro especializado — discute com o teu médico"`,
      },
      {
        role: 'user',
        content: `Interpreta estes resultados de análises clínicas:\n\n${labText}`,
      },
    ], { maxTokens: 3000, temperature: 0.1 })

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Labs error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao interpretar. Tenta novamente.' }, { status: 500 })
  }
}