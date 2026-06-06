'use client'

// "O que é este medicamento?" — explica em linguagem simples o que um medicamento
// faz, que doenças/sintomas trata, se precisa de receita, como tomar e cuidados.
// Foto ou nome (com autocomplete).
//
// 2026-06-01: reescrita completa com:
//  • DrugAutocomplete reutilizável (lib drugNames) — pedido recorrente
//  • Estética melhorada: cards com hierarquia clara, mobile-first
//  • Mecanismos:
//      1. resolveDrugName local (DCI confiável)
//      2. AI com regras estritas anti-alucinação
//      3. Fallback: se confiança baixa, sugerimos /bula com foto
//  • Receita por dose (Ben-u-ron 500 vs 1000, Brufen 200 vs 600, etc.)
//  • Estrutura: resposta dividida em secções claras com cores semânticas

import { useState } from 'react'
import { usePhloxContext } from '@/lib/copilotContext'
import Link from 'next/link'
import DrugAutocomplete from '@/components/DrugAutocomplete'
import { useAuth } from '@/components/AuthContext'

interface Result {
  identified: string
  active: string
  what_it_is: string                    // classe terapêutica em 1 frase simples
  what_it_treats: string[]
  symptoms: string[]
  how_to_take: string
  /** Receita: agora estruturado por dose se aplicável. */
  prescription: 'sem receita' | 'com receita médica' | 'com receita médica especial' | 'depende da dose'
  prescription_note?: string            // explica o limiar de dose
  common_side_effects: string[]
  cautions: string[]
  avoid_if: string[]
  good_to_know?: string
  confidence: 'alta' | 'media' | 'baixa'
  /** Se confidence === 'baixa', a UI mostra fallback (foto da bula). */
  fallback_advice?: string
  queried?: string
}

