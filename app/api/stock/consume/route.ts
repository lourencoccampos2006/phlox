// app/api/stock/consume/route.ts
// Consumo de stock a 1 toque + fluxo de reposição.
//   POST { item_id, qty }          → desconta, regista consumo, e se ficar <= min
//                                     avisa a equipa no mural (canal stock).
//   POST { item_id, action:'request'|'ordered'|'received', note? }
//                                     → muda o estado de reposição. 'received'
//                                       repõe e lança a despesa (unit_cost×qty).
// Org-scoped por RLS (token do utilizador). Push/despesa best-effort.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyOrgMembers } from '@/lib/notifyTeam'
import { sb } from '@/lib/orgAuth'

async function ctx(db: any) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: prof } = await db.from('profiles').select('active_org_id, org_id, name').eq('id', user.id).maybeSingle()
  return { user, orgId: prof?.active_org_id || prof?.org_id || null, name: prof?.name || 'Equipa' }
}

export async function POST(req: NextRequest) {
  const db = sb(req)
  const c = await ctx(db)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const body = await req.json().catch(() => ({}))
  const itemId = String(body.item_id || '')
  if (!itemId) return NextResponse.json({ error: 'item em falta' }, { status: 400 })
  const { data: item } = await db.from('stock_items').select('*').eq('id', itemId).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  const stamp = (row: any) => (c.orgId ? { ...row, org_id: c.orgId } : row)

  // ── Mudança de estado de reposição ──
  if (body.action) {
    if (body.action === 'request') {
      await db.from('stock_items').update({ reorder_status: 'requested', reorder_note: body.note || null, reorder_at: new Date().toISOString() }).eq('id', itemId)
      // avisa a equipa no mural (canal stock) + push
      await db.from('team_messages').insert(stamp({
        user_id: c.user.id, author_id: c.user.id, author_name: c.name, channel: 'stock',
        body: `📦 ${item.name} a acabar${body.note ? ` — ${body.note}` : ''}. Precisa de encomenda.`, priority: 'importante',
      })).then(() => {}, () => {})
      if (c.orgId) notifyOrgMembers(c.orgId, c.user.id, { title: '📦 Stock a acabar', body: `${item.name} — precisa de encomenda`, url: '/equipa?tab=mural', tag: 'stock'}).catch(() => {})
      return NextResponse.json({ ok: true, reorder_status: 'requested' })
    }
    if (body.action === 'ordered') {
      await db.from('stock_items').update({ reorder_status: 'ordered', reorder_at: new Date().toISOString() }).eq('id', itemId)
      await db.from('team_messages').insert(stamp({
        user_id: c.user.id, author_id: c.user.id, author_name: c.name, channel: 'stock',
        body: `✅ ${item.name} — encomendado. Já está tratado.`, priority: 'normal', resolved: true,
      })).then(() => {}, () => {})
      return NextResponse.json({ ok: true, reorder_status: 'ordered' })
    }
    if (body.action === 'received') {
      const addQty = Number(body.qty) > 0 ? Number(body.qty) : 0
      const newQty = Number(item.quantity || 0) + addQty
      await db.from('stock_items').update({ reorder_status: 'ok', quantity: newQty, reorder_note: null, updated_at: new Date().toISOString() }).eq('id', itemId)
      // despesa automática (se houver custo unitário definido)
      if (item.unit_cost && addQty > 0) {
        await db.from('finance_entries').insert(stamp({
          user_id: c.user.id, kind: 'expense', category: 'Material',
          description: `Compra: ${item.name} (${addQty} ${item.unit || 'un'})`,
          amount: Number(item.unit_cost) * addQty, date: new Date().toISOString().slice(0, 10),
        })).then(() => {}, () => {})
      }
      return NextResponse.json({ ok: true, reorder_status: 'ok', quantity: newQty })
    }
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  }

  // ── Consumo (1 toque) ──
  const qty = Number(body.qty) > 0 ? Number(body.qty) : 1
  const newQty = Math.max(0, Number(item.quantity || 0) - qty)
  await db.from('stock_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', itemId)
  // patient_id (Módulo 11, sprint133): atribuir o consumo a uma pessoa é o
  // que torna possível ler variações como sinal clínico. Opcional — muito
  // consumo é de uso geral, e a equipa nunca pode ficar bloqueada. Se a
  // coluna ainda não existir (migração por aplicar), tenta outra vez sem ela
  // para o consumo continuar a ser registado.
  const patientId = typeof body.patient_id === 'string' && body.patient_id ? body.patient_id : null
  const consRow: any = stamp({ user_id: c.user.id, item_id: itemId, qty, by_name: c.name })
  const ins = await db.from('stock_consumption').insert(patientId ? { ...consRow, patient_id: patientId } : consRow)
  if (ins.error && patientId) await db.from('stock_consumption').insert(consRow).then(() => {}, () => {})

  // Se atingiu o limiar e ainda não há pedido em curso → avisa a equipa 1 vez.
  let alerted = false
  if (item.min_quantity != null && newQty <= Number(item.min_quantity) && item.reorder_status === 'ok') {
    await db.from('stock_items').update({ reorder_status: 'requested', reorder_at: new Date().toISOString() }).eq('id', itemId)
    await db.from('team_messages').insert(stamp({
      user_id: c.user.id, author_id: c.user.id, author_name: c.name, channel: 'stock',
      body: `📦 ${item.name} atingiu o mínimo (${newQty} ${item.unit || 'un'}). Precisa de encomenda.`, priority: 'importante',
    })).then(() => {}, () => {})
    if (c.orgId) notifyOrgMembers(c.orgId, c.user.id, { title: '📦 Stock no mínimo', body: `${item.name} — ${newQty} ${item.unit || 'un'}`, url: '/equipa?tab=mural', tag: 'stock'}).catch(() => {})
    alerted = true
  }
  return NextResponse.json({ ok: true, quantity: newQty, alerted })
}
