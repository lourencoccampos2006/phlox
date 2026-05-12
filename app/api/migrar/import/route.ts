// app/api/migrar/import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 5, 60_000).allowed) return rateLimitResponse()
  const { plan, userId } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Migração')
  if (!userId) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const body = await req.json().catch(() => null)
  const { import_mode, items = [], source_system } = body

  if (!items.length) return NextResponse.json({ error: 'Sem dados para importar' }, { status: 400 })

  let inserted = 0
  const errors: string[] = []

  try {
    if (import_mode === 'medications') {
      const meds = items.map((m: any) => ({
        user_id: userId,
        name: m.name || 'Desconhecido',
        dose: m.dose || null,
        frequency: m.frequency || null,
        route: m.route || null,
        indication: m.indication || null,
        source: `importado:${source_system}`,
        created_at: new Date().toISOString(),
      }))
      const { data, error } = await supabase.from('personal_meds').insert(meds).select()
      if (error) throw error
      inserted = data?.length || 0

    } else if (import_mode === 'patients') {
      for (const item of items) {
        const { error } = await supabase.from('patients').insert({
          user_id: userId,
          name: item.name || 'Doente',
          age: item.age || null,
          sex: null,
          conditions: item.diagnosis || null,
          allergies: item.allergies?.join(', ') || null,
          notes: item.sns ? `SNS: ${item.sns}` : null,
        })
        if (error) errors.push(`${item.name}: ${error.message}`)
        else inserted++
      }

    } else if (import_mode === 'residents') {
      // Residentes não têm tabela própria — importa como patients com notas de quarto
      for (const item of items) {
        const { data: pt, error: ptErr } = await supabase.from('patients').insert({
          user_id: userId,
          name: item.name || 'Residente',
          age: item.age || null,
          sex: null,
          conditions: item.diagnosis || null,
          allergies: item.allergies?.join(', ') || null,
          notes: item.room ? `Quarto: ${item.room}` : null,
        }).select().single()

        if (ptErr) { errors.push(`${item.name}: ${ptErr.message}`); continue }

        // Importa medicação do residente
        if (item.medications?.length && pt?.id) {
          const meds = item.medications.map((m: any) => ({
            patient_id: pt.id,
            user_id: userId,
            name: m.name,
            dose: m.dose || null,
            frequency: m.frequency || null,
            source: `importado:${source_system}`,
          }))
          try {
            await supabase.from('patient_meds').insert(meds)
          } catch (_e: any) {}
        }
        inserted++
      }

    } else if (import_mode === 'labs') {
      const { error } = await supabase.from('lab_records').insert({
        user_id: userId,
        date: items[0]?.date || new Date().toISOString().split('T')[0],
        lab_name: body.lab_name || 'Importado',
        values: items.map((v: any) => ({
          name: v.name,
          value: v.value,
          unit: v.unit,
          reference: v.reference,
          status: v.status || 'NORMAL',
          interpretation: null,
        })),
        flags: items.filter((v: any) => v.status && v.status !== 'NORMAL').map((v: any) => v.name),
        source: `importado:${source_system}`,
        ai_summary: null,
      })
      if (error) throw error
      inserted = 1
    }

    return NextResponse.json({ success: inserted, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao importar' }, { status: 500 })
  }
}