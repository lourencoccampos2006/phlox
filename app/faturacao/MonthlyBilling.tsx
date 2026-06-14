'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc, type PrintRecord } from '@/lib/print'

interface Patient { id: string; name: string; room_number?: string | null; active?: boolean }
interface Entry {
  id: string; patient_id: string; month: string
  fee: number; subsidy: number; extras: number; discount: number
  paid: boolean; paid_date?: string | null; method?: string | null; notes?: string | null
}

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const thisMonth = () => new Date().toISOString().slice(0, 7)
const due = (e: Entry) => e.fee + e.extras - e.subsidy - e.discount
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function MonthlyBilling() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [month, setMonth] = useState(thisMonth())
  const [generating, setGenerating] = useState(false)
  const [edit, setEdit] = useState<Entry | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from('patients').select('id,name,room_number,active').eq('user_id', user.id).order('name'),
      supabase.from('billing_entries').select('*').eq('user_id', user.id),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    if (e.error) { setTableMissing(true); setEntries([]) } else { setTableMissing(false); setEntries(e.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['billing_entries', 'patients'], userId: user?.id, onChange: load })

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const monthEntries = entries.filter(e => e.month === month)
  const byPatient: Record<string, Entry> = {}; monthEntries.forEach(e => { byPatient[e.patient_id] = e })

  // residents without an entry this month
  const missing = patients.filter(p => !byPatient[p.id])

  async function generateMonth() {
    if (!user || missing.length === 0) return
    setGenerating(true)
    // copia mensalidade/comparticipação do mês anterior do residente, se existir
    const rows = missing.map(p => {
      const prev = entries.filter(e => e.patient_id === p.id).sort((a, b) => b.month.localeCompare(a.month))[0]
      return { user_id: user.id, patient_id: p.id, month, fee: prev?.fee || 0, subsidy: prev?.subsidy || 0, extras: 0, discount: 0, paid: false }
    })
    await supabase.from('billing_entries').insert(rows)
    setGenerating(false); load()
  }
  async function togglePaid(e: Entry) {
    const paid = !e.paid
    await supabase.from('billing_entries').update({ paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null }).eq('id', e.id).eq('user_id', user.id)
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null } : x))
  }
  async function saveEdit() {
    if (!user || !edit) return
    setSaving(true)
    await supabase.from('billing_entries').update({ fee: edit.fee, subsidy: edit.subsidy, extras: edit.extras, discount: edit.discount, method: edit.method || null, notes: edit.notes || null, updated_at: new Date().toISOString() }).eq('id', edit.id).eq('user_id', user.id)
    setSaving(false); setEdit(null); load()
  }

  const totalFee = monthEntries.reduce((s, e) => s + due(e), 0)
  const received = monthEntries.filter(e => e.paid).reduce((s, e) => s + due(e), 0)
  const owed = totalFee - received
  const rate = totalFee > 0 ? Math.round((received / totalFee) * 100) : 0

  function printMonth() {
    const records: PrintRecord[] = monthEntries.map(e => ({
      title: nameOf(e.patient_id),
      tags: [{ label: e.paid ? 'Pago' : 'Pendente', color: e.paid ? '#16a34a' : '#d97706' }],
      fields: [
        { label: 'Mensalidade', value: euro(e.fee) },
        { label: 'Comparticipação', value: euro(e.subsidy) },
        { label: 'Extras', value: euro(e.extras) },
        { label: 'Desconto', value: euro(e.discount) },
        { label: 'A pagar', value: euro(due(e)) },
        { label: 'Pago em', value: e.paid_date || '—' },
      ],
    }))
    printDoc({
      docTitle: 'Mapa de Faturação',
      docSubtitle: new Date(month + '-01T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
      institution: 'Lar / ERPI',
      meta: [
        { label: 'faturado', value: euro(totalFee) },
        { label: 'recebido', value: euro(received) },
        { label: 'em dívida', value: euro(owed) },
        { label: 'cobrança', value: `${rate}%` },
      ],
      sections: [{ heading: 'Residentes', records: records.length ? records : [{ title: 'Sem registos neste mês' }] }],
      footerNote: 'Mapa de faturação · Phlox',
    })
  }

  // Recibo individual de mensalidade para entregar à família
  function printReceipt(e: Entry) {
    const mLabel = new Date(e.month + '-01T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    const lines: PrintRecord[] = [{
      title: `Mensalidade — ${mLabel}`,
      fields: [
        { label: 'Mensalidade', value: euro(e.fee) },
        ...(e.extras ? [{ label: 'Extras', value: euro(e.extras) }] : []),
        ...(e.subsidy ? [{ label: 'Comparticipação', value: `- ${euro(e.subsidy)}` }] : []),
        ...(e.discount ? [{ label: 'Desconto', value: `- ${euro(e.discount)}` }] : []),
        { label: 'TOTAL A PAGAR', value: euro(due(e)) },
      ],
      ...(e.notes ? { body: e.notes } : {}),
    }]
    printDoc({
      docTitle: e.paid ? 'Recibo de Mensalidade' : 'Aviso de Pagamento',
      docSubtitle: nameOf(e.patient_id),
      institution: 'Lar / ERPI',
      meta: [
        { label: 'estado', value: e.paid ? 'PAGO' : 'PENDENTE' },
        ...(e.paid && e.paid_date ? [{ label: 'pago em', value: e.paid_date }] : []),
        ...(e.method ? [{ label: 'método', value: e.method }] : []),
      ],
      sections: [
        { heading: 'Detalhe', records: lines },
        { heading: 'Validação', records: [{ title: 'Assinaturas', fields: [{ label: 'Recebido por', value: '' }, { label: 'Data', value: '' }] }] },
      ],
      footerNote: `${e.paid ? 'Recibo' : 'Aviso'} de mensalidade · Phlox`,
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 940 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Financeiro</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Faturação & Mensalidades</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Mensalidades, comparticipações, extras e pagamentos — por residente e por mês.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 'auto' }} />
            <button onClick={printMonth} style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: '#374151' }}>Imprimir mapa</button>
          </div>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Indisponível de momento</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { v: euro(totalFee), l: 'Faturado', c: '#0b1120' },
                { v: euro(received), l: 'Recebido', c: '#16a34a' },
                { v: euro(owed), l: 'Em dívida', c: owed > 0 ? '#dc2626' : '#16a34a' },
                { v: `${rate}%`, l: 'Taxa de cobrança', c: '#2563eb' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 150px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.v}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {missing.length > 0 && (
              <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#1e40af' }}><strong>{missing.length}</strong> residente(s) sem faturação este mês.</span>
                <button onClick={generateMonth} disabled={generating} style={{ padding: '8px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{generating ? 'A gerar…' : 'Gerar mês (copiar valores)'}</button>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>
            ) : monthEntries.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 36, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem faturação neste mês. Usa "Gerar mês".</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {monthEntries.sort((a, b) => Number(a.paid) - Number(b.paid) || nameOf(a.patient_id).localeCompare(nameOf(b.patient_id))).map(e => (
                  <div key={e.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${e.paid ? '#16a34a' : '#d97706'}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{nameOf(e.patient_id)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>
                        Mens. {euro(e.fee)}{e.subsidy ? ` · compart. ${euro(e.subsidy)}` : ''}{e.extras ? ` · extras ${euro(e.extras)}` : ''}{e.discount ? ` · desc. ${euro(e.discount)}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{euro(due(e))}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>a pagar</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      <button onClick={() => togglePaid(e)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${e.paid ? '#bbf7d0' : '#fde68a'}`, background: e.paid ? '#f0fdf4' : '#fffbeb', color: e.paid ? '#16a34a' : '#d97706', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                        {e.paid ? '✓ Pago' : 'Marcar pago'}
                      </button>
                      <button onClick={() => printReceipt(e)} title={e.paid ? 'Imprimir recibo' : 'Imprimir aviso de pagamento'} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button onClick={() => setEdit(e)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {edit && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setEdit(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 460, padding: '20px 22px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{nameOf(edit.patient_id)}</h2>
              <button onClick={() => setEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><span style={lbl}>Mensalidade (€)</span><input type="number" value={edit.fee} onChange={e => setEdit({ ...edit, fee: parseFloat(e.target.value) || 0 })} style={inp} /></div>
              <div><span style={lbl}>Comparticipação (€)</span><input type="number" value={edit.subsidy} onChange={e => setEdit({ ...edit, subsidy: parseFloat(e.target.value) || 0 })} style={inp} /></div>
              <div><span style={lbl}>Extras (€)</span><input type="number" value={edit.extras} onChange={e => setEdit({ ...edit, extras: parseFloat(e.target.value) || 0 })} style={inp} /></div>
              <div><span style={lbl}>Desconto (€)</span><input type="number" value={edit.discount} onChange={e => setEdit({ ...edit, discount: parseFloat(e.target.value) || 0 })} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={lbl}>Método</span><input value={edit.method || ''} onChange={e => setEdit({ ...edit, method: e.target.value })} placeholder="Transferência, débito direto..." style={inp} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Total a pagar</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{euro(due(edit))}</span>
            </div>
            <button onClick={saveEdit} disabled={saving} style={{ width: '100%', padding: '11px', background: saving ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
