import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

function makeSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7)
  return null
}

interface DailyBrief {
  greeting: string
  status_line: string
  health_score: number
  health_score_label: string
  insights: { icon: string; text: string; type: 'positive' | 'warning' | 'info' | 'tip' }[]
  today_focus: string
  encouragement: string
  generated_at: string
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip, 5, 60_000).allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const supabase = makeSupabase(token)
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [
      { data: profile },
      { data: meds },
      { data: vitals },
      { data: logs },
      { data: goals },
    ] = await Promise.all([
      supabase.from('profiles').select('name, plan').eq('id', userId).single(),
      supabase.from('personal_meds').select('name,dose,frequency,reminder_times').eq('user_id', userId),
      supabase.from('vitals').select('hr,bp_sys,bp_dia,spo2,weight,glucose,temp,recorded_at').eq('user_id', userId).gte('recorded_at', sevenDaysAgo).order('recorded_at', { ascending: false }).limit(10),
      supabase.from('med_logs').select('med_id,date,status').eq('user_id', userId).gte('date', today).eq('status', 'taken'),
      supabase.from('personal_meds').select('id,reminder_times').eq('user_id', userId).not('reminder_times', 'is', null),
    ])

    const firstName = (profile?.name || '').split(' ')[0] || 'Utilizador'
    const medsList = (meds || []) as { name: string; dose?: string; frequency?: string; reminder_times?: string[] }[]
    const vitalsList = (vitals || []) as { hr?: number; bp_sys?: number; bp_dia?: number; spo2?: number; weight?: number; glucose?: number; temp?: number; recorded_at: string }[]
    const takenToday = (logs || []).length
    const goalsData = (goals || []) as { id: string; reminder_times?: string[] }[]

    // Calculate total slots today
    const totalSlotsToday = goalsData.reduce((n, m) => n + (m.reminder_times?.length || 0), 0)
    const adherencePct = totalSlotsToday > 0 ? Math.round(takenToday / totalSlotsToday * 100) : null

    // Most recent vitals
    const latestVitals = vitalsList[0] || null

    // Build context for AI
    const hourNow = new Date().getHours()
    const timeOfDay = hourNow < 12 ? 'manhã' : hourNow < 18 ? 'tarde' : 'noite'

    const contextLines = [
      `Hora do dia: ${timeOfDay} (${hourNow}h)`,
      `Medicamentos registados: ${medsList.length > 0 ? medsList.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ') : 'nenhum'}`,
      adherencePct !== null ? `Adesão hoje: ${adherencePct}% (${takenToday}/${totalSlotsToday} doses tomadas)` : 'Adesão: sem dados de tomas hoje',
      latestVitals ? [
        latestVitals.bp_sys && latestVitals.bp_dia ? `Tensão arterial mais recente: ${latestVitals.bp_sys}/${latestVitals.bp_dia} mmHg` : '',
        latestVitals.hr ? `Frequência cardíaca: ${latestVitals.hr} bpm` : '',
        latestVitals.spo2 ? `SpO2: ${latestVitals.spo2}%` : '',
        latestVitals.glucose ? `Glicemia: ${latestVitals.glucose} mg/dL` : '',
      ].filter(Boolean).join(', ') : 'Sem sinais vitais registados esta semana',
    ].filter(Boolean).join('\n')

    const brief = await aiJSON<DailyBrief>(
      [
        {
          role: 'system',
          content: `És o Phlox, um assistente de saúde pessoal inteligente e empático.
Geras um briefing diário personalizado para o utilizador, em português de Portugal.
Tom: caloroso, direto, encorajador. Linguagem simples (não clínica).
Máximo 3 insights. Cada insight deve ser prático e acionável.

Responde EXCLUSIVAMENTE com JSON no seguinte formato:
{
  "greeting": "string — saudação personalizada com o nome, ex: 'Bom dia, [nome]! 👋'",
  "status_line": "string — uma linha resumindo o estado de saúde, ex: 'A tua semana de saúde está no bom caminho.'",
  "health_score": number — 1-10 (baseado em aderência e vitais),
  "health_score_label": "string — ex: 'Muito Bem', 'Atenção', 'Excelente'",
  "insights": [
    { "icon": "emoji", "text": "string — insight específico baseado nos dados", "type": "positive|warning|info|tip" }
  ],
  "today_focus": "string — uma coisa concreta para fazer hoje",
  "encouragement": "string — frase motivacional curta e genuína",
  "generated_at": "${new Date().toISOString()}"
}`,
        },
        {
          role: 'user',
          content: `Nome do utilizador: ${firstName}\n\nDados de saúde de hoje:\n${contextLines}\n\nGera o briefing diário personalizado.`,
        },
      ],
      { maxTokens: 600, temperature: 0.3 }
    )

    return NextResponse.json({ ...brief, first_name: firstName })
  } catch (err: any) {
    console.error('daily-brief error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar briefing' }, { status: 500 })
  }
}
