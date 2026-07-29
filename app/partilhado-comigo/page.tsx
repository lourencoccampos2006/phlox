'use client'

// /partilhado-comigo — Convite de Partilha, lado do VIEWER/EDITOR (item B9 da
// auditoria, alargado no sprint121 com "gestão a dois"). Resgatar um código de
// outra pessoa (dono do perfil) dá acesso a ver medicação/vitais/sintomas —
// e, se o dono escolheu o papel "gere comigo", também a adicionar medicação e
// registar vitais/sintomas, tal como o dono. Não precisa de ser Pro para
// aceitar (só o dono precisa de ser Pro para convidar).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#1d4ed8'
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }
const inputStyle: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }

interface Shared { profile_id: string; name: string; relation: string | null; role: 'viewer' | 'editor' }
interface Med { id?: string; name: string; dose?: string; frequency?: string }
interface Vital { id?: string; recorded_at: string; bp_sys?: number; bp_dia?: number; hr?: number; weight?: number; glucose?: number }
interface Symptom { id?: string; at: string; symptoms?: string[]; pain?: number; notes?: string }
interface ViewData {
  profile: { name: string; relation?: string; age?: number; sex?: string; conditions?: string; allergies?: string; notes?: string }
  meds: Med[]
  vitals: Vital[]
  symptoms: Symptom[]
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

const emptyMedForm = { name: '', dose: '', frequency: '' }
const emptyVitalForm = { bp_sys: '', bp_dia: '', weight: '', glucose: '' }
const emptySymptomForm = { symptoms: '', pain: '', notes: '' }

export default function PartilhadoComigoPage() {
  const { user, supabase } = useAuth() as any
  const [shared, setShared] = useState<Shared[] | null>(null)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewData, setViewData] = useState<Record<string, ViewData>>({})
  const [tab, setTab] = useState<Record<string, 'ver' | 'medicacao' | 'vitais' | 'sintomas'>>({})
  const [medForm, setMedForm] = useState(emptyMedForm)
  const [vitalForm, setVitalForm] = useState(emptyVitalForm)
  const [symptomForm, setSymptomForm] = useState(emptySymptomForm)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')

  async function auth() { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || '' }

