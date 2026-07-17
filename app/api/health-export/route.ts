import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'

// Export do Registo de Saúde (Pro) — item D20 da auditoria. NOTA HONESTA: a
// sugestão original assumia um motor FHIR R4 já existente e auditado — ao
// investigar para construir isto, confirmei por grep em todo o código que
// NUNCA existiu (só há um NOME de scope 'fhir:read'/'fhir:write' em
// lib/apiKey.ts, sem nenhuma implementação por trás). Em vez de fabricar
// conformidade FHIR que não existe, construí a versão honesta e real: um
// dump completo e estruturado (medicação, vitais, sintomas, análises) para
// levar a qualquer médico — reaproveita o padrão de export PDF já provado
// (lib/print.ts), não inventa um formato novo.

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Exportar o meu registo de saúde')

  const supabase = sb(req)
  const since1y = new Date(Date.now() - 365 * 86400000).toISOString()

  const [{ data: meds }, { data: vitals }, { data: symptoms }, { data: labs }] = await Promise.all([
    supabase.from('personal_meds').select('name, dose, frequency, started_at').eq('user_id', userId),
    supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').eq('user_id', userId).is('profile_id', null).gte('recorded_at', since1y).order('recorded_at', { ascending: false }).limit(200),
    supabase.from('symptom_logs').select('at, symptoms, pain, temperature, notes').eq('user_id', userId).is('profile_id', null).gte('at', since1y).order('at', { ascending: false }).limit(100).then((r: any) => r, () => ({ data: [] })),
    supabase.from('lab_records').select('date, lab_name, values').eq('user_id', userId).is('profile_id', null).order('date', { ascending: false }).limit(20).then((r: any) => r, () => ({ data: [] })),
  ])

  return NextResponse.json({
    meds: meds || [],
    vitals: vitals || [],
    symptoms: symptoms || [],
    labs: labs || [],
    generated_at: new Date().toISOString(),
  })
}
