// app/api/family-help/route.ts
// "Quadro de preciso de ajuda" (pesquisa competitiva 2026-07-27, Lotsa Helping
// Hands): o cuidador principal publica necessidades concretas para um perfil
// partilhado, qualquer pessoa com acesso (family_profile_shares) reclama a
// tarefa. Serviço-role para poder juntar o NOME de quem criou/reclamou (RLS
// de profiles não deixa ler nomes de outras contas diretamente do cliente).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function hasAccess(db: any, userId: string, profileId: string): Promise<boolean> {
  const { data: owned } = await db.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (owned) return true
  const { data: shared } = await db.from('family_profile_shares').select('id').eq('profile_id', profileId).eq('viewer_user_id', userId).is('revoked_at', null).maybeSingle()
  return !!shared
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório.' }, { status: 400 })

  const db = admin()
  if (!(await hasAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  const { data: reqs } = await db.from('family_help_requests').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
  const ids = Array.from(new Set((reqs || []).flatMap((r: any) => [r.created_by, r.claimed_by]).filter(Boolean)))
  const { data: profs } = ids.length ? await db.from('profiles').select('id, name').in('id', ids as string[]) : { data: [] as any[] }
  const nameOf: Record<string, string> = {}
  ;(profs || []).forEach((p: any) => { nameOf[p.id] = p.name })

  const items = (reqs || []).map((r: any) => ({ ...r, created_by_name: nameOf[r.created_by] || 'Alguém', claimed_by_name: r.claimed_by ? (nameOf[r.claimed_by] || 'Alguém') : null }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const profileId = String(body.profile_id || '')
  const title = String(body.title || '').trim().slice(0, 200)
  if (!profileId || !title) return NextResponse.json({ error: 'Falta o título ou o perfil.' }, { status: 400 })

  const db = admin()
  if (!(await hasAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  const { error } = await db.from('family_help_requests').insert({
    profile_id: profileId, created_by: userId, title,
    note: body.note ? String(body.note).trim().slice(0, 500) : null,
    needed_by: body.needed_by || null,
  })
  if (error) { console.error('[phlox:family-help] criar falhou:', error.message); return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

// PATCH: reclamar / desreclamar / marcar feito
export async function PATCH(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id || !['claim', 'unclaim', 'done', 'reopen'].includes(action)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const db = admin()
  const { data: item } = await db.from('family_help_requests').select('profile_id, claimed_by').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  // IDOR corrigido: "largar" só a quem reclamou — o cliente já escondia o
  // botão para os outros, mas o servidor deixava qualquer pessoa com acesso
  // ao perfil desreclamar a tarefa de outra pessoa via chamada direta à API.
  if (action === 'unclaim' && item.claimed_by !== userId) {
    return NextResponse.json({ error: 'Só quem reclamou pode largar.' }, { status: 403 })
  }

  const patch: any =
    action === 'claim' ? { status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() } :
    action === 'unclaim' ? { status: 'open', claimed_by: null, claimed_at: null } :
    action === 'done' ? { status: 'done' } :
    { status: item.claimed_by ? 'claimed' : 'open' } // reopen

  const { error } = await db.from('family_help_requests').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'Falta o id.' }, { status: 400 })
  const db = admin()
  const { data: item } = await db.from('family_help_requests').select('profile_id, created_by').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  // IDOR corrigido: eliminar só a quem publicou OU ao dono do perfil (para
  // poder limpar o quadro) — não a qualquer pessoa com acesso partilhado.
  const { data: owns } = await db.from('family_profiles').select('id').eq('id', item.profile_id).eq('user_id', userId).maybeSingle()
  if (item.created_by !== userId && !owns) {
    return NextResponse.json({ error: 'Só quem publicou ou o dono do perfil pode eliminar.' }, { status: 403 })
  }

  await db.from('family_help_requests').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
