import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Portal família: acesso por código do residente, validado server-side (service role).
// Sem expor user_id nem outros residentes. Só o fio do residente correspondente ao código.

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function resolveCode(code: string) {
  if (!code || code.length < 4) return null
  const sb = admin()
  const { data } = await sb.from('patients').select('id, name, room_number, user_id').eq('family_code', code.toUpperCase().trim()).maybeSingle()
  return data || null
}

const last4 = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-4)

// Verifica os últimos 4 dígitos do telemóvel contra os contactos registados do residente.
// Devolve o contacto correspondente, ou null. Se o residente não tiver telefones, dispensa (gate aberto).
async function verifyFamily(patientId: string, digits: string): Promise<{ ok: boolean; gated: boolean; contact?: any }> {
  const sb = admin()
  const { data: contacts } = await sb.from('resident_contacts').select('id, name, phone').eq('patient_id', patientId)
  const withPhone = (contacts || []).filter((c: any) => last4(c.phone).length === 4)
  if (withPhone.length === 0) return { ok: true, gated: false } // sem telefones → não há como verificar
  const d = (digits || '').replace(/\D/g, '').slice(-4)
  const match = withPhone.find((c: any) => last4(c.phone) === d)
  return { ok: !!match, gated: true, contact: match }
}

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 60, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const code = req.nextUrl.searchParams.get('code') || ''
  const verify = req.nextUrl.searchParams.get('verify') || ''
  const pat = await resolveCode(code)
  if (!pat) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  const v = await verifyFamily(pat.id, verify)
  if (v.gated && !v.ok) {
    // código válido mas falta (ou está errada) a verificação por telemóvel
    return NextResponse.json({ needsVerify: true, patientName: pat.name, error: verify ? 'Os dígitos não correspondem ao contacto registado.' : '' }, { status: 200 })
  }

  const sb = admin()
  const { data: msgs } = await sb.from('family_thread_messages')
    .select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at')
    .eq('patient_id', pat.id).order('created_at', { ascending: true }).limit(200)

  return NextResponse.json({
    patient: { name: pat.name, room_number: pat.room_number },
    contactName: v.contact?.name || null,
    messages: msgs || [],
  })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 30, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.code) return NextResponse.json({ error: 'Código em falta' }, { status: 400 })
  const content = String(body.content || '').trim()
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  if (!content && !imageBase64) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const pat = await resolveCode(body.code)
  if (!pat) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  const v = await verifyFamily(pat.id, String(body.verify || ''))
  if (v.gated && !v.ok) return NextResponse.json({ error: 'Verificação necessária' }, { status: 403 })

  const sb = admin()

  // Upload de foto (opcional) — limite ~4MB de base64
  let photo_url: string | null = null
  if (imageBase64 && imageBase64.length < 5_500_000) {
    try {
      const buf = Buffer.from(imageBase64, 'base64')
      const path = `${pat.user_id}/${pat.id}/fam-${Date.now()}.jpg`
      const up = await sb.storage.from('family').upload(path, buf, { contentType: 'image/jpeg', upsert: false })
      if (!up.error) photo_url = sb.storage.from('family').getPublicUrl(path).data.publicUrl
    } catch { /* segue sem foto */ }
  }

  const { data, error } = await sb.from('family_thread_messages').insert({
    user_id: pat.user_id,
    patient_id: pat.id,
    author_side: 'family',
    contact_id: v.contact?.id || null,
    author_name: v.contact?.name || String(body.name || '').trim().slice(0, 60) || 'Família',
    kind: photo_url ? 'photo' : 'message',
    content: content.slice(0, 2000) || null,
    photo_url,
    read_by_family: true,
    read_by_staff: false,
  }).select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at').single()

  if (error) return NextResponse.json({ error: 'Não foi possível enviar' }, { status: 500 })
  return NextResponse.json({ message: data })
}
