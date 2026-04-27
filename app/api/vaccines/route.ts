import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.profile) return NextResponse.json({ error: 'Perfil obrigatório' }, { status: 400 })

  const profile = String(body.profile).trim()
  const destination = String(body.destination || '').trim()
  const own_vaccines = String(body.own_vaccines || '').trim()

  const PROFILE_LABELS: Record<string, string> = {
    adult: 'Adulto saudável (18-64 anos)',
    elderly: 'Idoso (>65 anos)',
    child: 'Criança / adolescente',
    pregnancy: 'Grávida',
    immunocompromised: 'Imunodeprimido / doença crónica',
    traveler: destination ? `Viajante para ${destination}` : 'Viajante internacional',
    healthcare: 'Profissional de saúde',
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico especialista em medicina preventiva e vacinologia em Portugal. Responde em português europeu (PT-PT).

Dado um perfil de utilizador, fornece as recomendações de vacinação baseadas no Programa Nacional de Vacinação (PNV) português e guidelines ECDC.

Responde APENAS com JSON válido sem markdown:
{
  "profile": "descrição do perfil",
  "up_to_date": [
    {
      "vaccine": "nome da vacina",
      "status": "descrição breve do calendário (ex: 'Reforço de 10 em 10 anos')"
    }
  ],
  "due_now": [
    {
      "vaccine": "nome da vacina",
      "why": "porquê é recomendada para este perfil agora",
      "urgency": "alta" | "normal" | "baixa"
    }
  ],
  ${destination ? `"travel_specific": {
    "destination": "${destination}",
    "vaccines": ["lista de vacinas recomendadas para este destino"]
  },` : '"travel_specific": null,'}
  "general_advice": "conselho geral sobre vacinação para este perfil"
}

Regras:
- Baseia-te no PNV português actualizado e guidelines ECDC
- up_to_date: vacinas que fazem parte do calendário regular
- due_now: vacinas em falta ou atrasadas para este perfil específico
- Para idosos: incluir gripe, pneumococo, herpes zoster, tétano
- Para grávidas: vacinas seguras na gravidez (Tdap, gripe), NUNCA vacinas vivas
- Para imunodeprimidos: sem vacinas vivas, reforços específicos
- Para profissionais de saúde: hepatite B, gripe anual, varicela
- urgency "alta" = vacina recomendada e provavelmente em atraso para este perfil`,
      },
      {
        role: 'user',
        content: `Perfil: ${PROFILE_LABELS[profile] || profile}${destination ? `. Destino de viagem: ${destination}` : ''}${own_vaccines ? `\n\nVacinas já tomadas pelo utilizador: ${own_vaccines}` : ''}. Tem em conta as vacinas que o utilizador já tomou ao fazer as recomendações.`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}