'use client'

// Faturação transacional — farmácia (vendas/caixa diária) e clínica/CSP (atos/recibos).
// Modelo POS: regista cada venda/ato, fecho de caixa do dia, recibo imprimível.
// Adapta o vocabulário e tipos de linha ao tipo de instituição.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc, type PrintRecord } from '@/lib/print'
import type { RevenueModel } from '@/lib/institutionConfig'

interface Sale {
  id: string; at: string; kind: string; description?: string | null; person_name?: string | null
  qty: number; gross: number; discount: number; tax_rate: number; method: string; paid: boolean
  professional?: string | null; notes?: string | null
  doc_no?: string | null; doc_status?: string | null; nif?: string | null
}

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const net = (s: Sale) => Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0))
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

const METHODS = ['dinheiro', 'multibanco', 'mbway', 'transferencia', 'comparticipado', 'isento']
const METHOD_LABEL: Record<string, string> = { dinheiro: 'Dinheiro', multibanco: 'Multibanco', mbway: 'MB WAY', transferencia: 'Transferência', comparticipado: 'Comparticipado', isento: 'Isento' }

// Tipos de linha por modelo de receita
const KINDS_POS = [
  { k: 'venda', label: 'Venda', color: '#2563eb' },
  { k: 'dispensa', label: 'Dispensa', color: '#0d9488' },
  { k: 'rastreio', label: 'Rastreio/serviço', color: '#7c3aed' },
  { k: 'outro', label: 'Outro', color: '#64748b' },
]
const KINDS_FFS = [
  { k: 'consulta', label: 'Consulta', color: '#dc2626' },
  { k: 'ato', label: 'Ato/exame', color: '#2563eb' },
  { k: 'rastreio', label: 'Rastreio', color: '#7c3aed' },
  { k: 'outro', label: 'Outro', color: '#64748b' },
]

