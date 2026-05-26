import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "Devo ir ao médico?" — orientação simples (NÃO diagnóstico) sobre onde procurar
// cuidados: casa, farmácia, centro de saúde, urgências ou 112.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const complaint = String(body?.complaint || '').trim().slice(0, 600)
  if (!complaint) return NextResponse.json({ error: 'Descreve o que sentes' }, { status: 400 })
  const ctx = String(body?.context || '').trim().slice(0, 300)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um enfermeiro de triagem em Portugal, calmo e claro, a orientar uma pessoa SEM formação médica sobre onde deve procurar ajuda. NÃO fazes diagnóstico. Orientas o nível de cuidado.

Responde APENAS com JSON válido (sem markdown), em português de Portugal:
{
  "level": "112 | urgencias | centro_saude | farmacia | casa",
  "headline": "frase clara e direta sobre o que fazer (ex: 'Liga já 112' ou 'Pode tratar em casa')",
  "why": "porquê, em 1-2 frases simples",
  "red_flags_now": ["sinal que, se aparecer, obriga a ligar 112 imediatamente"],
  "what_to_do": ["passo prático a fazer agora"],
  "timeframe": "em quanto tempo deve agir (ex: 'agora', 'nas próximas horas', 'nos próximos dias')",
  "reassurance": "uma frase tranquilizadora e honesta"
}

Níveis (escolhe o ADEQUADO, com prudência — na dúvida sobe o nível):
- "112": emergência com risco de vida (dor no peito, falta de ar grave, sinais de AVC, perda de consciência, hemorragia grave, reação alérgica grave).
- "urgencias": grave mas sem risco imediato de vida (fratura provável, dor intensa, febre alta persistente em risco, etc.).
- "centro_saude": precisa de ver um profissional mas não é urgente (consulta, persistência de sintomas).
- "farmacia": o farmacêutico pode ajudar / automedicação simples.
- "casa": autocuidado, vigiar.

Regras:
- Em PT, urgências = SU hospitalar; antes disso existe a linha SNS24 (808 24 24 24) — menciona-a no what_to_do quando fizer sentido.
- Sê SEMPRE prudente: se há qualquer hipótese de gravidade, escolhe o nível mais alto.
- Linguagem simples, sem termos técnicos.${ctx ? `\n\nContexto: ${ctx}` : ''}`,
      },
      { role: 'user', content: complaint },
    ], { maxTokens: 900, temperature: 0 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
