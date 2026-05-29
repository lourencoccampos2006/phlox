import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { toMoloni, toInvoiceXpress, toVendus, type SaleRecord } from '@/lib/posExport'

// Emissão de documento no software de faturação certificado do cliente (opcional).
// O Phlox não é certificado — delega a emissão fiscal no provedor configurado.
// Lê a chave de API a partir de invoice_settings (server-side; nunca exposta ao cliente).

function authClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 30, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sale: SaleRecord | undefined = body?.sale
  if (!sale) return NextResponse.json({ error: 'Venda em falta' }, { status: 400 })

  const sb = authClient(req)
  const { data: cfg } = await sb.from('invoice_settings').select('*').eq('user_id', userId).maybeSingle()
  if (!cfg || cfg.provider === 'export' || !cfg.api_key) {
    return NextResponse.json({ error: 'Sem integração de emissão configurada. Usa a exportação de ficheiros.', needsSetup: true }, { status: 409 })
  }

  try {
    let ref = '', docNumber = ''
    if (cfg.provider === 'invoicexpress') {
      const account = cfg.account_id || ''
      const docType = (cfg.doc_type || 'fatura_recibo') === 'fatura_recibo' ? 'invoice_receipts' : 'invoices'
      const r = await fetch(`https://${account}.app.invoicexpress.com/${docType}.json?api_key=${encodeURIComponent(cfg.api_key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(toInvoiceXpress(sale)),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.errors || `InvoiceXpress ${r.status}`)
      ref = String(j?.invoice?.id || j?.invoice_receipt?.id || '')
      docNumber = String(j?.invoice?.inverted_sequence_number || j?.invoice?.sequence_number || '')
    } else if (cfg.provider === 'moloni') {
      const r = await fetch(`https://api.moloni.pt/v1/invoices/insert/?access_token=${encodeURIComponent(cfg.api_key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: cfg.account_id, ...toMoloni(sale) }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.errors) throw new Error(j?.errors ? JSON.stringify(j.errors) : `Moloni ${r.status}`)
      ref = String(j?.document_id || '')
    } else if (cfg.provider === 'vendus') {
      const auth = Buffer.from(`${cfg.api_key}:`).toString('base64')
      const r = await fetch('https://www.vendus.pt/ws/v1.1/documents/', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify(toVendus(sale)),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.errors || `Vendus ${r.status}`)
      ref = String(j?.id || '')
      docNumber = String(j?.number || '')
    } else {
      return NextResponse.json({ error: 'Provedor não suportado para emissão automática.' }, { status: 400 })
    }

    // marca a venda como exportada/emitida + auditoria
    if (sale.id) await sb.from('sales').update({ exported: true, export_ref: ref, doc_number: docNumber || sale.doc_number || null, provider: cfg.provider }).eq('id', sale.id).eq('user_id', userId)
    await sb.from('fiscal_exports').insert({ user_id: userId, kind: cfg.provider, rows: 1, total: Math.max(0, (sale.gross || 0) - (sale.discount || 0)), ref, status: 'ok' })

    return NextResponse.json({ ok: true, ref, docNumber, provider: cfg.provider })
  } catch (e: any) {
    await sb.from('fiscal_exports').insert({ user_id: userId, kind: cfg.provider, rows: 1, status: 'error', detail: String(e?.message || e).slice(0, 300) }).then(() => {}, () => {})
    return NextResponse.json({ error: `Falha na emissão: ${String(e?.message || e).slice(0, 200)}` }, { status: 502 })
  }
}
