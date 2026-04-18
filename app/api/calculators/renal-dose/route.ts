import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, { result: string; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

export async function POST(req: NextRequest) {
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

  // Classifica o estadio renal para o prompt
  const stage =
    egfr >= 60 ? 'normal ou ligeiramente reduzida (TFG ≥ 60 mL/min)' :
    egfr >= 30 ? 'moderadamente reduzida (TFG 30–59 mL/min, DRC G3)' :
    egfr >= 15 ? 'gravemente reduzida (TFG 15–29 mL/min, DRC G4)' :
                 'falência renal / diálise (TFG < 15 mL/min, DRC G5)'

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um farmacologista clínico especializado em ajuste de dose em insuficiência renal.
Responde em português europeu (PT-PT), de forma concisa e clínica.
Baseia-te em fontes como SmPC, Micromedex, UpToDate e guidelines renais (KDIGO).
Estrutura a resposta em 3 partes:
1. DOSE HABITUAL: dose standard em adulto com função renal normal
2. AJUSTE RECOMENDADO: dose/intervalo recomendado para a função renal indicada
3. OBSERVAÇÕES: monitorização necessária, contraindicações absolutas ou alternativas se aplicável
Sê específico com doses e intervalos. Não uses disclaimers excessivos — o utilizador é um profissional de saúde.`
        },
        {
          role: 'user',
          content: `Ajuste de dose de ${drug} para doente com função renal ${stage} (TFG/ClCr = ${egfr} mL/min).`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const recommendation = completion.choices[0]?.message?.content?.trim() || 'Sem informação disponível.'
    cache.set(cacheKey, { result: recommendation, timestamp: Date.now() })
    return NextResponse.json({ recommendation })

  } catch (err: any) {
    console.error('Renal dose error:', err?.message)
    return NextResponse.json({ error: 'Erro ao consultar. Tenta novamente.' }, { status: 500 })
  }
}