'use client'

// /automacoes — Workflow automation + inbox de agentes
// Duas tabs: Regras de automação (criar/editar/disable) e Tarefas de agentes
// (inbox: open/acknowledged/done). Botão "Correr agentes agora" dispara o lote.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'

interface Automation {
  id: string; name: string; description: string|null
  trigger_kind: string; trigger_expr: string
  condition: any; actions: any[]
  enabled: boolean
  last_run_at: string|null; last_status: string|null
  run_count: number
}
interface AgentTask {
  id: string; agent_name: string; kind: string; title: string
  reason: string|null; payload: any; status: string; priority: number
  created_at: string; due_at: string|null; resolved_at: string|null; resolution: string|null
}
interface Run {
  id: string; automation_id: string; status: string
  matched_count: number|null; error: string|null; started_at: string; duration_ms: number|null
}

const ACCENT = '#0d6e42'

const AGENT_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  'stock-watch':   { label: 'Stock Watch',   desc: 'Repõe quando stock < mínimo', color: '#1e40af' },
  'expiry-watch':  { label: 'Expiry Watch',  desc: 'Alerta validades < 30 dias',  color: '#92400e' },
  'triage-helper': { label: 'Triage Helper', desc: 'Sinaliza esperas excedidas',  color: '#991b1b' },
  'rounds-flag':   { label: 'Rounds Flag',   desc: 'Polimedicação sem revisão',   color: '#6d28d9' },
}

const PRIORITY_META: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'CRÍTICA', color: '#7f1d1d', bg: '#fecaca' },
  2: { label: 'ALTA',    color: '#9a3412', bg: '#fed7aa' },
  3: { label: 'MÉDIA',   color: '#854d0e', bg: '#fef9c3' },
  4: { label: 'BAIXA',   color: '#166534', bg: '#bbf7d0' },
  5: { label: 'INFO',    color: '#1e40af', bg: '#bfdbfe' },
}

