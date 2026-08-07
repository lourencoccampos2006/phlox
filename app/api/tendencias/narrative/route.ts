// app/api/tendencias/narrative/route.ts
// "Mais inteligência" pedido na auditoria de /tendencias: traduz os sinais JÁ
// CALCULADOS (lib/trendSignals.ts) para um parágrafo em português corrido, em
// vez de só números e setas. Segurança: a IA só recebe os FLAGS/MÉTRICAS já
// computados (nunca dados clínicos em bruto) — não pode inventar um sinal que
// o motor não tenha calculado, só pode reformular o que já lá está.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    name?: string
    flags?: { title: string; detail: string; severity: string }[]
    metrics?: { label: string; declining: boolean; recentAvg: number | null; baselineAvg: number | null; unit: string }[]
    hasEnoughData?: boolean
  } | null
  if (!body || !body.name) return NextResponse.json({ error: 'dados em falta' }, { status: 400 })

  if (!body.hasEnoughData || !body.flags?.length) {
    return NextResponse.json({ narrative: `${body.name} não tem sinais a vigiar nas últimas semanas, com os dados registados até agora.` })
  }

  try {
    const out = await aiJSON<{ narrative: string }>([
      {
        role: 'system',
        content: `Escreves um resumo curto em PT-PT (2-4 frases) para a equipa de um lar/centro de dia, a partir de sinais de tendência JÁ CALCULADOS sobre um residente. REGRA ABSOLUTA: usa APENAS os factos na lista abaixo — nunca inventes números, causas, diagnósticos ou sugestões que não estejam lá. Tom profissional, claro, sem alarmismo desnecessário mas honesto sobre o que precisa de atenção. Não sugiras tratamento nem faças diagnóstico.
Responde EXCLUSIVAMENTE em JSON: {"narrative": "..."}`,
      },
      {
        role: 'user',
        content: `Residente: ${body.name}\nSinais calculados:\n${(body.flags || []).map(f => `- ${f.title}: ${f.detail}`).join('\n')}`,
      },
    ], { maxTokens: 300, temperature: 0.3 })
    return NextResponse.json({ narrative: out.narrative })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível gerar agora.' }, { status: 500 })
  }
}
