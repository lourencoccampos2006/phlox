import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "Estou em dia com a minha saúde?" — plano de vacinas e rastreios recomendados
// por idade/sexo/contexto, segundo as orientações da DGS (Portugal).

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const age = parseInt(String(body?.age || '')) || 0
  if (!age || age < 0 || age > 120) return NextResponse.json({ error: 'Idade inválida' }, { status: 400 })
  const sex = String(body?.sex || '').trim().slice(0, 20)
  const conditions = String(body?.conditions || '').trim().slice(0, 300)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico de família em Portugal. Dás a uma pessoa o resumo dos RASTREIOS e VACINAS recomendados para ela, segundo as orientações da DGS (Programa Nacional de Vacinação e rastreios oncológicos), em linguagem simples.

Responde APENAS com JSON válido (sem markdown), PT-PT:
{
  "profile": "resumo curto (ex: 'Mulher, 52 anos')",
  "screenings": [
    { "name": "rastreio (ex: 'Rastreio do cancro da mama — mamografia')", "why": "porquê, simples", "frequency": "periodicidade (ex: 'de 2 em 2 anos')", "priority": "alta | media | informativa" }
  ],
  "vaccines": [
    { "name": "vacina (ex: 'Gripe sazonal')", "why": "porquê", "frequency": "ex: 'todos os anos no outono'", "priority": "alta | media | informativa" }
  ],
  "lifestyle": ["recomendação prática de prevenção adequada à idade/perfil"],
  "note": "1 frase: isto é orientação geral, falar com o médico de família para o plano individual"
}

Regras:
- Adequa ESTRITAMENTE à idade e sexo (ex: rastreio do colo do útero 25-60, mama 50-69, cólon 50-74, próstata conforme idade/risco).
- Inclui vacinas relevantes para a idade (gripe e pneumocócica em idosos, reforços tétano/difteria a cada 10 anos, herpes zóster ≥50, COVID conforme orientação).
- Se houver condições (diabetes, doença respiratória, etc.) adapta (ex: gripe e pneumocócica passam a recomendadas).
- Prioridade "alta" só para o que é claramente recomendado para este perfil agora.
- Linguagem simples, encorajadora, sem alarmismo.${conditions ? `\n\nCondições: ${conditions}` : ''}`,
      },
      { role: 'user', content: `Idade: ${age}. Sexo: ${sex || 'não indicado'}.` },
    ], { maxTokens: 1200, temperature: 0 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
