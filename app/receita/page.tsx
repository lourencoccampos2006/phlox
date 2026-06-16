'use client'

// "Decifrar a receita médica" — foto da receita → explica cada medicamento em
// linguagem simples e monta um horário de tomas, para o doente/família.
//
// 2026-06-01: adicionado botão "Associar à minha medicação" — antes o
// utilizador via a explicação mas tinha de adicionar tudo manualmente.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import Link from 'next/link'

interface RxItem { name: string; what_for: string; how: string; times: string[]; with_food: string; caution: string }
interface Result { meds: RxItem[]; summary: string; warnings: string[]; disclaimer?: string }

const SLOTS = [
  { k: 'manhã', emoji: '🌅', label: 'Manhã' },
  { k: 'almoço', emoji: '🍽️', label: 'Almoço' },
  { k: 'jantar', emoji: '🌆', label: 'Jantar' },
  { k: 'deitar', emoji: '🌙', label: 'Deitar' },
]

function downscale(file: File, maxDim = 1400, q = 0.85): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('img')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ b64: (c.toDataURL('image/jpeg', q).split(',')[1]) || '', mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

const matchSlot = (times: string[], slot: string) => (times || []).some(t => t.toLowerCase().includes(slot))

// Página própria outra vez (a fusão em /scan foi desfeita).
export default function ReceitaTool() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [profile, setProfile] = useState<ActiveProfile | null>(getActiveProfile())
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [assoc, setAssoc] = useState<{ assigned: number; total: number } | null>(null)
  const [associng, setAssocing] = useState(false)

  function timesToFrequency(times?: string[]): string {
    if (!times || !times.length) return ''
    const n = times.length
    if (n === 1) return '1x/dia'
    if (n === 2) return '2x/dia'
    if (n === 3) return '3x/dia'
    return `${n}x/dia`
  }

  // Associa todos os medicamentos da receita ao perfil ativo.
  async function associate() {
    if (!user?.id || !result?.meds?.length || associng) return
    setAssocing(true)
    const isFamily = profile?.type === 'family'
    let assigned = 0
    for (const m of result.meds) {
      // Dose: extrair do nome quando possível (ex: "Brufen 400 mg")
      const dose = (m.name.match(/\d+[.,]?\d*\s*(mg|mcg|g|UI)/i) || [null])[0] || ''
      const frequency = timesToFrequency(m.times)
      const payload = {
        name: m.name.replace(/\s+\d+[.,]?\d*\s*(mg|mcg|g|UI).*/i, '').trim() || m.name,
        dose: dose || null,
        frequency: frequency || null,
        indication: m.what_for || null,
      }
      const { error: e } = isFamily
        ? await supabase.from('family_profile_meds').insert({ ...payload, profile_id: profile.id, user_id: user.id })
        : await supabase.from('personal_meds').insert({ ...payload, user_id: user.id })
      if (!e) assigned++
    }
    setAssoc({ assigned, total: result.meds.length })
    setAssocing(false)
    if (assigned === result.meds.length) toast.success(`${assigned} medicamento(s) adicionados.`)
    else toast.error(`${assigned}/${result.meds.length} adicionados — alguns falharam.`)
  }

  async function run() {
    if (!photo) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { b64, mime } = await downscale(photo)
      const res = await fetch('/api/receita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mimeType: mime }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível ler a receita.') }
    finally { setLoading(false) }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', padding: '26px 24px 22px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Perceber</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Decifrar a receita médica</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Tira uma foto e explicamos cada medicamento, horário e como associar ao teu perfil ou ao de um familiar.</p>
          </div>
          {user && <div style={{ background: 'white', borderRadius: 10, padding: 3 }}><ProfileSelector onChange={p => setProfile(p)} /></div>}
        </div>
      </div>

      <div className="page-container page-body">
        <div style={{ ...card, marginBottom: 16 }}>
          <label style={{ display: 'block', border: `1.5px dashed ${photo ? '#7c3aed' : 'var(--border)'}`, borderRadius: 12, padding: photo ? 12 : '26px 16px', textAlign: 'center', cursor: 'pointer', background: photo ? '#faf5ff' : 'var(--bg-2)' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setResult(null); setError('') } }} />
            {photo ? <div style={{ fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>📄 {photo.name} · tocar para trocar</div>
              : <div><div style={{ fontSize: 28, marginBottom: 6 }}>📷</div><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-3)' }}>Tirar foto à receita</div><div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>Receita do médico ou guia de tratamento</div></div>}
          </label>
          {photo && (
            <button onClick={run} disabled={loading}
              style={{ width: '100%', marginTop: 12, padding: 13, background: loading ? 'var(--bg-3)' : '#7c3aed', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              {loading ? 'A ler a receita…' : 'Decifrar receita'}
            </button>
          )}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.meds && result.meds.length > 0 && user && (
              <div style={{ ...card, background: '#0d6e42', borderColor: '#0d6e42', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ color: 'white' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{assoc ? `✓ ${assoc.assigned}/${assoc.total} associado(s)` : `Associar à medicação ${profile?.type === 'family' ? `de ${profile.name}` : 'pessoal'}`}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>Adiciona automaticamente ao Phlox — sem digitar.</div>
                </div>
                {assoc ? (
                  <Link href={profile?.type === 'family' ? '/familia' : '/mymeds'}
                    style={{ padding: '9px 16px', background: 'white', color: '#0d6e42', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                    Abrir →
                  </Link>
                ) : (
                  <button onClick={associate} disabled={associng}
                    style={{ padding: '9px 16px', background: 'white', color: '#0d6e42', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: associng ? 'wait' : 'pointer' }}>
                    {associng ? 'A associar…' : '+ Associar tudo'}
                  </button>
                )}
              </div>
            )}
            {result.summary && <div style={{ ...card, background: '#faf5ff', borderColor: '#e9d5ff' }}><div style={{ fontSize: 14, color: '#6b21a8', lineHeight: 1.6 }}>{result.summary}</div></div>}
            {result.warnings?.length > 0 && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a', padding: '10px 14px' }}>
                {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 12.5, color: '#92400e' }}>⚠ {w}</div>)}
              </div>
            )}

            {result.meds.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Não consegui ler a medicação. Tenta uma foto mais nítida e bem iluminada.</div>
            ) : result.meds.map((m, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{m.name}</div>
                {m.what_for && <div style={{ fontSize: 13.5, color: '#0f766e', marginTop: 3 }}>{m.what_for}</div>}
                {m.how && <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5 }}>{m.how}</div>}
                {/* Horário visual */}
                {m.times?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {SLOTS.map(s => {
                      const on = matchSlot(m.times, s.k)
                      return (
                        <div key={s.k} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 9, border: `1.5px solid ${on ? '#7c3aed' : 'var(--border)'}`, background: on ? '#faf5ff' : 'var(--bg-2)', opacity: on ? 1 : 0.5 }}>
                          <div style={{ fontSize: 17 }}>{s.emoji}</div>
                          <div style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? '#7c3aed' : 'var(--ink-5)', marginTop: 2 }}>{s.label}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {m.with_food && m.with_food !== 'indiferente' && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '3px 9px' }}>🍽️ {m.with_food}</span>}
                  {m.caution && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 9px' }}>⚠ {m.caution}</span>}
                </div>
              </div>
            ))}

            {result.disclaimer && <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5 }}>{result.disclaimer}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
