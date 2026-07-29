import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { adminDb, hasEditorAccess } from '@/lib/familyShareAccess'

// Gestão a dois (Pro, sprint121) — adicionar/remover medicação de um perfil
// de família como EDITOR (não dono). RLS de family_profile_meds continua
// fechada ao dono (auth.uid() = user_id) — esta rota usa service-role e faz
// a sua própria verificação (hasEditorAccess), tal como /api/family-share/view
// e /api/family-help. user_id fica registado como quem ADICIONOU (o editor),
// não o dono — mesma semântica de "quem fez o quê" já usada em family_help_
// requests (created_by) e family_med_logs (logged_by).

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const profileId = String(body?.profile_id || '')
  const name = String(body?.name || '').trim().slice(0, 200)
  if (!profileId || !name) return NextResponse.json({ error: 'Falta o perfil ou o nome do medicamento.' }, { status: 400 })

  const db = adminDb()
  if (!(await hasEditorAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso de gestão a este perfil.' }, { status: 403 })

  const { data, error } = await db.from('family_profile_meds').insert({
    profile_id: profileId,
    user_id: userId,
    name,
    dose: body?.dose ? String(body.dose).trim().slice(0, 100) : null,
    frequency: body?.frequency ? String(body.frequency).trim().slice(0, 100) : null,
    indication: body?.indication ? String(body.indication).trim().slice(0, 200) : null,
  }).select('id, name, dose, frequency, indication').single()

  if (error) { console.error('[phlox:family-share/med]', error.message); return NextResponse.json({ error: 'Não foi possível adicionar o medicamento.' }, { status: 500 }) }
  return NextResponse.json({ med: data })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const medId = String(body?.med_id || '')
  const profileId = String(body?.profile_id || '')
  if (!medId || !profileId) return NextResponse.json({ error: 'Falta o medicamento ou o perfil.' }, { status: 400 })

  const db = adminDb()
  if (!(await hasEditorAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso de gestão a este perfil.' }, { status: 403 })

  // Confirma que o medicamento é mesmo deste perfil antes de apagar — nunca
  // confiar só no med_id vindo do cliente.
  const { data: med } = await db.from('family_profile_meds').select('id').eq('id', medId).eq('profile_id', profileId).maybeSingle()
  if (!med) return NextResponse.json({ error: 'Medicamento não encontrado.' }, { status: 404 })

  const { error } = await db.from('family_profile_meds').delete().eq('id', medId)
  if (error) return NextResponse.json({ error: 'Não foi possível remover.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
