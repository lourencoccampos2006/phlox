// app/api/org/team/route.ts
// Gestão de equipa da organização (plano Institucional).
//
// GET    → lista os membros da organização ativa do utilizador (só owner/admin).
// POST   → adiciona um membro:
//            { mode: 'generate', name, role }  → cria login (user+password temporária)
//            { mode: 'invite',   email, role } → envia convite por email (org_invites)
// DELETE → desativa um membro { memberUserId }.
//
// Tudo exige que o chamador seja owner/admin da org (verificado via org_members).
// As contas geradas usam o service-role (admin) do Supabase — nunca exposto ao cliente.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt, randomBytes } from 'crypto'
import { sendEmail, emailLayout } from '@/lib/email'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Resolve o utilizador a partir do Bearer token e confirma que é owner/admin da org.
async function requireManager(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'Falta SUPABASE_SERVICE_ROLE_KEY na Vercel — necessária para gerir a equipa.', status: 503 as const }
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return { error: 'Sessão em falta.', status: 401 as const }
  const a = admin()
  const { data: { user } } = await a.auth.getUser(token)
  if (!user) return { error: 'Não autenticado.', status: 401 as const }
  // org ativa do utilizador (active_org_id no perfil; senão a 1ª onde é membro)
  const { data: prof } = await a.from('profiles').select('active_org_id, org_id, name').eq('id', user.id).single()
  let orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) {
    const { data: m } = await a.from('org_members').select('org_id').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle()
    orgId = m?.org_id || null
  }
  if (!orgId) return { error: 'Sem organização ativa.', status: 400 as const }
  const { data: mem } = await a.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) return { error: 'Sem permissão (só o dono/admin gere a equipa).', status: 403 as const }
  return { a, user, orgId, ownerName: prof?.name || '' }
}

// Mapeia o papel org_members → o "role" das escalas (team_members), para o
// funcionário aparecer com a função certa no /schedule.
const TEAM_ROLE: Record<string, string> = {
  admin: 'coordinator', nurse: 'nurse', assistant: 'caregiver',
  clinician: 'doctor', viewer: 'other',
}

function slugifyName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 24) || 'membro'
}
function genPassword(): string {
  // Palavra-passe TEMPORÁRIA, aleatoriedade criptográfica (randomInt), legível para
  // entregar em papel (sem 0/O/1/l/I). 14 chars: 4 maiúsculas + 6 minúsculas + 4
  // dígitos, baralhados. O funcionário deve trocá-la no 1º acesso.
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const num = '23456789'; const low = 'abcdefghijkmnpqrstuvwxyz'
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[randomInt(s.length)]).join('')
  const chars = (pick(abc, 4) + pick(low, 6) + pick(num, 4)).split('')
  // Fisher–Yates com randomInt (não viesa, não usa Math.random)
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.join('')
}

