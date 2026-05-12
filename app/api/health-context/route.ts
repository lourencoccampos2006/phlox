// app/api/health-context/route.ts
// Motor de análise integrada de saúde — o coração do registo de saúde Phlox.
// Quando chamado, busca TODO o contexto de saúde do utilizador/perfil
// e devolve uma análise integrada: análises + medicação + sintomas + consultas.
// Chamado automaticamente sempre que algo novo é adicionado ao registo.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 8, 60_000).allowed) return rateLimitResponse()
  const { plan, userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const body = await req.json().catch(() => ({}))
  const profileId = body?.profile_id || null
  const trigger = body?.trigger || 'manual' // 'labs' | 'medication' | 'vital' | 'symptom' | 'manual'

  // ── Buscar TODO o contexto ─────────────────────────────────────────────────
  const profileFilter = profileId
    ? (q: any) => q.eq('profile_id', profileId)
    : (q: any) => q.is('profile_id', null)

  const [
    { data: labs },
    { data: meds },
    { data: vitals },
    { data: vaccines },
  ] = await Promise.all([
    profileFilter(supabase.from('lab_records').select('date, lab_name, values, flags, ai_summary').eq('user_id', userId).order('date', { ascending: false }).limit(10)),
    profileId
      ? supabase.from('family_profile_meds').select('name, dose, frequency, indication').eq('user_id', userId).eq('profile_id', profileId).limit(30)
      : supabase.from('personal_meds').select('name, dose, frequency, indication').eq('user_id', userId).limit(30),
    profileFilter(supabase.from('vital_records').select('date, vital_type, value_1, value_2, unit').eq('user_id', userId).order('date', { ascending: false }).limit(20)),
    profileFilter(supabase.from('vaccine_records').select('name, date, batch, valid_until').eq('user_id', userId).order('date', { ascending: false }).limit(20)),
  ])

  // ── Preparar contexto para AI ──────────────────────────────────────────────

  // Análises — com comparação temporal
  const labsByDate: Record<string, any[]> = {}
  ;(labs || []).forEach((l: any) => {
    const key = l.date || 'sem_data'
    if (!labsByDate[key]) labsByDate[key] = []
    labsByDate[key].push(l)
  })

  const labsSummary = Object.entries(labsByDate)
    .slice(0, 4)
    .map(([date, records]) => {
      const allValues = records.flatMap(r => (r.values || []).map((v: any) => `${v.name}: ${v.value} ${v.unit || ''} [${v.status || 'NORMAL'}]`))
      return `${date}: ${allValues.slice(0, 15).join(' · ')}`
    })
    .join('\n')

  const medsSummary = (meds || []).map((m: any) => `${m.name} ${m.dose || ''} ${m.frequency || ''}${m.indication ? ` (${m.indication})` : ''}`).join(', ')

  const vitalsSummary = (vitals || []).slice(0, 10).map((v: any) => `${v.date} ${v.vital_type}: ${v.value_1}${v.value_2 ? `/${v.value_2}` : ''} ${v.unit}`).join(' | ')

  if (!medsSummary && !labsSummary && !vitalsSummary) {
    return NextResponse.json({ insights: [], summary: 'Sem dados suficientes para análise. Adiciona medicação e análises para obter insights personalizados.', connections: [], next_actions: [] })
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico e médico internista a analisar o contexto de saúde completo de um doente em Portugal.
Analisa TODA a informação disponível de forma integrada — não olhes para cada dado isoladamente.
O teu objectivo é encontrar conexões, padrões, alertas e recomendações que emergem da combinação dos dados.

Responde APENAS com JSON válido:
{
  "summary": "resumo em 1-2 frases do estado de saúde geral — honest e directo, não genérico",
  "overall_status": "BOM"|"ATENÇÃO"|"CONSULTA_RECOMENDADA"|"CONSULTA_URGENTE",
  "insights": [
    {
      "type": "trend"|"connection"|"alert"|"improvement"|"monitoring",
      "priority": "ALTA"|"MEDIA"|"BAIXA",
      "title": "título conciso do insight",
      "finding": "o que foi encontrado — específico, com valores reais dos dados",
      "explanation": "porque é importante esta conexão ou tendência",
      "action": "o que fazer — específico e accionável"
    }
  ],
  "connections": [
    "Conexão entre dados diferentes — ex: 'A tua creatinina subiu de 0.9 para 1.4 mg/dL nos últimos 6 meses, coincidindo com o início da metformina — monitorização renal recomendada'"
  ],
  "lab_trends": [
    {
      "parameter": "nome do parâmetro",
      "trend": "stable"|"improving"|"worsening"|"new",
      "change": "descrição quantitativa da mudança — ex: 'subiu de 5.8 para 7.2 mmol/L'",
      "significance": "o que significa clinicamente"
    }
  ],
  "medication_lab_connections": [
    "Conexão medicamento-análise — ex: 'A tua estatina pode estar a causar a ligeira elevação das transaminases (AST 52 U/L)'"
  ],
  "next_actions": [
    { "action": "acção específica", "urgency": "IMEDIATA"|"PROXIMA_CONSULTA"|"PROXIMAS_ANALISES", "reason": "porquê" }
  ],
  "missing_monitoring": [
    "análise ou parâmetro que deveria ser monitorizado dado o perfil de medicação ou diagnóstico"
  ]
}

Regras:
- Compara análises ao longo do tempo quando há múltiplas datas
- Conecta medicação com valores analíticos anormais (efeitos adversos conhecidos)
- Identifica padrões em sinais vitais (ex: TA consistentemente alta → HTA não controlada)
- Sê honesto mas não alarmista — distingue mudanças significativas de variação normal
- Máximo 5 insights, por ordem de prioridade
- Trigger desta análise: ${trigger}`,
      },
      {
        role: 'user',
        content: [
          medsSummary && `MEDICAÇÃO ACTUAL:\n${medsSummary}`,
          labsSummary && `ANÁLISES CLÍNICAS (cronológico, mais recente primeiro):\n${labsSummary}`,
          vitalsSummary && `SINAIS VITAIS:\n${vitalsSummary}`,
          body?.new_data && `NOVO DADO ADICIONADO (trigger desta análise):\n${JSON.stringify(body.new_data)}`,
        ].filter(Boolean).join('\n\n'),
      },
    ], { maxTokens: 2000, temperature: 0.05 })

    // Store the analysis result for display
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Health context error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}