  const load = useCallback(async () => {
    if (!user) return
    const res = await fetch('/api/family-share/mine', { headers: { Authorization: `Bearer ${await auth()}` } })
    if (res.ok) { const j = await res.json(); setShared(j.shared || []) }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function redeem() {
    if (!code.trim()) return
    setRedeeming(true); setErr('')
    try {
      const res = await fetch('/api/family-share/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({ code: code.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Código inválido')
      setCode('')
      load()
    } catch (e: any) { setErr(e.message || 'Erro ao resgatar o código.') }
    finally { setRedeeming(false) }
  }

  function isEditor(profileId: string) { return shared?.find(s => s.profile_id === profileId)?.role === 'editor' }

  async function fetchData(profileId: string) {
    const endpoint = isEditor(profileId) ? `/api/family-share/manage?profile_id=${profileId}` : `/api/family-share/view?profile_id=${profileId}`
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${await auth()}` } })
    if (res.ok) { const j = await res.json(); setViewData(prev => ({ ...prev, [profileId]: j })) }
  }

  async function expand(profileId: string) {
    if (expanded === profileId) { setExpanded(null); return }
    setExpanded(profileId)
    if (!tab[profileId]) setTab(prev => ({ ...prev, [profileId]: 'ver' }))
    if (!viewData[profileId]) await fetchData(profileId)
  }

  async function addMed(profileId: string) {
    if (!medForm.name.trim()) return
    setSaving(true); setFormErr('')
    try {
      const res = await fetch('/api/family-share/med', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({ profile_id: profileId, ...medForm }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setMedForm(emptyMedForm)
      await fetchData(profileId)
    } catch (e: any) { setFormErr(e.message || 'Não foi possível adicionar.') }
    finally { setSaving(false) }
  }

  async function removeMed(profileId: string, medId?: string) {
    if (!medId) return
    await fetch('/api/family-share/med', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
      body: JSON.stringify({ profile_id: profileId, med_id: medId }),
    })
    await fetchData(profileId)
  }

  async function addVital(profileId: string) {
    if (!vitalForm.bp_sys && !vitalForm.bp_dia && !vitalForm.weight && !vitalForm.glucose) { setFormErr('Indica pelo menos um valor.'); return }
    setSaving(true); setFormErr('')
    try {
      const res = await fetch('/api/family-share/vital', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({ profile_id: profileId, ...vitalForm }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setVitalForm(emptyVitalForm)
      await fetchData(profileId)
    } catch (e: any) { setFormErr(e.message || 'Não foi possível registar.') }
    finally { setSaving(false) }
  }

  async function addSymptom(profileId: string) {
    if (!symptomForm.symptoms.trim() && !symptomForm.pain && !symptomForm.notes.trim()) { setFormErr('Indica pelo menos um sintoma, dor ou nota.'); return }
    setSaving(true); setFormErr('')
    try {
      const res = await fetch('/api/family-share/symptom', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({
          profile_id: profileId,
          symptoms: symptomForm.symptoms.split(',').map(s => s.trim()).filter(Boolean),
          pain: symptomForm.pain || null,
          notes: symptomForm.notes || null,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setSymptomForm(emptySymptomForm)
      await fetchData(profileId)
    } catch (e: any) { setFormErr(e.message || 'Não foi possível registar.') }
    finally { setSaving(false) }
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <a href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</a>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #1e3a8a)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Partilhado comigo</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 580, lineHeight: 1.5 }}>Perfis de família que outra pessoa te deu acesso a ver — ou a gerir a dois, se ela te deu esse papel.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Tens um código de convite?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: A1B2C3D4"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={redeem} disabled={redeeming} style={{ padding: '9px 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: redeeming ? 'wait' : 'pointer' }}>
              {redeeming ? '…' : 'Resgatar'}
            </button>
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</div>}
        </div>

        {shared === null ? (
          <div className="skeleton" style={{ height: 100, borderRadius: 12 }} />
        ) : shared.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Ainda ninguém partilhou um perfil contigo.</div>
        ) : (
          shared.map(s => {
            const vd = viewData[s.profile_id]
            const isOpen = expanded === s.profile_id
            const editor = s.role === 'editor'
            const activeTab = tab[s.profile_id] || 'ver'
            return (
              <div key={s.profile_id} style={card}>
                <button onClick={() => expand(s.profile_id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{s.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: editor ? '#0f766e' : '#64748b', background: editor ? '#f0fdfa' : '#f1f5f9', border: `1px solid ${editor ? '#99f6e4' : '#e2e8f0'}`, borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {editor ? 'Geres a dois' : 'Só vês'}
                      </span>
                    </div>
                    {s.relation && <div style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>{s.relation}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{isOpen ? '▲ Fechar' : '▼ Ver'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!vd ? (
                      <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
                    ) : (
                      <>
                        {editor && (
                          <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--bg-3)', paddingBottom: 8, flexWrap: 'wrap' }}>
                            {([['ver', 'Ver'], ['medicacao', 'Medicação'], ['vitais', 'Vitais'], ['sintomas', 'Sintomas']] as const).map(([id, label]) => (
                              <button key={id} onClick={() => { setTab(prev => ({ ...prev, [s.profile_id]: id })); setFormErr('') }} style={{
                                padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                                background: activeTab === id ? 'var(--ink)' : 'var(--bg-2)', color: activeTab === id ? 'white' : 'var(--ink-4)',
                              }}>{label}</button>
                            ))}
                          </div>
                        )}

                        {activeTab === 'ver' && (
                          <>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                              {vd.profile.age && <span>{vd.profile.age} anos · </span>}
                              {vd.profile.allergies && <span style={{ color: '#dc2626' }}>⚠ Alergias: {vd.profile.allergies} · </span>}
                              {vd.profile.conditions && <span>Condições: {vd.profile.conditions}</span>}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>💊 Medicação ({vd.meds.length})</div>
                              {vd.meds.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem medicação registada.</div> :
                                vd.meds.map((m, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {m.name}{m.dose ? ` — ${m.dose}` : ''}{m.frequency ? ` (${m.frequency})` : ''}</div>)}
                            </div>
                            {vd.vitals.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>📈 Vitais recentes</div>
                                {vd.vitals.slice(0, 5).map((v, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--ink-4)', minWidth: 60 }}>{timeAgo(v.recorded_at)}</span>
                                    {v.bp_sys != null && <span>🩸 {v.bp_sys}/{v.bp_dia ?? '—'}</span>}
                                    {v.weight != null && <span>⚖️ {v.weight}kg</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {vd.symptoms.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>📝 Sintomas recentes</div>
                                {vd.symptoms.slice(0, 5).map((sm, i) => (
                                  <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--ink-4)' }}>{timeAgo(sm.at)}: </span>
                                    {sm.symptoms?.length ? sm.symptoms.join(', ') : 'sem sintomas descritos'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {editor && activeTab === 'medicacao' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {vd.meds.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem medicação registada.</div>}
                              {vd.meds.map(m => (
                                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)', borderRadius: 7, padding: '8px 10px' }}>
                                  <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{m.name}{m.dose ? ` — ${m.dose}` : ''}{m.frequency ? ` (${m.frequency})` : ''}</span>
                                  <button onClick={() => removeMed(s.profile_id, m.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16 }}>×</button>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 6 }}>
                              <input value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome *" style={inputStyle} />
                              <input value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} placeholder="Dose" style={inputStyle} />
                              <input value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))} placeholder="Frequência" style={inputStyle} />
                            </div>
                            {formErr && <div style={{ fontSize: 12, color: '#dc2626' }}>{formErr}</div>}
                            <button onClick={() => addMed(s.profile_id)} disabled={saving || !medForm.name.trim()} style={{ padding: '9px 14px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                              {saving ? 'A guardar…' : '+ Adicionar medicamento'}
                            </button>
                          </div>
                        )}

                        {editor && activeTab === 'vitais' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {vd.vitals.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem registos.</div>}
                              {vd.vitals.slice(0, 5).map((v, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--bg-2)', borderRadius: 7, padding: '8px 10px' }}>
                                  <span style={{ color: 'var(--ink-4)', minWidth: 60 }}>{timeAgo(v.recorded_at)}</span>
                                  {v.bp_sys != null && <span>🩸 {v.bp_sys}/{v.bp_dia ?? '—'}</span>}
                                  {v.weight != null && <span>⚖️ {v.weight}kg</span>}
                                  {v.glucose != null && <span>🩸 {v.glucose}mg/dL</span>}
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                              <input value={vitalForm.bp_sys} onChange={e => setVitalForm(f => ({ ...f, bp_sys: e.target.value.replace(/\D/g, '') }))} placeholder="TA sist." inputMode="numeric" style={inputStyle} />
                              <input value={vitalForm.bp_dia} onChange={e => setVitalForm(f => ({ ...f, bp_dia: e.target.value.replace(/\D/g, '') }))} placeholder="TA diast." inputMode="numeric" style={inputStyle} />
                              <input value={vitalForm.weight} onChange={e => setVitalForm(f => ({ ...f, weight: e.target.value }))} placeholder="Peso kg" inputMode="decimal" style={inputStyle} />
                              <input value={vitalForm.glucose} onChange={e => setVitalForm(f => ({ ...f, glucose: e.target.value }))} placeholder="Glicemia" inputMode="decimal" style={inputStyle} />
                            </div>
                            {formErr && <div style={{ fontSize: 12, color: '#dc2626' }}>{formErr}</div>}
                            <button onClick={() => addVital(s.profile_id)} disabled={saving} style={{ padding: '9px 14px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                              {saving ? 'A guardar…' : '+ Registar vitais'}
                            </button>
                          </div>
                        )}

                        {editor && activeTab === 'sintomas' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {vd.symptoms.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem registos.</div>}
                              {vd.symptoms.slice(0, 5).map((sm, i) => (
                                <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--bg-2)', borderRadius: 7, padding: '8px 10px' }}>
                                  <span style={{ color: 'var(--ink-4)' }}>{timeAgo(sm.at)}: </span>
                                  {sm.symptoms?.length ? sm.symptoms.join(', ') : 'sem sintomas descritos'}{sm.pain != null ? ` · dor ${sm.pain}/10` : ''}
                                </div>
                              ))}
                            </div>
                            <input value={symptomForm.symptoms} onChange={e => setSymptomForm(f => ({ ...f, symptoms: e.target.value }))} placeholder="Sintomas, separados por vírgula" style={inputStyle} />
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
                              <input value={symptomForm.pain} onChange={e => setSymptomForm(f => ({ ...f, pain: e.target.value.replace(/\D/g, '') }))} placeholder="Dor 0-10" inputMode="numeric" style={inputStyle} />
                              <input value={symptomForm.notes} onChange={e => setSymptomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas (opcional)" style={inputStyle} />
                            </div>
                            {formErr && <div style={{ fontSize: 12, color: '#dc2626' }}>{formErr}</div>}
                            <button onClick={() => addSymptom(s.profile_id)} disabled={saving} style={{ padding: '9px 14px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                              {saving ? 'A guardar…' : '+ Registar sintoma'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
