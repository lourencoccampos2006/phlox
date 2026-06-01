// app/api/share/[code]/route.ts
// Endpoint público (sem auth) que devolve os documentos partilhados por um
// código temporário. Usa SUPABASE_SERVICE_ROLE_KEY porque o destinatário não
// tem login; validação é apenas pelo código + expiração + max_views.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { code } = await ctx.params
  if (!code || code.length < 4) return NextResponse.json({ status: 'not_found' })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ status: 'not_found' }, { status: 503 })
  }

  const db = adminClient()
  const { data: share, error } = await db.from('health_vault_shares').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error || !share) return NextResponse.json({ status: 'not_found' })

  if (new Date(share.expires_at).getTime() < Date.now()) return NextResponse.json({ status: 'expired' })
  if (share.views >= share.max_views) return NextResponse.json({ status: 'maxed' })

  // Conta visualização
  await db.from('health_vault_shares').update({ views: (share.views || 0) + 1 }).eq('id', share.id)

  const { data: docs } = await db.from('health_vault')
    .select('id,title,category,notes,body_text,issued_at,expires_at,tags')
    .in('id', share.vault_ids || [])

  return NextResponse.json({ docs: docs || [], remaining: Math.max(0, share.max_views - share.views - 1) })
}
