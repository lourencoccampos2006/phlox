import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authApiKey, logApiUsage } from '@/lib/apiAuth'

// Phlox Public API · /api/v1/sales
//   GET  → lista vendas do período (scope sales:read)
//   POST → cria uma venda (scope sales:write)
// Auth: Bearer pk_live_... (rotável em /api-keys). Rate-limited por chave.

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authApiKey(req, 'sales:read')
  if (!auth.ok) return auth.response
  const url = new URL(req.url)
  const from = url.searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const limit = Math.min(500, Number(url.searchParams.get('limit') || 100))

  const sb = adminClient()
  const { data, error } = await sb.from('sales')
    .select('id,at,kind,description,person_name,nif,gross,discount,tax_rate,method,paid,doc_no,doc_type,doc_status,atcud')
    .eq('user_id', auth.userId)
    .gte('at', `${from}T00:00:00Z`).lte('at', `${to}T23:59:59Z`)
    .order('at', { ascending: false }).limit(limit)
  const status = error ? 500 : 200
  const body = error ? { error: error.message } : { data: data || [], count: data?.length || 0, from, to }
  logApiUsage(auth.keyId, auth.userId, '/api/v1/sales', 'GET', status, Date.now() - t0)
  return NextResponse.json(body, { status })
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authApiKey(req, 'sales:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  if (!body || typeof body.gross !== 'number') return NextResponse.json({ error: 'Body inválido — gross obrigatório' }, { status: 400 })

  const sb = adminClient()
  const row = {
    user_id: auth.userId,
    kind: String(body.kind || 'venda').slice(0, 30),
    description: body.description ? String(body.description).slice(0, 200) : null,
    person_name: body.person_name ? String(body.person_name).slice(0, 80) : null,
    nif: body.nif ? String(body.nif).replace(/\D/g, '').slice(0, 9) : null,
    qty: Number(body.qty) || 1,
    gross: Number(body.gross),
    discount: Number(body.discount) || 0,
    tax_rate: Number(body.tax_rate) || 23,
    method: String(body.method || 'dinheiro').slice(0, 30),
    paid: body.paid !== false,
    professional: body.professional ? String(body.professional).slice(0, 80) : null,
  }
  const { data, error } = await sb.from('sales').insert(row).select('id,at,kind,gross,discount,tax_rate,method').single()
  const status = error ? 500 : 201
  const out = error ? { error: error.message } : { data }
  logApiUsage(auth.keyId, auth.userId, '/api/v1/sales', 'POST', status, Date.now() - t0)
  return NextResponse.json(out, { status })
}
