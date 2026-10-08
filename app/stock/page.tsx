'use client'

// Stock & validades — existências, ruturas e prazos de validade.
// Transversal: medicamentos, consumíveis, EPI, produtos de limpeza.
// Alertas de stock baixo e validade próxima — útil da farmácia ao lar e à clínica.

import { useState, useEffect, useCallback, useRef } from 'react'
import StockDosUtentes from '@/components/institution/StockDosUtentes'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { reportError } from '@/lib/clientError'
import { buildProducts, type ImportedProduct } from '@/lib/productImport'
import { printDoc, type PrintRecord } from '@/lib/print'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'

interface Item {
  id: string; name: string; category: string; quantity: number; min_quantity: number
  unit?: string | null; expiry_date?: string | null; location?: string | null; updated_at: string
  barcode?: string | null; ref?: string | null; price?: number | null; tax_rate?: number | null
  reorder_status?: 'ok' | 'requested' | 'ordered' | null
  supplier_name?: string | null; supplier_contact?: string | null; buy_url?: string | null; unit_cost?: number | null
}

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, Campo, Grupo, Folha, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

/* AS CATEGORIAS NAO SAO UM CODIGO DE CORES (2026-10-07)
   Eram seis emoji e seis cores — duas delas inventadas aqui (`var(--red)` rosa,
   `var(--green)` azul) e uma o turquesa que ja saiu de todo o resto.

   E a cor da categoria pintava a BORDA ESQUERDA de cada linha: o mesmo sitio
   onde o vermelho do stock baixo tem de aparecer. Uma luva e um medicamento
   com cores diferentes, e nenhuma delas a dizer «falta isto».

   A categoria le-se em quatro letras. A borda fica para o que e urgente. */
const CATS: Record<string, { label: string; codigo: string }> = {
  medicamento:   { label: 'Medicamento',    codigo: 'MED' },
  // Categoria própria (2026-08-11) — fraldas/pensos/resguardos viviam
  // indistinguíveis de qualquer outro "consumível" (luvas, compressas). Um
  // lar que anuncia "stock de fraldas, pensos e resguardos" como serviço
  // precisa de conseguir ver e repor isto à parte, não perdido no meio de tudo.
  incontinencia: { label: 'Fraldas/Pensos', codigo: 'INCO' },
  consumivel:    { label: 'Consumível',     codigo: 'CONS' },
  epi:           { label: 'EPI',            codigo: 'EPI' },
  limpeza:       { label: 'Limpeza',        codigo: 'LIMP' },
  geral:         { label: 'Geral',          codigo: 'GER' },
}
const CAT_KEYS = Object.keys(CATS)

function expiryDays(d?: string | null) { return d ? Math.floor((new Date(d + 'T12:00').getTime() - Date.now()) / 86400000) : null }

