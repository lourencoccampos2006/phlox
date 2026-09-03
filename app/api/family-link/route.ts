// app/api/family-link/route.ts
// Liga um perfil de família (family_profiles) a um residente institucional
// (patients, por código + verificação de telefone) — a versão autenticada e
// persistida do que /portal-familia fazia só em localStorage (2026-08-09,
// /portal-familia extinta, absorvida em /familia). A leitura do dia-a-dia
// continua a ser feita pela rota já testada app/api/family-portal/route.ts,
// com o code/verify guardados aqui — esta rota só TRATA da ligação em si.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { admin, resolveCode, codeErrorResponse as codeErrorInfo, verifyFamily, HAS_SERVICE_KEY } from '@/lib/familyPortal'

// Sem chave de serviço não há como ler nem escrever ligações de família: o
// admin() nasce com a chave a undefined e todas as consultas falham. Isso saía
// como 500 ("Não foi possível carregar as ligações"), e o /familia parecia
// avariado quando na verdade era configuração em falta. Era a única rota do
// projeto fora do padrão — as outras devolvem 503 com explicação.
const semChave = () => NextResponse.json(
  { error: 'Esta parte ainda não está disponível nesta conta.' }, { status: 503 })

async function authedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  if (!HAS_SERVICE_KEY) return semChave()
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const user = await authedUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const a = admin()
  const { data, error } = await a.from('family_institution_links').select('id, family_profile_id, patient_id, patient_name, code, verify_digits, created_at').eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Não foi possível carregar as ligações.' }, { status: 500 })
  return NextResponse.json({ links: data || [] })
}

export async function POST(req: NextRequest) {
  if (!HAS_SERVICE_KEY) return semChave()
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const user = await authedUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  let familyProfileId = String(body?.family_profile_id || '')
  const code = String(body?.code || '')
  const verify = String(body?.verify || '')
  // "relation" só é usada quando NÃO há family_profile_id — é o caso novo
  // (2026-08-10) de criar o perfil DE RAIZ a partir do código, em vez de ligar
  // um perfil já existente. Sem isto, "+ Adicionar familiar" só sabia ligar
  // um perfil manual já criado — nunca criar um a partir da instituição.
  const relation = String(body?.relation || '').trim().slice(0, 40) || null
  if (!code) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 })

  const a = admin()
  let profile: { id: string; user_id: string } | null = null
  if (familyProfileId) {
    // O perfil tem de ser mesmo deste utilizador — nunca confiar só no id vindo do cliente.
    const { data } = await a.from('family_profiles').select('id, user_id').eq('id', familyProfileId).maybeSingle()
    if (!data || data.user_id !== user.id) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 })
    profile = data
  }

  const r = await resolveCode(code)
  if ('errorCode' in r) { const { error, status } = codeErrorInfo(r.errorCode); return NextResponse.json({ error }, { status }) }
  const pat = r.patient

  const v = await verifyFamily(pat.id, verify)
  if (v.noContacts) return NextResponse.json({ needsVerify: true, noContacts: true, patientName: pat.name, error: 'Por segurança, peça à instituição para registar o seu contacto telefónico antes de ligar.' })
  if (v.gated && !v.ok) return NextResponse.json({ needsVerify: true, patientName: pat.name, error: verify ? 'Os dígitos não correspondem ao contacto registado.' : '' })

  let createdProfile = false
  if (!profile) {
    // Cria o perfil AGORA, com o nome real vindo da instituição — a família
    // não escreve nada, é o lar que já mantém estes dados (decisão do
    // Fernando: a instituição passa a ser a fonte oficial).
    const { data: created, error: createErr } = await a.from('family_profiles')
      .insert({ user_id: user.id, name: pat.name, relation }).select('id, user_id').single()
    if (createErr || !created) return NextResponse.json({ error: 'Não foi possível criar o perfil agora.' }, { status: 500 })
    profile = created
    familyProfileId = created.id
    createdProfile = true
  }

  const { error } = await a.from('family_institution_links').upsert({
    user_id: user.id, family_profile_id: familyProfileId, patient_id: pat.id,
    patient_name: pat.name, code: code.toUpperCase().trim(), verify_digits: verify.replace(/\D/g, '').slice(-4),
  }, { onConflict: 'family_profile_id' })
  if (error) {
    // Já criámos o perfil mas a ligação falhou — não deixar um perfil "fantasma"
    // sem ligação nenhuma (a família ficaria com um perfil vazio, sem saber porquê).
    if (createdProfile) await a.from('family_profiles').delete().eq('id', familyProfileId)
    return NextResponse.json({ error: 'Não foi possível ligar agora.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, patientName: pat.name, familyProfileId })
}

export async function DELETE(req: NextRequest) {
  if (!HAS_SERVICE_KEY) return semChave()
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const user = await authedUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const familyProfileId = req.nextUrl.searchParams.get('family_profile_id') || ''
  if (!familyProfileId) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 })
  const a = admin()
  const { error } = await a.from('family_institution_links').delete().eq('family_profile_id', familyProfileId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Não foi possível desligar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
