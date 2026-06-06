'use client'

// /study/biblioteca — Q&A clínico com IA fundamentado em guidelines.
// Inspirado em UpToDate / DynaMed: faz uma pergunta clínica, recebe resposta
// estruturada com fontes citadas da biblioteca local.

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { usePhloxContext } from '@/lib/copilotContext'

const ACCENT = '#0d6e42'

interface Source { id: string; title: string; source: string|null; year: number|null; domain: string|null }

const QUICK_PROMPTS = [
  { icon: '💊', label: 'Como tratar', q: 'Como tratar fibrilhação auricular de novo num doente de 72 anos?' },
  { icon: '🩺', label: 'Diagnóstico de', q: 'Como diagnosticar embolia pulmonar — qual a abordagem actual?' },
  { icon: '⚖️', label: 'Doses', q: 'Qual a dose inicial de IECA na insuficiência cardíaca e como titular?' },
  { icon: '🚨', label: 'Quando referenciar', q: 'Quando referenciar dor lombar para imagem ou especialidade?' },
  { icon: '🔄', label: 'Comparar', q: 'NOAC vs varfarina na fibrilhação auricular — quando escolher cada?' },
  { icon: '📋', label: 'Protocolo', q: 'Qual o protocolo de bundle de 1 hora na sépsis?' },
]

const DOMAINS = [
  'cardiologia','pneumologia','endocrinologia','neurologia','gastroenterologia',
  'infecciologia','nefrologia','hematologia','reumatologia','oncologia',
  'urgencia','obstetricia','pediatria','psiquiatria','urologia',
]

export default function BibliotecaPage() {
  const { supabase } = useAuth() as any
  const [question, setQuestion] = useState('')
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [history, setHistory] = useState<{ q: string; a: string }[]>([])

  usePhloxContext(
    answer ? 'Pergunta clínica respondida' : (question ? 'A pesquisar na biblioteca' : ''),
    answer ? { pergunta: question, resposta: answer.slice(0, 1000) } : (question ? { pergunta: question } : null)
  )

  const ask = useCallback(async (q?: string) => {
    const target = (q || question).trim()
    if (!target || busy) return
    if (q) setQuestion(q)
    setBusy(true); setErr(null); setAnswer(null); setSources([])
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/biblioteca-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ question: target + (domain ? ` (foco: ${domain})` : '') }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setAnswer(j.answer || '')
      setSources(j.sources || [])
      setHistory(h => [{ q: target, a: j.answer || '' }, ...h].slice(0, 10))
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }, [question, domain, busy, supabase])

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca médica</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Pergunta clínica em PT-PT. A IA responde com base em guidelines (ESC, ADA, GINA, NICE, DGS, SCC) e cita as fontes.
      </p>

      <form onSubmit={e => { e.preventDefault(); ask() }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ex: Como tratar DPOC exacerbação? · Doses de NOAC em IRC? · Algoritmo de AVC isquémico em janela?"
          rows={2}
          style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={domain} onChange={e => setDomain(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: 'white' }}>
            <option value="">Qualquer domínio</option>
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="submit" disabled={busy || !question.trim()} style={{
            padding: '10px 22px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8,
            fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (busy || !question.trim()) ? 0.5 : 1,
          }}>{busy ? 'A pesquisar…' : 'Perguntar'}</button>
        </div>
      </form>

      {/* Prompts rápidos */}
      {!answer && !busy && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Inspiração</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => ask(p.q)} style={{
                textAlign: 'left', padding: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{p.icon} {p.label}</div>
                <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.4 }}>{p.q}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginTop: 16, fontSize: 13 }}>{err}</div>}

      {(answer || busy) && (
        <article style={{ marginTop: 22, background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22 }}>
          {busy ? (
            <p style={{ color: '#6b7280', margin: 0 }}>A consultar a biblioteca e a redigir a resposta…</p>
          ) : (
            <>
              <div style={{ lineHeight: 1.7, fontSize: 14, color: '#111827', whiteSpace: 'pre-wrap' }}>
                <MarkdownLike text={answer || ''} />
              </div>

              {sources.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    📚 Fontes consultadas ({sources.length})
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {sources.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, fontSize: 12 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#0d6e42', color: 'white', fontWeight: 700, fontSize: 10 }}>
                          {s.source || '—'} {s.year || ''}
                        </span>
                        <span style={{ color: '#111827', flex: 1 }}>{s.title}</span>
                        {s.domain && <span style={{ color: '#6b7280', fontSize: 11 }}>{s.domain}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </article>
      )}

      {/* Histórico */}
      {history.length > 1 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Histórico ({history.length - 1})
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {history.slice(1).map((h, i) => (
              <button key={i} onClick={() => ask(h.q)} style={{
                textAlign: 'left', padding: 10, background: 'white', border: '1px solid #f3f4f6', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, color: '#374151',
              }}>
                ↻ {h.q}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function MarkdownLike({ text }: { text: string }) {
  const html = text
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px; font-weight:700; margin:14px 0 6px; color:#111827">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:16px; font-weight:700; margin:18px 0 8px; color:#111827">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="margin:6px 0; padding-left:20px">${m}</ul>`)
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
