'use client'

// Phlox Brief — era a página /brief. Fundido em /relatorio como separador
// "Diário": sumário inteligente do dia (KPIs + tarefas + tendências + novidades
// + sugestões). Sem AI; tudo determinístico. Lógica inalterada.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

interface Brief {
  greeting: string
  date: string
  weather_line: string
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

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '18px 20px' }

export default function DailyBrief() {
  const { user, supabase } = useAuth() as any
  const [b, setB] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => new Date())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)

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

    const signals: Brief['signals'] = []
    if (sales.length > 0) signals.push({ label: 'Caixa hoje', value: eur(revenue), color: 'var(--green)', href: '/faturacao' })
    if (waiting.length > 0) signals.push({ label: 'Em espera', value: waitingNow, color: 'var(--ink-2)', href: '/agenda' })
    if (tasks.length > 0) signals.push({ label: 'Tarefas abertas', value: tasks.length, color: overdueT > 0 ? 'var(--amber)' : 'var(--ink)', href: '/tarefas-equipa' })
    if (incidents.length > 0) signals.push({ label: 'Ocorrências', value: incidents.length, color: 'var(--red)', href: '/incidents' })
    signals.push({ label: 'Modo', value: user?.experience_mode === 'clinical' ? 'Clínico' : user?.experience_mode === 'caregiver' ? 'Cuidador' : user?.experience_mode === 'student' ? 'Estudo' : 'Pessoal', color: 'var(--roxo)' })

    const open_items: Brief['open_items'] = []
    incidents.filter((i: any) => i.severity === 'critical' || i.severity === 'major').forEach((i: any) =>
      open_items.push({ title: `Ocorrência: ${i.type}`, href: '/incidents', tag: i.severity, tagColor: 'var(--red)' })
    )
    tasks.filter((t: any) => t.due_date && t.due_date < now.toISOString().slice(0, 10)).slice(0, 4).forEach((t: any) =>
      open_items.push({ title: t.title, href: '/tarefas-equipa', tag: 'em atraso', tagColor: 'var(--amber)' })
    )
    waiting.filter((w: any) => w.priority === 'urgente' && w.status === 'waiting').slice(0, 3).forEach((w: any) =>
      open_items.push({ title: `${w.name} — ${w.reason || 'urgente'}`, href: '/agenda', tag: 'urgente', tagColor: 'var(--red)' })
    )

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

    const mode = user?.experience_mode || 'personal'
    let suggestion: Brief['suggestion'] = null

    if (mode === 'clinical') {
      if (incidents.length > 2) suggestion = { title: 'Foco em qualidade hoje', desc: `Há ${incidents.length} ocorrências abertas. Vale a pena fechar 1 ou 2.`, href: '/incidents', cta: 'Abrir ocorrências' }
      else if (overdueT > 0) suggestion = { title: 'Põe as tarefas em dia', desc: `${overdueT} tarefa(s) em atraso esperam por ti.`, href: '/tarefas-equipa', cta: 'Ver tarefas' }
      else suggestion = { title: 'Vê o teu Clínico 360°', desc: 'Pulse do turno, ranking de risco e audit num só ecrã.', href: '/painel', cta: 'Abrir painel' }
    } else if (mode === 'caregiver') {
      if (overdueT > 0) suggestion = { title: 'Tarefas em atraso', desc: `${overdueT} pendentes nos familiares.`, href: '/familia', cta: 'Abrir família' }
      else suggestion = { title: 'Como vais a aguentar?', desc: 'Faz a escala Zarit-12 em 3 min, dentro do cartão de cada familiar — a sobrecarga do cuidador é real.', href: '/familia', cta: 'Avaliar sobrecarga' }
    } else if (mode === 'student') {
      suggestion = { title: 'Cartões para rever', desc: 'O algoritmo de revisão espaçada espera por ti.', href: '/study/notas', cta: 'Rever agora' }
    } else {
      suggestion = { title: 'A minha história de saúde', desc: 'Medicação, análises, documentos e sintomas, ao longo do tempo.', href: '/timeline', cta: 'Abrir' }
    }

    // BUG CORRIGIDO 2026-07-17: /familia360, /study360 e /saude360 são
    // redirects sem conteúdo próprio (Ronda 13b) — os hrefs abaixo apontavam
    // para eles em vez do destino real. Corrigido para os destinos reais; o
    // Zarit-12 (ZaritBurdenCard, item A4 da auditoria 2026-07-17) voltou a
    // existir de facto, dentro de cada cartão de familiar em /familia.
    const NEWS_BY_MODE: Record<string, { title: string; href: string }[]> = {
      clinical: [
        { title: 'Clínico 360° (Pulse · Risk · Stewardship · Audit)', href: '/painel' },
        /* «Reportar erros em quizzes / casos» estava aqui, no modo CLÍNICO, a
           apontar para o /painel — que é o painel da instituição e não tem
           quizzes nenhuns. Era a novidade que o React estava a esconder, e ao
           descobri-la vi que também estava no modo errado. Vai para o modo
           estudante, com o destino certo. */
        { title: 'Mode isolation: vês só o que é teu', href: '/settings?tab=ferramentas' },
      ],
      caregiver: [
        { title: 'Sobrecarga do cuidador (Zarit-12) por familiar', href: '/familia' },
        { title: 'Cofre de saúde com partilha por código', href: '/vault' },
        { title: 'Refill por familiar — sabe quando acaba', href: '/familia' },
      ],
      student: [
        { title: 'Biblioteca: PDFs e slides → resumos + perguntas', href: '/biblioteca' },
        { title: 'Revisão espaçada (SRS) das tuas notas', href: '/study/notas' },
        { title: 'Phlox Decisão: simulador com morte possível', href: '/simulador' },
        { title: 'Reportar erros em quizzes e casos', href: '/study' },
      ],
      personal: [
        { title: 'História de saúde: adesão, sparklines, refill', href: '/timeline' },
        { title: 'Cofre de saúde: anexa PDFs e imagens', href: '/vault' },
        { title: 'Regista como te sentes hoje', href: '/sintomas' },
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
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.4vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1 }}>{b?.greeting || greet()}{name ? `, ${name}` : ''}.</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 8, textTransform: 'capitalize' }}>{b?.date || now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {b?.weather_line && <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 4 }}>{b.weather_line}</div>}
      </div>

      {loading || !b ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--r-xl)' }} />)}</div>
      ) : (
        <>
          {b.signals.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
              {b.signals.map(s => {
                const Wrap: any = s.href ? Link : 'div'
                return (
                  <Wrap key={s.label} href={s.href || '#'} style={{ textDecoration: 'none' }}>
                    <div style={{ ...card, padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{s.label}</div>
                    </div>
                  </Wrap>
                )
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }} className="brief-grid">

            <div style={{ ...card }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>A precisar de atenção</div>
              {b.open_items.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--green)', padding: '6px 0' }}>Sem itens críticos. Bom dia para focar.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {b.open_items.slice(0, 6).map((it, i) => (
                    <Link key={i} href={it.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 'var(--r-lg)', background: 'var(--bg-2)', textDecoration: 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--badge-blue-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{it.title}</span>
                      {it.tag && <span style={{ fontSize: 10, fontWeight: 700, color: it.tagColor, background: (it.tagColor || 'var(--ink)') + '14', padding: '2px 8px', borderRadius: 'var(--r)', flexShrink: 0 }}>{it.tag}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {b.suggestion && (
                <div style={{ ...card, background: 'linear-gradient(135deg, var(--badge-green-bg) 0%, var(--badge-green-bg) 100%)', borderColor: 'var(--green-mid)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Sugestão de hoje</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{b.suggestion.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.55 }}>{b.suggestion.desc}</div>
                  <Link href={b.suggestion.href} style={{ display: 'inline-block', marginTop: 12, padding: '8px 14px', background: 'var(--green)', color: 'white', borderRadius: 'var(--r-md)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                    {b.suggestion.cta} →
                  </Link>
                </div>
              )}

              <div style={{ ...card }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Novidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* A chave é o TÍTULO, não o href — 2026-10-08.
                      Duas novidades do modo clínico apontavam ambas para
                      `/painel`, e com `key={n.href}` o React via duas chaves
                      iguais e deitava a segunda fora: a «Reportar erros em
                      quizzes / casos» nunca chegou a aparecer a ninguém.
                      Dois destinos iguais são legítimos — duas chaves iguais
                      não. O que distingue estas linhas é o que dizem. */}
                  {b.whats_new.map(n => (
                    <Link key={n.title} href={n.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--bg-3)', textDecoration: 'none', fontSize: 13, color: 'var(--badge-blue-fg)' }}>
                      <span>{n.title}</span>
                      <span style={{ color: 'var(--ink-5)' }}>→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {b.recent_activity.length > 0 && (
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Últimos 7 dias <Link href="/auditoria" style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, textDecoration: 'none' }}>Ver tudo →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {b.recent_activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--bg-3)', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--badge-blue-fg)' }}>{a.label}</span>
                    <span style={{ color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{new Date(a.at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`@media (max-width: 760px){ .brief-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
