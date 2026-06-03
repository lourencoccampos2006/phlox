'use client'

// /bi — BI conversacional: pergunta em PT-PT, recebe resposta + tabela.
// Histórico das últimas perguntas + favoritos.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'

interface QueryRow {
  id: string; question: string; answer: string|null
  rows_returned: number|null; duration_ms: number|null; error: string|null
  pinned: boolean; pin_label: string|null; created_at: string
}

interface BIResult {
  sql: string; answer: string; rows: any[]
  rows_returned: number; duration_ms: number
}

const ACCENT = '#0d6e42'

const EXAMPLES = [
  'Quantos doentes estão internados agora?',
  'Quais as 5 últimas intervenções farmacêuticas?',
  'Triagens prioridade 1 e 2 das últimas 24 horas',
  'Encomendas pendentes acima de 100€',
  'Top 10 doentes com mais medicamentos',
  'Camas livres por ala',
]

export default function BIPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BIResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [history, setHistory] = useState<QueryRow[]>([])
  const [pinned, setPinned] = useState<QueryRow[]>([])

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const loadHistory = useCallback(async () => {
    if (!org) return
    const headers = await authHeader()
    const [h, p] = await Promise.all([
      fetch(`/api/bi/history?org_id=${org.id}`, { headers }).then(r => r.json()),
      fetch(`/api/bi/history?org_id=${org.id}&pinned=1`, { headers }).then(r => r.json()),
    ])
    setHistory(h.queries || [])
    setPinned(p.queries || [])
  }, [org, authHeader])

  useEffect(() => { if (user && !orgLoading) loadHistory() }, [user, orgLoading, loadHistory])

  async function ask(q: string) {
    if (!org || !q.trim() || busy) return
    setBusy(true); setErr(null); setResult(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/bi/ask', { method: 'POST', headers, body: JSON.stringify({ org_id: org.id, question: q.trim() }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setResult(j as BIResult)
      loadHistory()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function togglePin(id: string, pinned: boolean) {
    const headers = await authHeader()
    await fetch('/api/bi/history', { method: 'PATCH', headers, body: JSON.stringify({ id, pinned }) })
    loadHistory()
  }

  if (orgLoading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>BI</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('bi.use')) return <main style={{ padding: 24 }}><h1>BI</h1><p>Sem permissão.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>BI conversacional</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>Pergunta sobre {org.name} em linguagem natural. A IA gera a consulta e devolve os dados.</p>
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); ask(question) }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ex: Quantos doentes têm episódio aberto hoje?"
            style={{ ...input, fontSize: 15 }}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !question.trim()} style={{ ...btn('primary'), padding: '10px 20px' }}>
            {busy ? 'A pensar…' : 'Perguntar'}
          </button>
        </div>
      </form>

      {/* Exemplos */}
      {!result && !err && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Exemplos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXAMPLES.map(e => (
              <button key={e} onClick={() => { setQuestion(e); ask(e) }} style={{
                padding: '6px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 999,
                fontSize: 12, color: '#374151', cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
      )}

      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{err}</div>}

      {/* Resultado */}
      {result && (
        <section style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Resposta</div>
              <div style={{ fontSize: 15, color: '#111827', lineHeight: 1.5 }}>{result.answer}</div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {result.rows_returned} linha{result.rows_returned === 1 ? '' : 's'} · {result.duration_ms}ms
            </div>
          </div>

          {/* Tabela de resultados */}
          {result.rows.length > 0 && <ResultTable rows={result.rows} />}

          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>Ver SQL gerada</summary>
            <pre style={{ background: '#f3f4f6', padding: 10, borderRadius: 6, fontSize: 12, color: '#374151', overflow: 'auto', marginTop: 8 }}>
              {result.sql}
            </pre>
          </details>
        </section>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 8 }}>★ Favoritos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {pinned.map(q => (
              <button key={q.id} onClick={() => { setQuestion(q.question); ask(q.question) }} style={{
                textAlign: 'left', padding: 12, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>★ {q.pin_label || 'Favorito'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{q.question}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Recentes</h2>
          <div style={{ display: 'grid', gap: 4 }}>
            {history.slice(0, 15).map(q => (
              <div key={q.id} style={{
                background: 'white', border: '1px solid #f3f4f6', borderRadius: 8, padding: 10,
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
              }}>
                <button onClick={() => { setQuestion(q.question); ask(q.question) }} style={{
                  background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0,
                }}>
                  <div style={{ fontSize: 13, color: '#111827' }}>{q.question}</div>
                  {q.answer && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{q.answer}</div>}
                  {q.error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {q.error}</div>}
                </button>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {q.rows_returned != null ? `${q.rows_returned} linhas` : ''}
                </span>
                <button onClick={() => togglePin(q.id, !q.pinned)} title={q.pinned ? 'Remover dos favoritos' : 'Marcar favorito'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: q.pinned ? '#f59e0b' : '#9ca3af' }}>
                  {q.pinned ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function ResultTable({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) return <p style={{ color: '#6b7280', fontSize: 13 }}>Sem dados.</p>
  const cols = Object.keys(rows[0])
  return (
    <div style={{ overflow: 'auto', maxHeight: 400, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {cols.map(c => {
                const v = row[c]
                const display = v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)
                return (
                  <td key={c} style={{ padding: '8px 12px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const input: React.CSSProperties = {
  flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
