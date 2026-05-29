'use client'

// Conformidade & auditoria — checklist legal adaptado ao TIPO de instituição.
// RGPD, licenciamento, registos obrigatórios, segurança. Score de prontidão,
// estado por item (feito / pendente / N/A), notas e impressão para auditoria.
// Ferramenta de organização — não substitui aconselhamento jurídico.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs, INST_META } from '@/lib/useClinicPrefs'
import { checklistFor } from '@/lib/complianceChecklists'
import { printDoc } from '@/lib/print'

type Status = 'done' | 'pending' | 'na'
interface Stored { key: string; status: Status; note?: string | null; updated_at?: string }

const ST: Record<Status, { label: string; color: string; bg: string }> = {
  done:    { label: 'Conforme',  color: '#16a34a', bg: '#f0fdf4' },
  pending: { label: 'Pendente',  color: '#d97706', bg: '#fffbeb' },
  na:      { label: 'N/A',       color: '#9ca3af', bg: '#f8fafc' },
}

export default function ConformidadePage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const groups = checklistFor(institution)
  const allItems = groups.flatMap(g => g.items)

  const [state, setState] = useState<Record<string, Stored>>({})
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('compliance_items').select('key,status,note,updated_at').eq('user_id', user.id)
    if (error) { if (/relation .*compliance_items.* does not exist/i.test(error.message)) setMissing(true) }
    else {
      setMissing(false)
      const map: Record<string, Stored> = {}
      ;(data || []).forEach((r: Stored) => { map[r.key] = r })
      setState(map)
    }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function setItem(key: string, patch: Partial<Stored>) {
    const next = { ...state[key], key, ...patch } as Stored
    setState(s => ({ ...s, [key]: next }))
    await supabase.from('compliance_items').upsert({
      user_id: user.id, key, institution,
      status: next.status || 'pending', note: next.note ?? null,
      reviewed_at: new Date().toISOString(), reviewed_by: user?.name || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' })
  }

  const done = allItems.filter(i => state[i.key]?.status === 'done').length
  const na = allItems.filter(i => state[i.key]?.status === 'na').length
  const applicable = allItems.length - na
  const pct = applicable > 0 ? Math.round((done / applicable) * 100) : 0
  const pending = allItems.filter(i => (state[i.key]?.status || 'pending') === 'pending')

  const scoreColor = pct >= 90 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'

  function exportPdf() {
    printDoc({
      docTitle: 'Relatório de Conformidade',
      docSubtitle: INST_META[institution].label,
      institution: user?.name || undefined,
      meta: [
        { label: 'Prontidão', value: `${pct}%` },
        { label: 'Conformes', value: `${done}/${applicable}` },
        { label: 'Pendentes', value: String(pending.length) },
        { label: 'Data', value: new Date().toLocaleDateString('pt-PT') },
      ],
      sections: groups.map(g => ({
        heading: g.group,
        records: g.items.map(it => {
          const s = (state[it.key]?.status || 'pending') as Status
          return {
            title: it.title,
            tags: [{ label: ST[s].label, color: ST[s].color }],
            body: it.detail + (it.ref ? `  (${it.ref})` : ''),
            fields: state[it.key]?.note ? [{ label: 'Nota', value: state[it.key]!.note! }] : undefined,
          }
        }),
      })),
      footerNote: 'Ferramenta de organização interna Phlox. Não substitui aconselhamento jurídico.',
    })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Legal · {INST_META[institution].label}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Conformidade & auditoria</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Checklist adaptado ao tipo de instituição. Organiza obrigações de RGPD, licenciamento e segurança — pronto para auditoria.</p>
          </div>
          {!missing && <button onClick={exportPdf} style={{ padding: '10px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>🖨 Relatório</button>}
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Conformidade por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint32_institution_ops.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}</div>
        ) : (
          <>
            {/* Score de prontidão */}
            <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                <svg width="76" height="76" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="38" cy="38" r="32" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`} strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
                    transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: scoreColor }}>{pct}%</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>Prontidão para auditoria</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 3 }}>{done} conformes · {pending.length} pendentes{na > 0 ? ` · ${na} N/A` : ''} · {applicable} aplicáveis</div>
                {pending.length > 0 && <div style={{ fontSize: 12, color: '#d97706', marginTop: 6, fontWeight: 600 }}>A resolver primeiro: {pending.slice(0, 3).map(p => p.title).join(' · ')}</div>}
              </div>
            </div>

            {groups.map(g => (
              <div key={g.group} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0b1120', marginBottom: 8, letterSpacing: '-0.01em' }}>{g.group}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.items.map(it => {
                    const s = (state[it.key]?.status || 'pending') as Status
                    const note = state[it.key]?.note || ''
                    return (
                      <div key={it.key} style={{ ...card, padding: '13px 16px', borderLeft: `3px solid ${ST[s].color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{it.title}{it.ref && <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}> · {it.ref}</span>}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.5 }}>{it.detail}</div>
                            {note && <div style={{ fontSize: 12, color: '#475569', marginTop: 6, background: 'var(--bg-2)', borderRadius: 7, padding: '6px 10px' }}>📝 {note}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              {(['done', 'pending', 'na'] as Status[]).map(opt => (
                                <button key={opt} onClick={() => setItem(it.key, { status: opt })} style={{ fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 6, cursor: 'pointer', border: `1.5px solid ${s === opt ? ST[opt].color : 'var(--border)'}`, background: s === opt ? ST[opt].bg : 'white', color: s === opt ? ST[opt].color : 'var(--ink-5)', fontFamily: 'var(--font-sans)' }}>{ST[opt].label}</button>
                              ))}
                            </div>
                            <button onClick={() => setEditingNote(editingNote === it.key ? null : it.key)} style={{ fontSize: 11, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{note ? 'Editar nota' : '+ Nota'}</button>
                          </div>
                        </div>
                        {editingNote === it.key && (
                          <div style={{ marginTop: 10 }}>
                            <textarea defaultValue={note} rows={2} placeholder="Evidência, responsável, próxima revisão…"
                              onBlur={e => { setItem(it.key, { note: e.target.value }); setEditingNote(null) }}
                              style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} autoFocus />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, padding: '6px 0 20px' }}>
              Ferramenta de organização interna. Não substitui aconselhamento jurídico nem a regulamentação aplicável em vigor.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
