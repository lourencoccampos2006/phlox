import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

function makeSupabase(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

interface Vital {
  id: string; user_id: string; recorded_at: string
  hr: number|null; bp_sys: number|null; bp_dia: number|null
  spo2: number|null; weight: number|null; glucose: number|null; temp: number|null; notes: string|null
}

interface TrendAnalysis {
  alerts: { field: string; message: string; severity: 'critical'|'warning'|'info' }[]
  trends: { field: string; direction: 'rising'|'falling'|'stable'; note: string }[]
  medication_correlations: { drug: string; field: string; observation: string }[]
  summary: string
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '90'), 200)

  const { data, error } = await supabase
    .from('vitals').select('*').eq('user_id', userId)
    .order('recorded_at', { ascending: false }).limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vitals: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)

  let body: Partial<Vital>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  const record = {
    user_id: userId,
    recorded_at: body.recorded_at || new Date().toISOString(),
    hr:     body.hr     != null ? Number(body.hr)     : null,
    bp_sys: body.bp_sys != null ? Number(body.bp_sys) : null,
    bp_dia: body.bp_dia != null ? Number(body.bp_dia) : null,
    spo2:   body.spo2   != null ? Number(body.spo2)   : null,
    weight: body.weight != null ? Number(body.weight) : null,
    glucose:body.glucose!= null ? Number(body.glucose): null,
    temp:   body.temp   != null ? Number(body.temp)   : null,
    notes:  body.notes  ? String(body.notes).slice(0, 500) : null,
  }

  const { data, error } = await supabase.from('vitals').insert(record).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await supabase.from('vitals').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}

// Dedicated AI analysis endpoint
export async function PUT(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (checkRateLimit(ip, 5, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { vitals: Vital[]; medications: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  const { vitals, medications } = body
  if (!vitals?.length) return NextResponse.json({ error: 'Sem dados de sinais vitais' }, { status: 400 })

  const recent = vitals.slice(0, 30)
  const vitalsText = recent.map(v => {
    const parts = []
    if (v.recorded_at) parts.push(new Date(v.recorded_at).toLocaleDateString('pt-PT'))
    if (v.hr) parts.push(`FC ${v.hr}bpm`)
    if (v.bp_sys && v.bp_dia) parts.push(`TA ${v.bp_sys}/${v.bp_dia}mmHg`)
    if (v.spo2) parts.push(`SpO2 ${v.spo2}%`)
    if (v.weight) parts.push(`Peso ${v.weight}kg`)
    if (v.glucose) parts.push(`Glicemia ${v.glucose}mg/dL`)
    if (v.temp) parts.push(`Temp ${v.temp}°C`)
    return parts.join(' · ')
  }).join('\n')

  const prompt = `És um médico clínico geral a analisar os sinais vitais de um doente.

SINAIS VITAIS (mais recente primeiro):
${vitalsText}

MEDICAÇÃO ATUAL: ${medications.join(', ') || 'não especificada'}

Analisa e devolve JSON:
{
  "alerts": [
    { "field": "campo_afetado", "message": "mensagem clara para o doente", "severity": "critical"|"warning"|"info" }
  ],
  "trends": [
    { "field": "campo", "direction": "rising"|"falling"|"stable", "note": "nota clínica em PT-PT" }
  ],
  "medication_correlations": [
    { "drug": "medicamento", "field": "campo_vital", "observation": "observação" }
  ],
  "summary": "resumo geral em 2-3 frases, linguagem simples PT-PT"
}

Regras de alertas:
- TA sistólica >180 → critical "Tensão muito elevada"
- TA sistólica >140 → warning
- SpO2 <95% → warning; <90% → critical
- FC >100 ou <50 → warning
- Glicemia >250 ou <70 → critical
- Temp >38.5°C → warning
- Correlações: ibuprofen/naproxen + TA a subir → alert
- Responde APENAS JSON`

  try {
    const result = await aiJSON<TrendAnalysis>([{ role: 'user', content: prompt }], { maxTokens: 800 })
    return NextResponse.json(result || { alerts: [], trends: [], medication_correlations: [], summary: '' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
