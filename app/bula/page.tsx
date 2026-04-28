'use client'

// ─── NOVO: app/bula/page.tsx ───
// Tradutor de Bula — gratuito, sem login obrigatório.
// Converte texto de bulas em linguagem simples para doentes.

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface BulaResult {
  nome_medicamento: string
  para_que_serve: string
  o_que_nao_podes_fazer: string[]
  quando_ir_ao_medico: string[]
  seguranca_especial: { criancas: string; idosos: string; gravidas: string }
  interacoes: string[]
}

export default function BulaPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'nome' | 'texto'>('nome')
  const [medicamento, setMedicamento] = useState('')
  const [texto, setTexto] = useState('')
  const [result, setResult] = useState<BulaResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function translate() {
    const input = mode === 'nome' ? medicamento.trim() : texto.trim()
    if (!input) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/bula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'nome' ? { medicamento: input } : { texto: input }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const SectionCard = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
            Gratuito · Sem conta necessária
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10 }}>
            Tradutor de Bula
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 560 }}>
            Cola o texto de qualquer bula ou introduz o nome do medicamento. Recebes uma explicação simples em linguagem de doente, não de médico.
          </p>
        </div>

        {/* Tabs modo */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
          {([['nome', 'Nome do medicamento'], ['texto', 'Colar texto da bula']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px 12px', background: mode === m ? 'var(--ink)' : 'transparent', color: mode === m ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', marginBottom: 12 }}>
          {mode === 'nome' ? (
            <input
              value={medicamento}
              onChange={e => setMedicamento(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && translate()}
              placeholder="Ex: Brufen 400mg, Metformina, Enalapril..."
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
            />
          ) : (
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Cola aqui o texto da bula, as indicações, posologia, contraindicações..."
              rows={8}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          )}

          <button onClick={translate} disabled={loading || (mode === 'nome' ? !medicamento.trim() : !texto.trim())}
            style={{ marginTop: 12, width: '100%', padding: '13px', background: loading || (mode === 'nome' ? !medicamento.trim() : !texto.trim()) ? 'var(--bg-3)' : 'var(--ink)', color: loading || (mode === 'nome' ? !medicamento.trim() : !texto.trim()) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
            {loading ? 'A traduzir...' : 'Traduzir bula'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, marginTop: 8 }}>
              {result.nome_medicamento}
            </div>

            <SectionCard title="Para que serve" color="var(--green)">
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{result.para_que_serve}</p>
            </SectionCard>

            <SectionCard title="O que não podes fazer enquanto tomas" color="#f97316">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.o_que_nao_podes_fazer.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Quando ir ao médico urgentemente" color="#dc2626">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.quando_ir_ao_medico.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Segurança especial" color="#7c3aed">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
                {[
                  { label: 'Crianças', value: result.seguranca_especial.criancas },
                  { label: 'Idosos', value: result.seguranca_especial.idosos },
                  { label: 'Grávidas', value: result.seguranca_especial.gravidas },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{value}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Interações com álcool, alimentos e outros medicamentos" color="#1d4ed8">
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.interacoes.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            {/* CTA para guardar */}
            {!user ? (
              <div style={{ marginTop: 16, background: 'var(--ink)', borderRadius: 10, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Guarda a medicação no teu perfil</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Verificação de interações, alertas e diário de sintomas — de graça.</div>
                </div>
                <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
                  Criar conta grátis →
                </Link>
              </div>
            ) : (
              <div style={{ marginTop: 16, background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                  Adicionar {result.nome_medicamento} à tua medicação?
                </div>
                <Link href="/mymeds" style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, border: '1px solid var(--green)', padding: '6px 12px', borderRadius: 5, flexShrink: 0 }}>
                  Ir para medicação →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Aviso legal */}
        <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 8, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Esta ferramenta apresenta informação simplificada para fins de esclarecimento. Não substitui a leitura da bula original nem o aconselhamento do médico ou farmacêutico.
        </div>
      </div>
    </div>
  )
}
