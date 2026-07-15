'use client'

// Movimentos financeiros do mês: DESPESAS e OUTRAS RECEITAS (além das
// mensalidades). Dá ao dono o resultado do mês: mensalidades recebidas +
// outras receitas − despesas. Org-scoped (sprint104 finance_entries).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc, type PrintRecord } from '@/lib/print'

interface Move { id: string; kind: 'expense' | 'income'; category?: string | null; description: string; amount: number; date: string; method?: string | null }

const euro = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

const EXPENSE_CATS = ['Salários', 'Alimentação', 'Renda', 'Água/Luz/Gás', 'Manutenção', 'Material', 'Transporte', 'Seguros', 'Impostos', 'Outro']
const INCOME_CATS = ['Donativo', 'Subsídio', 'Atividade', 'Venda', 'Outro']

export default function FinanceLedger({ month, monthlyReceived }: { month: string; monthlyReceived: number }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [moves, setMoves] = useState<Move[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const blank = { kind: 'expense' as 'expense' | 'income', category: '', description: '', amount: '', date: month + '-' + String(new Date().getDate()).padStart(2, '0'), method: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const start = month + '-01'
    const end = month + '-31'
    const r = await scope.filter(supabase.from('finance_entries').select('*')).gte('date', start).lte('date', end).order('date', { ascending: false })
    if (r.error) { setTableMissing(true); setMoves([]) } else { setTableMissing(false); setMoves(r.data || []) }
    setLoading(false)
  }, [user, supabase, month, scope.orgId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['finance_entries'], userId: scope.liveFilterValue || user?.id, onChange: load })

  async function save() {
    if (!user || !form.description.trim() || !parseFloat(form.amount)) { setErr('Descrição e valor são obrigatórios.'); return }
    if (!scope.canEdit) { setErr('A sua conta é só de leitura.'); return }
    setSaving(true); setErr('')
    const row = scope.stamp({
      kind: form.kind, category: form.category || null, description: form.description.trim(),
      amount: Math.abs(parseFloat(form.amount)), date: form.date, method: form.method || null,
      recorded_by_id: user.id,
    })
    const { error } = await supabase.from('finance_entries').insert(row)
    setSaving(false)
    if (error) { setErr(error.code === '42P01' ? 'Movimentos ainda não disponíveis — corre o sprint104_attendance.sql.' : (error.message || 'Erro ao guardar.')); return }
    setForm({ ...blank, kind: form.kind }); setShowForm(false); load()
  }
  async function remove(m: Move) {
    if (!confirm(`Eliminar "${m.description}"?`)) return
    await supabase.from('finance_entries').delete().eq('id', m.id)
    setMoves(prev => prev.filter(x => x.id !== m.id))
  }

  const expenses = moves.filter(m => m.kind === 'expense')
  const incomes = moves.filter(m => m.kind === 'income')
  const totalExp = expenses.reduce((s, m) => s + Number(m.amount), 0)
  const totalInc = incomes.reduce((s, m) => s + Number(m.amount), 0)
  const result = monthlyReceived + totalInc - totalExp

  function printLedger() {
    const recs: PrintRecord[] = moves.map(m => ({
      title: m.description,
      tags: [{ label: m.kind === 'expense' ? 'Despesa' : 'Receita', color: m.kind === 'expense' ? '#dc2626' : '#16a34a' }],
      fields: [
        { label: 'Categoria', value: m.category || '—' },
        { label: 'Valor', value: (m.kind === 'expense' ? '- ' : '+ ') + euro(Number(m.amount)) },
        { label: 'Data', value: m.date },
        ...(m.method ? [{ label: 'Método', value: m.method }] : []),
      ],
    }))
    printDoc({
      docTitle: 'Movimentos financeiros',
      docSubtitle: new Date(month + '-01T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
      meta: [
        { label: 'mensalidades', value: euro(monthlyReceived) },
        { label: 'outras receitas', value: euro(totalInc) },
        { label: 'despesas', value: euro(totalExp) },
        { label: 'resultado', value: euro(result) },
      ],
      sections: [{ heading: 'Movimentos', records: recs.length ? recs : [{ title: 'Sem movimentos neste mês' }] }],
      footerNote: 'Movimentos financeiros · Phlox',
    })
  }

  if (tableMissing) return (
    <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Movimentos ainda por ativar</div>
      <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>Corra o <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint104_attendance.sql</code> no Supabase para registar despesas e outras receitas.</div>
    </div>
  )

  return (
    <div>
      {/* Resultado do mês */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: euro(monthlyReceived), l: 'Mensalidades recebidas', c: '#16a34a' },
          { v: euro(totalInc), l: 'Outras receitas', c: '#16a34a' },
          { v: euro(totalExp), l: 'Despesas', c: '#dc2626' },
          { v: euro(result), l: 'Resultado do mês', c: result >= 0 ? '#16a34a' : '#dc2626' },
        ].map(s => (
          <div key={s.l} style={{ flex: '1 1 150px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => { setForm({ ...blank, kind: 'expense' }); setErr(''); setShowForm(true) }} style={{ padding: '9px 15px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>− Despesa</button>
        <button onClick={() => { setForm({ ...blank, kind: 'income' }); setErr(''); setShowForm(true) }} style={{ padding: '9px 15px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Receita</button>
        {moves.length > 0 && <button onClick={printLedger} style={{ marginLeft: 'auto', padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: '#374151' }}>Imprimir</button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}</div>
      ) : moves.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 36, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem movimentos neste mês. Regista uma despesa ou receita.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {moves.map(m => (
            <div key={m.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${m.kind === 'expense' ? '#dc2626' : '#16a34a'}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.description}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{m.category ? `${m.category} · ` : ''}{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}{m.method ? ` · ${m.method}` : ''}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: m.kind === 'expense' ? '#dc2626' : '#16a34a', flexShrink: 0 }}>{m.kind === 'expense' ? '−' : '+'}{euro(Number(m.amount))}</div>
              <button aria-label="Eliminar" onClick={() => remove(m)} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16 }}>×</button>            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 460, padding: '20px 22px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{form.kind === 'expense' ? 'Nova despesa' : 'Nova receita'}</h2>
              <button aria-label="Fechar" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span style={lbl}>Descrição *</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={form.kind === 'expense' ? 'Ex: Fatura da luz' : 'Ex: Donativo de família'} style={inp} autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Valor (€) *</span><input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={inp} /></div>
                <div><span style={lbl}>Data</span><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}><option value="">—</option>{(form.kind === 'expense' ? EXPENSE_CATS : INCOME_CATS).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><span style={lbl}>Método</span><input value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} placeholder="Transferência…" style={inp} /></div>
              </div>
              {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
              <button onClick={save} disabled={saving || !form.description.trim() || !parseFloat(form.amount)} style={{ padding: '11px', background: (!form.description.trim() || !parseFloat(form.amount) || saving) ? 'var(--bg-3)' : (form.kind === 'expense' ? '#dc2626' : '#16a34a'), color: (!form.description.trim() || !parseFloat(form.amount) || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!form.description.trim() || !parseFloat(form.amount) || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar movimento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
