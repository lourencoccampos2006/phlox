// app/api/shortage-watch/route.ts
// Vigia de Ruturas — cruza a medicação real do utilizador (ou de um familiar)
// com a Lista de Notificação Prévia do INFARMED já ingerida (ver
// lib/shortageIngest.ts + /api/cron/ingest-shortages). Matching CONSERVADOR:
// nome exato normalizado = confirmado; correspondência parcial = sinalizado
// como "parece corresponder", nunca apresentado como certeza.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { normalizeDrugName } from '@/lib/shortageIngest'

function makeSupabase(token: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}
function getToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

interface MatchResult {
  medication: string
  match: 'exato' | 'parcial' | null
  matched_name: string | null
  source_document: string | null
}

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Vigia de Ruturas')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const profileId = req.nextUrl.searchParams.get('profile_id')

  const [{ data: meds }, { data: shortageList }, { data: sync }] = await Promise.all([
    profileId
      ? supabase.from('family_profile_meds').select('name').eq('profile_id', profileId)
      : supabase.from('personal_meds').select('name').eq('user_id', userId),
    supabase.from('infarmed_shortage_list').select('medicine_name, source_document'),
    supabase.from('infarmed_shortage_sync').select('*').eq('id', 1).maybeSingle(),
  ])

  const list = (shortageList || []) as { medicine_name: string; source_document: string }[]
  const byExact = new Map(list.map(l => [normalizeDrugName(l.medicine_name), l]))

  const results: MatchResult[] = (meds || []).map((m: any) => {
    const norm = normalizeDrugName(m.name)
    const exact = byExact.get(norm)
    if (exact) return { medication: m.name, match: 'exato', matched_name: exact.medicine_name, source_document: exact.source_document }

    // Correspondência parcial: o nome do medicamento do utilizador contém, ou
    // está contido, no nome da lista (cobre "Ozempic 1mg" vs "Ozempic").
    const partial = list.find(l => {
      const ln = normalizeDrugName(l.medicine_name)
      return norm.length > 3 && ln.length > 3 && (norm.includes(ln) || ln.includes(norm))
    })
    if (partial) return { medication: m.name, match: 'parcial', matched_name: partial.medicine_name, source_document: partial.source_document }

    return { medication: m.name, match: null, matched_name: null, source_document: null }
  })

  return NextResponse.json({
    results,
    list_status: sync || null,
    list_empty: list.length === 0,
  })
}
