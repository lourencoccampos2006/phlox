'use client'

import { useState, useEffect, useRef } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'

interface MedEntry {
  name: string; dose: string
  morning: boolean; lunch: boolean; dinner: boolean; bedtime: boolean
  withFood: boolean; special: string
}

const SLOTS = [
  { key: 'morning' as const, label: 'Manhã',  icon: '☀️', time: '08h00' },
  { key: 'lunch'   as const, label: 'Almoço', icon: '🌤',  time: '13h00' },
  { key: 'dinner'  as const, label: 'Jantar', icon: '🌆', time: '19h00' },
  { key: 'bedtime' as const, label: 'Deitar', icon: '🌙', time: '22h00' },
]

const BLANK: MedEntry = { name:'', dose:'', morning:false, lunch:false, dinner:false, bedtime:false, withFood:false, special:'' }

export default function NotaEntregaPage() {
  const { user, supabase } = useAuth()
  const [patientName, setPatientName] = useState('')
  const [period, setPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [contact, setContact] = useState('')
  const [caretakerName, setCaretakerName] = useState('')
  const [meds, setMeds] = useState<MedEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newMed, setNewMed] = useState<MedEntry>({ ...BLANK })
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) setCaretakerName(user.name || '')
    const p = getActiveProfile()
    if (p?.type === 'family') setPatientName(p.name)
  }, [user])

  const handleProfile = async (p: any) => {
    if (p.name) setPatientName(p.name)
    if (!supabase) return
    setLoading(true)
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const id    = p.id === 'self' ? user?.id : p.id
    const { data } = await supabase.from(table).select('name, dose, frequency').eq(col, id)
    if (data?.length) {
      setMeds(data.map((m: any) => {
        const f = (m.frequency || '').toLowerCase()
        return {
          name: m.name, dose: m.dose || '', withFood: false, special: '',
          morning: f.includes('manhã') || f.includes('8h') || f.includes('12h') || f.includes('24h'),
          lunch:   f.includes('almoço') || f.includes('12h'),
          dinner:  f.includes('jantar') || f.includes('8h'),
          bedtime: f.includes('deitar') || f.includes('noite'),
        }
      }))
    }
    setLoading(false)
  }

  const addMed = () => {
    if (!newMed.name.trim()) return
    setMeds(p => [...p, { ...newMed }])
    setNewMed({ ...BLANK })
    setAdding(false)
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win || !printRef.current) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota de Entrega — ${patientName}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; background: white; padding: 24px; font-size: 13px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
      .title { font-size: 22px; font-weight: 400; font-family: Georgia, serif; margin-top: 4px; }
      .meta { font-size: 11px; color: #666; text-align: right; line-height: 1.6; }
      .tag { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #888; font-family: monospace; }
      .slot-header { display: flex; align-items: center; gap: 8px; background: #f5f5f5; padding: 8px 12px; border-radius: 4px; margin: 14px 0 8px; border-left: 3px solid #111; }
      .slot-title { font-size: 13px; font-weight: 700; }
      .slot-time { font-size: 11px; color: #888; font-family: monospace; margin-left: auto; }
      .med-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 4px; }
      .med-name { font-size: 14px; font-weight: 700; }
      .med-dose { font-size: 12px; color: #555; margin-left: 8px; }
      .med-food { font-size: 11px; color: #b45309; margin-left: 10px; }
      .med-special { font-size: 11px; color: #888; margin-top: 2px; }
      .checkbox { width: 20px; height: 20px; border: 1.5px solid #333; border-radius: 3px; flex-shrink: 0; }
      .days-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; flex-shrink: 0; }
      .day-cell { text-align: center; }
      .day-label { font-size: 9px; color: #888; font-family: monospace; text-transform: uppercase; margin-bottom: 3px; }
      .day-box { width: 20px; height: 20px; border: 1.5px solid #333; border-radius: 3px; margin: 0 auto; }
      .notes-box { margin-top: 16px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; }
      .notes-title { font-size: 9px; font-family: monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #92400e; font-weight: 700; margin-bottom: 6px; }
      .notes-text { font-size: 13px; color: #92400e; line-height: 1.6; }
      .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; font-family: monospace; }
      .contact-box { margin-top: 14px; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; color: #555; }
    </style></head><body>
    <div class="header">
      <div>
        <div class="tag">Nota de Entrega de Medicação</div>
        <div class="title">${patientName || 'Doente'}</div>
      </div>
      <div class="meta">
        <div>${period || new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        ${caretakerName ? `<div>Responsável: <strong>${caretakerName}</strong></div>` : ''}
        ${contact ? `<div>Contacto: ${contact}</div>` : ''}
      </div>
    </div>
    ${SLOTS.map(slot => {
      const slotMeds = meds.filter(m => m[slot.key])
      if (!slotMeds.length) return ''
      return `
      <div class="slot-header">
        <span>${slot.icon}</span>
        <span class="slot-title">${slot.label}</span>
        <span class="slot-time">${slot.time}</span>
      </div>
      ${slotMeds.map(med => `
        <div class="med-row">
          <div>
            <div>
              <span class="med-name">${med.name}</span>
              ${med.dose ? `<span class="med-dose">${med.dose}</span>` : ''}
              ${med.withFood ? '<span class="med-food">🍽 Com alimento</span>' : ''}
            </div>
            ${med.special ? `<div class="med-special">${med.special}</div>` : ''}
          </div>
          <div class="days-row">
            ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => `
              <div class="day-cell">
                <div class="day-label">${d}</div>
                <div class="day-box"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}`
    }).join('')}
    ${notes ? `<div class="notes-box"><div class="notes-title">⚠️ Notas importantes</div><div class="notes-text">${notes}</div></div>` : ''}
    ${contact ? `<div class="contact-box">Em caso de dúvida: <strong>${contact}</strong></div>` : ''}
    <div class="footer">
      <span>${meds.length} medicamento${meds.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('pt-PT')}</span>
      <span>phlox-clinical.com</span>
    </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  const hasMeds = meds.length > 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#b45309', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:2, background:'#b45309', borderRadius:1 }} />Nota de Entrega de Medicação
          </div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(20px,3vw,28px)', color:'var(--ink)', fontWeight:400, marginBottom:6 }}>Nota de Entrega</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6, maxWidth:540 }}>Para quando não estás presente. Cria uma nota clara com medicamentos, horários e checkboxes por dia da semana.</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:20, alignItems:'start' }}>

          {/* ── Editor ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {user && <ProfileSelector onChange={handleProfile} />}

            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Informação</div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {[
                  [patientName, setPatientName, 'Nome do doente / familiar *'],
                  [period, setPeriod, 'Período (ex: 2 a 9 de Junho)'],
                  [caretakerName, setCaretakerName, 'Responsável pela medicação'],
                  [contact, setContact, 'Contacto de emergência (telemóvel)'],
                ].map(([val, set, ph]: any) => (
                  <input key={ph} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    style={{ border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
                ))}
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notas importantes (alergias, sinais de alerta...)" rows={2}
                  style={{ border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none', resize:'vertical' }} />
              </div>
            </div>

            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
                Medicamentos {loading && '— a carregar...'}
              </div>
              {meds.map((med, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'7px 0', borderBottom:'1px solid var(--bg-3)', gap:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{med.name} <span style={{ fontWeight:400, color:'var(--ink-4)' }}>{med.dose}</span></div>
                    <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                      {SLOTS.filter(s => med[s.key]).map(s => `${s.icon} ${s.label}`).join(' · ') || 'Sem horário definido'}
                      {med.withFood && ' · 🍽 com alimento'}
                    </div>
                  </div>
                  <button onClick={() => setMeds(p => p.filter((_,idx) => idx !== i))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-5)', fontSize:18, padding:2, flexShrink:0 }}>×</button>
                </div>
              ))}
              {adding ? (
                <div style={{ marginTop:10, padding:12, background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:6, marginBottom:8 }}>
                    <input value={newMed.name} onChange={e => setNewMed(p=>({...p,name:e.target.value}))} placeholder="Medicamento *" autoFocus
                      style={{ border:'1.5px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
                    <input value={newMed.dose} onChange={e => setNewMed(p=>({...p,dose:e.target.value}))} placeholder="Dose"
                      style={{ border:'1.5px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
                    {SLOTS.map(s => (
                      <button key={s.key} onClick={() => setNewMed(p=>({...p,[s.key]:!p[s.key]}))}
                        style={{ padding:'5px 10px', border:`1.5px solid ${newMed[s.key]?'#b45309':'var(--border)'}`, borderRadius:6, background:newMed[s.key]?'#fffbeb':'white', cursor:'pointer', fontSize:12, fontWeight:newMed[s.key]?700:400, color:newMed[s.key]?'#b45309':'var(--ink-3)', fontFamily:'var(--font-sans)' }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                    <button onClick={() => setNewMed(p=>({...p,withFood:!p.withFood}))}
                      style={{ padding:'5px 10px', border:`1.5px solid ${newMed.withFood?'#0d6e42':'var(--border)'}`, borderRadius:6, background:newMed.withFood?'var(--green-light)':'white', cursor:'pointer', fontSize:12, fontWeight:newMed.withFood?700:400, color:newMed.withFood?'var(--green-2)':'var(--ink-3)', fontFamily:'var(--font-sans)' }}>
                      🍽 Com alimento
                    </button>
                  </div>
                  <input value={newMed.special} onChange={e => setNewMed(p=>({...p,special:e.target.value}))} placeholder="Instrução especial (opcional)"
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:6, padding:'7px 10px', fontSize:12, fontFamily:'var(--font-sans)', outline:'none', marginBottom:7 }} />
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={addMed} disabled={!newMed.name.trim()}
                      style={{ background:'#b45309', color:'white', border:'none', borderRadius:6, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', opacity:newMed.name.trim()?1:0.5 }}>Adicionar</button>
                    <button onClick={() => setAdding(false)}
                      style={{ background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                  style={{ marginTop:8, width:'100%', padding:'8px', background:'transparent', border:'1.5px dashed var(--border)', borderRadius:7, cursor:'pointer', fontSize:13, color:'var(--ink-4)', fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  + Adicionar medicamento
                </button>
              )}
            </div>

            <button onClick={handlePrint} disabled={!hasMeds || !patientName}
              style={{ padding:'13px', background:hasMeds&&patientName?'var(--ink)':'var(--bg-3)', color:hasMeds&&patientName?'white':'var(--ink-5)', border:'none', borderRadius:8, cursor:hasMeds&&patientName?'pointer':'not-allowed', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              🖨 Imprimir nota de entrega
            </button>
          </div>

          {/* ── Preview ── */}
          <div ref={printRef} style={{ background:'white', border:'2px solid var(--ink)', borderRadius:10, padding:28, position:'sticky', top:80 }}>
            <div style={{ borderBottom:'2px solid var(--ink)', paddingBottom:14, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>Nota de Entrega de Medicação</div>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--ink)', fontWeight:400 }}>{patientName || <span style={{ color:'var(--ink-5)', fontStyle:'italic' }}>Nome do doente</span>}</div>
              </div>
              <div style={{ textAlign:'right', fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', lineHeight:1.7, flexShrink:0 }}>
                <div>{period || new Date().toLocaleDateString('pt-PT', { day:'numeric', month:'long' })}</div>
                {caretakerName && <div>Resp: <strong>{caretakerName}</strong></div>}
                {contact && <div>{contact}</div>}
              </div>
            </div>

            {!hasMeds ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--ink-5)' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>💊</div>
                <div style={{ fontSize:14 }}>Adiciona medicamentos para pré-visualizar</div>
              </div>
            ) : (
              <>
                {SLOTS.map(slot => {
                  const slotMeds = meds.filter(m => m[slot.key])
                  if (!slotMeds.length) return null
                  return (
                    <div key={slot.key} style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-2)', padding:'7px 10px', borderRadius:5, marginBottom:7, borderLeft:'3px solid var(--ink)' }}>
                        <span>{slot.icon}</span>
                        <span style={{ fontSize:13, fontWeight:700 }}>{slot.label}</span>
                        <span style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginLeft:'auto' }}>{slot.time}</span>
                      </div>
                      {slotMeds.map((med, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'7px 10px', border:'1px solid var(--border)', borderRadius:5, marginBottom:3, gap:10 }}>
                          <div>
                            <div>
                              <span style={{ fontSize:13, fontWeight:700 }}>{med.name}</span>
                              {med.dose && <span style={{ fontSize:12, color:'var(--ink-4)', marginLeft:6 }}>{med.dose}</span>}
                              {med.withFood && <span style={{ fontSize:11, color:'#b45309', marginLeft:8 }}>🍽</span>}
                            </div>
                            {med.special && <div style={{ fontSize:11, color:'var(--ink-4)', marginTop:2 }}>{med.special}</div>}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,22px)', gap:3, flexShrink:0 }}>
                            {['S','T','Q','Q','S','S','D'].map((d,i) => (
                              <div key={i} style={{ textAlign:'center' }}>
                                <div style={{ fontSize:8, color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginBottom:2 }}>{d}</div>
                                <div style={{ width:18, height:18, border:'1.5px solid var(--border)', borderRadius:2, margin:'0 auto' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {notes && (
                  <div style={{ marginTop:10, padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7 }}>
                    <div style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'#92400e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>⚠️ Notas importantes</div>
                    <div style={{ fontSize:12, color:'#92400e', lineHeight:1.6 }}>{notes}</div>
                  </div>
                )}
                <div style={{ marginTop:14, paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)' }}>
                  <span>Em caso de dúvida: {contact || caretakerName || '—'}</span>
                  <span>phlox-clinical.com</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}