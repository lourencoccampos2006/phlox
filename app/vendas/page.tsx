'use client'

// POS — Ponto de Venda do Phlox. Otimizado para qualquer instituição que venda.
//  • Leitura: leitor teclado-wedge + câmara (BarcodeDetector) + pesquisa manual.
//  • Carrinho, verificação de preços, desconto, IVA, métodos de pagamento.
//  • Finaliza: cria venda + linhas, baixa stock, e (opcional) emite no software
//    de faturação certificado do cliente, ou exporta ficheiro universal.
// O Phlox não é certificado AT — é MEGA-COMPATÍVEL: delega a emissão fiscal.

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useWedgeScanner, cameraScanAvailable, startCameraScan } from '@/lib/barcode'
import { toCSV, toSAFTLike, type SaleRecord, type SaleLine } from '@/lib/posExport'
import { printDoc, type PrintRecord } from '@/lib/print'

interface StockItem { id: string; name: string; barcode?: string | null; ref?: string | null; price?: number | null; tax_rate?: number | null; quantity: number; unit?: string | null; category?: string | null }
interface CartLine { stock_id?: string; barcode?: string; name: string; qty: number; unit_price: number; discount: number; tax_rate: number; stockLeft?: number }

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const lineTotal = (l: CartLine) => Math.max(0, l.qty * l.unit_price - (l.discount || 0))
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const METHODS = ['dinheiro', 'multibanco', 'mbway', 'transferencia', 'comparticipado', 'isento']
const METHOD_LABEL: Record<string, string> = { dinheiro: 'Dinheiro', multibanco: 'Multibanco', mbway: 'MB WAY', transferencia: 'Transferência', comparticipado: 'Comparticipado', isento: 'Isento' }

