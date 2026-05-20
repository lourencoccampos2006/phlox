import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 8, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.context) return NextResponse.json({ error: 'Contexto obrigatório' }, { status: 400 })

  const { noteType, patient, medications, context, findings } = body

  const crCl = patient?.age && patient?.weight && patient?.creatinine && patient?.sex
    ? Math.round(((140 - patient.age) * patient.weight * (patient.sex === 'F' ? 0.85 : 1)) / (72 * patient.creatinine))
    : null

  const typeInstructions: Record<string, string> = {
    soap: 'Gera uma nota SOAP farmacêutica/clínica completa com todos os campos.',
    evolucao: 'Gera uma nota de evolução clínica documentando a progressão do estado do doente.',
    alta: 'Gera uma nota de alta hospitalar com resumo do internamento, medicação de alta e orientações.',
    interconsulta: 'Gera um pedido de interconsulta formal com motivo, dados clínicos e questão clínica específica.',
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico hospitalar a redigir documentação clínica formal. Responde em PT-PT.

${typeInstructions[noteType] || typeInstructions.soap}

Responde APENAS com JSON válido:
{
  "subjective": "queixas e história do doente em 2-4 frases",
  "objective": "dados objectivos: sinais vitais, exames, parâmetros laboratoriais relevantes",
  "assessment": "avaliação farmacêutica/clínica: diagnóstico, problemas identificados, farmacoterapia",
  "plan": "plano de actuação detalhado em tópicos numerados",
  "monitoring": "parâmetros a monitorizar e frequência",
  "follow_up": "próximos passos e follow-up recomendado",
  "pcne_code": "código PCNE P/C/I mais relevante se aplicável (ex: P2/C2/I2.1) ou null"
}

Regras:
- Linguagem clínica formal, terminologia correcta
- Específico para os dados do doente
- Plano concreto e accionável
- Se dados insuficientes, indica o que seria necessário`,
      },
      {
        role: 'user',
        content: `Tipo: ${noteType}

${patient ? `Doente: ${patient.name || 'N/A'}, ${patient.age || '?'} anos, ${patient.sex === 'M' ? 'masculino' : patient.sex === 'F' ? 'feminino' : 'sexo N/A'}
${crCl ? `Função renal: CrCl ${crCl} mL/min` : ''}
${patient.conditions ? `Diagnósticos: ${patient.conditions}` : ''}
${patient.allergies ? `Alergias: ${patient.allergies}` : ''}
${patient.weight ? `Peso: ${patient.weight} kg` : ''}` : 'Doente: não especificado'}

${medications?.length > 0 ? `Medicação:\n${medications.map((m: any) => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n')}` : ''}

Contexto/Motivo: ${context}

${findings ? `Achados/Dados objectivos: ${findings}` : ''}`,
      },
    ], { maxTokens: 1800, temperature: 0.2 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
