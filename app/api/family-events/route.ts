// app/api/family-events/route.ts
// Agenda partilhada de um perfil de família: consultas/compromissos e turnos
// de cobertura ("quem fica responsável de quinta a domingo?"). Qualquer pessoa
// com acesso ao perfil (dono ou partilha ativa — family_profile_shares) vê e
// cria; um turno de cobertura sem responsável pode ser reclamado por qualquer
// um com acesso, tal como o quadro "Preciso de ajuda". Serviço-role para
// juntar o NOME de quem criou/ficou responsável — mesmo padrão de
// family-help/route.ts e family-handoff/route.ts.
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

  const { data: events } = await db.from('family_profile_events').select('*').eq('profile_id', profileId).order('starts_at', { ascending: true })
  const ids = Array.from(new Set((events || []).flatMap((e: any) => [e.created_by, e.assigned_to]).filter(Boolean)))
  const { data: profs } = ids.length ? await db.from('profiles').select('id, name').in('id', ids as string[]) : { data: [] as any[] }
  const nameOf: Record<string, string> = {}
  ;(profs || []).forEach((p: any) => { nameOf[p.id] = p.name })

  const items = (events || []).map((e: any) => ({
    ...e,
    created_by_name: nameOf[e.created_by] || 'Alguém',
    assigned_to_name: e.assigned_to ? (nameOf[e.assigned_to] || 'Alguém') : null,
  }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const profileId = String(body.profile_id || '')
  const title = String(body.title || '').trim().slice(0, 200)
  const kind = body.kind === 'coverage' ? 'coverage' : 'appointment'
  const startsAt = String(body.starts_at || '')
  if (!profileId || !title || !startsAt) return NextResponse.json({ error: 'Falta o título, a data ou o perfil.' }, { status: 400 })
  if (Number.isNaN(new Date(startsAt).getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
  const endsAt = body.ends_at ? String(body.ends_at) : null
  if (endsAt && Number.isNaN(new Date(endsAt).getTime())) return NextResponse.json({ error: 'Data de fim inválida.' }, { status: 400 })
  if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) return NextResponse.json({ error: 'A data de fim não pode ser antes da data de início.' }, { status: 400 })

  const db = admin()
  if (!(await hasAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  const { error } = await db.from('family_profile_events').insert({
    profile_id: profileId, created_by: userId, kind, title,
    location: body.location ? String(body.location).trim().slice(0, 200) : null,
    notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
    starts_at: startsAt, ends_at: endsAt,
    // Conveniência: ao criar um turno de cobertura, o próprio cuidador pode
    // já ficar responsável (em vez de publicar sempre em aberto).
    assigned_to: body.assign_self ? userId : null,
  })
  if (error) { console.error('[phlox:family-events] criar falhou:', error.message); return NextResponse.json({ error: 'Não foi possível criar o evento.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

// PATCH: reclamar/largar um turno de cobertura, ou editar os campos (só dono/criador)
export async function PATCH(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id || !['claim', 'unclaim', 'update'].includes(action)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const db = admin()
  const { data: item } = await db.from('family_profile_events').select('profile_id, created_by, assigned_to').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })
  const { data: owns } = await db.from('family_profiles').select('id').eq('id', item.profile_id).eq('user_id', userId).maybeSingle()

  if (action === 'claim') {
    if (item.assigned_to && item.assigned_to !== userId) return NextResponse.json({ error: 'Já tem um responsável.' }, { status: 409 })
    const { error } = await db.from('family_profile_events').update({ assigned_to: userId }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'unclaim') {
    // Mesma lição do IDOR corrigido em family-help: largar só a quem ficou
    // responsável (ou o dono do perfil, para poder reabrir um turno parado) —
    // não a qualquer pessoa com acesso ao perfil.
    if (item.assigned_to !== userId && !owns) {
      return NextResponse.json({ error: 'Só quem ficou responsável ou o dono do perfil pode largar.' }, { status: 403 })
    }
    const { error } = await db.from('family_profile_events').update({ assigned_to: null }).eq('id', id)
    if (error) return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // action === 'update' — editar detalhes só a quem criou o evento ou ao dono do perfil.
  if (item.created_by !== userId && !owns) {
    return NextResponse.json({ error: 'Só quem criou o evento ou o dono do perfil pode editar.' }, { status: 403 })
  }
  const patch: any = {}
  if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 200)
  if (body.location !== undefined) patch.location = body.location ? String(body.location).trim().slice(0, 200) : null
  if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes).trim().slice(0, 500) : null
  if (body.starts_at !== undefined) {
    if (Number.isNaN(new Date(String(body.starts_at)).getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
    patch.starts_at = String(body.starts_at)
  }
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at ? String(body.ends_at) : null
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  const { error } = await db.from('family_profile_events').update(patch).eq('id', id)
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
  const { data: item } = await db.from('family_profile_events').select('profile_id, created_by').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  // Eliminar só a quem criou o evento OU ao dono do perfil — não a qualquer
  // pessoa com acesso partilhado (mesmo padrão do DELETE em family-help).
  const { data: owns } = await db.from('family_profiles').select('id').eq('id', item.profile_id).eq('user_id', userId).maybeSingle()
  if (item.created_by !== userId && !owns) {
    return NextResponse.json({ error: 'Só quem criou o evento ou o dono do perfil pode eliminar.' }, { status: 403 })
  }

  await db.from('family_profile_events').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
