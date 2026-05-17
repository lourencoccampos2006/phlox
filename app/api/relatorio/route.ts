import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

function makeSupabase(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 3, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = makeSupabase(req)

  // Fetch all relevant data
  const [{ data: meds }, { data: vitals }, { data: logs }] = await Promise.all([
    supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', userId),
    supabase.from('vitals').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }).limit(30),
    supabase.from('med_logs').select('*').eq('user_id', userId).gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]).order('date', { ascending: false }),
  ])

  const medList = (meds || []).map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`).join(', ') || 'Nenhum medicamento registado'

  const vitalsSummary = vitals?.length
    ? vitals.slice(0, 7).map(v => {
        const parts = []
        if (v.bp_sys && v.bp_dia) parts.push(`TA ${v.bp_sys}/${v.bp_dia}`)
        if (v.hr) parts.push(`FC ${v.hr}bpm`)
        if (v.weight) parts.push(`Peso ${v.weight}kg`)
        if (v.glucose) parts.push(`Glicemia ${v.glucose}mg/dL`)
        if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`)
        return `${new Date(v.recorded_at).toLocaleDateString('pt-PT')}: ${parts.join(', ')}`
      }).join('\n')
    : 'Nenhum registo de sinais vitais'

  const totalDoses = (logs || []).length
  const takenDoses = (logs || []).filter((l: any) => l.status === 'taken').length
  const adherence = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : null

  const prompt = `És um farmacêutico clínico a gerar o relatório semanal de saúde de um utente.

MEDICAÇÃO: ${medList}
SINAIS VITAIS (últimos 7 dias):
${vitalsSummary}
ADESÃO À MEDICAÇÃO: ${adherence != null ? `${adherence}% (${takenDoses}/${totalDoses} doses tomadas)` : 'Sem dados'}

Gera um relatório semanal claro, útil e personalizado em JSON:
{
  "title": "Relatório Semanal de Saúde",
  "period": "semana de dd/MM a dd/MM",
  "overall_score": 1-10,
  "overall_label": "Ex: Boa semana · Semana estável · Atenção necessária",
  "highlights": [
    { "type": "positive" | "warning" | "info", "text": "ponto relevante" }
  ],
  "vitals_analysis": "análise dos sinais vitais da semana (2-3 frases, linguagem simples)",
  "adherence_comment": "comentário sobre a adesão (1-2 frases)",
  "trends": [
    { "metric": "ex: Tensão arterial", "trend": "subiu" | "desceu" | "estável" | "sem dados", "comment": "detalhe curto" }
  ],
  "recommendations": [
    { "priority": "urgente" | "importante" | "sugestão", "action": "ação concreta recomendada" }
  ],
  "next_steps": "o que focar na próxima semana (1-2 frases)",
  "disclaimer": "nota que este relatório é informativo e não substitui consulta médica"
}

Responde APENAS JSON. Usa linguagem simples e positiva. Se os dados são escassos, diz isso honestamente.`

  try {
    const result = await aiJSON<any>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1500 }
    )

    return NextResponse.json({
      title: String(result?.title || 'Relatório Semanal de Saúde').slice(0, 100),
      period: String(result?.period || '').slice(0, 60),
      overall_score: typeof result?.overall_score === 'number' ? Math.min(10, Math.max(1, result.overall_score)) : 5,
      overall_label: String(result?.overall_label || '').slice(0, 60),
      highlights: Array.isArray(result?.highlights) ? result.highlights.slice(0, 6).map((h: any) => ({
        type: ['positive', 'warning', 'info'].includes(h.type) ? h.type : 'info',
        text: String(h.text || '').slice(0, 200),
      })) : [],
      vitals_analysis: String(result?.vitals_analysis || '').slice(0, 500),
      adherence_comment: String(result?.adherence_comment || '').slice(0, 300),
      trends: Array.isArray(result?.trends) ? result.trends.slice(0, 6).map((t: any) => ({
        metric: String(t.metric || '').slice(0, 50),
        trend: ['subiu', 'desceu', 'estável', 'sem dados'].includes(t.trend) ? t.trend : 'sem dados',
        comment: String(t.comment || '').slice(0, 100),
      })) : [],
      recommendations: Array.isArray(result?.recommendations) ? result.recommendations.slice(0, 5).map((r: any) => ({
        priority: ['urgente', 'importante', 'sugestão'].includes(r.priority) ? r.priority : 'sugestão',
        action: String(r.action || '').slice(0, 200),
      })) : [],
      next_steps: String(result?.next_steps || '').slice(0, 400),
      disclaimer: String(result?.disclaimer || 'Este relatório é informativo e não substitui a avaliação de um profissional de saúde.').slice(0, 300),
      generated_at: new Date().toISOString(),
      raw_data: { adherence, total_meds: meds?.length || 0, vitals_count: vitals?.length || 0 },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao gerar relatório' }, { status: 500 })
  }
}
