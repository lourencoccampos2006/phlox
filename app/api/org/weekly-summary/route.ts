// app/api/org/weekly-summary/route.ts
// "Resumo em palavras" para o dono, em /painel-dono — mesmo padrão já usado em
// /tendencias (app/api/tendencias/narrative/route.ts): a IA só recebe FACTOS
// JÁ CALCULADOS no servidor (lib/workLedger.ts buildLedger + byStaff de
// /api/org/audit) — nunca dados clínicos em bruto, nunca inventa um número
// que não esteja na lista. Só reformula em prosa o que já está correto.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    orgName?: string
    periodLabel?: string
    lines?: { value: string; label: string }[]
    byStaff?: Record<string, number>
    incidentsOpen?: number
    incidentsGrave?: number
  } | null
  if (!body || !body.periodLabel) return NextResponse.json({ error: 'dados em falta' }, { status: 400 })

  if (!body.lines?.length) {
    return NextResponse.json({ narrative: `Ainda sem registos suficientes em ${body.periodLabel} para um resumo — à medida que a equipa regista, este resumo enche-se.` })
  }

  const staffLines = Object.entries(body.byStaff || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, n]) => `- ${name}: ${n} registo${n === 1 ? '' : 's'}`).join('\n')

  try {
    const out = await aiJSON<{ narrative: string }>([
      {
        role: 'system',
        content: `Escreves um resumo curto em PT-PT (3-5 frases) para o DONO de um lar/centro de dia, a partir de factos JÁ CALCULADOS sobre a atividade da instituição num período. REGRA ABSOLUTA: usa APENAS os factos fornecidos — nunca inventes números, causas ou conclusões que não estejam na lista. Tom direto e profissional, como um relatório de gestão, não uma avaliação clínica. Se houver ocorrências graves em aberto, menciona isso primeiro e com destaque. Nunca sugere diagnóstico nem tratamento.
Responde EXCLUSIVAMENTE em JSON: {"narrative": "..."}`,
      },
      {
        role: 'user',
        content: `Instituição: ${body.orgName || 'a instituição'}\nPeríodo: ${body.periodLabel}\nFactos:\n${body.lines.map(l => `- ${l.value} ${l.label}`).join('\n')}${body.incidentsOpen ? `\n- ${body.incidentsOpen} ocorrência(s) em aberto${body.incidentsGrave ? `, ${body.incidentsGrave} grave(s)` : ''}` : ''}${staffLines ? `\nAtividade por funcionário:\n${staffLines}` : ''}`,
      },
    ], { maxTokens: 400, temperature: 0.3 })
    return NextResponse.json({ narrative: out.narrative })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível gerar agora.' }, { status: 500 })
  }
}