export default function StockPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('stock', 'editar')
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const largo = useLargo()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', category: 'medicamento', quantity: '', min_quantity: '', unit: '', expiry: '', location: '', barcode: '', ref: '', price: '', tax_rate: '23', supplier_name: '', supplier_contact: '', buy_url: '', unit_cost: '' }
  const [form, setForm] = useState<any>(blank)
  // Importação em massa
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<{ products: ImportedProduct[]; cols: string[] } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { products, columns } = buildProducts(String(reader.result || ''))
      setPreview({ products, cols: Object.keys(columns) })
      setImportMsg(products.length ? `${products.length} produto(s) detetado(s).` : 'Não consegui detetar produtos. Verifica o ficheiro.')
    }
    reader.readAsText(file, 'utf-8')
  }

  async function runImport() {
    if (!preview || !user || preview.products.length === 0) return
    setImportBusy(true); setImportMsg('A importar…')
    let ok = 0, fail = 0
    // mapa de barcodes existentes para decidir update vs insert
    const existingByBarcode: Record<string, string> = {}
    items.forEach(it => { if (it.barcode) existingByBarcode[it.barcode] = it.id })
    for (const p of preview.products) {
      const row: any = scope.stamp({
        name: p.name, category: p.category && CAT_KEYS.includes(p.category) ? p.category : 'medicamento',
        barcode: p.barcode || null, ref: p.ref || null,
        price: p.price ?? 0, cost: p.cost ?? 0, tax_rate: p.tax_rate ?? 23,
        quantity: p.quantity ?? 0, min_quantity: p.min_quantity ?? 0, unit: p.unit || null,
        updated_at: new Date().toISOString(),
      })
      let res
      if (p.barcode && existingByBarcode[p.barcode]) res = await supabase.from('stock_items').update(row).eq('id', existingByBarcode[p.barcode])
      else res = await supabase.from('stock_items').insert(row)
      if (res.error) fail++; else ok++
    }
    setImportMsg(`Importados ${ok}${fail ? ` · ${fail} falharam` : ''}.`)
    setImportBusy(false)
    setTimeout(() => { setImporting(false); setPreview(null); setImportMsg(''); load() }, 1200)
  }

  // Previsão de reencomenda: dias até esgotar, pelo RITMO REAL de consumo (não
  // só "abaixo do mínimo"). Cálculo determinístico (soma de stock_consumption
  // dos últimos 30 dias ÷ dias com histórico) — de propósito NÃO é uma
  // chamada a IA: uma previsão numérica ganha em ser uma conta reprodutível,
  // não um palpite de modelo de linguagem.
  const [daysLeft, setDaysLeft] = useState<Record<string, number>>({})
  const LOOKBACK_DAYS = 30

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()
    const [itemsRes, consRes, patsRes] = await Promise.all([
      scope.filter(supabase.from('stock_items').select('*')).order('name'),
      scope.filter(supabase.from('stock_consumption').select('item_id,qty,created_at')).gte('created_at', since),
      // Para atribuir consumo de incontinência a uma pessoa (Módulo 11).
      scope.filter(supabase.from('patients').select('id,name')).eq('active', true).order('name')
        .then((r: any) => r, () => ({ data: [] })),
    ])
    setPatients((patsRes.data || []) as { id: string; name: string }[])
    if (itemsRes.error) { if (/relation .*stock_items.* does not exist/i.test(itemsRes.error.message)) setMissing(true); setItems([]) }
    else {
      setMissing(false); setItems(itemsRes.data || [])
      const byItem: Record<string, { total: number; earliest: number }> = {}
      ;(consRes.data || []).forEach((c: any) => {
        const t = new Date(c.created_at).getTime()
        const cur = byItem[c.item_id] || { total: 0, earliest: t }
        cur.total += Number(c.qty) || 0
        cur.earliest = Math.min(cur.earliest, t)
        byItem[c.item_id] = cur
      })
      const dl: Record<string, number> = {}
      Object.entries(byItem).forEach(([itemId, { total, earliest }]) => {
        if (total <= 0) return
        const spanDays = Math.max(1, (Date.now() - earliest) / 86400000)
        const dailyRate = total / spanDays
        if (dailyRate > 0) {
          const it = (itemsRes.data || []).find((x: any) => x.id === itemId)
          if (it) dl[itemId] = it.quantity / dailyRate
        }
      })
      setDaysLeft(dl)
    }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'stock_items', userId: scope.liveFilterValue || user?.id, onChange: load })

  async function add() {
    if (!form.name.trim()) { setErr('Indica o nome do produto.'); return }
    setSaving(true); setErr('')
    const baseRow: any = {
      name: form.name.trim(), category: form.category,
      quantity: Number(form.quantity) || 0, min_quantity: Number(form.min_quantity) || 0,
      unit: form.unit.trim() || null, expiry_date: form.expiry || null, location: form.location.trim() || null,
      barcode: form.barcode.trim() || null, ref: form.ref.trim() || null,
      price: parseFloat(form.price) || 0, tax_rate: parseFloat(form.tax_rate) || 0,
    }
    // Campos de fornecedor/custo são do sprint106. Se a BD ainda não os tem, o
    // insert falha por coluna desconhecida → repetimos sem eles (degrada limpo).
    const extra = { supplier_name: form.supplier_name.trim() || null, supplier_contact: form.supplier_contact.trim() || null, buy_url: form.buy_url.trim() || null, unit_cost: parseFloat(form.unit_cost) || null }
    let { data, error } = await supabase.from('stock_items').insert(scope.stamp({ ...baseRow, ...extra })).select().single()
    if (error && /column|schema|supplier|buy_url|unit_cost/i.test(error.message)) {
      ;({ data, error } = await supabase.from('stock_items').insert(scope.stamp(baseRow)).select().single())
    }
    if (!error && data) { setItems(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name))); setShowForm(false); setForm(blank) }
    else setErr(error?.message || 'Erro')
    setSaving(false)
  }
  async function adjust(it: Item, delta: number) {
    if (!podeEditar) { setErr('A sua conta é só de leitura.'); return }
    const q = Math.max(0, Number(it.quantity) + delta)
    const prev = it.quantity
    setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: q } : x))
    const { error } = await supabase.from('stock_items').update({ quantity: q, updated_at: new Date().toISOString() }).eq('id', it.id)
    if (error) { setErr(reportError('stock-adjust', error, 'Não foi possível atualizar. Tenta de novo.')); setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: prev } : x)) }
  }
  async function del(id: string) {
    if (!podeEditar) { setErr('A sua conta é só de leitura.'); return }
    const { error } = await supabase.from('stock_items').delete().eq('id', id)
    if (error) { setErr(reportError('stock-del', error, 'Não foi possível remover. Tenta de novo.')); return }
    setItems(p => p.filter(x => x.id !== id))
  }
  // Consumo a 1 toque via API (desconta + regista + avisa a equipa se atingir o mínimo).
  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])
  async function consume(it: Item, qty = 1, patientId?: string) {
    if (!podeEditar) { setErr('A sua conta é só de leitura.'); return }
    const prev = it.quantity
    setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: Math.max(0, prev - qty) } : x))
    const r = await fetch('/api/stock/consume', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ item_id: it.id, qty, patient_id: patientId || null }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    if (r.error) { setErr(reportError('stock-consume', r.error, 'Não foi possível registar o consumo agora. Tenta de novo.')); setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: prev } : x)); return }
    setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: r.quantity, reorder_status: r.alerted ? 'requested' : x.reorder_status } : x))
  }
  async function reorder(it: Item, action: 'request' | 'ordered' | 'received', extra?: { qty?: number; note?: string }) {
    if (!podeEditar) { setErr('A sua conta é só de leitura.'); return }
    const r = await fetch('/api/stock/consume', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ item_id: it.id, action, ...extra }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    if (r.error) { setErr(r.error); return }
    setItems(p => p.map(x => x.id === it.id ? { ...x, reorder_status: r.reorder_status, quantity: r.quantity ?? x.quantity } : x))
  }

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter)
  const low = items.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity)
  const expiringSoon = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d >= 0 && d <= 30 })
  const expired = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d < 0 })
  // Previsto para esgotar em breve (≤7 dias ao ritmo real), mesmo que ainda
  // esteja ACIMA do mínimo fixo — o mínimo estático não sabe se o consumo
  // acelerou; o ritmo real sabe.
  const runningOutSoon = items.filter(i => daysLeft[i.id] != null && daysLeft[i.id] <= 7 && !(i.min_quantity > 0 && i.quantity <= i.min_quantity))
  // BUG/PEDIDO 2026-08-07: "mais fácil e intuitivo" — a lista era só alfabética,
  // por isso o que precisa de atenção (rutura/validade) ficava escondido no
  // meio de tudo o resto, a ler um a um. Agora separa-se o que precisa de
  // atenção AGORA do resto do inventário, sem mexer no fluxo de 1 toque que
  // já existia (Usar 1, +/-, reposição).
  const needsAttentionIds = new Set([...low, ...expiringSoon, ...expired, ...runningOutSoon].map(i => i.id))
  const attention = shown.filter(i => needsAttentionIds.has(i.id))
  const rest = shown.filter(i => !needsAttentionIds.has(i.id))
  const [showRest, setShowRest] = useState(attention.length === 0)

  // Relatório profissional (A4): ruturas para encomendar + validades a expirar +
  // produtos fora de validade. É o documento de ordem de compra / auditoria.
  function printStockReport() {
    const fmtQty = (i: Item) => `${i.quantity}${i.unit ? ' ' + i.unit : ''}`
    const sections = []
    if (low.length) sections.push({
      heading: `Ruturas — repor (${low.length})`,
      records: low.map<PrintRecord>(i => ({
        title: i.name,
        meta: i.location ? `Local: ${i.location}` : '',
        tags: [{ label: i.quantity === 0 ? 'ESGOTADO' : 'Stock baixo', color: 'var(--red)' }],
        fields: [{ label: 'Em stock', value: fmtQty(i) }, { label: 'Mínimo', value: String(i.min_quantity) }, { label: 'A repor', value: String(Math.max(0, i.min_quantity - i.quantity)) }, { label: 'Categoria', value: i.category || '—' }],
      })),
    })
    if (expired.length) sections.push({
      heading: `Fora de validade — retirar (${expired.length})`,
      records: expired.map<PrintRecord>(i => ({
        title: i.name,
        tags: [{ label: 'EXPIRADO', color: 'var(--red)' }],
        fields: [{ label: 'Validade', value: i.expiry_date || '—' }, { label: 'Quantidade', value: fmtQty(i) }, { label: 'Local', value: i.location || '—' }],
      })),
    })
    if (expiringSoon.length) sections.push({
      heading: `Validade a expirar (≤30 dias) — ${expiringSoon.length}`,
      records: expiringSoon.map<PrintRecord>(i => {
        const d = expiryDays(i.expiry_date)
        return {
          title: i.name,
          tags: [{ label: `${d} dias`, color: 'var(--amber)' }],
          fields: [{ label: 'Validade', value: i.expiry_date || '—' }, { label: 'Quantidade', value: fmtQty(i) }, { label: 'Local', value: i.location || '—' }],
        }
      }),
    })
    if (!sections.length) sections.push({ heading: 'Tudo em ordem', records: [{ title: 'Sem ruturas nem validades a expirar', body: 'Não há produtos em rutura, expirados ou a expirar nos próximos 30 dias.' }] })

    printDoc({
      docTitle: 'Relatório de Stock & Validades',
      docSubtitle: new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      meta: [
        { label: 'Produtos', value: String(items.length) },
        { label: 'Ruturas', value: String(low.length) },
        { label: 'A expirar', value: String(expiringSoon.length) },
        { label: 'Expirados', value: String(expired.length) },
      ],
      sections,
      footerNote: 'Relatório gerado pelo Phlox Clinical · Verificado por: __________________',
    })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '16px 18px' }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Eram quatro cartões de estatística com fundo de cor — três deles verdes
     quando estão a zero. Um «Expirados: 0» pintado de verde-vivo é ruído:
     ensina a ignorar a cor exactamente onde ela é precisa.

     E cada produto era um cartão que crescia para 200px quando tinha uma
     reposição em curso. Com sessenta produtos o inventário é um quilómetro.

     Passa a tabela. A quantidade fica com o −1/+1 ao lado, que é o gesto que
     se faz cem vezes por dia e tem de estar à mão.
     ══════════════════════════════════════════════════════════════════════════ */
  const linha = (it: Item) => (
    <StockItemCard key={it.id} it={it} scope={scope} consume={consume} adjust={adjust}
      del={del} reorder={reorder} daysLeft={daysLeft[it.id]} patients={patients} largo={largo} />
  )

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Stock</span>

          <select value={filter} onChange={e => setFilter(e.target.value)}
            aria-label="Categoria" style={{ ...CAIXA, width: 170 }}>
            <option value="all">Todas as categorias</option>
            {CAT_KEYS.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}
          </select>

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {items.length} PRODUTO{items.length === 1 ? '' : 'S'}
              </span>
              {/* Só aparece o que é um problema. Um «Expirados 0» a verde
                  ensina a ignorar a cor onde ela é precisa. */}
              {low.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                  {low.length} EM FALTA
                </span>
              )}
              {expired.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                  {expired.length} EXPIRADO{expired.length === 1 ? '' : 'S'}
                </span>
              )}
              {expiringSoon.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
                  {expiringSoon.length} A EXPIRAR EM 30 DIAS
                </span>
              )}
              {low.length === 0 && expired.length === 0 && expiringSoon.length === 0 && items.length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--green)' }}>
                  NADA EM FALTA NEM FORA DE PRAZO
                </span>
              )}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={printStockReport}
              titulo="Relatório A4 de ruturas e validades — para encomendas e auditoria">
              RELATÓRIO
            </Botao>
            <Botao onClick={() => { setImporting(true); setPreview(null); setImportMsg('') }}>
              IMPORTAR CSV
            </Botao>
            {podeEditar && (
              <Botao feitio="principal" onClick={() => { setForm(blank); setErr(''); setShowForm(true) }}>
                + PRODUTO
              </Botao>
            )}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>Abaixo do mínimo, ou fora de prazo</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>A acabar, ou validade curta</span>
          <span style={MONO}>«Dura» é pelo ritmo real dos últimos 30 dias, não pelo mínimo</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Existências, ruturas e prazos — de medicamentos a EPI e produtos de limpeza
          </span>
        </BarraDeEstado>
      }
    >
      {missing ? (
        <Painel>
          <Vazio titulo="O stock ainda não está disponível nesta conta."
            oQueFazer="Fale connosco e ativamos — tudo o resto continua a funcionar normalmente." />
        </Painel>
      ) : (
        <>
          {err && <Aviso tom="mau">{err}</Aviso>}

          {/* Quem está a ficar sem o quê, primeiro. Ninguém abre trinta fichas
              para descobrir que faltam fraldas a duas pessoas — a reposição
              faz-se aqui, com a lista de compras à frente.

              A peça traz o seu próprio painel e devolve `null` quando não há
              ninguém a acabar — envolvê-la num `Painel` aqui deixava uma caixa
              vazia com título em todas as casas onde está tudo bem. */}
          {!loading && <StockDosUtentes cor="var(--green)" />}

          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>Produto</span>
                <span style={{ ...ROTULO, width: 48 }}>Tipo</span>
                <span style={{ ...ROTULO, width: 120, textAlign: 'center' }}>Quantidade</span>
                <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Mínimo</span>
                <span style={{ ...ROTULO, width: 84, textAlign: 'right' }}>Validade</span>
                <span style={{ ...ROTULO, width: 58, textAlign: 'right' }}>Dura</span>
                <span style={{ ...ROTULO, width: 110 }}> </span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{shown.length} de {items.length}</span>}
          >
            {loading ? (
              <ACarregar oQue="A contar o que há…" />
            ) : shown.length === 0 ? (
              <Vazio
                titulo={items.length === 0 ? 'Ainda não há produtos no inventário.' : 'Nenhum nesta categoria.'}
                oQueFazer={items.length === 0
                  ? 'Com um mínimo definido, cada produto passa a avisar sozinho quando chega lá — e, ao fim de um mês de uso, a dizer quantos dias ainda dura ao ritmo a que está a ser gasto.'
                  : 'Experimente outra categoria, ou «Todas».'}
                acao={items.length === 0 && podeEditar
                  ? <Botao feitio="principal" onClick={() => { setForm(blank); setErr(''); setShowForm(true) }}>+ PRODUTO</Botao>
                  : undefined} />
            ) : (
              <>
                {attention.length > 0 && (
                  <>
                    <div style={{
                      padding: '5px 12px', background: 'var(--bg-2)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      <span style={{ ...ROTULO, color: 'var(--red)' }}>
                        Precisa de atenção · {attention.length}
                      </span>
                    </div>
                    {attention.map(linha)}
                  </>
                )}
                {rest.length > 0 && (
                  <>
                    {attention.length > 0 && (
                      <button onClick={() => setShowRest(v => !v)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                        padding: '5px 12px', background: 'var(--bg-2)', textAlign: 'left',
                        border: 'none', borderTop: '1px solid var(--border-2)',
                        borderBottom: '1px solid var(--border)', cursor: 'pointer',
                        fontFamily: 'inherit', position: 'sticky', top: 0, zIndex: 1,
                      }}>
                        <span style={ROTULO}>
                          {showRest ? '▾' : '▸'} Resto do inventário · {rest.length}
                        </span>
                      </button>
                    )}
                    {(showRest || attention.length === 0) && rest.map(linha)}
                  </>
                )}
              </>
            )}
          </Painel>
        </>
      )}
    </Mesa>

    {/* ── NOVO PRODUTO ───────────────────────────────────────────────────── */}
    {showForm && (
      <Folha titulo="Novo produto" aoFechar={() => setShowForm(false)}>
        <Campo rotulo="Nome" para="stock-name" obrigatorio>
          <input id="stock-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Luvas nitrilo M, Paracetamol 1g…" style={{ ...CAIXA, width: '100%' }} autoFocus />
        </Campo>

        <Campo rotulo="Categoria" para="stock-cat">
          <select id="stock-cat" value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...CAIXA, width: '100%' }}>
            {CAT_KEYS.map(k => <option key={k} value={k}>{CATS[k].label}</option>)}
          </select>
        </Campo>

        <Campo rotulo="Quantidade, mínimo e unidade"
          ajuda="O mínimo é o que faz este produto avisar sozinho. Sem ele, só se dá pela falta quando acaba.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <input aria-label="Quantidade" type="number" inputMode="numeric" placeholder="Quantos"
              value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={CAIXA} />
            <input aria-label="Mínimo" type="number" inputMode="numeric" placeholder="Mínimo"
              value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} style={CAIXA} />
            <input aria-label="Unidade" placeholder="cx, un…"
              value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={CAIXA} />
          </div>
        </Campo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo rotulo="Validade" para="stock-expiry">
            <input id="stock-expiry" type="date" value={form.expiry}
              onChange={e => setForm({ ...form, expiry: e.target.value })} style={{ ...CAIXA, width: '100%' }} />
          </Campo>
          <Campo rotulo="Onde está" para="stock-location">
            <input id="stock-location" value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Armário A2" style={{ ...CAIXA, width: '100%' }} />
          </Campo>
        </div>

        <Grupo titulo="Reposição e fornecedor">
          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.5 }}>
            Opcional. O custo por unidade lança a despesa sozinho quando se marcar «recebido».
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Campo rotulo="Fornecedor" para="stock-supplier-name">
              <input id="stock-supplier-name" value={form.supplier_name}
                onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                placeholder="Ex: Distribuidora X" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
            <Campo rotulo="Contacto" para="stock-supplier-contact">
              <input id="stock-supplier-contact" value={form.supplier_contact}
                onChange={e => setForm({ ...form, supplier_contact: e.target.value })}
                placeholder="Telefone ou email" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Campo rotulo="Link de compra" para="stock-buy-url">
              <input id="stock-buy-url" value={form.buy_url}
                onChange={e => setForm({ ...form, buy_url: e.target.value })}
                placeholder="https://…" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
            <Campo rotulo="Custo por unidade (€)" para="stock-unit-cost">
              <input id="stock-unit-cost" type="number" inputMode="decimal" value={form.unit_cost}
                onChange={e => setForm({ ...form, unit_cost: e.target.value })}
                placeholder="0.00" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
          </div>
        </Grupo>

        <div style={{ marginTop: 16 }}>
          <Botao feitio="principal" onClick={add} esperando={saving} disabled={!form.name.trim()}>
            ADICIONAR O PRODUTO
          </Botao>
        </div>
      </Folha>
    )}

    {/* ── IMPORTAR DE UM CSV ─────────────────────────────────────────────── */}
    {importing && (
      <Folha titulo="Importar produtos de um CSV" aoFechar={() => !importBusy && setImporting(false)}>
        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.55, margin: '10px 0 0' }}>
          Aceita exports do <strong>Sifarma</strong>, de ERP genéricos ou de Excel guardado como CSV.
          As colunas são detetadas sozinhas (CNP/EAN, designação, PVP, IVA, stock). O que já existe
          é actualizado pelo código de barras; o resto é criado.
        </p>

        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: 'none' }} />
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => fileRef.current?.click()} className="mesa-botao" style={{
            width: '100%', border: '1px dashed var(--border-2)', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', cursor: 'pointer',
            ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em', color: 'var(--ink-3)',
          }}>ESCOLHER O FICHEIRO CSV</button>
        </div>

        {importMsg && (
          <div style={{ marginTop: 10 }}>
            <Aviso tom={/Não|falharam/.test(importMsg) ? 'mau' : 'bom'}>{importMsg}</Aviso>
          </div>
        )}

        {preview && preview.products.length > 0 && (
          <>
            <div style={{ ...ROTULO, marginTop: 12 }}>
              Colunas detetadas: {preview.cols.join(', ') || 'posicional'}
            </div>
            <div style={{
              marginTop: 6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
            }}>
              {preview.products.slice(0, 30).map((p, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '6px 11px', borderBottom: '1px solid var(--border)',
                  fontSize: 'var(--t-dado)',
                }}>
                  <span style={{ minWidth: 0, color: 'var(--ink-2)' }}>
                    {p.name}
                    {p.barcode && <span style={{ ...MONO, color: 'var(--ink-5)' }}> · {p.barcode}</span>}
                  </span>
                  <span style={{ ...MONO, flexShrink: 0, fontWeight: 'var(--peso-forte)' as any }}>
                    {p.price != null ? `${p.price.toFixed(2)}€` : '—'}
                  </span>
                </div>
              ))}
              {preview.products.length > 30 && (
                <div style={{
                  padding: '6px 11px', ...MONO, fontSize: 'var(--t-meta)',
                  color: 'var(--ink-5)', textAlign: 'center',
                }}>+{preview.products.length - 30} mais</div>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <Botao feitio="principal" onClick={runImport} esperando={importBusy}>
                IMPORTAR {preview.products.length} PRODUTO{preview.products.length === 1 ? '' : 'S'}
              </Botao>
            </div>
          </>
        )}
      </Folha>
    )}
    </>
  )
}

