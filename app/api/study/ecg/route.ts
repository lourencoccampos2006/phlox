// app/api/study/ecg/route.ts
// GET → lista ECGs da biblioteca (filtros: category, difficulty)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

const NO_TABLE = (m: string) => /relation .*ecg_library.* does not exist/i.test(m)

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const cat = req.nextUrl.searchParams.get('category')
  const diff = req.nextUrl.searchParams.get('difficulty')
  const db = sb(req)
  let q = db.from('ecg_library').select('*').order('created_at', { ascending: false }).limit(100)
  if (cat) q = q.eq('category', cat)
  if (diff) q = q.eq('difficulty', diff)
  const { data, error } = await q
  if (error) {
    if (NO_TABLE(error.message)) return NextResponse.json({ ecgs: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ecgs: data || [] })
}
