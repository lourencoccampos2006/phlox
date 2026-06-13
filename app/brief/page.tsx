'use client'

// Phlox Brief — um sumário inteligente para o utilizador abrir todos os dias.
// Combina KPIs do dia + tarefas + tendências + novidades + sugestões.
// Sem AI; tudo determinístico, rápido e útil.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Brief {
  greeting: string
  date: string
  weather_line: string                  // saudação contextual
  signals: { label: string; value: string | number; color: string; href?: string }[]
  open_items: { title: string; href: string; tag?: string; tagColor?: string }[]
  recent_activity: { label: string; at: string; href?: string }[]
  suggestion: { title: string; desc: string; href: string; cta: string } | null
  whats_new: { title: string; href: string }[]
}

const eur = (v: number) => `${Math.round(v).toLocaleString('pt-PT')}€`

function greet(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 19) return 'Boa tarde'
  return 'Boa noite'
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }

export default function BriefPage() {
  const { user, supabase } = useAuth() as any
  const [b, setB] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  // Estabilizado por useState — não muda entre renders, mas é fresco por mount.
  const [now] = useState(() => new Date())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

    // Carregamento defensivo (tudo opcional; tabelas em falta apenas omitem)
    const safe = async (q: any) => { try { const r = await q; return r.data || [] } catch { return [] } }

    const [sales, tasks, waiting, incidents, audit] = await Promise.all([
      safe(supabase.from('sales').select('gross,discount,at').eq('user_id', user.id).gte('at', todayStart.toISOString())),
      safe(supabase.from('team_tasks').select('id,title,due_date').eq('user_id', user.id).neq('status', 'done').limit(8)),
      safe(supabase.from('waiting_room').select('id,name,reason,priority,status').eq('user_id', user.id).gte('arrived_at', todayStart.toISOString())),
      safe(supabase.from('incidents').select('id,type,severity,date,status').eq('user_id', user.id).neq('status', 'closed').limit(5)),
      safe(supabase.from('audit_events').select('action,resource,at,category').eq('user_id', user.id).gte('at', sevenDaysAgo.toISOString()).order('at', { ascending: false }).limit(10)),
    ])

    const revenue = sales.reduce((a: number, s: any) => a + Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0)), 0)
    const waitingNow = waiting.filter((w: any) => w.status === 'waiting').length
    const overdueT = tasks.filter((t: any) => t.due_date && t.due_date < now.toISOString().slice(0, 10)).length

    // ── sinais (KPIs) ─────────────────────────────────────────────────────────
    const signals: Brief['signals'] = []
    if (sales.length > 0) signals.push({ label: 'Caixa hoje', value: eur(revenue), color: '#0d6e42', href: '/faturacao' })
    if (waiting.length > 0) signals.push({ label: 'Em espera', value: waitingNow, color: '#2563eb', href: '/sala-espera' })
    if (tasks.length > 0) signals.push({ label: 'Tarefas abertas', value: tasks.length, color: overdueT > 0 ? '#d97706' : '#0b1120', href: '/tarefas-equipa' })
    if (incidents.length > 0) signals.push({ label: 'Ocorrências', value: incidents.length, color: '#dc2626', href: '/incidents' })
    signals.push({ label: 'Modo', value: user?.experience_mode === 'clinical' ? 'Clínico' : user?.experience_mode === 'caregiver' ? 'Cuidador' : user?.experience_mode === 'student' ? 'Estudo' : 'Pessoal', color: '#7c3aed' })

    // ── itens abertos (prioridade visual) ─────────────────────────────────────
    const open_items: Brief['open_items'] = []
    incidents.filter((i: any) => i.severity === 'critical' || i.severity === 'major').forEach((i: any) =>
      open_items.push({ title: `Ocorrência: ${i.type}`, href: '/incidents', tag: i.severity, tagColor: '#dc2626' })
    )
    tasks.filter((t: any) => t.due_date && t.due_date < now.toISOString().slice(0, 10)).slice(0, 4).forEach((t: any) =>
      open_items.push({ title: t.title, href: '/tarefas-equipa', tag: 'em atraso', tagColor: '#d97706' })
    )
    waiting.filter((w: any) => w.priority === 'urgente' && w.status === 'waiting').slice(0, 3).forEach((w: any) =>
      open_items.push({ title: `${w.name} — ${w.reason || 'urgente'}`, href: '/sala-espera', tag: 'urgente', tagColor: '#dc2626' })
    )

    // ── atividade recente ─────────────────────────────────────────────────────
    const labels: Record<string, string> = {
      'sale.finalized': 'Documento finalizado',
      'credit_note.issued': 'Nota de crédito emitida',
      'webhook.dispatched': 'Webhook entregue',
      'document.signed': 'Documento assinado',
      'plan.changed': 'Plano alterado',
      'patient.viewed': 'Ficha consultada',
    }
    const recent_activity: Brief['recent_activity'] = audit.slice(0, 6).map((a: any) => ({
      label: labels[a.action] || a.action,
      at: a.at,
      href: a.category === 'billing' ? '/faturacao' : a.category === 'integration' ? '/webhooks' : '/auditoria',
    }))

    // ── sugestão de hoje ──────────────────────────────────────────────────────
    // 2026-06-01: sugestões agora seguem o MODO (experience_mode), não o plano.
    // O utilizador (em modo cuidador) recebia "Lança movimento de POS" o que
    // não fazia sentido. Cada modo tem o seu pool de sugestões; caem para a
    // primeira condição que match.
    const mode = user?.experience_mode || 'personal'
    let suggestion: Brief['suggestion'] = null

    if (mode === 'clinical') {
      if (incidents.length > 2) suggestion = { title: 'Foco em qualidade hoje', desc: `Há ${incidents.length} ocorrências abertas. Vale a pena fechar 1 ou 2.`, href: '/incidents', cta: 'Abrir ocorrências' }
      else if (overdueT > 0) suggestion = { title: 'Põe as tarefas em dia', desc: `${overdueT} tarefa(s) em atraso esperam por ti.`, href: '/tarefas-equipa', cta: 'Ver tarefas' }
      else suggestion = { title: 'Vê o teu Clínico 360°', desc: 'Pulse do turno, ranking de risco e audit num só ecrã.', href: '/painel', cta: 'Abrir painel' }
    } else if (mode === 'caregiver') {
      if (overdueT > 0) suggestion = { title: 'Tarefas em atraso', desc: `${overdueT} pendentes nos familiares.`, href: '/familia360', cta: 'Abrir Família 360°' }
      else suggestion = { title: 'Como vais a aguentar?', desc: 'Faz a escala Zarit-12 em 3 min — a sobrecarga do cuidador é real.', href: '/familia360?tab=burden', cta: 'Avaliar sobrecarga' }
    } else if (mode === 'student') {
      suggestion = { title: 'Cartões para rever', desc: 'O algoritmo de revisão espaçada espera por ti no Estudo 360°.', href: '/study360', cta: 'Rever agora' }
    } else {
      // personal
      suggestion = { title: 'Perfil de risco', desc: 'Vê SCORE2, ACB e flags STOPP a partir do que já tens no Phlox.', href: '/risco', cta: 'Calcular risco' }
    }

    // ── novidades por modo ────────────────────────────────────────────────────
    const NEWS_BY_MODE: Record<string, { title: string; href: string }[]> = {
      clinical: [
        { title: 'Clínico 360° (Pulse · Risk · Stewardship · Audit)', href: '/painel' },
        { title: 'Reportar erros em quizzes / casos', href: '/painel' },
        { title: 'Mode isolation: vês só o que é teu', href: '/settings?tab=ferramentas' },
      ],
      caregiver: [
        { title: 'Família 360° (Inbox · Reconciliação · Zarit)', href: '/familia360' },
        { title: 'Cofre de saúde com partilha por código', href: '/vault' },
        { title: 'Refill por familiar — sabe quando acaba', href: '/familia360' },
      ],
      student: [
        { title: 'Biblioteca: PDFs e slides → resumos + perguntas', href: '/biblioteca' },
        { title: 'Estudo 360°: SRS, plano AI, Pomodoro', href: '/study360' },
        { title: 'Phlox Decisão: simulador com morte possível', href: '/simulador' },
      ],
      personal: [
        { title: 'Saúde 360°: adesão, sparklines, refill', href: '/saude360' },
        { title: 'Cofre de saúde: anexa PDFs e imagens', href: '/vault' },
        { title: 'Risco pessoal: SCORE2, ACB, STOPP', href: '/risco' },
      ],
    }
    const whats_new = NEWS_BY_MODE[mode] || NEWS_BY_MODE.personal

    const date = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    setB({
      greeting: greet(),
      date,
      weather_line: signals.length <= 1 ? 'Tudo calmo por agora.' : `${signals.length} indicadores em movimento.`,
      signals, open_items, recent_activity, suggestion, whats_new,
    })
    setLoading(false)
  }, [user, supabase, now])

  useEffect(() => { load() }, [load])

  const name = user?.name?.split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>

        {/* Hero */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox · Brief</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,42px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1 }}>{b?.greeting || greet()}{name ? `, ${name}` : ''}.</h1>
          <div style={{ fontSize: 14, color: '#475569', marginTop: 8, textTransform: 'capitalize' }}>{b?.date || now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {b?.weather_line && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>{b.weather_line}</div>}
        </div>

        {loading || !b ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />)}</div>
        ) : (
          <>
            {/* Sinais */}
            {b.signals.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
                {b.signals.map(s => {
                  const Wrap: any = s.href ? Link : 'div'
                  return (
                    <Wrap key={s.label} href={s.href || '#'} style={{ textDecoration: 'none' }}>
                      <div style={{ ...card, padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{s.label}</div>
                      </div>
                    </Wrap>
                  )
                })}
              </div>
            )}

            {/* Grelha 2 colunas: a precisar de atenção + sugestão/novidades */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }} className="brief-grid">

              {/* Itens abertos */}
              <div style={{ ...card }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', marginBottom: 12 }}>A precisar de atenção</div>
                {b.open_items.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#16a34a', padding: '6px 0' }}>Sem itens críticos. Bom dia para focar.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {b.open_items.slice(0, 6).map((it, i) => (
                      <Link key={i} href={it.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 9, background: '#f8fafc', textDecoration: 'none' }}>
                        <span style={{ fontSize: 13, color: '#1a202c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{it.title}</span>
                        {it.tag && <span style={{ fontSize: 10, fontWeight: 700, color: it.tagColor, background: (it.tagColor || '#000') + '14', padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>{it.tag}</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Sugestão + Novidades */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {b.suggestion && (
                  <div style={{ ...card, background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderColor: '#bbf7d0' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Sugestão de hoje</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120' }}>{b.suggestion.title}</div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.55 }}>{b.suggestion.desc}</div>
                    <Link href={b.suggestion.href} style={{ display: 'inline-block', marginTop: 12, padding: '8px 14px', background: '#0d6e42', color: 'white', borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                      {b.suggestion.cta} →
                    </Link>
                  </div>
                )}

                <div style={{ ...card }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', marginBottom: 10 }}>Novidades</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {b.whats_new.map(n => (
                      <Link key={n.href} href={n.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', fontSize: 13, color: '#1a202c' }}>
                        <span>{n.title}</span>
                        <span style={{ color: '#94a3b8' }}>→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Atividade recente */}
            {b.recent_activity.length > 0 && (
              <div style={{ ...card, marginTop: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Últimos 7 dias <Link href="/auditoria" style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Ver tudo →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {b.recent_activity.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px dashed #f1f5f9', fontSize: 12.5 }}>
                      <span style={{ color: '#1a202c' }}>{a.label}</span>
                      <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{new Date(a.at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@media (max-width: 760px){ .brief-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
