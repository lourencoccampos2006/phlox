// app/api/decisao/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const CASE_DEFINITIONS: Record<string, string> = {
  chf_decompensation: `Cria um caso de descompensação cardíaca aguda. Homem 72 anos, FA paroxística conhecida, IC-FEr (FE 35%) prévia. Recorre à urgência com dispneia em repouso, ortopneia de 3 almofadas, edemas. TA 160/95, FC 110 irregular, FR 28, SpO2 88% AA, apirético. Faz bisoprolol 5mg, furosemida 40mg, ramipril 10mg, varfarina.`,
  sepsis_antibiotics: `Cria um caso de sépsis associada aos cuidados de saúde. Mulher 58 anos, internada há 3 dias por pneumonia, em amoxicilina. Novo pico febril (39.2°C), FC 118, TA 90/60, FR 24, SpO2 93%. Confusa. Cateter venoso periférico 3 dias. Leucocitose 22.000.`,
  dm_ketoacidosis: `Cria um caso de cetoacidose diabética. Mulher 45 anos, DM1, insulina basal-bólus. Últimos 3 dias de vómitos, recusa alimentar, não ajustou insulina. Glicémia 450 mg/dL, cetona urinária 4+, pH 7.21, Bic 12, Na 132 (corrigido 138). TA 100/65, FC 120, mucosas secas.`,
  anticoag_bleeding: `Cria um caso de hemorragia digestiva alta no doente anticoagulado. Homem 68 anos, FA permanente em varfarina 5mg. INR 8.2 colhido hoje. Hematemese de sangue vivo há 1h. TA 95/60, FC 118, Hb 8.2 g/dL, hematócrito 25%.`,
  pneumonia_abx: `Cria um caso de pneumonia sem resposta ao antibiótico. Mulher 55 anos, internada há 3 dias com pneumonia lobar direita, iniciou amoxicilina 1g TID. Sem melhoria: ainda febril (38.8°C), PCR subiu de 180 para 240 mg/L. Culturais de escarro pendentes. Sem alergias conhecidas. Não institutcionalizada, sem antibióticos recentes.`,
  polypharmacy_elderly: `Cria um caso de queda no idoso polimedicado. Homem 84 anos, 11 medicamentos: furosemida 40mg, espironolactona 25mg, ramipril 5mg, bisoprolol 5mg, amlodipina 10mg, sinvastatina 20mg, metformina 500mg BD, alprazolam 0.5mg noite, omeprazol 20mg, ácido acetilsalicílico 100mg, donepezilo 10mg. Queda às 3h da manhã ao ir à casa de banho. Sem traumatismo craniano. TA deitado 130/80, TA em pé 95/60.`,
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 6, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.case_id) return NextResponse.json({ error: 'case_id obrigatório' }, { status: 400 })

  const caseDef = CASE_DEFINITIONS[body.case_id]
  if (!caseDef) return NextResponse.json({ error: 'Caso não encontrado' }, { status: 404 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `Crias casos clínicos dinâmicos para simulação de raciocínio médico em Portugal (PT-PT). Responde APENAS com JSON válido:
{
  "patient": {
    "name": "Nome português realista",
    "age": número,
    "sex": "M"|"F",
    "chief_complaint": "Queixa principal em 1-2 frases como o doente ou familiar diria",
    "background": "Antecedentes e história relevante — o que já se sabe",
    "current_meds": ["medicamento dose frequência"],
    "allergies": ["alergia ou 'NKDA'"],
    "vitals": [
      { "name": "TA", "value": "120/80", "unit": "mmHg", "status": "normal"|"abnormal"|"critical", "trend": "stable"|"up"|"down" }
    ],
    "labs": [
      { "name": "Hb", "value": "12.5", "unit": "g/dL", "status": "normal"|"abnormal"|"critical" }
    ],
    "narrative": "O que está a acontecer AGORA — o doente está à tua frente",
    "severity": "stable"|"worsening"|"critical",
    "time_elapsed": 0,
    "pending_results": ["resultado que está a aguardar"],
    "available_actions": [
      { "id": "id_unico", "label": "Descrição da acção", "category": "exam"|"treatment"|"consult"|"monitor"|"discharge", "consequence_preview": null }
    ]
  }
}

Regras para available_actions:
- Inclui 8-12 acções possíveis, cobrindo todas as categorias
- Algumas acções são correctas, outras são neutras, outras são erradas — mas não indiques qual
- As acções devem ser específicas e clinicamente realistas (ex: "Furosemida 40mg IV", não "dar diurético")
- category "exam" = pedir exames; "treatment" = terapêutica; "consult" = pedir opinião; "monitor" = vigiar; "discharge" = destino do doente
- Inclui sempre pelo menos 1-2 acções que um médico experiente jamais faria neste contexto (para testar)`,
      },
      { role: 'user', content: caseDef },
    ], { maxTokens: 2000, temperature: 0.3 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar caso' }, { status: 500 })
  }
}