'use client'

// ZaritBurdenCard — escala Zarit-12 de sobrecarga do cuidador (Pro, objetivo=
// cuidador). MELHORIAS 2026-07-17 (item A4 da auditoria): a lógica de
// pontuação (lib/caregiverScales.ts) já existia mas ficou órfã (sem UI, sem
// tabela) desde a Ronda 13b — reconstruída aqui, mínima, ligada a UM familiar
// (a escala pergunta pelo "seu familiar" no singular). Botão explícito, sem
// IA nenhuma envolvida (pontuação 100% determinística).

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { ZARIT12_QUESTIONS, ZARIT12_OPTIONS, ZARIT12_BAND_META } from '@/lib/caregiverScales'

interface Check { id: string; total_score: number; band: keyof typeof ZARIT12_BAND_META; created_at: string }

function daysAgo(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) }

export default function ZaritBurdenCard({ profileId, name }: { profileId: string; name: string }) {
  const { supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>(Array(12).fill(null))
  const [mode, setMode] = useState<'summary' | 'form'>('summary')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch(`/api/burden-check?profile_id=${profileId}`, { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
      const j = await res.json()
      if (res.ok) { setChecks(j.checks || []); setMode(j.checks?.length ? 'summary' : 'form') }
    } catch { /* degrada — mostra o formulário */ setMode('form') }
  }

  async function submit() {
    if (answers.some(a => a == null)) { setErr('Responde a todas as perguntas.'); return }
    setSaving(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/burden-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ profile_id: profileId, answers }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setChecks(prev => [j.check, ...(prev || [])])
      setAnswers(Array(12).fill(null))
      setMode('summary')
    } catch (e: any) { setErr(e.message || 'Não foi possível guardar.') }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); if (!checks) load() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#faf5ff', color: '#6d28d9', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
        🫂 Como estou a aguentar-me?
      </button>
    )
  }

  const latest = checks?.[0]
  const prev = checks?.[1]
  const meta = latest ? ZARIT12_BAND_META[latest.band] : null

  return (
    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#6d28d9' }}>🫂 Sobrecarga do cuidador — {name.split(' ')[0]}</span>
        <button onClick={() => setOpen(false)} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
      </div>

      {checks === null && <div style={{ fontSize: 12.5, color: '#6d28d9' }}>A carregar…</div>}

      {mode === 'summary' && latest && meta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'white', border: '1px solid #e9d5ff', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{latest.total_score}/48 · há {daysAgo(latest.created_at)} dia{daysAgo(latest.created_at) === 1 ? '' : 's'}</span>
              {prev && prev.total_score !== latest.total_score && (
                <span style={{ fontSize: 11, fontWeight: 700, color: latest.total_score > prev.total_score ? '#b45309' : '#15803d' }}>
                  {latest.total_score > prev.total_score ? '↑' : '↓'} desde a última avaliação
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: '#3f3f46', lineHeight: 1.5, marginTop: 6 }}>{meta.advice}</div>
          </div>
          <button onClick={() => setMode('form')} style={{ fontSize: 11, color: '#6d28d9', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start' }}>Fazer nova avaliação</button>
        </div>
      )}

      {mode === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: '#6b21a8', lineHeight: 1.5 }}>
            12 perguntas rápidas (~3 min) sobre como te sentes a cuidar de {name.split(' ')[0]}. Sem certo ou errado —
            é só para perceberes se precisas de mais apoio.
          </div>
          {ZARIT12_QUESTIONS.map((q, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e9d5ff', borderRadius: 8, padding: '9px 11px' }}>
              <div style={{ fontSize: 12.5, color: '#3f3f46', marginBottom: 6 }}>{i + 1}. {q}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ZARIT12_OPTIONS.map(o => (
                  <button key={o.v} onClick={() => setAnswers(a => a.map((v, idx) => idx === i ? o.v : v))}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${answers[i] === o.v ? '#6d28d9' : '#e9d5ff'}`,
                      background: answers[i] === o.v ? '#6d28d9' : 'white',
                      color: answers[i] === o.v ? 'white' : '#6d28d9',
                    }}>{o.label}</button>
                ))}
              </div>
            </div>
          ))}
          {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px 14px', background: '#6d28d9', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'A guardar…' : 'Ver resultado'}
            </button>
            {checks && checks.length > 0 && (
              <button onClick={() => { setMode('summary'); setErr('') }} style={{ padding: '9px 14px', background: 'white', color: '#6d28d9', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