export default function VendasPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)

  const [stock, setStock] = useState<StockItem[]>([])
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)

  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('dinheiro')
  const [nif, setNif] = useState('')
  const [person, setPerson] = useState('')
  const [toast, setToast] = useState('')
  const [camOpen, setCamOpen] = useState(false)
  const [camErr, setCamErr] = useState('')
  const [finishing, setFinishing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopCam = useRef<(() => void) | null>(null)
  const scanInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [st, se] = await Promise.all([
      supabase.from('stock_items').select('id,name,barcode,ref,price,tax_rate,quantity,unit,category').eq('user_id', user.id),
      supabase.from('invoice_settings').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    if (st.error) { if (/relation .*stock_items.* does not exist/i.test(st.error.message)) setMissing(true); setStock([]) }
    else { setMissing(false); setStock(st.data || []) }
    setSettings(se.error ? null : se.data)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1600) }

  const addToCart = useCallback((item: StockItem | null, fallbackName?: string, code?: string) => {
    setCart(prev => {
      if (item) {
        const i = prev.findIndex(l => l.stock_id === item.id)
        if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c }
        return [...prev, { stock_id: item.id, barcode: item.barcode || code, name: item.name, qty: 1, unit_price: Number(item.price) || 0, discount: 0, tax_rate: Number(item.tax_rate) ?? cfg.revenue === 'pos_sales' ? 6 : 23, stockLeft: item.quantity }]
      }
      return [...prev, { barcode: code, name: fallbackName || code || 'Artigo', qty: 1, unit_price: 0, discount: 0, tax_rate: 23 }]
    })
  }, [cfg.revenue])

  const onScan = useCallback((code: string) => {
    const c = code.trim()
    const item = stock.find(s => s.barcode === c || s.ref === c)
    if (item) { addToCart(item, undefined, c); flash(`+ ${item.name}`) }
    else { addToCart(null, undefined, c); flash(`Código ${c} — sem produto. Adicionado em branco.`) }
  }, [stock, addToCart])

  useWedgeScanner(onScan, !camOpen)

  async function openCamera() {
    setCamErr('')
    if (!cameraScanAvailable()) { setCamErr('A câmara de scan não é suportada neste browser. Usa um leitor ou a pesquisa.'); setCamOpen(true); return }
    setCamOpen(true)
    setTimeout(async () => {
      try { if (videoRef.current) stopCam.current = await startCameraScan(videoRef.current, (code) => { onScan(code) }) }
      catch (e: any) { setCamErr(String(e?.message || 'Falha ao abrir a câmara.')) }
    }, 50)
  }
  function closeCamera() { stopCam.current?.(); stopCam.current = null; setCamOpen(false) }
  useEffect(() => () => { stopCam.current?.() }, [])

  const results = query.trim().length >= 1
    ? stock.filter(s => { const q = query.toLowerCase(); return s.name.toLowerCase().includes(q) || (s.barcode || '').includes(query) || (s.ref || '').toLowerCase().includes(q) }).slice(0, 8)
    : []

  function setQty(i: number, qty: number) { setCart(c => c.map((l, j) => j === i ? { ...l, qty: Math.max(1, qty) } : l)) }
  function setPrice(i: number, p: number) { setCart(c => c.map((l, j) => j === i ? { ...l, unit_price: Math.max(0, p) } : l)) }
  function setDisc(i: number, d: number) { setCart(c => c.map((l, j) => j === i ? { ...l, discount: Math.max(0, d) } : l)) }
  function removeLine(i: number) { setCart(c => c.filter((_, j) => j !== i)) }

  const subtotal = cart.reduce((a, l) => a + lineTotal(l), 0)
  const taxTotal = cart.reduce((a, l) => a + (l.tax_rate > 0 ? lineTotal(l) - lineTotal(l) / (1 + l.tax_rate / 100) : 0), 0)
  const totalQty = cart.reduce((a, l) => a + l.qty, 0)

  async function finalize() {
    if (!user || cart.length === 0) return
    setFinishing(true)
    try {
      const grossSum = cart.reduce((a, l) => a + l.qty * l.unit_price, 0)
      const discSum = cart.reduce((a, l) => a + (l.discount || 0), 0)
      const avgTax = cart.length ? Math.round(cart.reduce((a, l) => a + l.tax_rate, 0) / cart.length) : 23
      const { data: sale, error } = await supabase.from('sales').insert({
        user_id: user.id, kind: cfg.revenue === 'pos_sales' ? 'venda' : 'ato',
        description: cart.length === 1 ? cart[0].name : `${cart.length} artigos`,
        person_name: person.trim() || null, nif: nif.trim() || null,
        qty: totalQty, gross: grossSum, discount: discSum, tax_rate: avgTax, method,
        paid: method !== 'comparticipado', professional: user?.name || null,
      }).select().single()
      if (error || !sale) throw new Error(error?.message || 'Falha ao registar a venda')

      // linhas + baixa de stock
      const items = cart.map(l => ({ user_id: user.id, sale_id: sale.id, stock_id: l.stock_id || null, barcode: l.barcode || null, name: l.name, qty: l.qty, unit_price: l.unit_price, discount: l.discount || 0, tax_rate: l.tax_rate }))
      await supabase.from('sale_items').insert(items)
      for (const l of cart) {
        if (l.stock_id && l.stockLeft != null) {
          await supabase.from('stock_items').update({ quantity: Math.max(0, l.stockLeft - l.qty), updated_at: new Date().toISOString() }).eq('id', l.stock_id)
        }
      }

      // emissão automática opcional
      const saleRec: SaleRecord = { id: sale.id, at: sale.at || new Date().toISOString(), kind: sale.kind, person_name: person, nif, method, gross: grossSum, discount: discSum, tax_rate: avgTax, lines: cart.map(toLine) }
      let emitted = ''
      if (settings?.auto_emit && settings?.provider && settings.provider !== 'export' && settings?.api_key) {
        try {
          const t = (await supabase.auth.getSession()).data.session?.access_token
          const r = await fetch('/api/invoicing/emit', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ sale: saleRec }) })
          const j = await r.json()
          if (r.ok) emitted = j.docNumber || j.ref || 'emitido'
        } catch { /* segue sem emissão */ }
      }
      printReceipt(saleRec, emitted)
      setCart([]); setNif(''); setPerson('')
      flash(emitted ? `Venda emitida (${emitted})` : 'Venda registada')
      load()
    } catch (e: any) {
      flash(String(e?.message || 'Erro').slice(0, 60))
    } finally { setFinishing(false) }
  }

  const toLine = (l: CartLine): SaleLine => ({ name: l.name, qty: l.qty, unit_price: l.unit_price, discount: l.discount || 0, tax_rate: l.tax_rate })

  function printReceipt(s: SaleRecord, emitted: string) {
    const records: PrintRecord[] = (s.lines || []).map(l => ({
      title: `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`,
      fields: [{ label: 'Preço', value: euro(l.unit_price) }, ...(l.discount ? [{ label: 'Desc.', value: euro(l.discount) }] : []), { label: 'Total', value: euro(Math.max(0, l.qty * l.unit_price - l.discount)) }],
    }))
    printDoc({
      docTitle: emitted ? 'Recibo' : 'Talão de Venda',
      docSubtitle: cfg.unitNoun,
      meta: [
        { label: 'data', value: new Date(s.at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) },
        { label: 'total', value: euro(Math.max(0, s.gross - s.discount)) },
        { label: 'método', value: METHOD_LABEL[s.method] || s.method },
        ...(s.nif ? [{ label: 'NIF', value: s.nif }] : []),
        ...(emitted ? [{ label: 'documento', value: emitted }] : [{ label: 'aviso', value: 'Sem valor fiscal' }]),
      ],
      sections: [{ heading: 'Artigos', records: records.length ? records : [{ title: 'Sem artigos' }] }],
      footerNote: emitted ? 'Recibo · Phlox' : 'Talão interno (sem valor fiscal). Documento fiscal emitido pelo software certificado.',
    })
  }

  async function exportToday(kind: 'csv' | 'saft') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('sales').select('*').eq('user_id', user.id).gte('at', start.toISOString()).order('at')
    const sales: SaleRecord[] = (data || []).map((s: any) => ({ id: s.id, at: s.at, kind: s.kind, person_name: s.person_name, nif: s.nif, method: s.method, gross: s.gross, discount: s.discount, tax_rate: s.tax_rate, doc_number: s.doc_number }))
    if (sales.length === 0) { flash('Sem vendas hoje para exportar.'); return }
    const content = kind === 'csv' ? toCSV(sales) : toSAFTLike(sales, { name: cfg.unitNoun })
    const blob = new Blob([content], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `phlox-vendas-${new Date().toISOString().slice(0, 10)}.${kind === 'csv' ? 'csv' : 'xml'}`; a.click(); URL.revokeObjectURL(url)
    const total = sales.reduce((acc, s) => acc + Math.max(0, s.gross - s.discount), 0)
    await supabase.from('fiscal_exports').insert({ user_id: user.id, kind, rows: sales.length, total, ref: a.download, status: 'ok' }).then(() => {}, () => {})
    flash(`Exportado ${sales.length} venda(s)`)
  }

  if (missing) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, margin: '0 0 12px' }}>Ponto de Venda</h1>
        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5, lineHeight: 1.6 }}>
          Para usar o POS, corre <strong>supabase/sprint33_sales.sql</strong> e <strong>supabase/sprint34_pos.sql</strong> no Supabase. Depois adiciona produtos com código de barras e preço em <Link href="/stock" style={{ color: '#b45309', fontWeight: 700 }}>Stock</Link>.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>POS · {cfg.unitNoun}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Ponto de Venda</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Lê o código de barras (leitor ou câmara) ou pesquisa. Compatível com o teu software de faturação.</p>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button onClick={() => exportToday('csv')} style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>Exportar CSV</button>
            <button onClick={() => exportToday('saft')} style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>Exportar SAFT</button>
            <Link href="/faturacao" style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#374151', textDecoration: 'none' }}>Caixa / Atos</Link>
          </div>
        </div>

        {/* Integração de faturação — estado */}
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: settings?.provider && settings.provider !== 'export' && settings?.api_key ? '#f0fdf4' : '#eff6ff', border: `1px solid ${settings?.provider && settings.provider !== 'export' && settings?.api_key ? '#bbf7d0' : '#bfdbfe'}`, fontSize: 12.5, color: settings?.provider && settings.provider !== 'export' && settings?.api_key ? '#15803d' : '#1d4ed8', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>
            {settings?.provider && settings.provider !== 'export' && settings?.api_key
              ? <>✓ Ligado a <strong>{settings.provider}</strong>{settings.auto_emit ? ' · emissão automática ao finalizar' : ' · emite manualmente'}.</>
              : <>Modo exportação: o talão é interno; o documento fiscal sai do teu software certificado (importa o CSV/SAFT). Liga uma API para emitir automaticamente.</>}
          </span>
          <Link href="/faturacao-config" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>Configurar</Link>
        </div>

        <div className="pos-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Esquerda: scan + pesquisa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input ref={scanInput} data-pos-scan value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && results.length) { addToCart(results[0]); flash(`+ ${results[0].name}`); setQuery('') } }}
                  placeholder="Ler código de barras ou pesquisar produto…" style={{ ...inp, fontSize: 15 }} autoFocus />
                <button onClick={camOpen ? closeCamera : openCamera} style={{ flexShrink: 0, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: camOpen ? '#fef2f2' : 'white', color: camOpen ? '#dc2626' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  {camOpen ? 'Fechar' : '📷 Câmara'}
                </button>
              </div>

              {camOpen && (
                <div style={{ marginBottom: 10 }}>
                  {camErr ? <div style={{ fontSize: 12.5, color: '#dc2626', padding: '10px 0' }}>{camErr}</div>
                    : <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 240, borderRadius: 10, background: '#000', objectFit: 'cover' }} />}
                </div>
              )}

              {/* Resultados de pesquisa */}
              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {results.map(r => (
                    <button key={r.id} onClick={() => { addToCart(r); flash(`+ ${r.name}`); setQuery('') }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-5)' }}>{r.barcode || r.ref || 'sem código'} · stock {r.quantity}{r.unit ? ` ${r.unit}` : ''}</span>
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0d6e42', flexShrink: 0 }}>{euro(Number(r.price) || 0)}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 1 && results.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-5)', padding: '4px 2px' }}>Sem produto. <Link href="/stock" style={{ color: '#2563eb' }}>Adicionar ao stock →</Link></div>
              )}
            </div>

            {/* Verificador de preço rápido */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8 }}>Verificação de preços</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5 }}>Lê um código para o adicionar ao carrinho e ver o preço. {stock.length} produto(s) em stock; {stock.filter(s => s.barcode).length} com código de barras.</div>
            </div>
          </div>

          {/* Direita: carrinho */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'sticky', top: 70 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Carrinho</span>
              {cart.length > 0 && <button onClick={() => setCart([])} style={{ fontSize: 11.5, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpar</button>}
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-5)', fontSize: 13 }}>Carrinho vazio.<br />Lê ou pesquisa um produto.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '46vh', overflowY: 'auto', marginBottom: 12 }}>
                {cart.map((l, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 0 }}>{l.name}</span>
                      <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 7 }}>
                        <button onClick={() => setQty(i, l.qty - 1)} style={{ width: 26, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--ink-3)' }}>−</button>
                        <input value={l.qty} onChange={e => setQty(i, parseInt(e.target.value) || 1)} style={{ width: 30, textAlign: 'center', border: 'none', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                        <button onClick={() => setQty(i, l.qty + 1)} style={{ width: 26, height: 28, border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--ink-3)' }}>+</button>
                      </div>
                      <input type="number" value={l.unit_price || ''} onChange={e => setPrice(i, parseFloat(e.target.value) || 0)} placeholder="Preço" style={{ width: 64, ...inp, padding: '6px 8px', fontSize: 12.5 }} />
                      <input type="number" value={l.discount || ''} onChange={e => setDisc(i, parseFloat(e.target.value) || 0)} placeholder="Desc." title="Desconto (€)" style={{ width: 54, ...inp, padding: '6px 8px', fontSize: 12.5 }} />
                      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{euro(lineTotal(l))}</span>
                    </div>
                    {l.stockLeft != null && l.qty > l.stockLeft && <div style={{ fontSize: 10.5, color: '#dc2626', marginTop: 4 }}>⚠ só há {l.stockLeft} em stock</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Totais + pagamento */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 3 }}><span>IVA incluído</span><span>{euro(taxTotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Total ({totalQty})</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0d6e42', lineHeight: 1 }}>{euro(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {METHODS.map(mm => <button key={mm} onClick={() => setMethod(mm)} style={{ padding: '5px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${method === mm ? '#0d6e42' : 'var(--border)'}`, background: method === mm ? '#eef6f1' : 'white', color: method === mm ? '#0d6e42' : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{METHOD_LABEL[mm]}</button>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                <input value={nif} onChange={e => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="NIF (opcional)" inputMode="numeric" style={{ ...inp, padding: '8px 10px', fontSize: 12.5 }} />
                <input value={person} onChange={e => setPerson(e.target.value)} placeholder={`${cfg.personNoun} (opc.)`} style={{ ...inp, padding: '8px 10px', fontSize: 12.5 }} />
              </div>
              <button onClick={finalize} disabled={cart.length === 0 || finishing} style={{ width: '100%', padding: 13, background: cart.length === 0 ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: cart.length === 0 ? 'default' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {finishing ? 'A finalizar…' : `Finalizar · ${euro(subtotal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#0b1120', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>{toast}</div>}
      <style>{`@media (max-width: 820px){ .pos-grid { grid-template-columns: 1fr !important } }`}</style>
    </div>
  )
}
