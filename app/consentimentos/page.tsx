'use client'

// Consentimentos & RGPD — gera, imprime e arquiva consentimentos adaptados ao tipo
// de instituição. Funciona para qualquer pessoa (mesmo sem conta Phlox): basta o nome.
// Modelos: RGPD, procedimento, imagem, vacina, serviço farmacêutico, ERPI, família.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs, INST_META } from '@/lib/useClinicPrefs'
import { consentTemplatesFor, fillConsent, type ConsentTemplate } from '@/lib/consentTemplates'
import { printDoc } from '@/lib/print'

interface Consent { id: string; person_name: string; kind: string; institution?: string | null; signed: boolean; signed_at?: string | null; created_at: string }

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function ConsentimentosPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const templates = consentTemplatesFor(institution)
  const instLabel = INST_META[institution].label

  const [tpl, setTpl] = useState<ConsentTemplate>(templates[0])
  const [name, setName] = useState('')
  const [history, setHistory] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [saved, setSaved] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('consents').select('id,person_name,kind,institution,signed,signed_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(40)
    if (error) { if (/relation .*consents.* does not exist/i.test(error.message)) setMissing(true); setHistory([]) }
    else { setMissing(false); setHistory(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useEffect(() => { setTpl(templates[0]) }, [institution]) // eslint-disable-line react-hooks/exhaustive-deps

  const filled = fillConsent(tpl.body, name, instLabel)

  function doPrint(forSign = true) {
    printDoc({
      docTitle: `Consentimento — ${tpl.label}`,
      docSubtitle: instLabel,
      meta: [
        { label: 'Nome', value: name || '________________' },
        { label: 'Data', value: new Date().toLocaleDateString('pt-PT') },
      ],
      sections: [
        { heading: 'Declaração', records: [{ title: tpl.label, body: filled }] },
        ...(forSign ? [{ heading: 'Assinaturas', records: [{
          title: '',
          fields: [
            { label: 'Assinatura do titular / representante', value: '\n\n______________________________' },
            { label: 'Profissional / instituição', value: '\n\n______________________________' },
            { label: 'Data', value: '____ / ____ / ________' },
          ],
        }] }] : []),
      ],
      footerNote: 'Documento gerado pelo Phlox. Conserve cópia assinada no processo.',
    })
  }

  async function archive() {
    if (!name.trim()) { setSaved('Indica o nome do titular antes de arquivar.'); return }
    const { data, error } = await supabase.from('consents').insert({
      user_id: user.id, person_name: name.trim(), kind: tpl.kind, institution: instLabel, body: filled, signed: false,
    }).select().single()
    if (!error && data) { setHistory(p => [data, ...p]); setSaved('Consentimento arquivado ✓'); setTimeout(() => setSaved(''), 2500) }
    else setSaved(error?.message || 'Erro ao arquivar')
  }
  async function toggleSigned(c: Consent) {
    const signed = !c.signed
    await supabase.from('consents').update({ signed, signed_at: signed ? new Date().toISOString() : null }).eq('id', c.id)
    setHistory(p => p.map(x => x.id === c.id ? { ...x, signed, signed_at: signed ? new Date().toISOString() : null } : x))
  }
  async function del(id: string) {
    await supabase.from('consents').delete().eq('id', id)
    setHistory(p => p.filter(x => x.id !== id))
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const tLabel = (k: string) => templates.find(t => t.kind === k)?.label || k

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Legal · {instLabel}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Consentimentos & RGPD</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Gera consentimentos adaptados à instituição. Funciona para qualquer pessoa — basta o nome. Imprime para assinar e arquiva.</p>
        </div>

        {missing && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>Arquivo por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Podes gerar e imprimir já. Para <strong>arquivar</strong> consentimentos, corre <strong>supabase/sprint32_institution_ops.sql</strong>.</div>
          </div>
        )}

        <div className="cons-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Esquerda: escolher modelo + nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card, padding: 14 }}>
              <span style={lbl}>Modelo</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {templates.map(t => (
                  <button key={t.kind} onClick={() => setTpl(t)} style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${tpl.kind === t.kind ? '#7c3aed' : 'var(--border)'}`, background: tpl.kind === t.kind ? '#faf5ff' : 'white', color: tpl.kind === t.kind ? '#6d28d9' : 'var(--ink-2)', fontFamily: 'var(--font-sans)' }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...card, padding: 14 }}>
              <span style={lbl}>Nome do titular / representante</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" style={inp} />
            </div>
          </div>

          {/* Direita: pré-visualização + ações */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120' }}>{tpl.icon} {tpl.label}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => doPrint(true)} style={{ padding: '8px 13px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>🖨 Imprimir p/ assinar</button>
                {!missing && <button onClick={archive} style={{ padding: '8px 13px', background: 'white', color: '#7c3aed', border: '1.5px solid #ddd6fe', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Arquivar</button>}
              </div>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65, background: 'var(--bg-2)', borderRadius: 10, padding: '14px 16px', maxHeight: 360, overflowY: 'auto' }}>{filled}</div>
            {saved && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: saved.includes('✓') ? '#16a34a' : '#dc2626' }}>{saved}</div>}
          </div>
        </div>

        {/* Arquivo */}
        {!missing && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>Arquivo de consentimentos</div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}</div>
            ) : history.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem consentimentos arquivados.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0b1120' }}>{c.person_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>{tLabel(c.kind)} · {new Date(c.created_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => toggleSigned(c)} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: `1.5px solid ${c.signed ? '#16a34a' : 'var(--border)'}`, background: c.signed ? '#f0fdf4' : 'white', color: c.signed ? '#16a34a' : 'var(--ink-5)', fontFamily: 'var(--font-sans)' }}>{c.signed ? '✓ Assinado' : 'Marcar assinado'}</button>
                      <button onClick={() => del(c.id)} style={{ fontSize: 16, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, padding: '16px 0 20px' }}>
          Modelos orientadores. Adapte ao seu contexto e valide juridicamente quando necessário.
        </div>
      </div>
      <style>{`@media (max-width: 720px){ .cons-grid { grid-template-columns: 1fr !important } }`}</style>
    </div>
  )
}
