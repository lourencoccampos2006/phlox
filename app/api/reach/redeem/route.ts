import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Resgatar um código de convite Phlox Reach — item nº3 das sugestões extra
// (2026-07-17). BUG REAL ENCONTRADO ao auditar tabelas nunca escritas:
// /reach gerava o link (/login?ref=CODE) e já sabia MOSTRAR resgates
// (invite_redemptions), mas nada em todo o código alguma vez os CRIAVA —
// /login nunca lia ?ref=, e não existia nenhuma rota de resgate. Alguém
// podia partilhar o código, um amigo registar-se com ele, e nada ficava
// registado — a funcionalidade estava invisivelmente partida desde sempre.
//
// Chamado uma vez, no fim do onboarding de uma conta NOVA (ver
// app/onboarding/page.tsx). Usa service-role porque nem "invites" nem
// "invite_redemptions" têm policy de RLS que permita a um utilizador
// diferente do dono escrever lá (por desenho — só o dono lê/gere os seus
// próprios convites).

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const code = String(body?.code || '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code obrigatório' }, { status: 400 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: invite } = await db.from('invites').select('id, user_id, uses, uses_limit').eq('code', code).maybeSingle()
  if (!invite) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })
  if (invite.user_id === userId) return NextResponse.json({ error: 'Não podes resgatar o teu próprio código' }, { status: 400 })
  if (invite.uses_limit != null && invite.uses >= invite.uses_limit) return NextResponse.json({ error: 'Este código atingiu o limite de utilizações' }, { status: 410 })

  // Idempotente — se este utilizador já resgatou este convite antes (ex:
  // reabriu o onboarding), não duplica a linha nem conta 2x.
  const { data: already } = await db.from('invite_redemptions').select('id').eq('invite_id', invite.id).eq('invitee_id', userId).maybeSingle()
  if (already) return NextResponse.json({ ok: true, already: true })

  const { data: authUser } = await db.auth.admin.getUserById(userId).catch(() => ({ data: null }) as any)
  const invitee_email = authUser?.user?.email || null

  const { error: insErr } = await db.from('invite_redemptions').insert({
    invite_id: invite.id, referrer_id: invite.user_id, invitee_id: userId, invitee_email,
  })
  if (insErr) return NextResponse.json({ error: 'Não foi possível registar o convite.' }, { status: 500 })

  await db.from('invites').update({ uses: (invite.uses || 0) + 1 }).eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
