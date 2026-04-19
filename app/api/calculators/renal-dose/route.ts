import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const cache = new Map<string, { result: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug || !body?.egfr) {
    return NextResponse.json({ error: 'Medicamento e TFG obrigatórios' }, { status: 400 })
  }

  const drug = String(body.drug).trim().slice(0, 100)
  const egfr = parseFloat(body.egfr)

  if (isNaN(egfr) || egfr < 0 || egfr > 200) {
    return NextResponse.json({ error: 'TFG inválida (0–200 mL/min)' }, { status: 400 })
  }

  const cacheKey = `${drug.toLowerCase()}:${Math.round(egfr / 5) * 5}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ recommendation: cached.result })
  }

  const stage =
    egfr >= 60 ? 'normal ou ligeiramente reduzida (TFG >= 60 mL/min)' :
    egfr >= 30 ? 'moderadamente reduzida (TFG 30-59 mL/min, DRC G3)' :
    egfr >= 15 ? 'gravemente reduzida (TFG 15-29 mL/min, DRC G4)' :
                 'falência renal / diálise (TFG < 15 mL/min, DRC G5)'

  try {
    const aiResult = await aiComplete([
      {
        role: 'system',
        content: 'És um farmacologista clínico especializado em ajuste de dose em insuficiência renal. Responde em português europeu (PT-PT), de forma concisa e clínica. Baseia-te em fontes como SmPC, Micromedex, UpToDate e guidelines renais (KDIGO). Estrutura a resposta em 3 partes: 1. DOSE HABITUAL: dose standard em adulto com função renal normal. 2. AJUSTE RECOMENDADO: dose/intervalo recomendado para a função renal indicada. 3. OBSERVAÇÕES: monitorização necessária, contraindicações absolutas ou alternativas. Sê específico com doses e intervalos.',
      },
      {
        role: 'user',
        content: `Ajuste de dose de ${drug} para doente com função renal ${stage} (TFG/ClCr = ${egfr} mL/min).`,
      },
    ], { maxTokens: 500, temperature: 0.1 })

    const recommendation = aiResult.text.trim() || 'Sem informação disponível.'
    cache.set(cacheKey, { result: recommendation, timestamp: Date.now() })
    return NextResponse.json({ recommendation })

  } catch (err: any) {
    console.error('Renal dose error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao consultar. Tenta novamente.' }, { status: 500 })
  }
}