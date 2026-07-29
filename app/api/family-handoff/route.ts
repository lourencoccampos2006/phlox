// app/api/family-handoff/route.ts
// "Passagem de cuidado" — quando a responsabilidade de cuidar de um familiar
// muda de mãos por um período (ex: um irmão cobre o outro uma semana), o
// cuidador que sai deixa uma nota estruturada para quem entra: como está a
// pessoa, do que estar atento, mudanças na medicação. Distinta da "Ficha para
// o hospital" (HandoffSheetButton) — aquela é um documento IMPRESSO gerado a
// partir de dados já existentes (medicação + risco + playbook), sem autoria
// nem persistência; esta é escrita por um cuidador PARA o próximo, guardada,
// e pode ser confirmada como lida ("assumo eu"). Serviço-role para juntar o
// NOME de quem escreveu/confirmou (RLS de profiles não deixa ler nomes de
// outras contas diretamente do cliente) — mesmo padrão de family-help/route.ts.
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

  const { data: notes } = await db.from('family_handoff_notes').select('*').eq('profile_id', profileId).order('starts_at', { ascending: false }).order('created_at', { ascending: false })
  const ids = Array.from(new Set((notes || []).flatMap((n: any) => [n.created_by, n.acknowledged_by]).filter(Boolean)))
  const { data: profs } = ids.length ? await db.from('profiles').select('id, name').in('id', ids as string[]) : { data: [] as any[] }
  const nameOf: Record<string, string> = {}
  ;(profs || []).forEach((p: any) => { nameOf[p.id] = p.name })

  const items = (notes || []).map((n: any) => ({
    ...n,
    created_by_name: nameOf[n.created_by] || 'Alguém',
    acknowledged_by_name: n.acknowledged_by ? (nameOf[n.acknowledged_by] || 'Alguém') : null,
  }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const profileId = String(body.profile_id || '')
  const summary = String(body.summary || '').trim().slice(0, 2000)
  if (!profileId || !summary) return NextResponse.json({ error: 'Falta o resumo ou o perfil.' }, { status: 400 })

  const db = admin()
  if (!(await hasAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  const startsAt = body.starts_at ? String(body.starts_at) : new Date().toISOString().slice(0, 10)
  const endsAt = body.ends_at ? String(body.ends_at) : null
  if (endsAt && endsAt < startsAt) return NextResponse.json({ error: 'A data de fim não pode ser antes da data de início.' }, { status: 400 })

  const { error } = await db.from('family_handoff_notes').insert({
    profile_id: profileId, created_by: userId,
    starts_at: startsAt, ends_at: endsAt, summary,
    watch_for: body.watch_for ? String(body.watch_for).trim().slice(0, 1000) : null,
    med_changes: body.med_changes ? String(body.med_changes).trim().slice(0, 1000) : null,
  })
  if (error) { console.error('[phlox:family-handoff] criar falhou:', error.message); return NextResponse.json({ error: 'Não foi possível criar a nota.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

// PATCH: confirmar leitura ("assumo eu") / desconfirmar
export async function PATCH(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Indisponível de momento.' }, { status: 503 })
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id || !['acknowledge', 'unacknowledge'].includes(action)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const db = admin()
  const { data: item } = await db.from('family_handoff_notes').select('profile_id, acknowledged_by').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  // Mesma lição do IDOR corrigido em family-help: "desconfirmar" só a quem
  // confirmou — não a qualquer pessoa com acesso ao perfil.
  if (action === 'unacknowledge' && item.acknowledged_by !== userId) {
    return NextResponse.json({ error: 'Só quem confirmou pode desfazer.' }, { status: 403 })
  }
  // Confirmar só quando ainda ninguém confirmou — evita uma segunda pessoa
  // "roubar" a confirmação de quem já assumiu o cuidado.
  if (action === 'acknowledge' && item.acknowledged_by && item.acknowledged_by !== userId) {
    return NextResponse.json({ error: 'Esta passagem já foi confirmada por outra pessoa.' }, { status: 409 })
  }

  const patch = action === 'acknowledge'
    ? { acknowledged_by: userId, acknowledged_at: new Date().toISOString() }
    : { acknowledged_by: null, acknowledged_at: null }

  const { error } = await db.from('family_handoff_notes').update(patch).eq('id', id)
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
  const { data: item } = await db.from('family_handoff_notes').select('profile_id, created_by').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  if (!(await hasAccess(db, userId, item.profile_id))) return NextResponse.json({ error: 'Sem acesso a este perfil.' }, { status: 403 })

  // Eliminar só a quem escreveu a nota OU ao dono do perfil — não a qualquer
  // pessoa com acesso partilhado (mesmo padrão do DELETE em family-help).
  const { data: owns } = await db.from('family_profiles').select('id').eq('id', item.profile_id).eq('user_id', userId).maybeSingle()
  if (item.created_by !== userId && !owns) {
    return NextResponse.json({ error: 'Só quem escreveu a nota ou o dono do perfil pode eliminar.' }, { status: 403 })
  }

  await db.from('family_handoff_notes').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
