// app/api/recall-watch/route.ts
// Vigia de Recalls — cruza a medicação do utilizador (ou de um familiar) com
// os alertas de qualidade/segurança do INFARMED já ingeridos (ver
// lib/recallIngest.ts + /api/cron/ingest-recalls). Matching por SUBSTRING no
// título da notícia (não há campos estruturados de nome de fármaco fiáveis
// em todas as notícias) — por isso é sempre "menciona", nunca "confirma
// lote", e liga sempre à notícia oficial para o utilizador confirmar.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { normalizeDrugName } from '@/lib/shortageIngest'
import { sb } from '@/lib/orgAuth'

interface RecallMatch { medication: string; url: string; title: string; notice_date: string | null }

const WINDOW_DAYS = 545 // ~18 meses — recalls mais antigos perdem relevância prática

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Vigia de Recalls')
  const supabase = sb(req)

  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (profileId) {
    const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const [{ data: meds }, { data: notices }] = await Promise.all([
    profileId
      ? supabase.from('family_profile_meds').select('name').eq('profile_id', profileId)
      : supabase.from('personal_meds').select('name').eq('user_id', userId),
    supabase.from('infarmed_recall_notices').select('url, title, notice_date, first_seen_at').gte('first_seen_at', since).order('first_seen_at', { ascending: false }),
  ])

  const noticeList = (notices || []) as { url: string; title: string; notice_date: string | null }[]
  const matches: RecallMatch[] = []
  for (const m of (meds || []) as { name: string }[]) {
    const norm = normalizeDrugName(m.name)
    if (norm.length < 4) continue
    for (const n of noticeList) {
      if (normalizeDrugName(n.title).includes(norm)) {
        matches.push({ medication: m.name, url: n.url, title: n.title, notice_date: n.notice_date })
      }
    }
  }

  return NextResponse.json({ matches, checked_medications: (meds || []).length, notices_available: noticeList.length })
}
