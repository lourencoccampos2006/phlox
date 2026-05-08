'use client'

// ─── IMPORTAR — Migração de dados para o Phlox ───────────────────────────────
// Importa dados de qualquer fonte: MySNS PDF, texto de análises, receitas,
// lista de medicamentos. O Phlox interpreta e guarda na memória clínica.

import { useState, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type ImportMode = 'meds' | 'labs' | 'vaccines' | 'sns' | 'prescription'

const IMPORT_MODES = [
  {
    id: 'meds' as ImportMode,
    label: 'Medicamentos',
    sub: 'Lista de medicação actual — texto, PDF ou foto de receita',
    dest: '/mymeds',
    destLabel: 'Os Meus Medicamentos',
  },
  {
    id: 'labs' as ImportMode,
    label: 'Análises clínicas',
    sub: 'PDF ou texto de resultados de laboratório — Synlab, Unilabs, hospital',
    dest: '/registo',
    destLabel: 'Registo de Saúde → Análises',
  },
  {
    id: 'vaccines' as ImportMode,
    label: 'Boletim de vacinas',
    sub: 'Texto ou PDF do boletim de vacinas — registo manual ou digitalizado',
    dest: '/registo',
    destLabel: 'Registo de Saúde → Vacinas',
  },
  {
    id: 'sns' as ImportMode,
    label: 'MySNS / Portal do Utente',
    sub: 'PDF descarregado do portal SNS24 ou MySNS — medicação, histórico, vacinação',
    dest: '/registo',
    destLabel: 'Registo de Saúde',
  },
  {
    id: 'prescription' as ImportMode,
    label: 'Receita médica',
    sub: 'Foto ou PDF de receita — extrai medicamentos automaticamente',
    dest: '/mymeds',
    destLabel: 'Os Meus Medicamentos',
  },
]

const SNS_INSTRUCTIONS = [
  {
    step: '1',
    title: 'Abre o portal MySNS',
    detail: 'Vai a mysns.min-saude.pt e faz login com o teu Cartão de Cidadão ou Chave Móvel Digital.',
  },
  {
    step: '2',
    title: 'Descarrega o teu registo',
    detail: 'Secção "O meu registo de saúde" → "Exportar" → escolhe PDF. Inclui medicação crónica, vacinação e histórico de consultas.',
  },
  {
    step: '3',
    title: 'Cola o texto aqui',
    detail: 'Abre o PDF, selecciona todo o texto (Ctrl+A), copia (Ctrl+C) e cola na caixa abaixo. O Phlox interpreta automaticamente.',
  },
]

export default function ImportarPage() {
  const { user, supabase } = useAuth()
  const [mode, setMode] = useState<ImportMode>('meds')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [profileTarget, setProfileTarget] = useState<'self' | string>('self')
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedMode = IMPORT_MODES.find(m => m.id === mode)!

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const t = await file.text()
    setText(t)
    e.target.value = ''
  }

  const analyse = async () => {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null); setSaved(false)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const endpoint = mode === 'labs' || mode === 'sns' ? '/api/labs' : '/api/import-meds'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ text: text.trim(), mode, source: mode === 'sns' ? 'sns' : 'import' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na análise')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    }
    setLoading(false)
  }

  const save = async () => {
    if (!result || !user) return
    setSaved(false)
    const { data: sd } = await supabase.auth.getSession()
    const pid = profileTarget === 'self' ? null : profileTarget

    try {
      if (mode === 'meds' || mode === 'prescription') {
        // Save to personal_meds or patient_meds
        const meds = result.meds || []
        for (const med of meds) {
          await supabase.from('personal_meds').upsert({
            user_id: user.id, name: med.name,
            dose: med.dose || null, frequency: med.frequency || null,
            indication: med.indication || null,
          }, { onConflict: 'user_id,name' })
        }
      } else if (mode === 'labs' || mode === 'sns') {
        // Save to lab_records
        if (result.values?.length) {
          await supabase.from('lab_records').insert({
            user_id: user.id, profile_id: pid,
            date: result.date || new Date().toISOString().split('T')[0],
            lab_name: result.lab_name || 'Importado',
            values: result.values,
            ai_summary: result.summary || null,
            flags: result.flags || [],
            source: mode === 'sns' ? 'sns' : 'import',
            raw_text: text.slice(0, 5000),
          })
        }
        // Also save meds if SNS
        if (mode === 'sns' && result.meds?.length) {
          for (const med of result.meds) {
            await supabase.from('personal_meds').upsert({
              user_id: user.id, name: med.name,
              dose: med.dose || null, frequency: med.frequency || null,
            }, { onConflict: 'user_id,name' })
          }
        }
      } else if (mode === 'vaccines') {
        // Save to vaccine_records
        for (const vax of (result.vaccines || [])) {
          await supabase.from('vaccine_records').insert({
            user_id: user.id, profile_id: pid,
            vaccine_name: vax.name,
            date_given: vax.date || null,
            dose_number: vax.dose || null,
            notes: vax.notes || null,
            source: 'import',
          })
        }
      }
      setSaved(true)
    } catch (e: any) {
      setError('Erro ao guardar: ' + (e.message || 'tenta novamente'))
    }
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 680 }}>

        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Importar dados</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8 }}>
            Traz os teus dados para o Phlox
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            Importa medicação, análises, vacinas ou o teu registo do MySNS. O Phlox interpreta automaticamente e guarda na tua memória clínica.
          </p>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          {IMPORT_MODES.map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setResult(null); setError(''); setSaved(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: mode === m.id ? '#0f172a' : 'white', border: `1.5px solid ${mode === m.id ? '#0f172a' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: mode === m.id ? '#22c55e' : 'var(--border)', flexShrink: 0, transition: 'background 0.15s' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: mode === m.id ? 'white' : 'var(--ink)', marginBottom: 1 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: mode === m.id ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.sub}</div>
              </div>
              {m.id === 'sns' && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: mode === m.id ? '#22c55e' : '#0d6e42', background: mode === m.id ? 'rgba(34,197,94,0.15)' : '#d1fae5', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', flexShrink: 0 }}>SNS</span>
              )}
            </button>
          ))}
        </div>

        {/* SNS instructions */}
        {mode === 'sns' && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Como importar do MySNS
            </div>
            {SNS_INSTRUCTIONS.map((inst, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < SNS_INSTRUCTIONS.length - 1 ? 10 : 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1d4ed8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{inst.step}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 2 }}>{inst.title}</div>
                  <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.6, opacity: 0.8 }}>{inst.detail}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'white', borderRadius: 6, fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
              <strong>Nota:</strong> A integração directa com a API do SNS requer acordo formal com a SPMS. Por agora, a importação via PDF/texto é a forma disponível. Os dados ficam guardados no Phlox — nunca são enviados ao SNS.
            </div>
          </div>
        )}

        {/* Input area */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".txt,.pdf,.csv" style={{ display: 'none' }} onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()}
              style={{ padding: '8px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', color: 'var(--ink-2)' }}>
              Carregar ficheiro (PDF/TXT)
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-4)', alignSelf: 'center' }}>ou cola o texto directamente:</span>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={
              mode === 'meds' ? 'Ex: Ramipril 5mg 1x/dia, Metformina 1000mg 2x/dia...\nOu cola o texto de uma receita médica ou PDF de medicação.'
              : mode === 'labs' ? 'Cola aqui o texto das tuas análises clínicas (copia do PDF ou app do laboratório).\nEx: Hemoglobina: 13.2 g/dL (ref: 12.0-16.0), Glicemia: 98 mg/dL...'
              : mode === 'vaccines' ? 'Cola aqui o texto do boletim de vacinas.\nEx: BCG - 2001, Hepatite B - 2001, 2002, 2003...'
              : mode === 'sns' ? 'Cola aqui o texto copiado do PDF do MySNS ou do Portal do Utente.\nO Phlox identifica automaticamente medicação, vacinas e outros dados.'
              : 'Cola aqui o texto da receita médica...'
            }
            rows={8}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setText(''); setResult(null); setError('') }}
              style={{ padding: '8px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
              Limpar
            </button>
            <button onClick={analyse} disabled={!text.trim() || loading}
              style={{ padding: '9px 20px', background: text.trim() && !loading ? 'var(--ink)' : 'var(--bg-3)', color: text.trim() && !loading ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 7, cursor: text.trim() && !loading ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A analisar...</> : 'Analisar →'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-strip alert-strip-red" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Resultado da análise
              </div>
              {saved ? (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', padding: '3px 10px', borderRadius: 4 }}>
                  ✓ Guardado em {selectedMode.destLabel}
                </span>
              ) : (
                <button onClick={save}
                  style={{ padding: '7px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  Guardar no Phlox →
                </button>
              )}
            </div>
            <div style={{ padding: '14px 16px' }}>

              {/* Meds result */}
              {(mode === 'meds' || mode === 'prescription' || (mode === 'sns' && result.meds?.length)) && result.meds?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Medicamentos identificados ({result.meds.length})
                  </div>
                  {result.meds.map((med: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < result.meds.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{med.name}</span>
                        {med.dose && <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 8 }}>{med.dose}</span>}
                        {med.frequency && <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 6 }}>{med.frequency}</span>}
                      </div>
                      {med.indication && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{med.indication}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Labs result */}
              {(mode === 'labs' || mode === 'sns') && result.values?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Análises identificadas ({result.values.length} parâmetros)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.values.map((v: any, i: number) => {
                      const colors: Record<string, { bg: string; color: string }> = {
                        NORMAL: { bg: '#d1fae5', color: '#065f46' },
                        ALTO: { bg: '#fef9c3', color: '#854d0e' },
                        BAIXO: { bg: '#eff6ff', color: '#1e40af' },
                        CRITICO_ALTO: { bg: '#fee2e2', color: '#991b1b' },
                        CRITICO_BAIXO: { bg: '#fee2e2', color: '#991b1b' },
                      }
                      const s = colors[v.status] || colors.NORMAL
                      return (
                        <div key={i} style={{ padding: '6px 10px', background: s.bg, borderRadius: 6, minWidth: 80 }}>
                          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{v.name}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{v.value} <span style={{ fontSize: 9, fontWeight: 400 }}>{v.unit}</span></div>
                        </div>
                      )
                    })}
                  </div>
                  {result.summary && (
                    <div style={{ marginTop: 10, padding: '9px 11px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, color: '#1d4ed8', lineHeight: 1.6 }}>
                      {result.summary}
                    </div>
                  )}
                </div>
              )}

              {/* Vaccines result */}
              {mode === 'vaccines' && result.vaccines?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Vacinas identificadas ({result.vaccines.length})
                  </div>
                  {result.vaccines.map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < result.vaccines.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{v.name}</span>
                      {v.date && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{v.date}</span>}
                    </div>
                  ))}
                </div>
              )}

              {!result.meds?.length && !result.values?.length && !result.vaccines?.length && (
                <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '20px 0' }}>
                  Não foi possível identificar dados estruturados. Tenta com um texto mais completo.
                </div>
              )}
            </div>
          </div>
        )}

        {saved && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={selectedMode.dest}
              style={{ flex: 1, padding: '12px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'block' }}>
              Ver em {selectedMode.destLabel} →
            </Link>
            <button onClick={() => { setText(''); setResult(null); setSaved(false) }}
              style={{ padding: '12px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              Importar mais
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}