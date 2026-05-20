import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico especialista em aconselhamento ao doente. Crias folhas de informação ao doente (Patient Counseling Sheets) em português de Portugal.

A linguagem deve ser SIMPLES, clara, sem jargão médico. Escrita para o doente leigo.
Máximo 3 linhas por ponto. Direto e prático.

Responde APENAS com JSON válido:
{
  "drug_name": "nome do medicamento (DCI + nome comercial se relevante)",
  "drug_class": "classe terapêutica",
  "indication": "para que serve — em linguagem simples (1-2 frases)",
  "how_to_take": {
    "dose": "dose e frequência em linguagem simples",
    "timing": "quando tomar (em jejum, com refeição, à noite, etc.)",
    "duration": "durante quanto tempo",
    "missed_dose": "o que fazer se se esquecer"
  },
  "important_notes": ["nota importante 1", "nota importante 2", "nota importante 3"],
  "food_interactions": ["interação alimentar 1"],
  "side_effects": {
    "common": ["efeito secundário comum 1 (o que sentir e quando é normal)"],
    "call_doctor": ["quando ligar ao médico/farmacêutico"]
  },
  "storage": "como guardar",
  "special_populations": {
    "elderly": "precauções em idosos (null se não aplicável)",
    "renal": "precauções em insuficiência renal (null se não aplicável)",
    "pregnancy": "segurança na gravidez/amamentação"
  },
  "monitoring": ["o que vigiar (sintoma, análise, etc.)"],
  "interactions_alert": ["medicamento ou suplemento a evitar"],
  "patient_tips": ["dica prática para ajudar na adesão"]
}`,
      },
      {
        role: 'user',
        content: `Criar folha de aconselhamento para: ${body.drug}
${body.indication ? `Indicação neste doente: ${body.indication}` : ''}
${body.age ? `Idade do doente: ${body.age} anos` : ''}
${body.conditions ? `Condições do doente: ${body.conditions}` : ''}
${body.otherMeds ? `Outros medicamentos: ${body.otherMeds}` : ''}
${body.language_level ? `Nível de literacia: ${body.language_level}` : ''}`,
      },
    ], { maxTokens: 2000, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar folha de aconselhamento.' }, { status: 500 })
  }
}
