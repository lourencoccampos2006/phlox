import { NextRequest, NextResponse } from 'next/server'
import { authedClient } from '@/lib/orgAuth'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sendSMS, sendWhatsApp, HAS_SMS, HAS_WHATSAPP } from '@/lib/notify'

// POST /api/notify-family — envia um SMS/WhatsApp real aos contactos com
// telefone registado de um utente (resident_contacts). SEMPRE além da
// mensagem no fio in-app (family_thread_messages) que os chamadores já
// escrevem antes de chamar isto — nunca substitui, só soma. 2026-08-11.
//
// Autenticado com o token do próprio utilizador (authedClient) — a RLS de
// resident_contacts/patients já garante que só vê contactos da SUA
// instituição; não precisa de service role.
export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()

  const supabase = authedClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!HAS_SMS && !HAS_WHATSAPP) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const patientId = String(body?.patientId || '')
  const text = String(body?.body || '').trim().slice(0, 600)
  const channel: 'sms' | 'whatsapp' | 'auto' = body?.channel === 'whatsapp' ? 'whatsapp' : body?.channel === 'sms' ? 'sms' : 'auto'
  if (!patientId || !text) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 })

  const { data: contacts, error } = await supabase.from('resident_contacts').select('id,name,phone').eq('patient_id', patientId)
  if (error) return NextResponse.json({ error: 'Não foi possível carregar os contactos.' }, { status: 500 })
  const withPhone = ((contacts || []) as any[]).filter(c => c.phone && String(c.phone).trim())
  if (!withPhone.length) return NextResponse.json({ error: 'Sem telefone registado para nenhum contacto deste utente.' }, { status: 404 })

  const preferWhatsApp = channel === 'whatsapp' || (channel === 'auto' && HAS_WHATSAPP)
  const results = await Promise.all(withPhone.map(async (c: any) => {
    let r = preferWhatsApp ? await sendWhatsApp(c.phone, text) : await sendSMS(c.phone, text)
    // Em modo automático, se o WhatsApp falhar (ex: template não aprovado
    // ainda), cai para SMS em vez de simplesmente falhar em silêncio.
    if (!r.ok && preferWhatsApp && channel === 'auto' && HAS_SMS) r = await sendSMS(c.phone, text)
    return { contact: c.name, ok: r.ok, error: r.ok ? null : (r as any).error }
  }))

  const anyOk = results.some(r => r.ok)
  return NextResponse.json({ ok: anyOk, results })
}
