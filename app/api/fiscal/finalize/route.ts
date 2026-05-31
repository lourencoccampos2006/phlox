import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { buildFiscalDoc, type DocType } from '@/lib/fiscal'
import { recordAudit } from '@/lib/auditServer'

// Finaliza fiscalmente uma venda: aloca nº sequencial da série (atómico),
// encadeia o hash com o documento anterior, gera ATCUD + QR (formato AT).
// Server-side: a numeração e a cadeia têm de ser autoritativas e não-adulteráveis.

function authClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 60, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const saleId: string | undefined = body?.saleId
  if (!saleId) return NextResponse.json({ error: 'saleId em falta' }, { status: 400 })

  const sb = authClient(req)
  const { data: sale, error: sErr } = await sb.from('sales').select('*').eq('id', saleId).eq('user_id', userId).maybeSingle()
  if (sErr || !sale) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  if (sale.doc_no) return NextResponse.json({ ok: true, alreadyFinalized: true, docNo: sale.doc_no, atcud: sale.atcud, qrData: sale.qr_data, hash4: sale.hash4 })

  const { data: fsettings } = await sb.from('fiscal_settings').select('*').eq('user_id', userId).maybeSingle()
  const docType: DocType = (body?.docType || sale.doc_type || fsettings?.default_doc_type || 'FS') as DocType
  const series: string = body?.series || sale.series || fsettings?.default_series || 'A'
  const year = new Date(sale.at || Date.now()).getFullYear()

  // série + código ATCUD validado (se a instituição o tiver registado)
  const { data: serieRow } = await sb.from('doc_series').select('atcud_code').eq('user_id', userId).eq('doc_type', docType).eq('series', series).eq('year', year).maybeSingle()

  // alocar nº sequencial atómico (RPC). Fallback: contar + 1 se a função não existir.
  let seq: number | null = null
  const rpc = await sb.rpc('next_doc_seq', { p_user: userId, p_type: docType, p_series: series, p_year: year })
  if (!rpc.error && typeof rpc.data === 'number') seq = rpc.data
  if (seq == null) {
    const { count } = await sb.from('sales').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('doc_type', docType).eq('series', series).not('seq', 'is', null)
    seq = (count || 0) + 1
  }

  // hash do documento anterior da MESMA série/ano (cadeia)
  const { data: prev } = await sb.from('sales').select('doc_hash,seq').eq('user_id', userId).eq('doc_type', docType).eq('series', series).not('doc_hash', 'is', null).order('seq', { ascending: false }).limit(1).maybeSingle()

  const gross = Math.max(0, (Number(sale.gross) || 0) - (Number(sale.discount) || 0))
  const taxRate = Number(sale.tax_rate) || 0
  const net = taxRate > 0 ? gross / (1 + taxRate / 100) : gross
  const tax = gross - net
  const date = new Date(sale.at || Date.now()).toISOString().slice(0, 10)

  const fiscal = await buildFiscalDoc(
    { docType, series, seq, year, date, netTotal: net, taxTotal: tax, grossTotal: gross, prevHash: prev?.doc_hash || null },
    { atcudCode: serieRow?.atcud_code, emitterNif: fsettings?.nif || '999999990', customerNif: sale.nif || undefined, taxRate }
  )

  const { error: uErr } = await sb.from('sales').update({
    doc_type: docType, series, seq, doc_no: fiscal.docNo,
    doc_hash: fiscal.hash, prev_hash: prev?.doc_hash || null, hash4: fiscal.hash4,
    atcud: fiscal.atcud, qr_data: fiscal.qrData, finalized_at: fiscal.finalizedAt,
  }).eq('id', saleId).eq('user_id', userId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  // Audit trail
  recordAudit({
    user_id: userId, action: docType === 'NC' ? 'credit_note.issued' : 'sale.finalized',
    category: 'billing', resource: 'sale', resource_id: saleId,
    detail: { docNo: fiscal.docNo, atcud: fiscal.atcud, gross },
  }).catch(() => { /* silent */ })

  return NextResponse.json({ ok: true, docNo: fiscal.docNo, atcud: fiscal.atcud, qrData: fiscal.qrData, hash4: fiscal.hash4, seq })
}