// Extraído de dentro do map original (2026-08-07) para poder ser reutilizado
// nas duas secções ("Precisa de atenção" + "Resto do inventário") sem
// duplicar a marcação. Refeito na linguagem da mesa em 2026-10-07: era um
// cartão de 80px que crescia para 200px, com seis emoji no corpo e três
// botões quadrados sem rótulo nenhum.
function StockItemCard({ it, scope, consume, adjust, del, reorder, daysLeft, patients, largo }: {
  it: Item; scope: ReturnType<typeof useOrgScope>
  consume: (it: Item, qty?: number, patientId?: string) => void
  adjust: (it: Item, delta: number) => void
  del: (id: string) => void
  reorder: (it: Item, action: 'request' | 'ordered' | 'received', extra?: { qty?: number; note?: string }) => void
  daysLeft?: number
  patients: { id: string; name: string }[]
  largo: boolean
}) {
  const cat = CATS[it.category] || CATS.geral
  // Módulo 11: só na categoria de incontinência é que saber PARA QUEM tem
  // valor clínico (a variação de consumo por pessoa é o sinal). Nas outras, o
  // "Usar 1" fica exactamente como estava — um toque, sem perguntas.
  const [pickFor, setPickFor] = useState(false)
  const attributable = it.category === 'incontinencia' && patients.length > 0
  const isLow = it.min_quantity > 0 && it.quantity <= it.min_quantity
  const d = expiryDays(it.expiry_date)
  const expirado = d !== null && d < 0
  const expiraCedo = d !== null && d >= 0 && d <= 30
  const runsOutSoon = daysLeft != null && daysLeft <= 14
  const podeEditar = scope.pode('stock', 'editar')
  const precisaReposicao = isLow || runsOutSoon || (it.reorder_status && it.reorder_status !== 'ok')

  /* A quantidade com o −1/+1 ao lado. É o gesto que se faz cem vezes por dia:
     fica junto ao número, e com a altura de alvo do sistema — que no
     telemóvel são 44px, não os 28 que aqui estavam escritos à mão. */
  const quantidade = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" aria-label={`Tirar uma unidade de ${it.name}`} className="mesa-botao"
        onClick={() => adjust(it, -1)} disabled={!podeEditar}
        style={{
          width: 26, padding: 0, borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-2)', background: 'var(--bg)',
          cursor: podeEditar ? 'pointer' : 'default', color: 'var(--ink-3)',
          fontFamily: 'inherit', fontSize: 'var(--t-corpo)', lineHeight: 1,
        }}>−</button>
      <span style={{
        ...MONO, minWidth: 46, textAlign: 'center',
        fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
        color: isLow ? 'var(--red)' : 'var(--ink)',
      }}>
        {it.quantity}
        {it.unit && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}> {it.unit}</span>}
      </span>
      <button type="button" aria-label={`Juntar uma unidade de ${it.name}`} className="mesa-botao"
        onClick={() => adjust(it, 1)} disabled={!podeEditar}
        style={{
          width: 26, padding: 0, borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-2)', background: 'var(--bg)',
          cursor: podeEditar ? 'pointer' : 'default', color: 'var(--ink-3)',
          fontFamily: 'inherit', fontSize: 'var(--t-corpo)', lineHeight: 1,
        }}>+</button>
    </span>
  )

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${isLow || expirado ? 'var(--red)' : expiraCedo || runsOutSoon ? 'var(--amber)' : 'transparent'}`,
    }}>
      <div style={{
        display: 'flex', alignItems: largo ? 'center' : 'flex-start', gap: 10,
        flexDirection: largo ? 'row' : 'column',
        padding: largo ? '7px 12px' : '10px 12px',
      }}>
        <span style={{ minWidth: 0, flex: largo ? 1 : undefined, width: largo ? undefined : '100%' }}>
          <span style={{
            display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{it.name}</span>
          <span style={{
            display: 'block', ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {[
              it.location,
              it.barcode,
              it.price ? `${(Math.round(it.price * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€` : null,
            ].filter(Boolean).join(' · ') || '—'}
          </span>
        </span>

        {largo ? (
          <>
            <span style={{ width: 48, flexShrink: 0 }}><Codigo texto={cat.codigo} /></span>
            <span style={{ width: 120, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{quantidade}</span>
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)', width: 56, textAlign: 'right',
              flexShrink: 0, color: it.min_quantity > 0 ? 'var(--ink-4)' : 'var(--ink-5)',
            }}>{it.min_quantity > 0 ? it.min_quantity : '—'}</span>
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)', width: 84, textAlign: 'right', flexShrink: 0,
              fontWeight: (expirado || expiraCedo ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
              color: expirado ? 'var(--red)' : expiraCedo ? 'var(--amber)' : 'var(--ink-4)',
            }}>
              {d === null ? '—' : expirado ? `há ${-d}d` : `${d}d`}
            </span>
            {/* Pelo ritmo real dos últimos 30 dias — não é só «abaixo do mínimo». */}
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)', width: 58, textAlign: 'right', flexShrink: 0,
              fontWeight: (runsOutSoon ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
              color: daysLeft == null ? 'var(--ink-5)'
                : daysLeft <= 7 ? 'var(--red)' : daysLeft <= 14 ? 'var(--amber)' : 'var(--ink-4)',
            }}>{daysLeft == null ? '—' : `${Math.max(1, Math.round(daysLeft))}d`}</span>
            <span style={{ width: 110, flexShrink: 0, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {podeEditar && (
                <Botao feitio="principal" titulo="Usei uma unidade"
                  onClick={() => attributable ? setPickFor(v => !v) : consume(it, 1)}>
                  USAR 1
                </Botao>
              )}
              {podeEditar && <Botao feitio="calmo" onClick={() => del(it.id)}>×</Botao>}
            </span>
          </>
        ) : (
          <>
            <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              <Codigo texto={cat.codigo} />
              {quantidade}
              {it.min_quantity > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={ROTULO}>Mín</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>{it.min_quantity}</span>
                </span>
              )}
              {d !== null && (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={ROTULO}>Validade</span>
                  <span style={{
                    ...MONO, fontSize: 'var(--t-dado)',
                    fontWeight: (expirado || expiraCedo ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                    color: expirado ? 'var(--red)' : expiraCedo ? 'var(--amber)' : 'var(--ink-4)',
                  }}>{expirado ? `há ${-d}d` : `${d}d`}</span>
                </span>
              )}
              {daysLeft != null && (
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={ROTULO}>Dura</span>
                  <span style={{
                    ...MONO, fontSize: 'var(--t-dado)',
                    fontWeight: (runsOutSoon ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                    color: daysLeft <= 7 ? 'var(--red)' : daysLeft <= 14 ? 'var(--amber)' : 'var(--ink-4)',
                  }}>{Math.max(1, Math.round(daysLeft))}d</span>
                </span>
              )}
            </span>
            {podeEditar && (
              <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <Botao feitio="principal" onClick={() => attributable ? setPickFor(v => !v) : consume(it, 1)}>
                  USAR 1
                </Botao>
                <Botao feitio="calmo" onClick={() => del(it.id)}>APAGAR</Botao>
              </span>
            )}
          </>
        )}
      </div>

      {/* Para quem? (só incontinência) — atribuir é o que permite ler a
          variação por pessoa como sinal. «Sem atribuir» existe sempre: a
          equipa nunca fica bloqueada por não saber ou não querer dizer. */}
      {pickFor && attributable && (
        <div style={{ padding: '0 12px 10px 12px' }}>
          <div style={{ ...ROTULO, marginBottom: 5 }}>Para quem foi?</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {patients.map(p => (
              <Botao key={p.id} onClick={() => { consume(it, 1, p.id); setPickFor(false) }}>
                {p.name}
              </Botao>
            ))}
            <Botao feitio="calmo" onClick={() => { consume(it, 1); setPickFor(false) }}>
              SEM ATRIBUIR
            </Botao>
          </div>
        </div>
      )}

      {/* Fluxo de reposição: ok → pedido → encomendado → repor. Sem re-pedidos. */}
      {precisaReposicao && (
        <div style={{
          padding: '7px 12px 9px', display: 'flex', alignItems: 'center',
          gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)',
        }}>
          {it.reorder_status === 'requested' ? (
            <>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                PEDIDO ENVIADO À EQUIPA
              </span>
              {podeEditar && <Botao onClick={() => reorder(it, 'ordered')}>MARCAR ENCOMENDADO</Botao>}
            </>
          ) : it.reorder_status === 'ordered' ? (
            <>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontWeight: 'var(--peso-forte)' as any }}>
                ENCOMENDADO — A CAMINHO
              </span>
              {podeEditar && (
                <Botao feitio="principal"
                  onClick={() => reorder(it, 'received', { qty: Math.max(1, (it.min_quantity || 1) * 2) })}>
                  RECEBIDO — REPOR
                </Botao>
              )}
            </>
          ) : podeEditar ? (
            <Botao onClick={() => reorder(it, 'request')}>AVISAR A EQUIPA — FALTA ESTE</Botao>
          ) : null}

          {it.buy_url && (
            <a href={it.buy_url} target="_blank" rel="noreferrer" style={{
              ...MONO, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
              color: 'var(--green)', textDecoration: 'none',
            }}>COMPRAR →</a>
          )}
          {it.supplier_name && (
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
              {it.supplier_name}{it.supplier_contact ? ` · ${it.supplier_contact}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
