'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'

interface Med { id:string; name:string; dose:string|null; frequency:string|null; indication:string|null; started_at:string|null }
interface EmergencyCard { name:string; allergies:string; blood_type:string; emergency_contact:string; token:string }

const PT: Record<string,string> = {
  title:'Passaporte de Saúde', name:'Nome', dob:'Data de Nasc.', blood:'Grupo Sanguíneo',
  allergies:'Alergias', emergency:'Contacto de Emergência', medications:'Medicação Atual',
  conditions:'Condições Médicas', dose:'Dose', freq:'Frequência', since:'Desde',
  generated:'Gerado em', via:'via Phlox', no_allergies:'Sem alergias conhecidas',
  no_meds:'Nenhum medicamento registado', scan:'Digitalizar para versão atualizada',
  print:'Imprimir', share:'Partilhar', edit:'Editar dados',
}
const EN: Record<string,string> = {
  title:'Health Passport', name:'Name', dob:'Date of Birth', blood:'Blood Type',
  allergies:'Allergies', emergency:'Emergency Contact', medications:'Current Medications',
  conditions:'Medical Conditions', dose:'Dose', freq:'Frequency', since:'Since',
  generated:'Generated on', via:'via Phlox', no_allergies:'No known allergies',
  no_meds:'No medications recorded', scan:'Scan for updated version',
  print:'Print', share:'Share', edit:'Edit details',
}