export default function AutomacoesPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [tab, setTab] = useState<'tasks' | 'rules'>('tasks')
  const [automations, setAutomations] = useState<Automation[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNewRule, setShowNewRule] = useState(false)
  const [runningAgents, setRunningAgents] = useState(false)

  const canWriteAuto = caps.includes('automation.write')
  const canAgent = caps.includes('agent.use')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const url = new URL('/api/agent-tasks', window.location.origin)
      url.searchParams.set('org_id', org.id)
      if (statusFilter) url.searchParams.set('status', statusFilter)
      const [aRes, tRes] = await Promise.all([
        fetch(`/api/automations?org_id=${org.id}`, { headers }).then(r => r.json()),
        fetch(url.toString(), { headers }).then(r => r.json()),
      ])
      setAutomations(aRes.automations || [])
      setRuns(aRes.runs || [])
      setTasks(tRes.tasks || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, statusFilter, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  async function runAgents() {
    if (!org || runningAgents) return
    setRunningAgents(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/agents/run', { method: 'POST', headers, body: JSON.stringify({ org_id: org.id, agent: 'all' }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      load()
    } catch (e: any) { setErr(e.message) } finally { setRunningAgents(false) }
  }

  async function resolveTask(id: string, action: 'acknowledge' | 'done' | 'dismiss', resolution?: string) {
    const headers = await authHeader()
    await fetch('/api/agent-tasks', { method: 'PATCH', headers, body: JSON.stringify({ id, action, resolution }) })
    load()
  }

  async function toggleAuto(id: string, enabled: boolean) {
    const headers = await authHeader()
    await fetch(`/api/automations/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ enabled }) })
    load()
  }

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Automações</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('automation.read') && !caps.includes('agent.use')) {
    return <main style={{ padding: 24 }}><h1>Automações</h1><p>Sem permissão.</p></main>
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Automações &amp; Agentes</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canAgent && (
            <button onClick={runAgents} disabled={runningAgents} style={btn('ghost')}>
              {runningAgents ? 'A correr…' : '⚡ Correr agentes agora'}
            </button>
          )}
          {tab === 'rules' && canWriteAuto && (
            <button onClick={() => setShowNewRule(true)} style={btn('primary')}>+ Nova regra</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <TabBtn label="Tarefas dos agentes" active={tab === 'tasks'} onClick={() => setTab('tasks')} count={tasks.filter(t => t.status === 'open').length} />
        <TabBtn label="Regras" active={tab === 'rules'} onClick={() => setTab('rules')} count={automations.length} />
      </div>

      {tab === 'tasks' && (
        <>
          {/* Filtro */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { v: 'open', label: 'Abertas' },
              { v: 'acknowledged', label: 'Reconhecidas' },
              { v: 'done', label: 'Resolvidas' },
              { v: 'dismissed', label: 'Descartadas' },
              { v: '', label: 'Todas' },
            ].map(s => (
              <button key={s.v} onClick={() => setStatusFilter(s.v)} style={{
                padding: '4px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: statusFilter === s.v ? ACCENT : '#f3f4f6',
                color: statusFilter === s.v ? 'white' : '#374151',
              }}>{s.label}</button>
            ))}
          </div>

          {tasks.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ margin: 0, color: '#6b7280' }}>Sem tarefas. Os agentes propõem aqui ações que precisam de revisão humana.</p>
              {canAgent && <button onClick={runAgents} style={{ ...btn('primary'), marginTop: 12 }}>Correr agentes agora</button>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {tasks.map(t => {
                const agent = AGENT_LABELS[t.agent_name] || { label: t.agent_name, desc: '', color: '#6b7280' }
                const pri = PRIORITY_META[t.priority] || PRIORITY_META[3]
                return (
                  <div key={t.id} style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                    display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 14, alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: agent.color, letterSpacing: 0.5 }}>{agent.label.toUpperCase()}</div>
                      <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, background: pri.bg, color: pri.color, fontSize: 10, fontWeight: 700 }}>
                        {pri.label}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.title}</div>
                      {t.reason && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{t.reason}</div>}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {new Date(t.created_at).toLocaleString('pt-PT')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {canAgent && t.status === 'open' && (
                        <>
                          <button onClick={() => resolveTask(t.id, 'done', 'Resolvido')} style={{ ...btn('primary'), fontSize: 12, padding: '5px 10px' }}>Resolver</button>
                          <button onClick={() => resolveTask(t.id, 'acknowledge')} style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px' }}>Ver depois</button>
                          <button onClick={() => resolveTask(t.id, 'dismiss')} style={{ ...btn('ghost'), fontSize: 12, padding: '5px 10px', color: '#dc2626' }}>Descartar</button>
                        </>
                      )}
                      {t.status === 'acknowledged' && canAgent && (
                        <button onClick={() => resolveTask(t.id, 'done', 'Resolvido')} style={{ ...btn('primary'), fontSize: 12, padding: '5px 10px' }}>Resolver</button>
                      )}
                      {(t.status === 'done' || t.status === 'dismissed') && (
                        <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>
                          {t.status === 'done' ? '✓ resolvido' : '✗ descartado'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'rules' && (
        automations.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ margin: 0, color: '#6b7280' }}>Sem regras. Cria a primeira para automatizar lembretes, alertas ou tarefas.</p>
            {canWriteAuto && <button onClick={() => setShowNewRule(true)} style={{ ...btn('primary'), marginTop: 12 }}>Criar regra</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {automations.map(a => {
              const lastRuns = runs.filter(r => r.automation_id === a.id).slice(0, 5)
              return (
                <div key={a.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{a.name}</h3>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600 }}>{a.trigger_kind}</span>
                        {!a.enabled && <span style={{ padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>DESACTIVADA</span>}
                      </div>
                      {a.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{a.description}</p>}
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#374151', marginTop: 8 }}>
                        <span><b>Gatilho:</b> <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{a.trigger_expr}</code></span>
                        <span><b>Acções:</b> {a.actions.length}</span>
                        <span><b>Corridas:</b> {a.run_count}</span>
                      </div>
                      {lastRuns.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          {lastRuns.map(r => (
                            <span key={r.id} title={`${r.status} · ${r.matched_count || 0}`} style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: r.status === 'ok' ? '#10b981' : r.status === 'error' ? '#dc2626' : '#9ca3af',
                            }} />
                          ))}
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>últimas {lastRuns.length} corridas</span>
                        </div>
                      )}
                    </div>
                    {canWriteAuto && (
                      <button onClick={() => toggleAuto(a.id, !a.enabled)} style={{ ...btn('ghost'), fontSize: 12 }}>
                        {a.enabled ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {showNewRule && (
        <NewRuleModal orgId={org.id} onClose={() => setShowNewRule(false)} onSaved={() => { setShowNewRule(false); load() }} authHeader={authHeader} />
      )}
    </main>
  )
}

function TabBtn({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
      fontWeight: 600, fontSize: 14, color: active ? ACCENT : '#6b7280',
      borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`, marginBottom: -1,
    }}>{label}{count != null && count > 0 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 10, background: active ? ACCENT : '#e5e7eb', color: active ? 'white' : '#6b7280' }}>{count}</span>}</button>
  )
}