function downscale(file: File, maxDim = 1280, q = 0.82): Promise<{ b64: string; mime: string }> {
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

const RX_META: Record<Result['prescription'], { label: string; color: string; bg: string; border: string; icon: string }> = {
  'sem receita':                  { label: 'Venda livre (MNSRM)',        color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓' },
  'com receita médica':           { label: 'Precisa de receita médica',  color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '🩺' },
  'com receita médica especial':  { label: 'Receita médica especial',    color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', icon: '⚠' },
  'depende da dose':              { label: 'Depende da dose',            color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: 'ⓘ' },
}

export default function MedicamentoPage() {
  const { user } = useAuth() as any
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [infomedCode, setInfomedCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  // Publica para o Copilot o medicamento pesquisado + resultado
  usePhloxContext(
    result ? 'Medicamento consultado' : (name ? 'A pesquisar medicamento' : ''),
    result
      ? { medicamento: result.identified || name, principio_ativo: result.active, para_que_serve: result.what_it_is, receita: result.prescription }
      : (name ? { pesquisa: name } : null)
  )

  async function explain() {
    if (!name.trim() && !photo && !infomedCode.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      let payload: any = { name: name.trim() }
      if (photo && !name.trim()) { const { b64, mime } = await downscale(photo); payload = { image: b64, mimeType: mime } }
      // O código INFARMED/CNPEM, quando fornecido, é a identificação mais fiável.
      // Incluímos sempre que o utilizador o forneceu — funciona como âncora.
      if (infomedCode.trim()) payload.infomed_code = infomedCode.trim()
      const res = await fetch('/api/medicamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Não foi possível. Tenta uma foto da bula em /bula.')
    } finally { setLoading(false) }
  }

  const rx = result ? RX_META[result.prescription] || RX_META['com receita médica'] : null

  // Tokens visuais
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const sectionTitle = (t: string, emoji: string, color: string = 'var(--ink-3)') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)' }}>{t}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      {/* Hero — calmo, não chamativo */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 0 16px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Perceber</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>O que é este medicamento?</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.55 }}>
            Escreve o nome (com sugestões à medida que escreves) ou tira foto à caixa. Explicamos em palavras simples para que serve, se precisa de receita e o que ter em atenção.
          </p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        {/* Input — com autocomplete */}
        <div style={{ ...card, marginBottom: 16 }}>
          {/* Foto */}
          <label style={{ display: 'block', border: `1.5px dashed ${photo ? '#0d9488' : 'var(--border)'}`, borderRadius: 12, padding: photo ? 14 : '22px 16px', textAlign: 'center', cursor: 'pointer', background: photo ? '#f0fdfa' : 'var(--bg-2)', marginBottom: 12, transition: 'all 0.15s' }}>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setName(''); setResult(null); setError('') } }} />
            {photo ? (
              <div style={{ fontSize: 13.5, color: '#0d9488', fontWeight: 700 }}>📷 {photo.name} · tocar para trocar</div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)' }}>Tirar foto à caixa</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3 }}>(Da galeria ou directamente)</div>
              </>
            )}
          </label>

          {/* Separador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>OU ESCREVE</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Autocomplete + botão */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DrugAutocomplete
                value={name}
                onChange={(v) => { setName(v); if (v) setPhoto(null) }}
                onPick={(_dci, displayed) => { setName(displayed); }}
                placeholder="Ex: Ben-u-ron, Brufen, Concor…"
                helper="Carrega numa sugestão para preencher o nome"
                inputStyle={{ background: 'white', fontSize: 15, padding: '12px 14px' }}
              />
            </div>
            <button onClick={explain} disabled={loading || (!name.trim() && !photo && !infomedCode.trim())}
              style={{
                padding: '12px 18px',
                background: (name.trim() || photo || infomedCode.trim()) && !loading ? '#0d9488' : 'var(--bg-3)',
                color: (name.trim() || photo || infomedCode.trim()) && !loading ? 'white' : 'var(--ink-4)',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800,
                cursor: (name.trim() || photo || infomedCode.trim()) && !loading ? 'pointer' : 'default',
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              {loading ? '…' : 'Ver'}
            </button>
          </div>

          {/* Código INFARMED / CNPEM — identificação inequívoca da embalagem */}
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--ink-4)', fontWeight: 600 }}>
              + Adicionar nº INFARMED / CNPEM (acerto quase 100%)
            </summary>
            <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-2)', borderRadius: 8 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                Encontras este número na caixa do medicamento (geralmente 7 dígitos junto ao código de barras, etiquetado <b>"Reg. nº"</b> ou <b>"CNPEM"</b>). Quando fornecido, é a identificação oficial — minimiza erros do reconhecimento.
              </p>
              <input
                value={infomedCode}
                onChange={e => setInfomedCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 5432532"
                inputMode="numeric"
                maxLength={10}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-5)' }}>
                Não tens a caixa? Pesquisa em <a href="https://extranet.infarmed.pt/INFOMED-fo/" target="_blank" rel="noreferrer" style={{ color: '#0d9488' }}>INFOMED</a> pelo nome para encontrar o número exacto.
              </p>
            </div>
          </details>

          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 80, background: 'white', border: '1px solid var(--border)', borderRadius: 12, opacity: 0.5 }} />)}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Card principal: nome + classe + receita */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{result.identified || result.queried}</div>
                  {result.active && result.active !== result.identified && (
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{result.active}</div>
                  )}
                </div>
                {rx && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800, color: rx.color, background: rx.bg, border: `1.5px solid ${rx.border}`, padding: '5px 11px', borderRadius: 8 }}>
                      <span>{rx.icon}</span> {rx.label}
                    </span>
                  </div>
                )}
              </div>
              {result.what_it_is && (
                <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, marginTop: 6 }}>{result.what_it_is}</div>
              )}
              {result.prescription_note && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', lineHeight: 1.55 }}>
                  <strong style={{ color: rx?.color }}>Nota:</strong> {result.prescription_note}
                </div>
              )}

              {/* Confiança */}
              {result.confidence !== 'alta' && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 11px', display: 'flex', gap: 7 }}>
                  <span>⚠</span>
                  <span><strong>Confiança {result.confidence}</strong>. Confirma com o farmacêutico antes de tomar.</span>
                </div>
              )}
            </div>

            {/* Fallback se confiança baixa */}
            {result.confidence === 'baixa' && (
              <div style={{ background: '#0f172a', borderRadius: 12, padding: '16px 18px', color: 'white' }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Não consegui identificar com certeza</div>
                <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 12, lineHeight: 1.55 }}>
                  {result.fallback_advice || 'A informação acima pode estar incorreta. Em vez disso, tira uma foto à BULA (onde está o texto técnico do medicamento) — o motor de bula tem maior precisão.'}
                </div>
                <Link href="/bula" style={{ display: 'inline-block', padding: '9px 16px', background: 'white', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>📷 Ir à ferramenta /bula →</Link>
              </div>
            )}

            {/* Para que serve */}
            {result.what_it_treats?.length > 0 && (
              <div style={card}>
                {sectionTitle('Para que serve', '🎯', '#0d6e42')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.what_it_treats.map((t, i) => (
                    <span key={i} style={{ fontSize: 13, color: '#0d6e42', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 11px', fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
                {result.symptoms?.length > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--ink)' }}>Sintomas que ajuda a aliviar:</strong> {result.symptoms.join(' · ')}
                  </div>
                )}
              </div>
            )}

            {/* Como tomar */}
            {result.how_to_take && (
              <div style={card}>
                {sectionTitle('Como se costuma tomar', '💊', '#1d4ed8')}
                <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65 }}>{result.how_to_take}</div>
              </div>
            )}

            {/* Cuidados */}
            {result.cautions?.length > 0 && (
              <div style={{ ...card, background: '#fffdf7', borderColor: '#fde68a' }}>
                {sectionTitle('Cuidados', '⚠️', '#b45309')}
                <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                  {result.cautions.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* NÃO tomar se */}
            {result.avoid_if?.length > 0 && (
              <div style={{ ...card, background: '#fff7f7', borderColor: '#fca5a5' }}>
                {sectionTitle('NÃO tomes (sem falar com o médico) se', '🚫', '#991b1b')}
                <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: '#991b1b', lineHeight: 1.65 }}>
                  {result.avoid_if.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                </ul>
              </div>
            )}

            {/* Efeitos secundários */}
            {result.common_side_effects?.length > 0 && (
              <div style={card}>
                {sectionTitle('Efeitos secundários comuns', '🩺')}
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>{result.common_side_effects.join(' · ')}</div>
              </div>
            )}

            {/* Bom saber */}
            {result.good_to_know && (
              <div style={{ ...card, background: '#f0fdfa', borderColor: '#99f6e4' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ fontSize: 18 }}>💡</span>
                  <div style={{ fontSize: 13.5, color: '#0f766e', lineHeight: 1.6 }}>{result.good_to_know}</div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <Link href="/interactions" style={{ flex: '1 1 200px', textAlign: 'center', padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', textDecoration: 'none' }}>
                ⚗ Verificar interações
              </Link>
              {user && (
                <Link href="/mymeds" style={{ flex: '1 1 200px', textAlign: 'center', padding: '12px', background: '#0d6e42', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  + Adicionar à minha lista
                </Link>
              )}
              <Link href="/bula" style={{ flex: '1 1 100%', textAlign: 'center', padding: '11px', background: 'white', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-4)', textDecoration: 'none' }}>
                Não te pareceu certo? Tira foto à bula em /bula →
              </Link>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5, marginTop: 8 }}>
              Informação geral de apoio · Confirma sempre com o teu farmacêutico ou médico.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
