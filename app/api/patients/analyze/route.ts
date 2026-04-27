import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.medications || body.medications.length < 2) {
    return NextResponse.json({ error: 'Mínimo 2 medicamentos' }, { status: 400 })
  }

  const { patient, medications } = body

  const crCl = patient?.age && patient?.weight && patient?.creatinine && patient?.sex
    ? Math.round(((140 - patient.age) * patient.weight * (patient.sex === 'F' ? 0.85 : 1)) / (72 * patient.creatinine))
    : null

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico hospitalar especialista em revisão de medicação. Responde em PT-PT.

Analisa o perfil farmacológico completo do doente e identifica alertas clinicamente relevantes.

Responde APENAS com JSON válido sem markdown:
{
  "alerts": [
    {
      "type": "interaction" | "dose" | "beers" | "monitoring",
      "severity": "grave" | "moderada" | "info",
      "message": "descrição clara do problema — específica para esta medicação e doente",
      "action": "acção recomendada — concreta e accionável"
    }
  ],
  "summary": "resumo do perfil farmacológico em 1-2 frases"
}

Tipos de alerta:
- interaction: interação medicamentosa
- dose: dose inadequada (especialmente para função renal)
- beers: critérios Beers (medicamentos potencialmente inadequados em idosos)
- monitoring: parâmetro que precisa de monitorização laboratorial

Regras:
- Sê conservador mas rigoroso — reporta só o que tem evidência real
- Para graves: interações com risco real de vida, doses claramente erradas para o CrCl
- Para moderadas: interações que requerem monitorização, ajustes de dose recomendados
- Para info: monitorização laboratorial recomendada, critérios Beers em idosos
- Máximo 6 alertas — só os mais relevantes
- Se não há problemas reais, alerts: []`,
      },
      {
        role: 'user',
        content: `Doente: ${patient?.name || 'N/A'}, ${patient?.age || 'idade desconhecida'} anos, ${patient?.sex === 'M' ? 'masculino' : patient?.sex === 'F' ? 'feminino' : 'sexo desconhecido'}
${crCl ? `Função renal: CrCl ${crCl} mL/min (Cockroft-Gault)` : ''}
${patient?.conditions ? `Diagnósticos: ${patient.conditions}` : ''}
${patient?.allergies ? `Alergias: ${patient.allergies}` : ''}

Medicação actual:
${medications.map((m: any) => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}${m.indication ? ` (${m.indication})` : ''}`).join('\n')}`,
      },
    ], { maxTokens: 1500, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}