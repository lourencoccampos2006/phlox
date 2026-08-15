import { NextRequest, NextResponse } from 'next/server'
import { authedClient } from '@/lib/orgAuth'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sendSMS, sendWhatsApp, HAS_SMS, HAS_WHATSAPP } from '@/lib/notify'

// GET/POST /api/notify-family/test — testar a ligação SMS/WhatsApp sem
// precisar de um utente/contacto real. 2026-08-11 (o Fernando está em trial
// da Twilio, só pode enviar para números que ele próprio verificou lá — isto
// deixa-o confirmar que o Phlox consegue mesmo enviar, com o seu telemóvel).
export async function GET(req: NextRequest) {
  const supabase = authedClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({ hasSms: HAS_SMS, hasWhatsapp: HAS_WHATSAPP })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const supabase = authedClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const to = String(body?.to || '').trim()
  const channel: 'sms' | 'whatsapp' = body?.channel === 'whatsapp' ? 'whatsapp' : 'sms'
  if (!to) return NextResponse.json({ error: 'Indique um número.' }, { status: 400 })

  if (channel === 'whatsapp' && !HAS_WHATSAPP) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  if (channel === 'sms' && !HAS_SMS) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const text = 'Phlox: esta é uma mensagem de teste. Se a recebeu, as notificações estão a funcionar. 🌱'
  const r = channel === 'whatsapp' ? await sendWhatsApp(to, text) : await sendSMS(to, text)
  if (!r.ok) return NextResponse.json({ error: (r as any).error }, { status: 400 })
  return NextResponse.json({ ok: true, sid: (r as any).sid })
}
