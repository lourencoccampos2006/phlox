'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'

interface Med { name: string; dose: string; morning: boolean; lunch: boolean; dinner: boolean; bedtime: boolean; withFood: boolean; special: string }
const SLOTS = [
  { key: 'morning' as const, label: 'Manhã',  icon: '☀️', time: '08h00', bg: '#fef9c3', border: '#fde68a', color: '#854d0e' },
  { key: 'lunch'   as const, label: 'Almoço', icon: '🌤',  time: '13h00', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  { key: 'dinner'  as const, label: 'Jantar', icon: '🌆', time: '19h00', bg: '#f0fdf5', border: '#bbf7d0', color: '#0d6e42' },
  { key: 'bedtime' as const, label: 'Deitar', icon: '🌙', time: '22h00', bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed' },
]
const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const BLANK = { name:'', dose:'', morning:false, lunch:false, dinner:false, bedtime:false, withFood:false, special:'' }

function parseFrequency(freq: string): Pick<Med, 'morning'|'lunch'|'dinner'|'bedtime'> {
  const f = (freq || '').toLowerCase()
  if (f.includes('24h') || f.includes('1x') || f.includes('uma vez')) return { morning:true, lunch:false, dinner:false, bedtime:false }
  if (f.includes('12h') || f.includes('2x') || f.includes('duas vezes')) return { morning:true, lunch:false, dinner:true, bedtime:false }
  if (f.includes('8h') || f.includes('3x') || f.includes('três vezes')) return { morning:true, lunch:true, dinner:true, bedtime:false }
  if (f.includes('6h') || f.includes('4x')) return { morning:true, lunch:true, dinner:true, bedtime:true }
  if (f.includes('manhã') || f.includes('mane')) return { morning:true, lunch:false, dinner:false, bedtime:false }
  if (f.includes('almoço')) return { morning:false, lunch:true, dinner:false, bedtime:false }
  if (f.includes('jantar') || f.includes('noite')) return { morning:false, lunch:false, dinner:true, bedtime:false }
  if (f.includes('deitar')) return { morning:false, lunch:false, dinner:false, bedtime:true }
  return { morning:true, lunch:false, dinner:false, bedtime:false }
}

export default function CalendarioMedsPage() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<Med[]>([])
  const [patientName, setPatientName] = useState('')
  const [adding, setAdding] = useState(false)
  const [newMed, setNewMed] = useState<Med>({ ...BLANK })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const p = getActiveProfile()
    if (p?.name) setPatientName(p.name)
  }, [])

  const handleProfile = async (p: any) => {
    if (p.name) setPatientName(p.name)
    setLoading(true)
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const id    = p.id === 'self' ? user?.id : p.id
    const { data } = await supabase.from(table).select('name, dose, frequency').eq(col, id)
    if (data?.length) {
      setMeds(data.map((m: any) => ({
        name: m.name, dose: m.dose || '', withFood: false, special: '',
        ...parseFrequency(m.frequency || '')
      })))
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
    if (!win) return
    const slotsHtml = SLOTS.map(slot => {
      const slotMeds = meds.filter(m => m[slot.key])
      if (!slotMeds.length) return ''
      return `<div class="slot">
        <div class="slot-header" style="background:${slot.bg};border-left:3px solid ${slot.color}">
          <span>${slot.icon}</span><span class="slot-title">${slot.label}</span><span class="slot-time">${slot.time}</span>
        </div>
        ${slotMeds.map(med => `
          <div class="med-row">
            <div>
              <span class="med-name">${med.name}</span>
              ${med.dose ? `<span class="med-dose">${med.dose}</span>` : ''}
              ${med.withFood ? '<span class="med-food">🍽 Com alimento</span>' : ''}
              ${med.special ? `<div class="med-special">${med.special}</div>` : ''}
            </div>
            <div class="days-grid">
              ${DAYS.map(d => `<div class="day-cell"><div class="day-label">${d.slice(0,3)}</div><div class="day-box"></div></div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Calendário de Medicamentos — ${patientName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#111;padding:20px;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
      .title{font-size:20px;font-family:Georgia,serif;font-weight:400;margin-top:4px}
      .tag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#888;font-family:monospace}
      .meta{font-size:11px;color:#666;text-align:right;line-height:1.6}
      .slot{margin-bottom:14px}
      .slot-header{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:4px;margin-bottom:6px}
      .slot-title{font-size:13px;font-weight:700}
      .slot-time{font-size:11px;color:#888;font-family:monospace;margin-left:auto}
      .med-row{display:flex;align-items:flex-start;justify-content:space-between;padding:7px 10px;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:3px;gap:10px}
      .med-name{font-size:14px;font-weight:700}
      .med-dose{font-size:12px;color:#555;margin-left:6px}
      .med-food{font-size:11px;color:#b45309;margin-left:8px}
      .med-special{font-size:11px;color:#888;margin-top:2px}
      .days-grid{display:grid;grid-template-columns:repeat(7,26px);gap:3px;flex-shrink:0}
      .day-cell{text-align:center}
      .day-label{font-size:8px;color:#aaa;font-family:monospace;text-transform:uppercase;margin-bottom:2px}
      .day-box{width:22px;height:22px;border:1.5px solid #333;border-radius:2px;margin:0 auto}
      .footer{margin-top:16px;padding-top:10px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;font-size:10px;color:#aaa;font-family:monospace}
    </style></head><body>
    <div class="header">
      <div><div class="tag">Calendário de Medicamentos</div><div class="title">${patientName || 'Doente'}</div></div>
      <div class="meta">${new Date().toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    ${slotsHtml}
    <div class="footer"><span>${meds.length} medicamento${meds.length!==1?'s':''}</span><span>phlox-clinical.com</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#b45309', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:2, background:'#b45309', borderRadius:1 }} />Calendário de Medicamentos
          </div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(20px,3vw,28px)', color:'var(--ink)', fontWeight:400, marginBottom:6 }}>Calendário Semanal</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6, maxWidth:540 }}>Gera um calendário visual com horários e checkboxes para cada dia. Imprime e entrega ao familiar.</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20, alignItems:'start' }} className="cal-grid">

          {/* Editor */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {user && <ProfileSelector onChange={handleProfile} />}

            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Para</div>
              <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nome do doente / familiar"
                style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
            </div>

            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
                Medicamentos {loading && <span style={{ color:'var(--green)' }}>A carregar...</span>}
              </div>
              {meds.map((med, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'7px 0', borderBottom:'1px solid var(--bg-3)', gap:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{med.name} <span style={{ fontWeight:400, color:'var(--ink-4)', fontSize:12 }}>{med.dose}</span></div>
                    <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                      {SLOTS.filter(s => med[s.key]).map(s => s.icon + ' ' + s.label).join(' · ') || '—'}
                      {med.withFood && ' · 🍽'}
                    </div>
                  </div>
                  <button onClick={() => setMeds(p => p.filter((_,idx) => idx !== i))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-5)', fontSize:18, padding:2, flexShrink:0 }}>×</button>
                </div>
              ))}
              {adding ? (
                <div style={{ marginTop:10, padding:12, background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 70px', gap:6, marginBottom:7 }}>
                    <input value={newMed.name} onChange={e => setNewMed(p=>({...p,name:e.target.value}))} placeholder="Medicamento *" autoFocus
                      style={{ border:'1.5px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
                    <input value={newMed.dose} onChange={e => setNewMed(p=>({...p,dose:e.target.value}))} placeholder="Dose"
                      style={{ border:'1.5px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 }}>
                    {SLOTS.map(s => (
                      <button key={s.key} onClick={() => setNewMed(p=>({...p,[s.key]:!p[s.key]}))}
                        style={{ padding:'5px 9px', border:`1.5px solid ${newMed[s.key]?s.color:'var(--border)'}`, borderRadius:5, background:newMed[s.key]?s.bg:'white', cursor:'pointer', fontSize:11, fontWeight:newMed[s.key]?700:400, color:newMed[s.key]?s.color:'var(--ink-3)', fontFamily:'var(--font-sans)' }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                    <button onClick={() => setNewMed(p=>({...p,withFood:!p.withFood}))}
                      style={{ padding:'5px 9px', border:`1.5px solid ${newMed.withFood?'#0d6e42':'var(--border)'}`, borderRadius:5, background:newMed.withFood?'var(--green-light)':'white', cursor:'pointer', fontSize:11, fontWeight:newMed.withFood?700:400, color:newMed.withFood?'var(--green-2)':'var(--ink-3)', fontFamily:'var(--font-sans)' }}>
                      🍽 Alimento
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={addMed} disabled={!newMed.name.trim()}
                      style={{ background:'#b45309', color:'white', border:'none', borderRadius:6, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', opacity:newMed.name.trim()?1:0.5 }}>Adicionar</button>
                    <button onClick={() => setAdding(false)}
                      style={{ background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', fontSize:12, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                  style={{ marginTop:8, width:'100%', padding:'8px', background:'transparent', border:'1.5px dashed var(--border)', borderRadius:7, cursor:'pointer', fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  + Adicionar medicamento
                </button>
              )}
            </div>

            <button onClick={handlePrint} disabled={meds.length === 0}
              style={{ padding:'12px', background:meds.length?'var(--ink)':'var(--bg-3)', color:meds.length?'white':'var(--ink-5)', border:'none', borderRadius:8, cursor:meds.length?'pointer':'not-allowed', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
              🖨 Imprimir calendário
            </button>
          </div>

          {/* Preview */}
          <div style={{ background:'white', border:'2px solid var(--ink)', borderRadius:10, padding:24, position:'sticky', top:80 }}>
            <div style={{ borderBottom:'2px solid var(--ink)', paddingBottom:12, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:3 }}>Calendário de Medicamentos</div>
                <div style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'var(--ink)', fontWeight:400 }}>{patientName || <span style={{ color:'var(--ink-5)', fontStyle:'italic' }}>Nome</span>}</div>
              </div>
              <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>{new Date().toLocaleDateString('pt-PT',{day:'numeric',month:'short'})}</div>
            </div>

            {meds.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--ink-5)' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>💊</div>
                <div style={{ fontSize:13 }}>Selecciona um perfil ou adiciona medicamentos</div>
              </div>
            ) : SLOTS.map(slot => {
              const slotMeds = meds.filter(m => m[slot.key])
              if (!slotMeds.length) return null
              return (
                <div key={slot.key} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:slot.bg, padding:'6px 10px', borderRadius:5, marginBottom:6, borderLeft:`3px solid ${slot.color}` }}>
                    <span>{slot.icon}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:slot.color }}>{slot.label}</span>
                    <span style={{ fontSize:10, color:slot.color, opacity:0.7, fontFamily:'var(--font-mono)', marginLeft:'auto' }}>{slot.time}</span>
                  </div>
                  {slotMeds.map((med, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'6px 8px', border:'1px solid var(--border)', borderRadius:4, marginBottom:3, gap:8 }}>
                      <div>
                        <span style={{ fontSize:13, fontWeight:700 }}>{med.name}</span>
                        {med.dose && <span style={{ fontSize:11, color:'var(--ink-4)', marginLeft:5 }}>{med.dose}</span>}
                        {med.withFood && <span style={{ fontSize:10, color:'#b45309', marginLeft:6 }}>🍽</span>}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,20px)', gap:2, flexShrink:0 }}>
                        {['S','T','Q','Q','S','S','D'].map((d,di) => (
                          <div key={di} style={{ textAlign:'center' }}>
                            <div style={{ fontSize:7, color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginBottom:2 }}>{d}</div>
                            <div style={{ width:16, height:16, border:'1.5px solid var(--border)', borderRadius:2, margin:'0 auto' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}

            {meds.length > 0 && (
              <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)', fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)', display:'flex', justifyContent:'space-between' }}>
                <span>{meds.length} med{meds.length!==1?'s':''}</span>
                <span>phlox-clinical.com</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:768px){.cal-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}