export async function GET(req: NextRequest) {
  const ctx = await requireManager(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { a, orgId } = ctx
  const { data: members } = await a.from('org_members')
    .select('user_id, role, department, active, joined_at')
    .eq('org_id', orgId).eq('active', true).order('joined_at')
  const ids = (members || []).map(m => m.user_id)
  const { data: profs } = ids.length
    ? await a.from('profiles').select('id, name, email').in('id', ids)
    : { data: [] as any[] }
  const byId: Record<string, any> = {}
  ;(profs || []).forEach((p: any) => { byId[p.id] = p })
  const team = (members || []).map(m => ({
    user_id: m.user_id, role: m.role, department: m.department,
    name: byId[m.user_id]?.name || '—', email: byId[m.user_id]?.email || '',
  }))
  // convites pendentes
  const { data: invites } = await a.from('org_invites')
    .select('email, role, created_at').eq('org_id', orgId).is('accepted_at', null).eq('revoked', false)
  return NextResponse.json({ team, invites: invites || [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireManager(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { a, orgId, ownerName, user } = ctx
  const body = await req.json().catch(() => ({}))
  const role = ['admin', 'nurse', 'assistant', 'clinician', 'viewer'].includes(body.role) ? body.role : 'assistant'

  // ── Modo "gerar login" — cria conta com password temporária, pronta a entregar ──
  if (body.mode === 'generate') {
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Indica o nome do funcionário.' }, { status: 400 })
    // email interno determinístico no domínio da app (não precisa de ser real)
    const base = slugifyName(name)
    const domain = 'equipa.phloxclinical.com'
    let emailAddr = `${base}@${domain}`
    // evita colisão acrescentando um sufixo curto
    const { data: exists } = await a.from('profiles').select('id').eq('email', emailAddr).maybeSingle()
    if (exists) emailAddr = `${base}.${Math.floor(Math.random() * 90 + 10)}@${domain}`
    const password = genPassword()

    const { data: created, error: cErr } = await a.auth.admin.createUser({
      email: emailAddr, password, email_confirm: true,
      user_metadata: { full_name: name, generated: true },
    })
    if (cErr || !created?.user) return NextResponse.json({ error: cErr?.message || 'Não consegui criar a conta.' }, { status: 400 })

    const newId = created.user.id
    // perfil clínico ligado à org
    await a.from('profiles').upsert({
      id: newId, email: emailAddr, name, plan: 'clinic',
      experience_mode: 'clinical', onboarded: true,
      org_id: orgId, active_org_id: orgId, org_role: role === 'admin' ? 'admin' : 'member',
    })
    await a.from('org_members').upsert({ org_id: orgId, user_id: newId, role, invited_by: user.id, active: true }, { onConflict: 'org_id,user_id' })

    // Torna o funcionário AGENDÁVEL logo: cria a linha team_members ligada à conta
    // (antes /equipa e /schedule eram sistemas separados — adicionar aqui não
    // aparecia nas escalas). Tolerante: se a tabela/coluna faltar, não parte.
    try {
      await a.from('team_members').upsert(
        { org_id: orgId, user_id: newId, name, role: TEAM_ROLE[role] || 'other', status: 'off' },
        { onConflict: 'org_id,user_id' }
      )
    } catch { /* team_members sem user_id nesta BD → ignora */ }

    // devolve as credenciais UMA vez (para imprimir/entregar)
    return NextResponse.json({ ok: true, mode: 'generate', login: { name, username: emailAddr, password, role } })
  }

  // ── Modo "convite por email" — usa org_invites + email ──
  if (body.mode === 'invite') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    const inviteRole = ['admin', 'nurse', 'assistant', 'clinician', 'viewer'].includes(body.role) ? body.role : 'assistant'
    // Token do convite: 256 bits de aleatoriedade criptográfica (sem fallback fraco).
    const token = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
    const { error: iErr } = await a.from('org_invites').insert({
      org_id: orgId, email, role: inviteRole, token, expires_at: expires, invited_by: user.id,
    })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 })
    const url = `https://phloxclinical.com/convite/${token}`
    const t = emailLayout({
      heading: 'Foi convidado para uma equipa no Phlox',
      body: `<p style="margin:0 0 12px">${ownerName ? ownerName + ' convidou-o' : 'Convidaram-no'} para se juntar à equipa no Phlox Clinical.</p>
             <p style="margin:0">Carregue no botão para criar a sua conta e entrar.</p>`,
      cta: { label: 'Aceitar convite', url },
    })
    sendEmail({ to: email, subject: 'Convite para a equipa — Phlox', html: t }).catch(() => {})
    return NextResponse.json({ ok: true, mode: 'invite', email, url })
  }

  return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireManager(req)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { a, orgId, user } = ctx
  const body = await req.json().catch(() => ({}))
  const target = String(body.memberUserId || '')
  if (!target) return NextResponse.json({ error: 'Falta o membro.' }, { status: 400 })
  if (target === user.id) return NextResponse.json({ error: 'Não te podes remover a ti próprio.' }, { status: 400 })
  // não permitir remover o owner
  const { data: m } = await a.from('org_members').select('role').eq('org_id', orgId).eq('user_id', target).maybeSingle()
  if (m?.role === 'owner') return NextResponse.json({ error: 'O dono não pode ser removido.' }, { status: 400 })
  await a.from('org_members').update({ active: false }).eq('org_id', orgId).eq('user_id', target)

  // Tirar MESMO o acesso institucional ao removido: se ainda pertencer a outra org
  // ativa, aponta o perfil para essa; caso contrário, despromove para o plano grátis
  // e limpa a org ativa. Sem isto, a conta mantinha plano clínico (bug reportado).
  const { data: other } = await a.from('org_members').select('org_id').eq('user_id', target).eq('active', true).neq('org_id', orgId).limit(1).maybeSingle()
  if (other?.org_id) {
    await a.from('profiles').update({ active_org_id: other.org_id, org_id: other.org_id }).eq('id', target)
  } else {
    await a.from('profiles').update({ active_org_id: null, org_id: null, plan: 'free' }).eq('id', target)
  }
  return NextResponse.json({ ok: true })
}
