'use client'

// ─── NOVO: app/bula/page.tsx ───
// Tradutor de Bula — gratuito, sem login obrigatório.
// Converte texto de bulas em linguagem simples para doentes.

import { useState, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useUsageLimit } from '@/lib/useUsageLimit'
import { UpgradePrompt, UsageBadge } from '@/components/UpgradePrompt'
import DrugAutocomplete from '@/components/DrugAutocomplete'

interface BulaResult {
  nome_medicamento: string
  para_que_serve: string
  o_que_nao_podes_fazer: string[]
  quando_ir_ao_medico: string[]
  seguranca_especial: { criancas: string; idosos: string; gravidas: string }
  interacoes: string[]
  /** 2026-06-01: novo — alguns medicamentos têm doses MNSRM (sem receita) e
   *  doses sujeitas a receita (ex: ibuprofeno 200/400 vs 600/800 mg). */
  receita_medica?: { necessaria: boolean; nota: string }
}

export default function BulaPage() {
  const { user } = useAuth()
  const usage = useUsageLimit('bula')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [mode, setMode] = useState<'nome' | 'texto' | 'foto'>('nome')
  const [medicamento, setMedicamento] = useState('')
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [result, setResult] = useState<BulaResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)

  // 2026-06-01: aceita foto da bula. Converte em data URL e envia base64
  // — o endpoint /api/bula precisa de aceitar imageBase64 + mimeType.
  async function fileToBase64(file: File): Promise<{ b64: string; mime: string }> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => {
        const s = String(r.result || '')
        const idx = s.indexOf(',')
        resolve({ b64: idx >= 0 ? s.slice(idx + 1) : s, mime: file.type || 'image/jpeg' })
      }
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  async function translate() {
    if (!usage.allowed) { setShowUpgrade(true); return }
    setLoading(true); setError(null); setResult(null)
    try {
      let body: any
      if (mode === 'nome') {
        const v = medicamento.trim()
        if (!v) { setLoading(false); return }
        body = { medicamento: v }
      } else if (mode === 'texto') {
        const v = texto.trim()
        if (!v) { setLoading(false); return }
        body = { texto: v }
      } else {
        if (!foto) { setLoading(false); return }
        const { b64, mime } = await fileToBase64(foto)
        body = { imageBase64: b64, mimeType: mime }
      }
      const res = await fetch('/api/bula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) usage.increment()
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
          {([['nome', 'Nome'], ['texto', 'Colar texto'], ['foto', '📷 Foto']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px 12px', background: mode === m ? 'var(--ink)' : 'transparent', color: mode === m ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', marginBottom: 12 }}>
          {mode === 'nome' ? (
            <DrugAutocomplete
              value={medicamento}
              onChange={setMedicamento}
              onPick={(dci) => { setMedicamento(dci); /* não dispara translate automaticamente — utilizador clica em Traduzir */ }}
              placeholder="Ex: Brufen 400 mg, Metformina, Enalapril…"
              inputStyle={{ fontSize: 15, padding: '12px 14px' }}
            />
          ) : mode === 'texto' ? (
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Cola aqui o texto da bula, as indicações, posologia, contraindicações..."
              rows={8}
              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          ) : (
            <div>
              <label style={{ display: 'block', cursor: 'pointer', border: `1.5px dashed ${foto ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, padding: foto ? 12 : '28px 16px', textAlign: 'center', background: foto ? '#f0fdf4' : 'var(--bg-2)' }}>
                <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFoto(f); setResult(null); setError(null) } }} />
                {foto ? (
                  <div style={{ fontSize: 13, color: 'var(--green-2)', fontWeight: 700 }}>📷 {foto.name} · {Math.round(foto.size/1024)} KB · tocar para trocar</div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)' }}>Tirar foto à bula</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>Ou escolher imagem da galeria</div>
                  </div>
                )}
              </label>
            </div>
          )}

          {!usage.unlimited && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <UsageBadge remaining={usage.remaining} unlimited={usage.unlimited} />
            </div>
          )}
          <button onClick={translate} disabled={loading || (mode === 'nome' ? !medicamento.trim() : mode === 'texto' ? !texto.trim() : !foto)}
            style={{ marginTop: 8, width: '100%', padding: '13px', background: loading || (mode === 'nome' ? !medicamento.trim() : !texto.trim()) ? 'var(--bg-3)' : 'var(--ink)', color: loading || (mode === 'nome' ? !medicamento.trim() : !texto.trim()) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
            {loading ? 'A traduzir...' : 'Traduzir bula'}
          </button>
          <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)} toolLabel="Perceber uma bula" plan={usage.plan} limit={usage.limit} />
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

            {result.receita_medica && (
              <div style={{ background: result.receita_medica.necessaria ? '#fef2f2' : '#f0fdf4', border: `1px solid ${result.receita_medica.necessaria ? '#fca5a5' : '#bbf7d0'}`, borderLeft: `3px solid ${result.receita_medica.necessaria ? '#dc2626' : '#16a34a'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: result.receita_medica.necessaria ? '#991b1b' : '#166534', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 800 }}>
                  {result.receita_medica.necessaria ? '🩺 Precisa de receita médica' : '✓ Venda livre (MNSRM)'}
                </div>
                {result.receita_medica.nota && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{result.receita_medica.nota}</div>}
              </div>
            )}

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