// ─── Templates prontos a usar ────────────────────────────────────────────
interface Template {
  id: string
  icon: string
  name: string
  desc: string
  trigger_kind: 'cron' | 'event' | 'threshold'
  trigger_expr: string
  trigger_label: string
  actions: { kind: string; params: any }[]
}

const TEMPLATES: Template[] = [
  {
    id: 'daily-stock-check',
    icon: '📦',
    name: 'Verificar stock todas as manhãs',
    desc: 'Às 7h00, cria uma tarefa para a equipa rever stock crítico do dia.',
    trigger_kind: 'cron',
    trigger_expr: '0 7 * * *',
    trigger_label: 'Todos os dias às 7h00',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'stock-check', title: 'Verificar stock crítico do dia', priority: 3 } }],
  },
  {
    id: 'expiry-weekly',
    icon: '⏰',
    name: 'Alerta semanal de validades',
    desc: 'Toda 2ª-feira de manhã, gera lista de medicamentos a expirar nos próximos 30 dias.',
    trigger_kind: 'cron',
    trigger_expr: '0 8 * * 1',
    trigger_label: 'Segundas às 8h00',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'expiry-watch', title: 'Rever validades próximas', priority: 3 } }],
  },
  {
    id: 'occupancy-alert',
    icon: '🛏️',
    name: 'Alerta de lotação > 90%',
    desc: 'Quando ocupação das camas excede 90%, avisa coordenador.',
    trigger_kind: 'threshold',
    trigger_expr: 'beds_occupied_pct > 90',
    trigger_label: 'Ocupação > 90%',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'capacity', title: 'Lotação crítica — rever altas pendentes', priority: 2 } }],
  },
  {
    id: 'triage-overdue',
    icon: '🚨',
    name: 'Triagem com tempo excedido',
    desc: 'Sempre que um doente em triagem passa o tempo-alvo, sinaliza ao chefe de equipa.',
    trigger_kind: 'event',
    trigger_expr: 'triage.overdue',
    trigger_label: 'Triagem excede tempo-alvo',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'triage-helper', title: 'Triagem com espera excedida', priority: 1 } }],
  },
  {
    id: 'shift-handover',
    icon: '🔄',
    name: 'Passagem de turno automatizada',
    desc: 'Às 13h45, 20h45 e 06h45, gera resumo de doentes para o turno seguinte.',
    trigger_kind: 'cron',
    trigger_expr: '45 6,13,20 * * *',
    trigger_label: 'Antes de cada turno (06h45, 13h45, 20h45)',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'handover', title: 'Passagem de turno — rever doentes críticos', priority: 2 } }],
  },
  {
    id: 'rounds-flag-poly',
    icon: '💊',
    name: 'Rever polimedicados sem revisão',
    desc: 'Semanal — sinaliza doentes com ≥ 8 fármacos não revistos há mais de 14 dias.',
    trigger_kind: 'cron',
    trigger_expr: '0 9 * * 3',
    trigger_label: 'Quartas às 9h00',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'rounds-flag', title: 'Polimedicação sem revisão recente', priority: 3 } }],
  },
  {
    id: 'po-pending',
    icon: '📋',
    name: 'Encomendas pendentes há > 7 dias',
    desc: 'Diariamente sinaliza encomendas enviadas mas não recebidas após 7 dias.',
    trigger_kind: 'cron',
    trigger_expr: '0 10 * * *',
    trigger_label: 'Todos os dias às 10h00',
    actions: [{ kind: 'create_agent_task', params: { agent_name: 'purchase-watch', title: 'Encomendas pendentes há > 7 dias', priority: 3 } }],
  },
  {
    id: 'custom',
    icon: '✏️',
    name: 'Regra personalizada',
    desc: 'Cria a tua própria regra do zero.',
    trigger_kind: 'cron',
    trigger_expr: '',
    trigger_label: '',
    actions: [],
  },
]

