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
import { sendEmail, emailLayout, teamInviteEmail } from '@/lib/email'
import { normalizarPapel, orgRoleAntigo, PAPEL_NA_ESCALA } from '@/lib/permissoes'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Resolve o utilizador a partir do Bearer token e confirma que é owner/admin da org.
async function requireManager(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('[phlox:org-team] SUPABASE_SERVICE_ROLE_KEY missing'); return { error: 'A gestão de equipa ainda não está ativa nesta conta.', status: 503 as const } }
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
  // Os dois vocabularios: entre este codigo subir e a migracao (sprint152)
  // correr, a base de dados ainda tem os papeis antigos.
  if (!mem || !['owner', 'admin', 'dono', 'direcao'].includes(mem.role)) {
    return { error: 'Não tem acesso a gerir a equipa.', status: 403 as const }
  }
  return { a, user, orgId, ownerName: prof?.name || '' }
}

// Mapeia o papel org_members → o "role" das escalas (team_members), para o
// funcionário aparecer com a função certa em /equipa?tab=escalas.
//
// Era uma lista à mão com os papéis ANTIGOS (`admin`, `nurse`, `clinician`).
// Depois do sprint152 nenhum deles é escrito, por isso `TEAM_ROLE[papel]` dava
// sempre `undefined` e toda a gente entrava na escala como "outro" — sem erro
// nenhum a dizê-lo. Agora vem de lib/permissoes, que é onde os papéis vivem.

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
  // O papel vem da interface. `normalizarPapel` aceita os dois vocabulários
  // (um separador aberto de ontem manda o antigo) e devolve sempre um dos sete
  // novos — ou null, e aí diz-se que não se percebeu em vez de escolher um.
  //
  // A versão anterior era `[...antigos].includes(body.role) ? body.role :
  // 'assistant'`: assim que a interface passou a mandar `direcao`, a lista não
  // o reconhecia e TODA A GENTE entrava como auxiliar, sem erro nenhum.
  const papel = normalizarPapel(body.role)
  if (!papel) {
    return NextResponse.json({ error: 'Escolha a função desta pessoa na casa.' }, { status: 400 })
  }
  if (papel === 'dono') {
    // O Dono não se atribui: herda-se ao criar a casa. Deixar dar o papel por
    // aqui seria uma forma de qualquer gestor criar um segundo dono.
    return NextResponse.json({ error: 'O papel de Dono não se atribui.' }, { status: 400 })
  }
  const role = papel

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
    // Perfil ligado à org. plan='free' de propósito: o acesso clínico vem da
    // PERTENÇA à org (getUserPlan promove membros a 'clinic' efetivo), por isso
    // o funcionário tem limites gratuitos FORA da instituição mas trabalha nela.
    await a.from('profiles').upsert({
      id: newId, email: emailAddr, name, plan: 'free',
      experience_mode: 'clinical', onboarded: true,
      // `profiles.org_role` e uma copia grosseira (owner/admin/member) do papel
      // real, que vive em `org_members.role`. Mantem-se por compatibilidade.
      org_id: orgId, active_org_id: orgId,
      org_role: orgRoleAntigo(papel),
    })
    await a.from('org_members').upsert({ org_id: orgId, user_id: newId, role, invited_by: user.id, active: true }, { onConflict: 'org_id,user_id' })

    // Torna o funcionário AGENDÁVEL logo: cria a linha team_members ligada à conta
    // (a conta e as escalas partilham a mesma página /equipa, mas são tabelas
    // diferentes). supabase-js não lança exceção em erro de query — tem de se
    // verificar .error explicitamente, senão uma falha fica invisível.
    const { error: tmErr } = await a.from('team_members').upsert(
      { org_id: orgId, user_id: newId, name, role: PAPEL_NA_ESCALA[papel] || 'other', status: 'off' },
      { onConflict: 'org_id,user_id' }
    )
    if (tmErr) console.error('[phlox:org-team] criar perfil em team_members falhou:', tmErr.message)

    // devolve as credenciais UMA vez (para imprimir/entregar)
    return NextResponse.json({ ok: true, mode: 'generate', login: { name, username: emailAddr, password, role } })
  }

  // ── Modo "convite por email" — usa org_invites + email ──
  if (body.mode === 'invite') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    // O mesmo papel já normalizado acima — não se volta a ler `body.role`, que
    // era como as duas metades desta rota acabavam a discordar uma da outra.
    const inviteRole = papel

    // BUG CORRIGIDO: se o email JÁ tem conta Phlox, o convite por link nunca dava
    // acesso (a pessoa ficava com o plano dela, ex. student, sem entrar na org).
    // Agora, se a conta existe, ADICIONAMO-LA já à organização — sem esperar clique.
    const { data: existing } = await a.from('profiles').select('id, name, active_org_id, org_id').eq('email', email).maybeSingle()
    if (existing?.id) {
      await a.from('org_members').upsert(
        { org_id: orgId, user_id: existing.id, role: inviteRole, invited_by: user.id, active: true },
        { onConflict: 'org_id,user_id' }
      )
      // Aponta a org ATIVA para esta (é para cá que a pessoa é convidada) e mete
      // em modo clínico. NÃO tocamos no plano de faturação: o acesso institucional
      // vem da pertença (effectivePlan/getUserPlan dão-lhe 'clinic' no modo clínico).
      const patch: any = { experience_mode: 'clinical', org_id: orgId, active_org_id: orgId, org_role: orgRoleAntigo(papel), onboarded: true }
      await a.from('profiles').update(patch).eq('id', existing.id)
      const { error: tmErr } = await a.from('team_members').upsert(
        { org_id: orgId, user_id: existing.id, name: existing.name || email, role: PAPEL_NA_ESCALA[papel] || 'other', status: 'off' },
        { onConflict: 'org_id,user_id' }
      )
      if (tmErr) console.error('[phlox:org-team] criar perfil em team_members falhou (convite existente):', tmErr.message)

      // Avisar quem foi adicionado. Este caminho — conta que JÁ existe — dava
      // acesso a uma instituição e não dizia nada a ninguém: a pessoa entrava
      // um dia qualquer e encontrava uma casa inteira na conta dela, sem
      // perceber porquê. Quem é convidado pelo outro caminho (sem conta) já
      // recebia email; este não.
      try {
        const { data: casa } = await a.from('organizations').select('name').eq('id', orgId).maybeSingle()
        const { subject, html } = teamInviteEmail(casa?.name || 'equipa', ownerName || 'Alguém da equipa')
        sendEmail({ to: email, subject, html }).catch(() => {})
      } catch { /* o convite vale por si; o email é um extra */ }

      return NextResponse.json({ ok: true, mode: 'added', email, name: existing.name || email })
    }

    // Token do convite: 256 bits de aleatoriedade criptográfica (sem fallback fraco).
    const token = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
    const { error: iErr } = await a.from('org_invites').insert({
      org_id: orgId, email, role: inviteRole, token, expires_at: expires, invited_by: user.id,
    })
    if (iErr) { console.error('[phlox:org-team] criar convite falhou:', iErr.message); return NextResponse.json({ error: 'Não foi possível criar o convite agora. Tente novamente.' }, { status: 400 }) }
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
  if (['owner', 'dono'].includes(m?.role)) {
    return NextResponse.json({ error: 'O dono não pode ser removido.' }, { status: 400 })
  }
  await a.from('org_members').update({ active: false }).eq('org_id', orgId).eq('user_id', target)

  // Tirar MESMO o acesso institucional ao removido: se ainda pertencer a outra org
  // ativa, aponta o perfil para essa; caso contrário, despromove para o plano grátis
  // e limpa a org ativa. Sem isto, a conta mantinha plano clínico (bug reportado).
  const { data: other } = await a.from('org_members').select('org_id').eq('user_id', target).eq('active', true).neq('org_id', orgId).limit(1).maybeSingle()
  if (other?.org_id) {
    await a.from('profiles').update({ active_org_id: other.org_id, org_id: other.org_id }).eq('id', target)
  } else {
    // 2026-09-11: faltava aqui o `experience_mode`. O POST em cima põe-no a
    // 'clinical' (linhas 124 e 161) e é ESSE campo — não o plano — que faz o
    // /inicio e o /painel arrancarem no modo institucional. Limpar só o plano
    // e a org deixava a pessoa a entrar numa instituição vazia: perdia os
    // dados, mas continuava a ver a casa toda como interface. Daí o
    // "continua a ter conta institucional".
    //
    // O org_role e o institution_type vão pelo mesmo motivo: são resíduo de
    // uma pertença que já não existe, e o institution_type ainda mudava o
    // vocabulário da aplicação inteira ("utente", "residente") a alguém que
    // já não trabalha em lado nenhum.
    await a.from('profiles').update({
      active_org_id: null,
      org_id: null,
      plan: 'free',
      experience_mode: 'personal',
      org_role: null,
      institution_type: null,
    }).eq('id', target)
  }

  // A linha das escalas. Sem isto, quem saiu continuava a aparecer como
  // agendável em /schedule e /equipa — não tinha acesso, mas o turno ainda lhe
  // podia ser atribuído, e alguém contava com ela.
  //
  // Apaga-se a linha em vez de a marcar: o `status` de team_members é o estado
  // de turno ('on_shift', 'sick', 'vacation'…), não pertença — pô-lo a 'off'
  // diria "está de folga", que é outra coisa. O filtro é pelo par org+conta,
  // por isso só desaparece a linha que o convite criou; as pessoas que alguém
  // escreveu à mão na escala (sem conta ligada) ficam onde estão. Os turnos já
  // passados que apontem para esta linha continuam a desenhar — o /equipa já
  // ignora atribuições sem membro (components/team/EscalasEquipa.tsx).
  const { error: tmErr } = await a.from('team_members')
    .delete().eq('org_id', orgId).eq('user_id', target)
  if (tmErr) console.error('[phlox:org-team] remover de team_members falhou:', tmErr.message)

  return NextResponse.json({ ok: true })
}
