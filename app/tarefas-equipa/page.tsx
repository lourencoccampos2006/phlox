'use client'

// Tarefas da equipa — para TODAS as funções, da secretaria à limpeza, cozinha,
// manutenção e clínica. Quadro simples (A fazer / A decorrer / Feito) com áreas,
// responsável, prioridade e recorrência. Dá utilidade diária a quem não é clínico.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

// Fundido em "Equipa & Escalas" (/schedule) como aba "Tarefas" (TarefasTool
// reutilizado). A rota /tarefas-equipa redireciona p/ não partir links antigos.
export default function TarefasRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/schedule?tab=tarefas') }, [r])
  return null
}

interface Task {
  id: string; title: string; area: string; assignee?: string | null
  priority: 'alta' | 'normal' | 'baixa'; status: 'todo' | 'doing' | 'done'
  due_date?: string | null; recurring?: string | null; done_at?: string | null; done_by?: string | null; created_at: string
}

const AREAS: Record<string, { label: string; icon: string; color: string }> = {
  clinica:    { label: 'Clínica',    icon: '🩺', color: '#dc2626' },
  secretaria: { label: 'Secretaria', icon: '🗂️', color: '#0d9488' },
  farmacia:   { label: 'Farmácia',   icon: '💊', color: '#2563eb' },
  cozinha:    { label: 'Cozinha',    icon: '🍽️', color: '#d97706' },
  limpeza:    { label: 'Limpeza',    icon: '🧹', color: '#0891b2' },
  manutencao: { label: 'Manutenção', icon: '🔧', color: '#7c3aed' },
  geral:      { label: 'Geral',      icon: '📌', color: '#64748b' },
}
const AREA_KEYS = Object.keys(AREAS)
const COLS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo', label: 'A fazer', color: '#64748b' },
  { id: 'doing', label: 'A decorrer', color: '#2563eb' },
  { id: 'done', label: 'Feito', color: '#16a34a' },
]
const PRI: Record<string, { label: string; color: string }> = {
  alta: { label: 'Alta', color: '#dc2626' }, normal: { label: 'Normal', color: '#2563eb' }, baixa: { label: 'Baixa', color: '#9ca3af' },
}
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export function TarefasTool() {
  const { user, supabase } = useAuth() as any
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { title: '', area: 'geral', assignee: '', priority: 'normal' as const, due_date: '', recurring: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data, error } = await supabase.from('team_tasks').select('*').eq('user_id', user.id)
      .or(`status.neq.done,done_at.gte.${cutoff}`).order('created_at', { ascending: false })
    if (error) { if (/relation .*team_tasks.* does not exist/i.test(error.message)) setMissing(true); setTasks([]) }
    else { setMissing(false); setTasks(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'team_tasks', userId: user?.id, onChange: load })

  async function add() {
    if (!form.title.trim()) { setErr('Escreve a tarefa.'); return }
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('team_tasks').insert({
      user_id: user.id, title: form.title.trim(), area: form.area, assignee: form.assignee.trim() || null,
      priority: form.priority, due_date: form.due_date || null, recurring: form.recurring.trim() || null, status: 'todo',
    }).select().single()
    if (!error && data) { setTasks(p => [data, ...p]); setShowForm(false); setForm(blank) }
    else setErr(error?.message || 'Erro')
    setSaving(false)
  }
  async function move(t: Task, status: Task['status']) {
    const patch: any = { status }
    if (status === 'done') { patch.done_at = new Date().toISOString(); patch.done_by = user?.name || null }
    else { patch.done_at = null; patch.done_by = null }
    await supabase.from('team_tasks').update(patch).eq('id', t.id)
    setTasks(p => p.map(x => x.id === t.id ? { ...x, ...patch } : x))
  }
  async function del(id: string) {
    await supabase.from('team_tasks').delete().eq('id', id)
    setTasks(p => p.filter(x => x.id !== id))
  }

  const shown = filter === 'all' ? tasks : tasks.filter(t => t.area === filter)
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Operações</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Tarefas da equipa</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Da secretaria à limpeza, cozinha e manutenção — tudo o que mantém a instituição a funcionar.{overdue > 0 ? ` ${overdue} em atraso.` : ''}</p>
          </div>
          <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Tarefa</button>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Tarefas por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint32_institution_ops.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setFilter('all')} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${filter === 'all' ? '#0b1120' : 'var(--border)'}`, background: filter === 'all' ? '#0b112010' : 'white', color: filter === 'all' ? '#0b1120' : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>Todas</button>
              {AREA_KEYS.map(k => (
                <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${filter === k ? AREAS[k].color : 'var(--border)'}`, background: filter === k ? AREAS[k].color + '12' : 'white', color: filter === k ? AREAS[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{AREAS[k].icon} {AREAS[k].label}</button>
              ))}
            </div>
            {err && !missing && <div style={{ marginBottom: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#991b1b', fontSize: 13, padding: '12px 16px' }}>{err}</div>}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}</div>
            ) : (
              <div className="tasks-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
                {COLS.map(col => {
                  const items = shown.filter(t => t.status === col.id)
                  return (
                    <div key={col.id} style={{ background: 'var(--bg-2)', borderRadius: 12, padding: 10, minHeight: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px 10px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0b1120' }}>{col.label}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{items.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {items.length === 0 && <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', padding: '14px 0' }}>—</div>}
                        {items.map(t => {
                          const a = AREAS[t.area] || AREAS.geral
                          const isOverdue = t.status !== 'done' && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
                          return (
                            <div key={t.id} style={{ background: 'white', border: `1px solid ${isOverdue ? '#fca5a5' : 'var(--border)'}`, borderRadius: 10, padding: '10px 11px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0b1120', lineHeight: 1.35 }}>{t.title}</span>
                                <button onClick={() => del(t.id)} style={{ fontSize: 14, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: a.color, background: a.color + '12', padding: '1px 6px', borderRadius: 4 }}>{a.icon} {a.label}</span>
                                {t.priority !== 'normal' && <span style={{ fontSize: 10, fontWeight: 700, color: PRI[t.priority].color }}>{PRI[t.priority].label}</span>}
                                {t.assignee && <span style={{ fontSize: 10.5, color: '#6b7280' }}>· {t.assignee}</span>}
                                {t.recurring && <span style={{ fontSize: 10.5, color: '#6b7280' }}>🔁 {t.recurring}</span>}
                                {t.due_date && <span style={{ fontSize: 10.5, color: isOverdue ? '#dc2626' : '#9ca3af', fontWeight: isOverdue ? 700 : 400 }}>📅 {new Date(t.due_date + 'T12:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                                {col.id !== 'todo' && <button onClick={() => move(t, col.id === 'done' ? 'doing' : 'todo')} style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 0', cursor: 'pointer' }}>←</button>}
                                {col.id !== 'done' && <button onClick={() => move(t, col.id === 'todo' ? 'doing' : 'done')} style={{ flex: 2, fontSize: 11, fontWeight: 700, color: '#fff', background: col.id === 'todo' ? '#2563eb' : '#16a34a', border: 'none', borderRadius: 6, padding: '5px 0', cursor: 'pointer' }}>{col.id === 'todo' ? 'Iniciar' : 'Concluir'}</button>}
                              </div>
                            </div>
                          )
                        })}
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
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Nova tarefa</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>Tarefa</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: limpar sala 2, repor luvas, ligar à família…" style={inp} autoFocus /></div>
              <div>
                <span style={lbl}>Área</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {AREA_KEYS.map(k => <button key={k} onClick={() => setForm({ ...form, area: k })} style={{ padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.area === k ? AREAS[k].color : 'var(--border)'}`, background: form.area === k ? AREAS[k].color + '12' : 'white', color: form.area === k ? AREAS[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{AREAS[k].icon} {AREAS[k].label}</button>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Responsável</span><input value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Nome (opcional)" style={inp} /></div>
                <div><span style={lbl}>Para quando</span><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={lbl}>Prioridade</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['alta', 'normal', 'baixa'] as const).map(k => <button key={k} onClick={() => setForm({ ...form, priority: k })} style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${form.priority === k ? PRI[k].color : 'var(--border)'}`, background: form.priority === k ? PRI[k].color + '12' : 'white', color: form.priority === k ? PRI[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{PRI[k].label}</button>)}
                  </div>
                </div>
                <div><span style={lbl}>Recorrência</span><input value={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.value })} placeholder="Ex: diária, semanal" style={inp} /></div>
              </div>
              <button onClick={add} disabled={saving} style={{ padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : 'Adicionar tarefa'}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@media (max-width: 720px){ .tasks-board { grid-template-columns: 1fr !important } }`}</style>
    </div>
  )
}
