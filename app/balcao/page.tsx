'use client'

// /balcao — Modo balcão (farmácia comunitária).
// Atendimento rápido ao utente: descreve a queixa → o Phlox sugere o protocolo
// de indicação farmacêutica (dose concreta, conselhos, sinais de alarme) → o
// farmacêutico ajusta → e ENVIA para o telemóvel do utente por QR/link.
// O utente sai da farmácia com as instruções no bolso. B2B2C: cada atendimento
// põe a marca Phlox no telemóvel de um novo utilizador.

import { useState, useCallback } from 'react'
import BalcaoHub from './BalcaoHub'

// /balcao é agora a fusão "Balcão" (abas: indicação + vendas + sala + atendimentos
// + aconselhamento). O AtendimentoTool abaixo é a aba "Indicação".
export default function BalcaoPage() { return <BalcaoHub /> }
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #d8dadd', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono,monospace)', fontSize: 10, color: '#8b8f99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

interface RecMed { name: string; dose?: string; duration?: string; notes?: string }
interface Counter {
  complaint: string
  assessment?: string
  suitable?: boolean
  recommended: RecMed[]
  advice: string[]
  avoid: string[]
  refer_if: string[]
  followUp: string
}

export function AtendimentoTool() {
  const { user, supabase } = useAuth() as any
  const [complaint, setComplaint] = useState('')
  const [context, setContext] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState<Counter | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  const auth = useCallback(async () => (await supabase.auth.getSession()).data?.session?.access_token || '', [supabase])

  async function suggest() {
    if (!complaint.trim()) { setErr('Descreve a queixa do utente.'); return }
    setErr(''); setBusy('A preparar o aconselhamento…'); setDraft(null); setShareUrl('')
    try {
      const r = await fetch('/api/indicacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint, context }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao gerar.')
      setDraft({
        complaint: complaint.trim(),
        assessment: j.assessment || '',
        suitable: j.suitable_for_self_care !== false,
        recommended: (j.recommended || []).map((m: any) => ({ name: m.name || m.active || '', dose: m.dose || '', duration: m.duration || '', notes: m.notes || '' })),
        advice: [...(j.counseling || []), ...(j.non_pharmacological || [])].filter(Boolean),
        avoid: [],
        refer_if: j.refer_if || [],
        followUp: j.follow_up || '',
      })
    } catch (e: any) { setErr(e.message) } finally { setBusy('') }
  }

  function patch(p: Partial<Counter>) { setDraft(d => d ? { ...d, ...p } : d) }
  function patchMed(i: number, p: Partial<RecMed>) { setDraft(d => d ? { ...d, recommended: d.recommended.map((m, j) => j === i ? { ...m, ...p } : m) } : d) }
  function listEdit(field: 'advice' | 'avoid' | 'refer_if', text: string) { patch({ [field]: text.split('\n').map(s => s.trim()).filter(Boolean) } as any) }

  async function generate() {
    if (!draft) return
    setBusy('A gerar o link para o utente…'); setErr('')
    try {
      // Carimbo da farmácia (nome da instituição), se existir
      let pharmacy = ''
      if (user) {
        const { data: inst } = await supabase.from('institution_settings').select('name, short_name').eq('user_id', user.id).maybeSingle()
        pharmacy = inst?.name || inst?.short_name || ''
      }
      const payload = {
        pharmacy, complaint: draft.complaint,
        recommended: draft.recommended.filter(m => m.name.trim()),
        advice: draft.advice, avoid: draft.avoid, refer_if: draft.refer_if, followUp: draft.followUp,
      }
      const r = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: JSON.stringify({ type: 'counter', title: 'Aconselhamento da farmácia', data: payload }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao gerar link.')
      setShareUrl(j.url)
    } catch (e: any) { setErr(e.message) } finally { setBusy('') }
  }

  function reset() { setComplaint(''); setContext(''); setDraft(null); setShareUrl(''); setErr('') }

  return (
    <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99' }}>Modo balcão</div>
      <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Atender e entregar no bolso.</h1>
      <p style={{ color: '#6b7280', fontSize: 14.5, lineHeight: 1.6, marginBottom: 18 }}>Descreve a queixa do utente. O Phlox sugere o protocolo de indicação — ajustas — e o utente leva tudo no telemóvel por QR.</p>

      {/* Passo 1 — queixa */}
      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Queixa do utente</label>
          <textarea value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Ex: dor de garganta há 2 dias, sem febre" rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div>
          <label style={lbl}>Contexto (opcional) — idade, gravidez, crónicos, medicação, alergias</label>
          <input value={context} onChange={e => setContext(e.target.value)} placeholder="Ex: 34 anos, toma a pílula, alérgica à penicilina" style={inp} />
        </div>
        <div>
          <button onClick={suggest} disabled={!!busy} style={{ padding: '11px 22px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14.5, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy === 'A preparar o aconselhamento…' ? busy : 'Sugerir aconselhamento'}
          </button>
        </div>
      </div>

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {/* Passo 2 — rever e ajustar */}
      {draft && !shareUrl && (
        <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 18, marginBottom: 16 }}>
          {draft.assessment && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{draft.assessment}</div>}
          {!draft.suitable && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠ Situação que pode não ser para automedicação — confirma os critérios de referenciação antes de entregar.</div>}

          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 8px' }}>O que pode tomar (editável)</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {draft.recommended.map((m, i) => (
              <div key={i} style={{ border: '1px solid #eceef0', borderRadius: 10, padding: 12, display: 'grid', gap: 6 }}>
                <input value={m.name} onChange={e => patchMed(i, { name: e.target.value })} placeholder="Medicamento" style={{ ...inp, fontWeight: 700 }} />
                <input value={m.dose || ''} onChange={e => patchMed(i, { dose: e.target.value })} placeholder="Como tomar (dose, frequência)" style={inp} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={m.duration || ''} onChange={e => patchMed(i, { duration: e.target.value })} placeholder="Durante quanto tempo" style={inp} />
                  <button onClick={() => patch({ recommended: draft.recommended.filter((_, j) => j !== i) })} style={{ border: '1px solid #e7e8ea', background: 'white', borderRadius: 8, padding: '0 12px', color: '#b91c1c', cursor: 'pointer', fontSize: 13 }}>Remover</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => patch({ recommended: [...draft.recommended, { name: '', dose: '', duration: '' }] })} style={{ marginTop: 8, background: 'none', border: 'none', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Adicionar medicamento</button>

          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <div><label style={lbl}>Conselhos (um por linha)</label><textarea value={draft.advice.join('\n')} onChange={e => listEdit('advice', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
            <div><label style={lbl}>A evitar (um por linha)</label><textarea value={draft.avoid.join('\n')} onChange={e => listEdit('avoid', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
            <div><label style={lbl}>Procurar o médico se… (um por linha)</label><textarea value={draft.refer_if.join('\n')} onChange={e => listEdit('refer_if', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
            <div><label style={lbl}>Voltar à farmácia / reavaliar</label><input value={draft.followUp} onChange={e => patch({ followUp: e.target.value })} style={inp} /></div>
          </div>

          <button onClick={generate} disabled={!!busy} style={{ marginTop: 16, padding: '12px 24px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy === 'A gerar o link para o utente…' ? busy : '📱 Entregar ao utente (QR)'}
          </button>
        </div>
      )}

      {/* Passo 3 — QR para o utente */}
      {shareUrl && (
        <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16181d', marginBottom: 4 }}>Peça ao utente para apontar a câmara</div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>O aconselhamento abre no telemóvel dele, pronto a guardar.</p>
          <div style={{ display: 'inline-block', padding: 12, background: 'white', border: '1px solid #eee', borderRadius: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`} alt="QR para o utente" style={{ width: 220, height: 220, display: 'block' }} />
          </div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#8b8f99', wordBreak: 'break-all' }}>{shareUrl}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ padding: '9px 18px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}>Copiar link</button>
            <button onClick={reset} style={{ padding: '9px 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}>Novo atendimento</button>
          </div>
        </div>
      )}
    </main>
  )
}
