// GET    → metadata do convite (org, role)
// POST   → aceitar convite (cria org_member)
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { normalizarPapel, orgRoleAntigo, PAPEL_NA_ESCALA } from '@/lib/permissoes'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Servidor não preparado' }, { status: 503 })
  }
  const db = adminClient()
  const { data: inv } = await db.from('org_invites')
    .select('id, org_id, email, role, department, expires_at, accepted_at, revoked, organizations(name, short_name, kind, accent_color)')
    .eq('token', token).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  if (inv.revoked) return NextResponse.json({ error: 'Convite revogado' }, { status: 410 })
  if (inv.accepted_at) return NextResponse.json({ error: 'Convite já aceite' }, { status: 410 })
  if (new Date(inv.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Convite expirou' }, { status: 410 })
  return NextResponse.json({ invite: inv })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Servidor não preparado' }, { status: 503 })

  const { token } = await ctx.params
  const db = adminClient()
  const { data: inv } = await db.from('org_invites').select('*').eq('token', token).maybeSingle()
  if (!inv) return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  if (inv.revoked || inv.accepted_at || new Date(inv.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 410 })
  }

  // Há convites POR ABRIR na base de dados com os papéis antigos (`clinician`,
  // `assistant`) — foram criados antes do sprint152 e continuam válidos durante
  // catorze dias. Traduz-se à entrada, para que nenhuma linha NOVA em
  // `org_members` fique com vocabulário velho. É isso que permitirá, mais à
  // frente, apertar a restrição para só os sete papéis novos.
  //
  // Um papel que não se reconheça vira `convidado`: vê, não mexe. Recusar o
  // convite seria deixar alguém à porta por causa de um valor antigo na base
  // de dados, que não é culpa de quem está a entrar.
  const papel = normalizarPapel(inv.role) || 'convidado'

  // Cria membership (idempotente por unique org_id+user_id)
  const { error: memErr } = await db.from('org_members').insert({
    org_id: inv.org_id, user_id: userId, role: papel, department: inv.department,
  })
  // ignora unique-violation (utilizador já é membro)
  if (memErr && !/duplicate key/i.test(memErr.message)) {
    console.error('[phlox:invites] adicionar membro falhou:', memErr.message)
    return NextResponse.json({ error: 'Não foi possível aceitar o convite agora. Tente novamente.' }, { status: 500 })
  }

  // Perfil → modo clínico + org ativa (para ter logo o acesso institucional; o
  // plano de faturação mantém-se — o acesso vem da pertença). onboarded p/ não
  // cair no wizard.
  const { data: prof } = await db.from('profiles').select('name').eq('id', userId).maybeSingle()
  await db.from('profiles').update({
    experience_mode: 'clinical', org_id: inv.org_id, active_org_id: inv.org_id,
    org_role: orgRoleAntigo(papel), onboarded: true,
  }).eq('id', userId)

  // Aparece LOGO nas escalas (/equipa?tab=escalas): cria a linha team_members
  // ligada à conta. Sem isto, o membro que aceitava por link não surgia na
  // equipa. O mapa papel→escala vive em lib/permissoes (era uma cópia à mão
  // aqui, com os papéis antigos).
  try {
    const { error: tmErr } = await db.from('team_members').upsert(
      { org_id: inv.org_id, user_id: userId, name: prof?.name || inv.email || 'Membro', role: PAPEL_NA_ESCALA[papel] || 'other', status: 'off' },
      { onConflict: 'org_id,user_id' }
    )
    if (tmErr) console.error('[phlox:invites] criar perfil em team_members falhou:', tmErr.message)
  } catch (e: any) {
    console.error('[phlox:invites] criar perfil em team_members falhou:', e?.message || e)
  }

  // Marca aceite
  await db.from('org_invites').update({ accepted_at: new Date().toISOString(), accepted_by: userId }).eq('id', inv.id)
  return NextResponse.json({ ok: true, org_id: inv.org_id })
}
