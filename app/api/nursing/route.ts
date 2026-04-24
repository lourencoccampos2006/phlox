import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drugs || !body?.via) {
    return NextResponse.json({ error: 'Fármaco(s) e via obrigatórios' }, { status: 400 })
  }

  const drugs: string[] = Array.isArray(body.drugs)
    ? body.drugs.map(String).slice(0, 5)
    : [String(body.drugs)]
  const via: 'IV' | 'SC' | 'IM' = body.via
  const dose = String(body.dose || '').trim().slice(0, 100)
  const isCompatibilityQuery = drugs.length > 1

  if (!['IV', 'SC', 'IM'].includes(via)) {
    return NextResponse.json({ error: 'Via inválida.' }, { status: 400 })
  }

  // Deterministic seed for consistent answers
  const cacheKey = JSON.stringify({ drugs: drugs.map(d => d.toLowerCase()).sort(), via, dose })

  try {
    if (isCompatibilityQuery) {
      // ─── COMPATIBILITY MODE: 2+ drugs same route ─────────────────────────
      const result = await aiJSON<any>([
        {
          role: 'system',
          content: `És um farmacêutico clínico hospitalar especialista em farmacotecnia. Responde SEMPRE em português europeu (PT-PT).

A questão é sobre compatibilidade de ${via === 'IV' ? 'fármacos na mesma linha/cateter IV' : `fármacos administrados pelo mesmo local de injecção ${via}`}.

Responde APENAS com JSON válido sem markdown:
{
  "drugs": ["lista dos fármacos"],
  "via": "${via}",
  "compatible": true | false | "condicional",
  "verdict": "frase directa: compatíveis / incompatíveis / condicionalmente compatíveis nesta via",
  "evidence_source": "fonte da informação (ex: Trissel's, King Guide, ASHP, estudo específico)",
  "physical_compatibility": "compatibilidade física — precipitação, turvação, alteração de cor",
  "chemical_compatibility": "estabilidade química — degradação, interacção",
  "conditions_if_conditional": "condições necessárias se compatibilidade condicional (concentrações, diluentes, tempo) — null se não aplicável",
  "incompatibility_mechanism": "mecanismo da incompatibilidade se existir — null se compatíveis",
  "alternatives": ["alternativa prática se incompatíveis — linha separada, timing diferente, etc"],
  "clinical_notes": ["nota clinicamente relevante para o farmacêutico/enfermeiro sénior — nada básico"],
  "time_window": "se compatíveis, durante quanto tempo e em que condições"
}

REGRAS CRÍTICAS:
- Se incompatíveis por via ${via}: diz claramente e explica o mecanismo
- NÃO incluas passos de técnica de administração — o utilizador é profissional
- NÃO expliques o que é um cateter, como dar uma injecção, ou outros conceitos básicos
- Sê conservador: se a evidência for limitada, diz "dados limitados — contactar farmácia"
- Para SC especificamente: verifica se ambos os fármacos são adequados para perfusão subcutânea contínua (infusão SC) vs bolus SC — são questões distintas`
        },
        {
          role: 'user',
          content: `Compatibilidade via ${via}: ${drugs.join(' + ')}${dose ? ` (${dose})` : ''}`
        }
      ], { maxTokens: 900, temperature: 0.0 })
      return NextResponse.json({ mode: 'compatibility', ...result })

    } else {
      // ─── SINGLE DRUG MODE: clinically relevant info only ─────────────────
      const drug = drugs[0]
      const result = await aiJSON<any>([
        {
          role: 'system',
          content: `És um farmacêutico clínico hospitalar. O utilizador é um enfermeiro ou farmacêutico experiente. Responde SEMPRE em português europeu (PT-PT).

Fornece APENAS a informação clinicamente relevante que um profissional precisa de verificar — não o que já sabe de treino básico.

Responde APENAS com JSON válido sem markdown:
{
  "drug": "nome do fármaco",
  "via": "${via}",
  "suitable_for_via": true | false,
  "unsuitable_reason": "motivo se não adequado — null se adequado",
  "concentration_limits": {
    "min": "concentração mínima se relevante",
    "max": "concentração máxima — CRÍTICO para prevenir flebite/necrose",
    "recommended": "concentração recomendada para esta via"
  },
  "diluents_compatible": ["SF 0.9%", "G5%", etc — apenas os validados, não todos os possíveis],
  "diluents_incompatible": ["diluentes a EVITAR — ex: Ringer Lactato com cefalosporinas"],
  "rate_critical_info": "informação CRÍTICA sobre ritmo — apenas se existir risco de toxicidade por velocidade (ex: vancomicina, fenitoína, potássio). null se não relevante",
  "stability_reconstituted": "estabilidade após reconstituição — temperatura, luz, duração",
  "stability_diluted": "estabilidade após diluição final",
  "incompatible_drugs_common": ["fármacos comuns incompatíveis nesta via — os que aparecem frequentemente juntos"],
  "special_warnings": ["aviso farmacológico relevante para esta via específica — ex: extravasamento, fotossensibilidade, filtro obrigatório"],
  "sc_specific": ${via === 'SC' ? `{
    "max_volume_per_site": "volume máximo por local",
    "suitable_for_csci": true | false,
    "csci_notes": "notas sobre infusão SC contínua (CSCI) se aplicável"
  }` : 'null'},
  "ph_range": "pH da solução — relevante para compatibilidade",
  "osmolarity": "osmolaridade se relevante para via periférica vs central"
}

REGRAS:
- NÃO incluas: técnica de punção, localização de veias, como preencher seringa, higiene das mãos, asepsia — o utilizador já sabe
- NÃO repitas informação da bula que qualquer enfermeiro já conhece
- INCLUI: o que pode correr mal especificamente com este fármaco nesta via
- Para IV: foca em incompatibilidades físico-químicas, concentração máxima, ritmo crítico
- Para SC: foca em volume máximo, adequação CSCI, compatibilidade em seringa driver
- Para IM: foca em volume máximo por local, necessidade técnica Z, profundidade — apenas se relevante clinicamente`
        },
        {
          role: 'user',
          content: `Via ${via}: ${drug}${dose ? ` — dose ${dose}` : ''}`
        }
      ], { maxTokens: 900, temperature: 0.0 })
      return NextResponse.json({ mode: 'single', ...result })
    }

  } catch (err: any) {
    console.error('Nursing error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}