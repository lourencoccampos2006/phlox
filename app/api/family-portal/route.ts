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

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 60, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const code = req.nextUrl.searchParams.get('code') || ''
  const pat = await resolveCode(code)
  if (!pat) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  const sb = admin()
  const { data: msgs } = await sb.from('family_thread_messages')
    .select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at')
    .eq('patient_id', pat.id).order('created_at', { ascending: true }).limit(200)

  return NextResponse.json({
    patient: { name: pat.name, room_number: pat.room_number },
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
  if (!content) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const pat = await resolveCode(body.code)
  if (!pat) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  const sb = admin()
  const { data, error } = await sb.from('family_thread_messages').insert({
    user_id: pat.user_id,
    patient_id: pat.id,
    author_side: 'family',
    author_name: String(body.name || '').trim().slice(0, 60) || 'Família',
    kind: 'message',
    content: content.slice(0, 2000),
    read_by_family: true,
    read_by_staff: false,
  }).select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at').single()

  if (error) return NextResponse.json({ error: 'Não foi possível enviar' }, { status: 500 })
  return NextResponse.json({ message: data })
}