export default function PassportPage() {
  const { user, supabase } = useAuth()
  const [lang, setLang] = useState<'PT'|'EN'>('PT')
  const [meds, setMeds] = useState<Med[]>([])
  const [card, setCard] = useState<EmergencyCard|null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name:'', blood_type:'', allergies:'', emergency_contact:'', conditions:'' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeProfile, setActiveProfile] = useState<any>(null)

  const t = lang === 'PT' ? PT : EN

  // 2026-06-01: o utilizador reportou que o /passport não tinha selector
  // de perfil — só servia para o próprio. Agora se está num perfil familiar,
  // o passaporte carrega os dados desse perfil.
  useEffect(() => {
    if (!user) { setLoading(false); return }
    const isFamily = activeProfile?.type === 'family'
    const medsPromise = isFamily
      ? supabase.from('family_profile_meds').select('*').eq('profile_id', activeProfile.id).order('created_at', { ascending: false })
      : supabase.from('personal_meds').select('*').eq('user_id', user.id).order('started_at', { ascending: false })
    Promise.all([
      medsPromise,
      isFamily
        ? supabase.from('family_profiles').select('name, allergies, blood_type, emergency_contact').eq('id', activeProfile.id).maybeSingle()
        : supabase.from('emergency_tokens').select('*').eq('user_id', user.id).maybeSingle(),
    ]).then(async ([{ data: medsData }, { data: cardData }]) => {
      setMeds(medsData || [])
      if (cardData) {
        setCard(cardData as EmergencyCard)
        setForm({ name: cardData.name || '', blood_type: cardData.blood_type || '', allergies: cardData.allergies || '', emergency_contact: cardData.emergency_contact || '', conditions: '' })
      } else {
        const userName = (user as any).user_metadata?.full_name || user.email?.split('@')[0] || ''
        setForm(p => ({ ...p, name: userName }))
        if (userName) {
          try {
            const { data: sd } = await supabase.auth.getSession()
            const token = sd.session?.access_token
            if (token) {
              const res = await fetch('/api/emergency-card/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: userName }),
              })
              if (res.ok) {
                const created = await res.json()
                if (created.token) setCard({ name: userName, allergies: '', blood_type: '', emergency_contact: '', token: created.token })
              }
            }
          } catch {}
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, supabase, activeProfile?.id])

  const save = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token
      if (!token) { setSaveError('Sessão expirada. Recarrega a página.'); return }
      const res = await fetch('/api/emergency-card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, blood_type: form.blood_type, allergies: form.allergies, emergency_contact: form.emergency_contact }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Erro ao guardar'); return }
      if (data.token) setCard({ name: form.name, blood_type: form.blood_type, allergies: form.allergies, emergency_contact: form.emergency_contact, token: data.token })
      setEditing(false)
    } catch (e: any) {
      setSaveError(e.message || 'Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  const emergencyUrl = card?.token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/emergency/${card.token}` : null

  // 2026-06-01: guarda snapshot do passaporte (com a medicação atual) no
  // cofre — útil para ter histórico do que o utente levava em cada momento.
  async function savePassportToVault() {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const medsList = meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` · ${m.frequency}` : ''}`).join('\n')
    const text = [
      `PASSAPORTE DE SAÚDE — ${today}`,
      `Nome: ${form.name || '—'}`,
      `Grupo sanguíneo: ${form.blood_type || '—'}`,
      `Alergias: ${form.allergies || 'Sem alergias conhecidas'}`,
      `Contacto de emergência: ${form.emergency_contact || '—'}`,
      '',
      'MEDICAÇÃO ATUAL:',
      medsList || '(sem medicação registada)',
      '',
      emergencyUrl ? `Versão online atualizada: ${emergencyUrl}` : '',
    ].filter(Boolean).join('\n')
    const { error } = await supabase.from('health_vault').insert({
      user_id: user.id,
      title: `Passaporte de saúde · ${today}`,
      category: 'report',
      notes: 'Snapshot do passaporte de saúde',
      body_text: text,
      issued_at: today,
    })
    if (error) { alert(`Não foi possível guardar: ${error.message}`); return }
    alert('Passaporte guardado no cofre.')
  }

  const today = new Date().toLocaleDateString(lang === 'PT' ? 'pt-PT' : 'en-GB', { day:'2-digit', month:'long', year:'numeric' })

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ textAlign:'center', paddingTop:60 }}>
        <div style={{ fontSize:36, marginBottom:16 }}>🪪</div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--ink)', marginBottom:8 }}>Passaporte de Saúde</div>
        <div style={{ fontSize:14, color:'var(--ink-4)', marginBottom:24 }}>Inicia sessão para criar o teu passaporte de saúde personalizado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>

      {/* Controls — hidden on print */}
      <div className="no-print">

        <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
          <div className="page-container" style={{ paddingTop:24, paddingBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>Passaporte de Saúde</div>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--ink)' }}>O teu documento de saúde completo</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <ProfileSelector onChange={(p) => setActiveProfile(p)} />
                <button onClick={() => setLang(l => l==='PT'?'EN':'PT')}
                  style={{ padding:'9px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--ink)' }}>
                  {lang === 'PT' ? '🇬🇧 EN' : '🇵🇹 PT'}
                </button>
                <button onClick={() => setEditing(true)}
                  style={{ padding:'9px 14px', background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--ink)' }}>
                  ✏️ {t.edit}
                </button>
                {emergencyUrl && (
                  <button onClick={() => navigator.clipboard?.writeText(emergencyUrl)}
                    style={{ padding:'9px 14px', background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--ink)' }}>
                    🔗 {t.share}
                  </button>
                )}
                {/* 2026-06-01: novos botões — "guardar no cofre" + "versão bolso" */}
                {user && (
                  <button onClick={savePassportToVault}
                    style={{ padding:'9px 14px', background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--ink)' }}>
                    🔒 Cofre
                  </button>
                )}
                <button onClick={() => { document.body.classList.add('passport-pocket'); window.print(); document.body.classList.remove('passport-pocket') }}
                  style={{ padding:'9px 14px', background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'var(--ink)' }}>
                  👛 Versão bolso
                </button>
                <button onClick={() => window.print()}
                  style={{ padding:'9px 18px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  🖨️ {t.print}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth:720 }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:80, borderRadius:10 }} />)}
          </div>
        ) : (

        /* ─── PASSPORT CARD ─── */
        <div className="passport-card" style={{ background:'white', border:'2px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>

          {/* Header strip */}
          <div style={{ background:'#0f172a', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.5)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>Phlox · {t.title}</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'white', fontWeight:400 }}>
                {form.name || '—'}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'2px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🪪</div>
            </div>
          </div>

          {/* Critical info row */}
          <div className="passport-critical-row" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid var(--border)' }}>
            <div style={{ padding:'14px 18px', borderRight:'1px solid var(--border)', background: form.blood_type ? '#eff6ff' : 'var(--bg-2)' }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>{t.blood}</div>
              <div style={{ fontSize:20, fontWeight:700, color: form.blood_type ? '#1d4ed8' : 'var(--ink-5)', fontFamily:'var(--font-mono)' }}>
                {form.blood_type || '—'}
              </div>
            </div>
            <div style={{ padding:'14px 18px', borderRight:'1px solid var(--border)', background: form.allergies ? '#fee2e2' : 'var(--bg-2)' }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>{t.allergies}</div>
              <div style={{ fontSize:12, fontWeight:700, color: form.allergies ? '#991b1b' : 'var(--ink-5)', lineHeight:1.4 }}>
                {form.allergies || t.no_allergies}
              </div>
            </div>
            <div style={{ padding:'14px 18px', background:'var(--bg-2)' }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>{t.emergency}</div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--ink)', lineHeight:1.4 }}>
                {form.emergency_contact || '—'}
              </div>
            </div>
          </div>

          {/* Conditions */}
          {form.conditions && (
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', background:'#fffbeb' }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>{t.conditions}</div>
              <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.55 }}>{form.conditions}</div>
            </div>
          )}

          {/* Medications list */}
          <div style={{ padding:'18px 18px 0' }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>
              {t.medications} ({meds.length})
            </div>
            {meds.length === 0 ? (
              <div style={{ fontSize:13, color:'var(--ink-5)', fontStyle:'italic', padding:'12px 0' }}>{t.no_meds}</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)' }}>
                    <th style={{ textAlign:'left', padding:'6px 0', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700 }}>Medicamento</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700 }}>{t.dose}</th>
                    <th style={{ textAlign:'left', padding:'6px 8px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700 }}>{t.freq}</th>
                    <th style={{ textAlign:'left', padding:'6px 0', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, display:'table-cell' }} className="passport-since">{t.since}</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: i < meds.length-1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <td style={{ padding:'9px 0', fontWeight:700, color:'var(--ink)' }}>
                        {m.name}
                        {m.indication && <div style={{ fontSize:10, color:'var(--ink-5)', fontWeight:400, fontStyle:'italic', marginTop:1 }}>{m.indication}</div>}
                      </td>
                      <td style={{ padding:'9px 8px', color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>{m.dose || '—'}</td>
                      <td style={{ padding:'9px 8px', color:'var(--ink-3)', fontSize:11 }}>{m.frequency || '—'}</td>
                      <td style={{ padding:'9px 0', color:'var(--ink-5)', fontFamily:'var(--font-mono)', fontSize:10 }} className="passport-since">
                        {m.started_at ? new Date(m.started_at).toLocaleDateString(lang==='PT'?'pt-PT':'en-GB') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer — 2026-06-01: empilha em mobile (QR grande em cima, info por
              baixo) para o QR ser sempre digitalizável.  */}
          <div className="passport-footer" style={{ padding:'18px 18px', borderTop:'1px solid var(--border)', marginTop:16, background:'var(--bg-2)' }}>
            {emergencyUrl && (
              <div className="passport-footer-qr" style={{ textAlign:'center', marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(emergencyUrl)}`}
                  alt="QR de emergência" className="passport-qr"
                  style={{ width:160, height:160, borderRadius:8, border:'3px solid white', background:'white', boxShadow:'0 2px 10px rgba(0,0,0,0.08)' }} />
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-3)', marginTop:8, lineHeight:1.45, fontWeight: 600 }}>{t.scan}</div>
              </div>
            )}
            <div style={{ textAlign:'center', borderTop: emergencyUrl ? '1px solid var(--border)' : 'none', paddingTop: emergencyUrl ? 10 : 0 }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)' }}>{t.generated} {today} · {t.via}</div>
              {emergencyUrl && <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', marginTop:3, wordBreak:'break-all' }}>{emergencyUrl}</div>}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ─── Edit modal ─── */}
      {editing && (
        <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} className="no-print"
          onClick={() => setEditing(false)}>
          <div style={{ background:'white', borderRadius:14, padding:24, width:'100%', maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:20 }}>✏️ {t.edit}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder={t.name + ' *'}
                style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
              <input value={form.blood_type} onChange={e => setForm(p=>({...p,blood_type:e.target.value}))} placeholder={t.blood + ' (ex: A+, O-)'}
                style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
              <input value={form.allergies} onChange={e => setForm(p=>({...p,allergies:e.target.value}))} placeholder={t.allergies + ' (ex: penicilina, AAS)'}
                style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
              <input value={form.emergency_contact} onChange={e => setForm(p=>({...p,emergency_contact:e.target.value}))} placeholder={t.emergency}
                style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)' }} />
              <textarea value={form.conditions} onChange={e => setForm(p=>({...p,conditions:e.target.value}))} placeholder={t.conditions + ' (ex: HTA, DM2, FA)'}
                rows={2}
                style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none', fontFamily:'var(--font-sans)', resize:'none' }} />
            </div>
            {saveError && (
              <div style={{ marginTop:10, padding:'8px 12px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, fontSize:12, color:'#991b1b' }}>
                ⚠️ {saveError}
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={save} disabled={!form.name.trim() || saving}
                style={{ flex:1, padding:'12px', background:form.name.trim()?'var(--green)':'var(--bg-3)', color:form.name.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:form.name.trim()?'pointer':'default' }}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding:'12px 16px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:8, fontSize:14, cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important }
          body { background: white !important }
          .passport-card { box-shadow: none !important; border: 1px solid #ccc !important }
          .page-container { padding: 12px !important; max-width: 100% !important }
        }
        @media (max-width: 520px) {
          .passport-since { display: none !important }
          /* Em telemóvel, a linha crítica (grupo, alergias, contacto) empilha
             em vez de espremer em 3 colunas estreitas e ilegíveis. */
          .passport-critical-row { grid-template-columns: 1fr !important }
          .passport-critical-row > div { border-right: none !important; border-bottom: 1px solid var(--border) !important }
          .passport-critical-row > div:last-child { border-bottom: none !important }
          /* QR mais pequeno em telefones muito estreitos (mas sempre legível) */
          .passport-qr { width: 140px !important; height: 140px !important }
        }

        /* Versão bolso (A6 ~ 105×148 mm) — corta para caber na carteira.
           Activada via classe .passport-pocket no body antes de imprimir. */
        .passport-pocket .passport-card {
          max-width: 105mm !important;
          margin: 0 auto !important;
        }
        .passport-pocket .passport-since { display: none !important }
        .passport-pocket .passport-qr { width: 90px !important; height: 90px !important }

        /* Impressão normal — garante o QR digitalizável e o cartão centrado. */
        @media print {
          .passport-card { max-width: 180mm !important; margin: 0 auto !important; box-shadow: none !important; }
          .passport-qr { width: 130px !important; height: 130px !important; }
        }
        @page { margin: 8mm }
      `}</style>
    </div>
  )
}
