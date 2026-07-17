// app/api/risk-index/route.ts
// Índice de Risco Contínuo — GET sem parâmetros = a própria pessoa; com
// ?profile_id=X = um familiar (objetivo "cuidador"). Calcula ao ver a página
// (sem cron), persiste 1 snapshot por dia em risk_snapshots (dedup manual,
// não upsert — o índice único usa uma expressão coalesce que o onConflict do
// supabase-js não referencia diretamente), e devolve o histórico dos últimos
// 14 dias para a tendência.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { computeSelfRiskScore } from '@/lib/healthAlerts'
import { analyzeFamilyMember } from '@/lib/caregiverWatch'
import type { RiskResult } from '@/lib/riskIndex'
import { makeSupabase, getToken } from '@/lib/orgAuth'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    const supabase = makeSupabase(token)

    const profileId = req.nextUrl.searchParams.get('profile_id')
    const now = new Date()
    const since90 = new Date(now.getTime() - 90 * 86400000).toISOString()
    const since14date = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)

    let result: RiskResult

    if (profileId) {
      const { data: prof } = await supabase.from('family_profiles')
        .select('age,sex,weight,conditions,allergies').eq('id', profileId).eq('user_id', userId).maybeSingle()
      if (!prof) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

      const [{ data: meds }, { data: vitals }, { data: syms }] = await Promise.all([
        supabase.from('family_profile_meds').select('name,pills_remaining,pills_per_day').eq('profile_id', profileId),
        supabase.from('vitals').select('recorded_at,bp_sys,bp_dia,hr,spo2,weight,glucose,temp').eq('profile_id', profileId).gte('recorded_at', since90),
        supabase.from('symptom_logs').select('at,pain,temperature,symptoms').eq('profile_id', profileId).gte('at', since90),
      ])
      const r = analyzeFamilyMember({
        age: prof.age, sex: prof.sex, weight: prof.weight, conditions: prof.conditions, allergies: prof.allergies,
        meds: (meds || []).map((m: any) => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
        vitals: vitals || [], symptoms: syms || [],
      })
      result = { score: r.score, level: r.level, topFactors: r.signals.slice(0, 4).map(s => ({ title: s.title, severity: s.severity })) }
    } else {
      // NOTA: `profiles` não guarda idade/sexo/condições da própria pessoa (só
      // family_profiles/patients têm isso) — degradamos com elegância como o
      // /api/companion já faz: as regras que dependem de idade simplesmente não
      // disparam, o resto do motor funciona na mesma.
      const [{ data: meds }, { data: vitals }, { data: syms }, { data: logs }] = await Promise.all([
        supabase.from('personal_meds').select('name,pills_remaining,pills_per_day').eq('user_id', userId),
        supabase.from('vitals').select('recorded_at,bp_sys,bp_dia,hr,spo2,weight,glucose,temp').eq('user_id', userId).is('profile_id', null).gte('recorded_at', since90),
        supabase.from('symptom_logs').select('at,pain,temperature,symptoms').eq('user_id', userId).is('profile_id', null).gte('at', since90),
        supabase.from('med_logs').select('status,date').eq('user_id', userId).gte('date', since14date).then((r: any) => r, () => ({ data: [] })),
      ])
      const logList = (logs || []) as any[]
      const adherencePct = logList.length > 0 ? Math.round((logList.filter(l => l.status === 'taken').length / logList.length) * 100) : null

      result = computeSelfRiskScore({
        meds: (meds || []).map((m: any) => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
        vitalSeries: vitals || [], symptoms: syms || [], adherencePct,
      })
    }

    // ── Persistir snapshot de hoje (1x/dia) — check-then-write, não upsert. ──
    const today = now.toISOString().slice(0, 10)
    const dedupQuery = supabase.from('risk_snapshots').select('id').eq('user_id', userId).eq('snapshot_date', today)
    const { data: existing } = profileId ? await dedupQuery.eq('profile_id', profileId).maybeSingle() : await dedupQuery.is('profile_id', null).maybeSingle()

    if (existing) {
      await supabase.from('risk_snapshots').update({ score: result.score, level: result.level, top_factors: result.topFactors }).eq('id', (existing as any).id)
    } else {
      await supabase.from('risk_snapshots').insert({ user_id: userId, profile_id: profileId || null, snapshot_date: today, score: result.score, level: result.level, top_factors: result.topFactors })
    }

    // ── Histórico (14 dias) para a tendência. ──
    const histQuery = supabase.from('risk_snapshots').select('snapshot_date,score,level').eq('user_id', userId).gte('snapshot_date', since14date).order('snapshot_date', { ascending: true })
    const { data: history } = profileId ? await histQuery.eq('profile_id', profileId) : await histQuery.is('profile_id', null)

    return NextResponse.json({ today: result, history: history || [] })
  } catch (err: any) {
    console.error('risk-index error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao calcular o índice de risco' }, { status: 500 })
  }
}
