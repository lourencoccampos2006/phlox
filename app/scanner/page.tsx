'use client'

import { useState, useRef, useEffect } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanResult {
  name: string
  brand_names: string[]
  what_it_is: string          // "Para que serve" em linguagem simples
  how_it_works_simple: string // mecanismo em 1 frase para leigos
  when_to_take: string        // quando e como tomar
  with_food: 'SIM' | 'NAO' | 'TANTO_FAZ' | 'PREFERIVELMENTE'
  duration_typical: string
  most_common_effects: string[]  // efeitos adversos mais comuns em linguagem simples
  serious_effects: string[]      // quando ir ao médico
  avoid_with: string[]           // "Evita com:" — alimentos, álcool, outros
  safety_profile: {
    driving: 'SEGURO' | 'CUIDADO' | 'EVITAR'
    alcohol: 'SEGURO' | 'CUIDADO' | 'EVITAR'
    pregnancy: 'SEGURO' | 'CUIDADO' | 'EVITAR' | 'PROIBIDO'
    elderly: 'SEGURO' | 'CUIDADO' | 'EVITAR'
  }
  personal_check?: {             // só se tiver medicação registada
    status: 'SEGURO' | 'CUIDADO' | 'EVITAR'
    reason: string
    conflicts: string[]
  }
  quick_answer: string           // A resposta à pergunta "posso tomar?" em 1 frase
  myth_bust?: string             // mito comum sobre este medicamento (opcional)
}

// ─── Safety badge ─────────────────────────────────────────────────────────────

