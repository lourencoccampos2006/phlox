import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Nome do fármaco obrigatório' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico especialista. Responde em PT-PT com terminologia correcta.

Fornece informação farmacológica completa e clinicamente relevante baseada em guidelines actuais (EMA, INFARMED, UpToDate, Micromedex).

Responde APENAS com JSON válido:
{
  "name_dci": "nome DCI oficial",
  "name_brand": ["nomes comerciais disponíveis em Portugal"],
  "class": "classe farmacológica",
  "mechanism": "mecanismo de acção detalhado (2-3 frases)",
  "indications": ["indicação 1", "indicação 2"],
  "contraindications": ["contraindicação 1", "contraindicação 2"],
  "interactions": [
    {
      "drug": "nome do fármaco que interage",
      "severity": "grave" | "moderada" | "leve",
      "description": "mecanismo e consequência clínica"
    }
  ],
  "dose_adult": "posologia standard no adulto com todas as indicações",
  "dose_renal": [
    { "stage": "CrCl 30-60 mL/min", "adjustment": "ajuste específico" },
    { "stage": "CrCl 15-30 mL/min", "adjustment": "ajuste específico" },
    { "stage": "CrCl < 15 mL/min", "adjustment": "ajuste ou evitar" }
  ],
  "dose_hepatic": "ajuste em insuficiência hepática ou 'Sem ajuste necessário'",
  "monitoring": ["parâmetro 1", "parâmetro 2"],
  "adverse_effects": [
    { "effect": "nome da RAM", "frequency": "muito frequente/frequente/pouco frequente/raro", "severity": "grave/moderada/leve" }
  ],
  "pregnancy": "categoria e recomendações para gravidez e lactação",
  "notes": "notas clínicas importantes (interacções específicas, particularidades de uso)",
  "references": "SmPC INFARMED, EMA, UpToDate"
}

Máximo 6 interações (só as mais clinicamente relevantes). Máximo 10 RAM. Baseado em evidência.`,
      },
      {
        role: 'user',
        content: `Fármaco: ${body.drug}`,
      },
    ], { maxTokens: 2500, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Fármaco não encontrado ou erro. Tenta novamente.' }, { status: 500 })
  }
}
