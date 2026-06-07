'use client'

// UniversalSearch — barra de pesquisa global (⌘J / Ctrl+J).
// Escreve em linguagem natural; a IA decide a ferramenta certa e leva-te lá com
// os parâmetros já preenchidos. Mostra também atalhos diretos.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

// Atalhos diretos (navegação instantânea, sem IA)
const QUICK = [
  { label: 'Verificar interações', route: '/interactions', icon: '⚗' },
  { label: 'O que é este medicamento', route: '/medicamento', icon: '💊' },
  { label: 'Biblioteca médica (Q&A)', route: '/study/biblioteca', icon: '📚' },
  { label: 'Interpretar análises', route: '/study/lab', icon: '🧪' },
  { label: 'Treinar ECG', route: '/study/ecg', icon: '💓' },
  { label: 'As minhas notas', route: '/study/notas', icon: '📝' },
  { label: 'Devo ir ao médico?', route: '/saude-agora', icon: '🩺' },
]

const TOOL_LABEL: Record<string, string> = {
  interactions: 'Verificador de interações', medicamento: 'Informação de medicamento',
  bula: 'Bula', biblioteca: 'Biblioteca médica', labs: 'Interpretação de análises',
  ecg: 'ECG', 'saude-agora': 'Triagem', calculadoras: 'Calculadoras', escalas: 'Escalas',
  mymeds: 'A minha medicação', estudo: 'Estudo',
}

export default function UniversalSearch() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tool: string; route: string; hint: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { if (open) { setResult(null); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  const go = useCallback((route: string) => { setOpen(false); setQ(''); router.push(route) }, [router])

  const search = useCallback(async () => {
    const query = q.trim()
    if (!query || busy) return
    setBusy(true); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/universal-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ query }),
      })
      const j = await r.json()
      if (j.route) { setResult({ tool: j.tool, route: j.route, hint: j.hint }); }
    } catch { /* ignore */ } finally { setBusy(false) }
  }, [q, busy, supabase])

  if (!user) return null

  return (
    <>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,21,0.4)', backdropFilter: 'blur(2px)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 'min(560px, calc(100vw - 32px))', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eceef0' }}>
              <span style={{ color: '#8b8f99', fontSize: 16 }}>⌕</span>
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') search() }}
                placeholder="Pergunta em linguagem natural… (ex: varfarina + ibuprofeno, como tratar DPOC)"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit' }} />
              {busy && <span style={{ fontSize: 12, color: '#8b8f99' }}>a pensar…</span>}
              <kbd style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', border: '1px solid #e7e8ea', borderRadius: 4, padding: '1px 5px' }}>esc</kbd>
            </div>

            {/* Resultado IA */}
            {result && (
              <button onClick={() => go(result.route)} style={{ width: '100%', textAlign: 'left', padding: '14px 18px', background: '#f0fdf5', border: 'none', borderBottom: '1px solid #eceef0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>✦</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: ACCENT }}>{TOOL_LABEL[result.tool] || 'Abrir'}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#374151', marginTop: 1 }}>{result.hint || 'Abre a ferramenta certa com a tua pesquisa.'}</span>
                </span>
                <span style={{ color: ACCENT, fontWeight: 700 }}>↵</span>
              </button>
            )}

            {/* Atalhos */}
            {!result && (
              <div style={{ padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
                {q.trim() && (
                  <button onClick={search} style={{ width: '100%', textAlign: 'left', padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 16 }}>✦</span>
                    <span style={{ fontSize: 13.5, color: '#16181d' }}>Perguntar à IA: <b>"{q.trim()}"</b></span>
                  </button>
                )}
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, padding: '6px 18px 4px' }}>Atalhos</div>
                {QUICK.map(item => (
                  <button key={item.route} onClick={() => go(item.route)} style={{ width: '100%', textAlign: 'left', padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: '#374151' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f6f7f8')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