export default function SalesBilling({ revenue, unitNoun, personNoun }: {
  revenue: RevenueModel; unitNoun: string; personNoun: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const isPOS = revenue === 'pos_sales'
  const KINDS = isPOS ? KINDS_POS : KINDS_FFS
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const blank = {
    kind: KINDS[0].k, description: '', person_name: '', qty: '1', gross: '', discount: '',
    tax_rate: isPOS ? '6' : '23', method: 'dinheiro', paid: !isPOS ? false : true, professional: '',
  }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const start = new Date(day + 'T00:00:00').toISOString()
    const end = new Date(day + 'T23:59:59').toISOString()
    const { data, error } = await scope.filter(supabase.from('sales').select('*')).gte('at', start).lte('at', end).order('at', { ascending: false })
    if (error) { if (/relation .*sales.* does not exist/i.test(error.message)) setMissing(true); setSales([]) }
    else { setMissing(false); setSales(data || []) }
    setLoading(false)
  }, [user, supabase, day])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'sales', userId: scope.liveFilterValue || user?.id, onChange: load })

  async function add() {
    const gross = parseFloat(form.gross) || 0
    if (gross <= 0 && !form.description.trim()) { setErr('Indica o valor ou a descrição.'); return }
    setSaving(true); setErr('')
    const row = scope.stamp({
      kind: form.kind, description: form.description.trim() || null,
      person_name: form.person_name.trim() || null, qty: Number(form.qty) || 1,
      gross, discount: parseFloat(form.discount) || 0, tax_rate: parseFloat(form.tax_rate) || 0,
      method: form.method, paid: !!form.paid, professional: form.professional.trim() || null,
      at: day === new Date().toISOString().slice(0, 10) ? new Date().toISOString() : new Date(day + 'T12:00:00').toISOString(),
    })
    const { data, error } = await supabase.from('sales').insert(row).select().single()
    if (!error && data) { setSales(p => [data, ...p]); setShowForm(false); setForm(blank) }
    else setErr(error?.message || 'Erro')
    setSaving(false)
  }
  async function togglePaid(s: Sale) {
    await supabase.from('sales').update({ paid: !s.paid }).eq('id', s.id)
    setSales(p => p.map(x => x.id === s.id ? { ...x, paid: !s.paid } : x))
  }
  async function del(id: string) {
    await supabase.from('sales').delete().eq('id', id)
    setSales(p => p.filter(x => x.id !== id))
  }
  // Documento finalizado não se apaga — emite-se uma NOTA DE CRÉDITO que o anula.
  async function creditNote(s: Sale) {
    if (!confirm(`Emitir nota de crédito que anula ${s.doc_no}? O documento original mantém-se no histórico (exigência fiscal).`)) return
    const gross = net(s)
    const { data: nc, error } = await supabase.from('sales').insert(scope.stamp({
      kind: s.kind, doc_type: 'NC', description: `Anulação de ${s.doc_no}`,
      person_name: s.person_name || null, nif: s.nif || null, qty: 1,
      gross, discount: 0, tax_rate: s.tax_rate, method: s.method, paid: true,
      doc_status: 'nota_credito', annuls_id: s.id, professional: user?.name || null,
    })).select().single()
    if (error || !nc) { alert(error?.message || 'Erro a emitir nota de crédito'); return }
    await supabase.from('sales').update({ doc_status: 'anulado' }).eq('id', s.id)
    const token = (await supabase.auth.getSession()).data.session?.access_token
    try { await fetch('/api/fiscal/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ saleId: nc.id, docType: 'NC' }) }) } catch { /* segue */ }
    load()
  }

  const total = sales.reduce((a, s) => a + net(s), 0)
  const received = sales.filter(s => s.paid).reduce((a, s) => a + net(s), 0)
  const pending = total - received
  const count = sales.length
  const byMethod: Record<string, number> = {}
  sales.filter(s => s.paid).forEach(s => { byMethod[s.method] = (byMethod[s.method] || 0) + net(s) })
  const isToday = day === new Date().toISOString().slice(0, 10)

  function closeRegister() {
    const records: PrintRecord[] = sales.map(s => ({
      title: `${KINDS.find(k => k.k === s.kind)?.label || s.kind}${s.description ? ` — ${s.description}` : ''}`,
      meta: `${new Date(s.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}${s.person_name ? ` · ${s.person_name}` : ''}`,
      tags: [{ label: s.paid ? 'Pago' : 'Pendente', color: s.paid ? '#16a34a' : '#d97706' }, { label: METHOD_LABEL[s.method] || s.method, color: '#64748b' }],
      fields: [{ label: 'Valor', value: euro(net(s)) }],
    }))
    printDoc({
      docTitle: isPOS ? 'Fecho de Caixa' : 'Mapa de Atos',
      docSubtitle: new Date(day + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      institution: unitNoun,
      meta: [
        { label: 'movimentos', value: String(count) },
        { label: 'total', value: euro(total) },
        { label: 'recebido', value: euro(received) },
        ...(pending > 0 ? [{ label: 'pendente', value: euro(pending) }] : []),
        ...Object.entries(byMethod).map(([m, v]) => ({ label: METHOD_LABEL[m] || m, value: euro(v) })),
      ],
      sections: [{ heading: isPOS ? 'Movimentos do dia' : 'Atos do dia', records: records.length ? records : [{ title: 'Sem movimentos' }] }],
      footerNote: `${isPOS ? 'Fecho de caixa' : 'Mapa de atos'} · Phlox`,
    })
  }

  function printReceipt(s: Sale) {
    printDoc({
      docTitle: 'Recibo',
      docSubtitle: unitNoun,
      meta: [
        { label: 'data', value: new Date(s.at).toLocaleDateString('pt-PT') },
        { label: 'estado', value: s.paid ? 'PAGO' : 'PENDENTE' },
        { label: 'método', value: METHOD_LABEL[s.method] || s.method },
      ],
      sections: [{
        heading: 'Detalhe', records: [{
          title: `${KINDS.find(k => k.k === s.kind)?.label || s.kind}${s.description ? ` — ${s.description}` : ''}`,
          meta: s.person_name || undefined,
          fields: [
            ...(s.qty > 1 ? [{ label: 'Quantidade', value: String(s.qty) }] : []),
            { label: 'Valor bruto', value: euro(s.gross) },
            ...(s.discount ? [{ label: 'Desconto', value: `- ${euro(s.discount)}` }] : []),
            ...(s.tax_rate ? [{ label: `IVA incluído (${s.tax_rate}%)`, value: euro(net(s) - net(s) / (1 + s.tax_rate / 100)) }] : []),
            { label: 'TOTAL', value: euro(net(s)) },
          ],
        }],
      }],
      footerNote: 'Recibo · Phlox',
    })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 940 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Financeiro · {unitNoun}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>{isPOS ? 'Vendas & Caixa' : 'Atos & Recibos'}</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>{isPOS ? 'Regista vendas e dispensa, e fecha a caixa do dia.' : 'Regista atos e consultas, emite recibos e fecha o dia.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} style={{ ...inp, width: 'auto' }} />
            <button onClick={closeRegister} style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: '#374151' }}>{isPOS ? 'Fecho de caixa' : 'Imprimir dia'}</button>
            <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '9px 16px', background: isPOS ? '#2563eb' : '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ {isPOS ? 'Venda' : 'Ato'}</button>
          </div>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Vendas / caixa ainda por ativar</div>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>A base de dados de vendas ainda não está criada nesta conta. Aplique a migração de faturação (<code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sales</code>) no Supabase e recarregue. Tudo o resto continua a funcionar normalmente.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { v: euro(total), l: isPOS ? 'Total do dia' : 'Faturado', c: '#0b1120' },
                { v: euro(received), l: 'Recebido', c: '#16a34a' },
                ...(pending > 0 ? [{ v: euro(pending), l: 'Pendente', c: '#d97706' }] : []),
                { v: String(count), l: 'Movimentos', c: '#2563eb' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 140px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.v}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {Object.keys(byMethod).length > 0 && (
              <div style={{ ...card, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Por método</span>
                {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
                  <span key={m} style={{ fontSize: 13, color: 'var(--ink-2)' }}><strong>{METHOD_LABEL[m] || m}:</strong> {euro(v)}</span>
                ))}
              </div>
            )}
            {err && <div style={{ marginBottom: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#991b1b', fontSize: 13, padding: '12px 16px' }}>{err}</div>}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}</div>
            ) : sales.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: 36 }}>
                {isToday ? `Sem movimentos hoje. Regista o primeiro com “+ ${isPOS ? 'Venda' : 'Ato'}”.` : 'Sem movimentos neste dia.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sales.map(s => {
                  const kind = KINDS.find(k => k.k === s.kind) || KINDS[KINDS.length - 1]
                  const finalized = !!s.doc_no
                  const annulled = s.doc_status === 'anulado'
                  const isNC = s.doc_status === 'nota_credito'
                  return (
                    <div key={s.id} style={{ background: annulled ? '#fafafa' : 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${isNC ? '#dc2626' : kind.color}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', opacity: annulled ? 0.7 : 1 }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: isNC ? '#dc2626' : kind.color, background: (isNC ? '#dc2626' : kind.color) + '14', padding: '2px 8px', borderRadius: 5 }}>{isNC ? 'Nota de crédito' : kind.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textDecoration: annulled ? 'line-through' : 'none' }}>{s.description || s.person_name || '—'}</span>
                          {s.qty > 1 && <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>×{s.qty}</span>}
                          {annulled && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>ANULADO</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 2 }}>
                          {s.doc_no ? <strong>{s.doc_no} · </strong> : ''}{new Date(s.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {METHOD_LABEL[s.method] || s.method}{s.person_name && s.description ? ` · ${s.person_name}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isNC ? '#dc2626' : 'var(--ink)' }}>{isNC ? '−' : ''}{euro(net(s))}</div>
                        {s.discount > 0 && <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>desc. {euro(s.discount)}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        {!s.paid && <button onClick={() => togglePaid(s)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>Marcar pago</button>}
                        {s.paid && !isNC && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ pago</span>}
                        <button onClick={() => printReceipt(s)} title="Imprimir recibo" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                        {finalized && !annulled && !isNC && (
                          <button onClick={() => creditNote(s)} title="Emitir nota de crédito (anula o documento)" style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>NC</button>
                        )}
                        {!finalized && <button onClick={() => del(s.id)} title="Eliminar (rascunho não finalizado)" style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 17 }}>×</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{isPOS ? 'Nova venda' : 'Novo ato'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <span style={lbl}>Tipo</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {KINDS.map(k => <button key={k.k} onClick={() => setForm({ ...form, kind: k.k })} style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.kind === k.k ? k.color : 'var(--border)'}`, background: form.kind === k.k ? k.color + '12' : 'white', color: form.kind === k.k ? k.color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{k.label}</button>)}
                </div>
              </div>
              <div><span style={lbl}>Descrição</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={isPOS ? 'Ex: Paracetamol 1g, medição de TA…' : 'Ex: Consulta de seguimento, penso…'} style={inp} autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div><span style={lbl}>{personNoun} (opcional)</span><input value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} placeholder="Anónimo" style={inp} /></div>
                <div><span style={lbl}>Qtd</span><input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Valor (€)</span><input type="number" value={form.gross} onChange={e => setForm({ ...form, gross: e.target.value })} placeholder="0.00" style={inp} /></div>
                <div><span style={lbl}>Desc. (€)</span><input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="0" style={inp} /></div>
                <div><span style={lbl}>IVA %</span><input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} style={inp} /></div>
              </div>
              <div>
                <span style={lbl}>Método</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {METHODS.map(m => <button key={m} onClick={() => setForm({ ...form, method: m, paid: m === 'comparticipado' ? form.paid : true })} style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.method === m ? '#2563eb' : 'var(--border)'}`, background: form.method === m ? '#eff6ff' : 'white', color: form.method === m ? '#2563eb' : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{METHOD_LABEL[m]}</button>)}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} /> Pago
              </label>
              <button onClick={add} disabled={saving} style={{ padding: 12, background: isPOS ? '#2563eb' : '#dc2626', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : `Registar ${isPOS ? 'venda' : 'ato'}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
