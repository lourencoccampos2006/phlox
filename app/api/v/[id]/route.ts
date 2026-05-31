import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canonical, signHmac, timingSafeEqualHex } from '@/lib/signDoc'

// GET /api/v/[id] — verifica publicamente a assinatura de um documento.
// Devolve o estado (válido / revogado / adulterado) e o título/kind/datas.
// NÃO expõe a chave HMAC. Sem dados sensíveis: o payload é o que o utilizador
// decidiu publicar como público.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, status: 'invalid_id' }, { status: 400 })

  const secret = process.env.PHLOX_SIGN_SECRET
  if (!secret) return NextResponse.json({ ok: false, status: 'server_not_ready' }, { status: 503 })

  const sb = admin()
  const { data } = await sb.from('signed_docs').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ ok: false, status: 'not_found' }, { status: 404 })

  if (data.revoked) return NextResponse.json({ ok: false, status: 'revoked', title: data.title, kind: data.kind, signed_at: data.signed_at, revoked_at: data.revoked_at })

  const expected = await signHmac(secret, canonical(data.payload))
  const valid = timingSafeEqualHex(expected, data.signature)

  return NextResponse.json({
    ok: valid,
    status: valid ? 'valid' : 'tampered',
    id: data.id,
    title: data.title,
    kind: data.kind,
    signed_at: data.signed_at,
    signer_name: data.signer_name,
    payload: data.public_view ? data.payload : undefined,
    fingerprint: data.signature.slice(0, 16),
  })
}
