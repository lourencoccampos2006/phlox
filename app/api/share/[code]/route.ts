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

  const { data: docs, error: erroDocs } = await db.from('health_vault')
    .select('id,title,category,notes,body_text,body_url,storage_path,file_name,file_type,issued_at,expires_at,tags')
    .in('id', share.vault_ids || [])
  if (erroDocs) {
    return NextResponse.json({ status: 'not_found', detalhe: 'Não foi possível ler os documentos.' }, { status: 500 })
  }

  // ── O ficheiro tem de vir com o documento ────────────────────────────────
  // Desde o sprint147 o ficheiro vive num bucket PRIVADO, e a linha guarda só
  // o caminho. Esta rota continuava a devolver apenas `body_url` — que nos
  // documentos novos é null. Resultado: partilhava-se um exame a um médico e
  // ele abria uma página com o título e sem o exame.
  //
  // Quem recebe o código não tem conta, por isso não pode ler o bucket. Gera-se
  // aqui um URL assinado, com a validade do próprio código de partilha (no
  // máximo uma hora): o acesso ao ficheiro expira quando a partilha expirar,
  // e não fica um URL eterno a circular por email.
  const segundosAteExpirar = Math.floor((new Date(share.expires_at).getTime() - Date.now()) / 1000)
  const validade = Math.max(60, Math.min(segundosAteExpirar, 3600))

  const comFicheiro = await Promise.all((docs || []).map(async (d: any) => {
    if (!d.storage_path) return d
    const { data, error: e } = await db.storage.from('cofre').createSignedUrl(d.storage_path, validade)
    // Sem URL assinado mostra-se o resto do documento em vez de nada.
    return { ...d, ficheiro_url: e ? null : data?.signedUrl || null }
  }))

  return NextResponse.json({ docs: comFicheiro, remaining: Math.max(0, share.max_views - share.views - 1) })
}