function NewRuleModal({ orgId, onClose, onSaved, authHeader }: {
  orgId: string; onClose: () => void; onSaved: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const [step, setStep] = useState<'choose' | 'configure'>('choose')
  const [tpl, setTpl] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [triggerExpr, setTriggerExpr] = useState('')
  const [actionTitle, setActionTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function pickTemplate(t: Template) {
    setTpl(t)
    setName(t.name)
    setDesc(t.desc)
    setTriggerExpr(t.trigger_expr)
    setActionTitle(t.actions[0]?.params?.title || '')
    setStep('configure')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!tpl) return
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const actions = tpl.actions.length > 0
        ? tpl.actions.map(a => ({
            ...a,
            params: { ...a.params, title: actionTitle || a.params.title },
          }))
        : [{ kind: 'create_agent_task', params: { agent_name: 'custom', title: actionTitle || name, priority: 3 } }]
      const r = await fetch('/api/automations', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, name, description: desc, trigger_kind: tpl.trigger_kind, trigger_expr: triggerExpr, actions, enabled: true,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 20, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {step === 'choose' ? 'Escolhe uma receita' : 'Personaliza a regra'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0 }}>×</button>
        </div>

        {step === 'choose' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              Receitas prontas a usar — clica para configurar.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => pickTemplate(t)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
                  cursor: 'pointer', textAlign: 'left',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
                  <div style={{ fontSize: 26, flexShrink: 0 }}>{t.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t.desc}</div>
                    {t.trigger_label && (
                      <div style={{ fontSize: 11, color: ACCENT, marginTop: 4, fontWeight: 600 }}>⏱ {t.trigger_label}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 18, color: '#9ca3af' }}>→</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'configure' && tpl && (
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <button type="button" onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0, marginBottom: 4 }}>
              ← Escolher outra receita
            </button>
            {err && <div style={errBox}>{err}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <span style={{ fontSize: 22 }}>{tpl.icon}</span>
              <div style={{ fontSize: 13, color: '#374151' }}>{tpl.desc}</div>
            </div>

            <Field label="Nome da regra">
              <input required value={name} onChange={e => setName(e.target.value)} style={input} />
            </Field>

            {tpl.trigger_kind === 'cron' && (
              <Field label="Quando correr (cron)">
                <input required value={triggerExpr} onChange={e => setTriggerExpr(e.target.value)} style={input} />
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>
                  Formato cron: <code>min hora dia mês dia-semana</code>. Ex: <code>0 7 * * *</code> = 7h00 todos os dias.
                </p>
              </Field>
            )}
            {tpl.trigger_kind === 'event' && (
              <Field label="Evento">
                <input required value={triggerExpr} onChange={e => setTriggerExpr(e.target.value)} style={input} />
              </Field>
            )}
            {tpl.trigger_kind === 'threshold' && (
              <Field label="Condição">
                <input required value={triggerExpr} onChange={e => setTriggerExpr(e.target.value)} style={input} />
                <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>
                  Ex: <code>beds_occupied_pct &gt; 90</code>, <code>stock_critical_count &gt; 5</code>.
                </p>
              </Field>
            )}

            <Field label="Título da tarefa a criar">
              <input value={actionTitle} onChange={e => setActionTitle(e.target.value)} style={input} placeholder="O que precisa de ser feito?" />
            </Field>

            <Field label="Descrição (opcional)">
              <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} style={{ ...input, resize: 'vertical' }} />
            </Field>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
              <button type="submit" disabled={busy || !name || !triggerExpr} style={btn('primary')}>{busy ? 'A criar…' : 'Criar regra'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const errBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8 }
const emptyCard: React.CSSProperties = { background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
