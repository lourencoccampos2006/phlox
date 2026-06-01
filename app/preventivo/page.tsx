'use client'

// "Estou em dia com a minha saúde?" — checklist preventivo determinístico.
// 2026-06-01: reescrito. Antes era AI sopa, agora é uma lista baseada nas
// normas DGS / PNV portuguesas, com registo do que já foi feito e cálculo
// real do que está em atraso. O utilizador pode marcar "já fiz" e o item
// muda de "em atraso" para "em dia".

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { recommendPreventive, type PreventiveItem, type Sex } from '@/lib/preventiveCare'
import Link from 'next/link'

const PRIO_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  devido:    { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', label: 'Em atraso' },
  em_breve:  { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Em breve' },
  em_dia:    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Em dia' },
  opcional:  { color: '#475569', bg: '#f8fafc', border: '#e5e7eb', label: 'Opcional' },
}

const CAT_META: Record<string, { icon: string; label: string }> = {
  rastreio: { icon: '🔬', label: 'Rastreios' },
  vacina:   { icon: '💉', label: 'Vacinas' },
  consulta: { icon: '🩺', label: 'Consultas' },
}

const LS_KEY = 'phlox-preventivo-done'

export default function PreventivoPage() {
  const { user, supabase } = useAuth() as any
  const [age, setAge] = useState<string>('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [conditions, setConditions] = useState<string>('')
  const [done, setDone] = useState<Record<string, string>>({})

  // Carrega perfil + "feitos" do localStorage
  useEffect(() => {
    try { const r = localStorage.getItem(LS_KEY); if (r) setDone(JSON.parse(r)) } catch {}
  }, [])
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('birth_date, age, sex, conditions').eq('id', user.id).maybeSingle()
        let a: number | undefined
        if (profile?.age) a = profile.age
        else if (profile?.birth_date) {
          const bd = new Date(profile.birth_date)
          a = Math.floor((Date.now() - bd.getTime()) / (365.25 * 86400000))
        }
        if (a) setAge(String(a))
        if (profile?.sex === 'M' || profile?.sex === 'F') setSex(profile.sex)
        if (profile?.conditions) setConditions(profile.conditions)
      } catch {}
      // Vacinas conhecidas — se já existe tabela vaccine_records, importa
      try {
        const { data: vacs } = await supabase.from('vaccine_records').select('vaccine_id, given_at').eq('user_id', user.id)
        if (vacs && Array.isArray(vacs)) {
          const map: Record<string, string> = {}
          for (const v of vacs) { if (v.vaccine_id && v.given_at) map[v.vaccine_id] = v.given_at.slice(0, 10) }
          setDone(prev => ({ ...prev, ...map }))
        }
      } catch { /* tabela pode não existir */ }
    })()
  }, [user, supabase])

  const persistDone = useCallback((next: Record<string, string>) => {
    setDone(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  function markDone(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    persistDone({ ...done, [id]: today })
  }
  function markUndone(id: string) {
    const next = { ...done }
    delete next[id]
    persistDone(next)
  }

  const ageNum = parseInt(age, 10)
  const valid = !!ageNum && (sex === 'M' || sex === 'F')
  const result = valid
    ? recommendPreventive({ age: ageNum, sex, conditions: conditions ? conditions.split(/[,;]\s*/) : [], done })
    : null

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'linear-gradient(135deg, #0d6e42 0%, #16a34a 100%)', padding: '24px 24px 20px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Estou em dia com a saúde?</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Rastreios, vacinas e consultas recomendados pela DGS para a tua idade. Marca o que já fizeste — o resto fica em alerta.</p>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Inputs — pré-preenchidos do perfil */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>Idade</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="52" min={0} max={120} style={inp} />
            </div>
            <div>
              <label style={lbl}>Sexo</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([['F', 'Feminino'], ['M', 'Masculino']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setSex(v)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1.5px solid ${sex === v ? '#0d6e42' : 'var(--border)'}`, background: sex === v ? '#f0fdf4' : 'white', color: sex === v ? '#0d6e42' : 'var(--ink-3)', fontSize: 13, fontWeight: sex === v ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label style={lbl}>Doenças crónicas (opcional, separa por vírgulas)</label>
          <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="diabetes, hipertensão, asma…" style={inp} />
          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 8, lineHeight: 1.45 }}>
            ⓘ Esta lista baseia-se em normas oficiais da DGS e no PNV. Não substitui a avaliação do teu médico de família.
          </div>
        </div>

        {!result && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#78350f' }}>
            Indica a tua idade e sexo para ver as recomendações.
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionGroup title={`Em atraso (${result.due.length})`} color="#dc2626" items={result.due} onMarkDone={markDone} onMarkUndone={markUndone} doneMap={done} emptyMsg="✓ Sem itens em atraso!" />
            <SectionGroup title={`Em breve (${result.soon.length})`} color="#d97706" items={result.soon} onMarkDone={markDone} onMarkUndone={markUndone} doneMap={done} />
            <SectionGroup title={`Em dia (${result.upToDate.length})`} color="#15803d" items={result.upToDate} onMarkDone={markDone} onMarkUndone={markUndone} doneMap={done} collapsibleByDefault />
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>
              Tabela baseada em: <strong>Programa Nacional de Vacinação 2020/2024</strong>, normas DGS para rastreios oncológicos (mama 051/2017, colo 018/2012, cólon 003/2014) e cardiovasculares. Confirma com o teu médico, especialmente se tiveres condições de risco.
            </div>
            <Link href="/calendario" style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#0d6e42', color: 'white', textDecoration: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              📅 Marcar próxima consulta no calendário Phlox →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionGroup({ title, color, items, onMarkDone, onMarkUndone, doneMap, emptyMsg, collapsibleByDefault }: {
  title: string; color: string; items: PreventiveItem[]
  onMarkDone: (id: string) => void; onMarkUndone: (id: string) => void
  doneMap: Record<string, string>; emptyMsg?: string; collapsibleByDefault?: boolean
}) {
  const [collapsed, setCollapsed] = useState(!!collapsibleByDefault)
  if (items.length === 0 && !emptyMsg) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(c => !c)}
        style={{ width: '100%', padding: '14px 18px', background: 'white', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid var(--bg-3)' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{title}</span>
        <span style={{ fontSize: 14, color: 'var(--ink-5)' }}>{collapsed ? '▾' : '▴'}</span>
      </button>
      {!collapsed && (
        <div>
          {items.length === 0 && emptyMsg && (
            <div style={{ padding: '14px 18px', fontSize: 13, color: '#15803d', textAlign: 'center' }}>{emptyMsg}</div>
          )}
          {items.map(it => {
            const meta = PRIO_META[it.priority]
            const cat = CAT_META[it.category]
            const lastDone = doneMap[it.id]
            return (
              <div key={it.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-3)', display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{cat?.icon || '·'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>{it.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>{it.why}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, padding: '1px 8px', borderRadius: 4, fontWeight: 700 }}>{meta.label}</span>
                    <span style={{ fontSize: 11.5, color: '#0f766e', fontWeight: 600 }}>🗓 {it.frequency}</span>
                  </div>
                  {lastDone && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      Último: {new Date(lastDone).toLocaleDateString('pt-PT')}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--ink-5)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>{it.source}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {lastDone ? (
                    <button onClick={() => onMarkUndone(it.id)} title="Desmarcar"
                      style={{ padding: '7px 11px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      ✓ Feito
                    </button>
                  ) : (
                    <button onClick={() => onMarkDone(it.id)}
                      style={{ padding: '7px 11px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Marcar como feito
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }
