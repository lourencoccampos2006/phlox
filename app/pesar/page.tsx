'use client'

// Phlox Peso — track simples de peso ao longo do tempo, com tendência.
// Grava em `vitals` (weight). Gráfico minimalista. Vê padrões sem esforço.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

interface Entry { id: string; recorded_at: string; weight: number; notes?: string | null }

export default function PesoPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 365 * 86400000).toISOString()
    const { data } = await supabase.from('vitals')
      .select('id,recorded_at,weight,notes').eq('user_id', user.id).not('weight', 'is', null)
      .gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(200)
    setEntries((data || []).filter((d: any) => typeof d.weight === 'number'))
    setLoading(false)
  }, [user, supabase])
  useEffect(() => { load() }, [load])

  async function add() {
    const n = Number(val.replace(',', '.'))
    if (!user || !n || n < 20 || n > 400) { toast.error('Valor inválido', 'Indica um peso entre 20 e 400 kg.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('vitals').insert({ user_id: user.id, recorded_at: new Date().toISOString(), weight: n }).select().single()
    if (error) toast.error('Não consegui guardar', error.message)
    else if (data) { setEntries(p => [data, ...p]); setVal(''); toast.success(`${n} kg registado`) }
    setSaving(false)
  }
  async function del(id: string) {
    await supabase.from('vitals').delete().eq('id', id); setEntries(p => p.filter(e => e.id !== id))
  }

  const latest = entries[0]
  const monthAgo = entries.find(e => new Date(e.recorded_at).getTime() < Date.now() - 30 * 86400000) || entries[entries.length - 1]
  const delta = latest && monthAgo ? Math.round((latest.weight - monthAgo.weight) * 10) / 10 : null
  const deltaColor = delta == null ? '#64748b' : delta < -0.3 ? '#15803d' : delta > 0.3 ? '#b45309' : '#64748b'

  // Histórico de 30 dias para o gráfico de linha simples
  const days = 30
  const since = Date.now() - days * 86400000
  const points = entries.filter(e => new Date(e.recorded_at).getTime() >= since).reverse() // cronológico
  const min = points.length ? Math.min(...points.map(p => p.weight)) : 0
  const max = points.length ? Math.max(...points.map(p => p.weight)) : 1
  const range = Math.max(0.5, max - min)
  const padY = range * 0.15

  function pathFor() {
    if (points.length === 0) return ''
    const W = 600, H = 140
    return points.map((p, i) => {
      const x = points.length === 1 ? W / 2 : (i / (points.length - 1)) * W
      const norm = (p.weight - (min - padY)) / (range + 2 * padY)
      const y = H - norm * H
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fdf4ff 0%, #fafbfc 60%)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 640 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>A minha saúde</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,40px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Peso</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Pesa-te de vez em quando. Vê a tendência ao longo do mês — não obcecar com o dia.</p>
        </div>

        {/* Hero */}
        <div style={{ background: 'white', borderRadius: 18, padding: '24px 24px', marginBottom: 14, border: '1px solid #e5e7eb', boxShadow: '0 6px 24px -12px rgba(8,12,24,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, color: '#6b21a8', lineHeight: 1 }}>
                {latest ? `${latest.weight}` : '—'} <span style={{ fontSize: 20, color: '#94a3b8' }}>kg</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {latest ? new Date(latest.recorded_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : 'Sem registos ainda'}
              </div>
            </div>
            {delta != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: deltaColor }}>{delta > 0 ? '+' : ''}{delta} kg</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>30 dias</div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              type="number" step="0.1" inputMode="decimal" placeholder="Ex: 72.4"
              style={{ flex: 1, border: '1.5px solid #ddd6fe', borderRadius: 10, padding: '12px 16px', fontSize: 17, fontFamily: 'var(--font-sans)', outline: 'none', textAlign: 'center', fontWeight: 700, color: '#6b21a8' }} />
            <button onClick={add} disabled={saving || !val} style={{ padding: '0 22px', background: val ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : '#e5e7eb', color: val ? 'white' : '#94a3b8', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: val ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
              {saving ? '…' : 'Registar'}
            </button>
          </div>
        </div>

        {/* Gráfico simples */}
        {points.length >= 2 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px 14px', marginBottom: 14, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120', marginBottom: 12 }}>Últimos 30 dias</div>
            <div style={{ position: 'relative', height: 150 }}>
              <svg viewBox="0 0 600 140" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="weightArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={pathFor() + ` L600,140 L0,140 Z`} fill="url(#weightArea)" />
                <path d={pathFor()} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => {
                  const x = points.length === 1 ? 300 : (i / (points.length - 1)) * 600
                  const norm = (p.weight - (min - padY)) / (range + 2 * padY)
                  const y = 140 - norm * 140
                  return <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4 : 2.5} fill="#7c3aed" />
                })}
              </svg>
              <span style={{ position: 'absolute', top: 0, left: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{(max).toFixed(1)} kg</span>
              <span style={{ position: 'absolute', bottom: -4, left: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{(min).toFixed(1)} kg</span>
            </div>
          </div>
        )}

        {/* Histórico */}
        {entries.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>Histórico</div>
            {entries.slice(0, 15).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#1a202c', fontWeight: 700 }}>{e.weight} kg</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date(e.recorded_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>
                <button onClick={() => del(e.id)} aria-label="Remover" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '32px 24px', textAlign: 'center', color: '#64748b', fontSize: 13.5, border: '1px solid #e5e7eb' }}>
            Sem registos ainda. Adiciona o primeiro acima para começar a ver a tendência.
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center' }}>
          Os teus pesos ficam no <Link href="/dashboard" style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>histórico de vitais</Link>.
        </div>
      </div>
    </div>
  )
}