const STATUS = {
  SEGURO:  { bg: '#f0fdf4', border: '#86efac', color: '#14532d', dot: '#22c55e', emoji: '✓' },
  CUIDADO: { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b', emoji: '⚠' },
  EVITAR:  { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444', emoji: '✗' },
  PROIBIDO:{ bg: '#fff5f5', border: '#fca5a5', color: '#450a0a', dot: '#dc2626', emoji: '✗' },
}

function Badge({ status, label }: { status: keyof typeof STATUS; label: string }) {
  const s = STATUS[status] || STATUS.CUIDADO
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'white', fontWeight: 700 }}>
        {s.emoji}
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: s.color, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center' }}>{label}</div>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{status}</div>
    </div>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result, hasMeds }: { result: ScanResult; hasMeds: boolean }) {
  const [mode, setMode] = useState<'simples' | 'tecnico'>('simples')

  const pc = result.personal_check
  const pcStyle = pc ? (STATUS[pc.status] || STATUS.CUIDADO) : null

  return (
    <div className="fade-in">

      {/* Personal check — the killer feature */}
      {pc && pcStyle && (
        <div style={{ background: pcStyle.bg, border: `2px solid ${pcStyle.dot}`, borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: pcStyle.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {pcStyle.emoji}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: pcStyle.color, letterSpacing: '0.12em', fontWeight: 700 }}>COM A TUA MEDICAÇÃO ACTUAL</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: pcStyle.color, fontWeight: 700 }}>{pc.status}</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: pcStyle.color, lineHeight: 1.7, margin: '0 0 10px' }}>{pc.reason}</p>
          {pc.conflicts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pc.conflicts.map(c => (
                <span key={c} style={{ fontSize: 11, background: 'white', border: `1px solid ${pcStyle.border}`, borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-mono)', color: pcStyle.color }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No meds registered — upsell Student */}
      {!hasMeds && (
        <div style={{ background: 'white', border: '2px dashed var(--border-2)', borderRadius: 8, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>💊 Queres saber se podes tomar com a tua medicação?</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Regista os teus medicamentos e verifica automaticamente — plano Student.</div>
          </div>
          <Link href="/dashboard?tab=meds" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '7px 16px', borderRadius: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Registar →
          </Link>
        </div>
      )}

      {/* Main card */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>

        {/* Drug header */}
        <div style={{ background: 'var(--green)', padding: '20px 22px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>
            {result.brand_names.length > 0 && result.brand_names.join(' · ')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', margin: '0 0 8px' }}>{result.name}</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>{result.quick_answer}</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['simples', 'tecnico'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '10px', background: mode === m ? 'var(--bg-2)' : 'white', border: 'none', borderBottom: mode === m ? '2px solid var(--green)' : '2px solid transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', color: mode === m ? 'var(--green)' : 'var(--ink-4)', fontWeight: mode === m ? 700 : 400, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {m === 'simples' ? '🧑 Linguagem simples' : '⚕️ Técnico'}
            </button>
          ))}
        </div>

        {mode === 'simples' ? (
          <div style={{ padding: '20px' }}>
            {/* What it is */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Para que serve</div>
              <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0 }}>{result.what_it_is}</p>
            </div>

            {/* When to take */}
            <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Como e quando tomar</div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: '0 0 8px' }}>{result.when_to_take}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>{result.with_food === 'SIM' ? '🍽' : result.with_food === 'NAO' ? '🚫🍽' : result.with_food === 'PREFERIVELMENTE' ? '🍽' : '🤷'}</span>
                <span style={{ color: 'var(--ink-2)' }}>
                  {result.with_food === 'SIM' ? 'Tomar com comida' :
                   result.with_food === 'NAO' ? 'Tomar com estômago vazio' :
                   result.with_food === 'PREFERIVELMENTE' ? 'Preferivelmente com comida' :
                   'Com ou sem comida — tanto faz'}
                </span>
              </div>
            </div>

            {/* Safety grid */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Segurança</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <Badge status={result.safety_profile.driving} label="Conduzir" />
                <Badge status={result.safety_profile.alcohol} label="Álcool" />
                <Badge status={result.safety_profile.pregnancy} label="Gravidez" />
                <Badge status={result.safety_profile.elderly} label="Idosos" />
              </div>
            </div>

            {/* Avoid with */}
            {result.avoid_with.length > 0 && (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>⚠ Evita com</div>
                {result.avoid_with.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#78350f', marginBottom: 4 }}>
                    <span style={{ flexShrink: 0 }}>·</span>{a}
                  </div>
                ))}
              </div>
            )}

            {/* Side effects */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Efeitos mais comuns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.most_common_effects.map(e => (
                  <span key={e} style={{ fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px', color: 'var(--ink-3)' }}>{e}</span>
                ))}
              </div>
            </div>

            {/* Serious effects */}
            {result.serious_effects.length > 0 && (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#7f1d1d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>🚨 Vai ao médico se tiveres</div>
                {result.serious_effects.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#742a2a', marginBottom: 4 }}>
                    <span style={{ flexShrink: 0, fontWeight: 700 }}>!</span>{e}
                  </div>
                ))}
              </div>
            )}

            {/* Myth bust */}
            {result.myth_bust && (
              <div style={{ padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>💡 Sabes que</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.myth_bust}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Mecanismo de acção</div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.how_it_works_simple}</p>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Efeitos adversos frequentes</div>
            {result.most_common_effects.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, padding: '4px 0', borderBottom: '1px solid var(--bg-3)' }}>
                <span style={{ color: 'var(--ink-4)' }}>·</span>{e}
              </div>
            ))}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>Efeitos graves</div>
            {result.serious_effects.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#742a2a', marginBottom: 4, padding: '4px 0', borderBottom: '1px solid #fff5f5' }}>
                <span style={{ color: '#c53030', fontWeight: 700 }}>!</span>{e}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
        ⚕️ Informação educacional. Confirma sempre com o teu médico ou farmacêutico.
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  'Ibuprofeno', 'Paracetamol', 'Metformina', 'Omeprazol',
  'Sertralina', 'Amoxicilina', 'Lorazepam', 'Atorvastatina',
  'Levotiroxina', 'Ramipril', 'Alprazolam', 'Prednisolona',
]

export default function ScannerPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meds, setMeds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load personal meds for context
  useEffect(() => {
    if (!user || !isStudent) return
    supabase.from('personal_meds').select('name').eq('user_id', user.id)
      .then(({ data }) => { if (data) setMeds(data.map((m: any) => m.name)) })
  }, [user, isStudent, supabase])

  const scan = async (drug?: string) => {
    const q = (drug ?? query).trim()
    if (!q) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers,
        body: JSON.stringify({ drug: q, personal_meds: isStudent ? meds : [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao analisar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {/* Hero search — always visible, always usable */}
        <div style={{ maxWidth: 640, margin: '0 auto 32px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Posso tomar este medicamento?
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
            Escreve qualquer medicamento. Sabe o que é, como tomar, o que evitar — e se é seguro com a tua medicação.
          </p>

          <div style={{ display: 'flex', gap: 8, background: 'white', border: '2px solid var(--border-2)', borderRadius: 8, padding: 6, marginBottom: 16 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scan()}
              placeholder="Ex: ibuprofeno, amoxicilina, omeprazol..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontFamily: 'var(--font-sans)', color: 'var(--ink)', padding: '6px 8px', background: 'transparent' }}
              autoFocus
            />
            <button onClick={() => scan()} disabled={!query.trim() || loading}
              style={{ background: query.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: query.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: query.trim() && !loading ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
              {loading ? '...' : 'Verificar →'}
            </button>
          </div>

          {/* Examples */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setQuery(ex); scan(ex) }}
                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Context banner for logged in students */}
        {isStudent && meds.length > 0 && !result && (
          <div style={{ maxWidth: 640, margin: '0 auto 24px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--green-2)' }}>
              Verificação personalizada activa — tens {meds.length} medicamento{meds.length !== 1 ? 's' : ''} no perfil
            </span>
          </div>
        )}

        {/* No account upsell — subtle, not annoying */}
        {!user && !result && (
          <div style={{ maxWidth: 640, margin: '0 auto 24px', background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Tem conta? Verificamos com os teus medicamentos pessoais.</span>
            <Link href="/login" style={{ fontSize: 12, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Entrar →</Link>
          </div>
        )}

        {/* Results */}
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {loading && (
            <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: 'var(--green)', padding: '20px 22px' }}>
                <div className="skeleton" style={{ height: 10, width: 140, marginBottom: 10, opacity: 0.4 }} />
                <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 8, opacity: 0.4 }} />
                <div className="skeleton" style={{ height: 14, width: '70%', opacity: 0.3 }} />
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[80, 60, 100, 45, 70].map((w, i) => (
                  <div key={i} className="skeleton" style={{ height: 13, width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '16px 20px' }}>
              <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
            </div>
          )}

          {result && !loading && (
            <ResultCard result={result} hasMeds={isStudent && meds.length > 0} />
          )}
        </div>
      </div>
    </div>
  )
}