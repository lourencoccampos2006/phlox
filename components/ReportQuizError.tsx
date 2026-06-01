'use client'

// components/ReportQuizError.tsx
// Botão "Reportar erro" reutilizável para qualquer pergunta/caso clínico
// gerado pela AI. Abre popover com motivos pré-definidos + comentário opcional.
// Quando o utilizador reporta, fica registado em quiz_feedback no Supabase
// (RLS: ele só vê os seus próprios reportes).
//
// Como usar:
//   <ReportQuizError source="arena" sourceKey={challenge.id} snapshot={challenge} />

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

type Source = 'arena' | 'cases' | 'exam' | 'flashcards' | 'decisao' | 'other'
type Reason = 'resposta_errada' | 'duas_corretas' | 'linguagem' | 'referencia_invalida' | 'desatualizado' | 'outro'

const REASONS: { id: Reason; label: string; hint: string }[] = [
  { id: 'resposta_errada',   label: 'Resposta marcada como certa está errada', hint: 'A "correta" não é a verdadeira correta' },
  { id: 'duas_corretas',     label: 'Há duas (ou mais) respostas corretas',    hint: 'A pergunta é ambígua' },
  { id: 'linguagem',         label: 'Erro de português ou termos PT-BR',       hint: 'Ex: "monitoramento", "trombolização"' },
  { id: 'referencia_invalida', label: 'Referência citada não existe',           hint: 'Ex: norma DGS inventada' },
  { id: 'desatualizado',     label: 'Informação desatualizada',                hint: 'A guideline mudou' },
  { id: 'outro',             label: 'Outro',                                   hint: 'Descreve no comentário' },
]

export default function ReportQuizError({
  source,
  sourceKey,
  snapshot,
  qualityFlags,
}: {
  source: Source
  sourceKey: string
  snapshot?: any
  qualityFlags?: string[]
}) {
  const { supabase } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('resposta_errada')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [reported, setReported] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  async function submit() {
    if (sending) return
    setSending(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/quiz-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source, source_key: sourceKey, reason, comment: comment.trim() || null, question_snapshot: snapshot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falhou')
      setReported(true)
      setOpen(false)
      toast.success(data.already ? 'Já tinhas reportado este item.' : 'Obrigado — a equipa vai rever.')
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível enviar.')
    } finally {
      setSending(false)
    }
  }

  // Quando inspectQuestion já sinalizou problemas, deixamos o botão mais notório
  const hasFlags = qualityFlags && qualityFlags.length > 0

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popRef}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={reported}
        aria-label="Reportar erro nesta pergunta"
        style={{
          padding: '5px 11px',
          background: reported ? '#f0fdf4' : hasFlags ? '#fffbeb' : 'white',
          color: reported ? '#0d6e42' : hasFlags ? '#b45309' : '#475569',
          border: `1px solid ${reported ? '#bbf7d0' : hasFlags ? '#fde68a' : '#e5e7eb'}`,
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: reported ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>
        {reported ? '✓ Reportado' : hasFlags ? '⚠ Reportar (suspeito)' : '⚠ Reportar erro'}
      </button>

      {open && !reported && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 30,
          width: 320, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0b1120', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Reportar erro nesta pergunta
          </div>
          {hasFlags && (
            <div style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
              <strong>Sinais de qualidade detetados:</strong> {qualityFlags!.join(' · ')}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {REASONS.map(r => (
              <label key={r.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                  background: reason === r.id ? '#eff6ff' : 'transparent',
                  border: `1px solid ${reason === r.id ? '#bfdbfe' : 'transparent'}`,
                  borderRadius: 6, cursor: 'pointer',
                }}>
                <input type="radio" checked={reason === r.id} onChange={() => setReason(r.id)}
                  style={{ marginTop: 2, accentColor: '#1d4ed8' }} />
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0b1120' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{r.hint}</div>
                </span>
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, 1000))}
            placeholder="(opcional) Descreve o erro com mais detalhe…"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 7, padding: '7px 9px', fontSize: 12, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 9 }}>
            <button onClick={() => setOpen(false)} disabled={sending}
              style={{ padding: '6px 12px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={submit} disabled={sending}
              style={{ padding: '6px 14px', background: sending ? '#cbd5e1' : '#1d4ed8', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: sending ? 'wait' : 'pointer' }}>
              {sending ? 'A enviar…' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
