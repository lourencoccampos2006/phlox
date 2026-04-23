import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug || !body?.via) {
    return NextResponse.json({ error: 'Medicamento e via obrigatórios' }, { status: 400 })
  }

  const drug = String(body.drug).trim().slice(0, 100)
  const via: 'IV' | 'SC' | 'IM' = body.via
  const dose = String(body.dose || '').trim().slice(0, 50)

  if (!['IV', 'SC', 'IM'].includes(via)) {
    return NextResponse.json({ error: 'Via inválida. Use IV, SC ou IM.' }, { status: 400 })
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico hospitalar especialista em farmacotecnia e administração de medicamentos. Responde em português europeu (PT-PT).

Dado um medicamento e uma via de administração, fornece o protocolo clínico completo para administração.

Responde APENAS com JSON válido sem markdown:
{
  "drug": "nome do medicamento conforme pedido",
  "via": "${via}",
  "compatible": true | false,
  "preparation": "instruções de preparação detalhadas — diluente, volume, ordem de adição",
  "concentration": "concentração final (ex: '1mg/mL', '5mg/50mL') — null se não aplicável",
  "volume_max": "volume máximo por administração/local — null se não aplicável",
  "rate": "ritmo de administração (ex: 'infundir em 60 min', 'bolus lento 5 min') — null se SC/IM simples",
  "sites": ["locais de injecção para SC/IM — null para IV"],
  "technique": [
    "Passo 1: ...",
    "Passo 2: ...",
    "..." 
  ],
  "stability": "estabilidade após reconstituição/abertura — temperatura, luz, duração",
  "contraindications": ["contraindicações específicas desta via para este fármaco"],
  "monitoring": ["parâmetro a monitorizar após administração"],
  "special_notes": ["notas clínicas importantes que um enfermeiro não pode ignorar"],
  "alternatives": "alternativa de via se esta for contraindicada — null se não aplicável"
}

Regras:
- Se o fármaco não pode ser dado por ${via}: compatible: false, explica porquê em preparation e indica alternativa
- Sê específico sobre: diluentes compatíveis (SF, G5%, água ppi), concentrações máximas, ritmos de perfusão
- Para SC: menciona rotação de locais, ângulo (45-90°), volume máximo por local (geralmente 1-2mL)
- Para IM: menciona músculo preferencial (deltoide, vasto externo, glúteo), ângulo 90°, técnica Z se necessário
- Para IV bolus: velocidade máxima, necessidade de filtro, incompatibilidades comuns
- Inclui sempre: o que observar no doente nos primeiros 15-30 min
- Usa linguagem técnica mas clara — destinada a enfermeiros`,
      },
      {
        role: 'user',
        content: `Guia de administração ${via} para: ${drug}${dose ? ` (dose: ${dose})` : ''}`,
      },
    ], { maxTokens: 1500, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Nursing error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}