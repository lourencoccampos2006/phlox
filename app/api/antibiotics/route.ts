import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.site) return NextResponse.json({ error: 'Local de infecção obrigatório' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um infectologista e farmacêutico clínico especialista em antibioterapia. Baseias as tuas recomendações em:
- ESCMID/EUCAST guidelines 2024
- IDSA Infectious Disease Guidelines
- DGS Portugal — Programa Nacional de Prevenção das Resistências aos Antimicrobianos (PPCIRA)
- UpToDate Antimicrobial Therapy
- Antibiograma local europeu (EARS-Net)

Responde APENAS com JSON válido:
{
  "site": "local de infecção",
  "likely_pathogens": ["lista dos agentes mais prováveis"],
  "empirical_first_line": {
    "regimen": "fármaco(s) + doses + via + intervalo",
    "rationale": "justificação",
    "allergies_note": "alternativa se alergia à penicilina"
  },
  "empirical_second_line": {
    "regimen": "alternativa",
    "rationale": "quando usar"
  },
  "mrsa_coverage": {
    "needed": true/false,
    "risk_factors": ["fatores de risco para MRSA"],
    "add_on": "fármaco a adicionar se MRSA suspeito",
    "dose": "dose específica"
  },
  "esbl_pseudomonas_coverage": {
    "needed": true/false,
    "risk_factors": ["fatores de risco"],
    "regimen": "antibiótico de largo espectro"
  },
  "iv_to_oral": {
    "eligible_criteria": ["critérios para step-down IV→oral"],
    "oral_regimen": "antibiótico oral de substituição"
  },
  "duration": {
    "standard": "duração standard (ex: 5-7 dias)",
    "extended": "quando prolongar e por quanto tempo",
    "stop_criteria": ["critérios para parar antibiótico"]
  },
  "renal_adjustment": [
    { "drug": "nome do fármaco", "gfr_below": número, "adjustment": "ajuste de dose específico" }
  ],
  "monitoring": ["parâmetro 1", "parâmetro 2"],
  "de_escalation": "quando e como fazer de-escalonamento após culturas",
  "stewardship_notes": "notas de stewardship (duração mínima, revisão 48-72h, etc.)"
}

Ser específico com doses (mg/dia, intervalos, vias). Incluir ajuste renal para todos os antibióticos propostos.
Priorizar antibióticos de espectro mais estreito (princípio de stewardship).`,
      },
      {
        role: 'user',
        content: `Pedido de orientação de antibioterapia:

Local de infecção: ${body.site}
Gravidade: ${body.severity || 'moderada'}
${body.age ? `Idade: ${body.age} anos` : ''}
${body.weight ? `Peso: ${body.weight} kg` : ''}
${body.creatinine ? `Creatinina: ${body.creatinine} mg/dL (TFG estimada necessária)` : ''}
${body.allergies ? `Alergias: ${body.allergies}` : 'Sem alergias conhecidas'}
${body.risk_mrsa ? `Fatores de risco MRSA: ${body.risk_mrsa}` : ''}
${body.risk_esbl ? `Fatores de risco ESBL/Pseudomonas: ${body.risk_esbl}` : ''}
${body.prior_antibiotics ? `Antibioterapia prévia: ${body.prior_antibiotics}` : ''}
${body.culture_result ? `Resultado de cultura: ${body.culture_result}` : ''}
${body.context ? `Contexto adicional: ${body.context}` : ''}`,
      },
    ], { maxTokens: 2500, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar recomendação.' }, { status: 500 })
  }
}
