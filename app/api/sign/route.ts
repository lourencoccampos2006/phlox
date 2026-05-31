import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { canonical, signHmac } from '@/lib/signDoc'
import { recordAudit } from '@/lib/auditServer'

// POST /api/sign — assina um documento canónico e devolve o ID + URL pública /v/{id}.
// O cliente envia { kind, title, data }. O servidor canoniza, assina e guarda.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const secret = process.env.PHLOX_SIGN_SECRET
  if (!secret) return NextResponse.json({ error: 'PHLOX_SIGN_SECRET não está definida no servidor.' }, { status: 503 })

  const body = await req.json().catch(() => null)
  if (!body?.kind || !body?.title) return NextResponse.json({ error: 'kind e title são obrigatórios' }, { status: 400 })

  const sb = admin()
  const id = crypto.randomUUID()
  const signed_at = new Date().toISOString()
  const payload = {
    id, user_id: userId, kind: String(body.kind).slice(0, 40), title: String(body.title).slice(0, 200),
    data: body.data || {}, signed_at,
  }
  const signature = await signHmac(secret, canonical(payload))

  const { data: prof } = await sb.from('profiles').select('name').eq('id', userId).maybeSingle()

  const { error } = await sb.from('signed_docs').insert({
    id, user_id: userId, kind: payload.kind, title: payload.title,
    payload, signature, signed_at, signer_name: prof?.name || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAudit({ user_id: userId, action: 'document.signed' as any, category: 'data', resource: 'signed_doc', resource_id: id, detail: { kind: payload.kind } }).catch(() => {})

  const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'phloxclinical.com'}`
  return NextResponse.json({ ok: true, id, url: `${origin}/v/${id}`, signed_at })
}
