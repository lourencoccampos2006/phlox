'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import FusionTabs from '@/components/FusionTabs'
import { AuditoriaTool } from '../auditoria/page'
import { ADRReportTool } from '../adr-report/page'

// /documentos é agora a fusão "Conformidade": Documentos + Auditoria + Notificação
// RAM. Cada aba é o componente original intacto.
export default function DocumentosPage() {
  return <FusionTabs
    eyebrow="Conformidade" title="Documentos e conformidade"
    subtitle="Documentos, auditoria e notificação de reações adversas, num só sítio."
    tabs={[
      { id: 'docs', label: 'Documentos', icon: '📁', render: () => <DocumentosTool /> },
      { id: 'auditoria', label: 'Auditoria', icon: '🔍', render: () => <AuditoriaTool /> },
      { id: 'ram', label: 'Notificação RAM', icon: '⚠️', render: () => <ADRReportTool /> },
    ]} />
}

type Cat = 'contrato' | 'consentimento' | 'identificacao' | 'medico' | 'seguro' | 'rgpd' | 'financeiro' | 'outro'
interface Patient { id: string; name: string; active?: boolean }
interface Doc { id: string; patient_id?: string | null; name: string; category: Cat; file_path: string; expiry_date?: string | null; notes?: string | null; created_at: string }

const CATS: Record<Cat, { label: string; color: string }> = {
  contrato:      { label: 'Contrato', color: '#0d6e42' },
  consentimento: { label: 'Consentimento', color: '#2563eb' },
  identificacao: { label: 'Identificação', color: '#7c3aed' },
  medico:        { label: 'Médico', color: '#dc2626' },
  seguro:        { label: 'Seguro', color: '#0891b2' },
  rgpd:          { label: 'RGPD', color: '#b45309' },
  financeiro:    { label: 'Financeiro', color: '#16a34a' },
  outro:         { label: 'Outro', color: '#64748b' },
}
const CAT_KEYS = Object.keys(CATS) as Cat[]
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const daysTo = (d?: string | null) => d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null

function DocumentosTool() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [search, setSearch] = useState('')
  const [expFilter, setExpFilter] = useState<'all' | 'expiring' | 'expired'>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const blank = { patient_id: '', name: '', category: 'contrato' as Cat, expiry_date: '', notes: '' }
  const [form, setForm] = useState<any>(blank)
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [p, d] = await Promise.all([
      supabase.from('patients').select('id,name,active').eq('user_id', user.id).order('name'),
      supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    if (d.error) { setTableMissing(true); setDocs([]) } else { setTableMissing(false); setDocs(d.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['documents', 'patients'], userId: user?.id, onChange: load })

  const nameOf = (id?: string | null) => id ? (patients.find(p => p.id === id)?.name || 'Residente') : 'Instituição'

  async function save() {
    if (!user || !form.name.trim() || !file) { setErr('Nome e ficheiro são obrigatórios.'); return }
    setSaving(true); setErr('')
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
      const path = `${user.id}/${form.patient_id || 'instituicao'}/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (up) throw up
      await supabase.from('documents').insert({ user_id: user.id, patient_id: form.patient_id || null, name: form.name.trim(), category: form.category, file_path: path, expiry_date: form.expiry_date || null, notes: form.notes || null })
      setShowForm(false); setForm(blank); setFile(null); load()
    } catch (e: any) {
      setErr(e.message?.includes('Bucket') || e.message?.includes('bucket') ? 'Cria o bucket "documents" no Supabase (sprint23).' : (e.message || 'Erro ao guardar.'))
    } finally { setSaving(false) }
  }
  async function open(d: Doc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Não foi possível abrir o documento.')
  }
  async function remove(d: Doc) {
    if (!confirm(`Eliminar "${d.name}"?`)) return
    await supabase.storage.from('documents').remove([d.file_path]).catch(() => {})
    await supabase.from('documents').delete().eq('id', d.id).eq('user_id', user.id)
    load()
  }

  const matchesExp = (d: Doc, f: 'all' | 'expiring' | 'expired') => {
    if (f === 'all') return true
    const n = daysTo(d.expiry_date)
    if (n == null) return false
    return f === 'expired' ? n < 0 : (n >= 0 && n <= 30)
  }
  const filtered = docs.filter(d =>
    (!search || d.name.toLowerCase().includes(search.toLowerCase()) || nameOf(d.patient_id).toLowerCase().includes(search.toLowerCase()))
    && matchesExp(d, expFilter)
  )
  const expiring = docs.filter(d => { const n = daysTo(d.expiry_date); return n != null && n >= 0 && n <= 30 }).length
  const expired = docs.filter(d => { const n = daysTo(d.expiry_date); return n != null && n < 0 }).length

  // group by resident/instituição
  const groups = new Map<string, Doc[]>()
  filtered.forEach(d => { const k = d.patient_id || 'inst'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(d) })
  const keys = Array.from(groups.keys()).sort((a, b) => (a === 'inst' ? -1 : b === 'inst' ? 1 : nameOf(a).localeCompare(nameOf(b))))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Documental</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Documentos</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Contratos, consentimentos, RGPD e relatórios — por residente e da instituição.</p>
          </div>
          <button onClick={() => { setForm(blank); setFile(null); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Documento</button>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Documentos por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint23_documents.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {expired > 0 && <button onClick={() => setExpFilter(f => f === 'expired' ? 'all' : 'expired')} style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: expFilter === 'expired' ? '#fee2e2' : '#fef2f2', border: `1.5px solid ${expFilter === 'expired' ? '#dc2626' : '#fca5a5'}`, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{expired} expirado(s)</button>}
              {expiring > 0 && <button onClick={() => setExpFilter(f => f === 'expiring' ? 'all' : 'expiring')} style={{ fontSize: 12, fontWeight: 700, color: '#d97706', background: expFilter === 'expiring' ? '#fef3c7' : '#fffbeb', border: `1.5px solid ${expFilter === 'expiring' ? '#d97706' : '#fde68a'}`, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{expiring} a expirar (≤30d)</button>}
              {expFilter !== 'all' && <button onClick={() => setExpFilter('all')} style={{ fontSize: 12, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>limpar filtro</button>}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar documento ou residente..." style={{ ...inp, width: 260, flex: '0 1 260px', marginLeft: 'auto' }} />
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>
            ) : keys.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 36, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem documentos. Adiciona o primeiro.</div>
            ) : keys.map(k => (
              <div key={k} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{nameOf(k === 'inst' ? null : k)}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{groups.get(k)!.length}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groups.get(k)!.map(d => {
                    const cc = CATS[d.category]; const n = daysTo(d.expiry_date)
                    const exp = n != null && n < 0 ? { l: 'Expirado', c: '#dc2626', bg: '#fef2f2' } : n != null && n <= 30 ? { l: `Expira ${n}d`, c: '#d97706', bg: '#fffbeb' } : null
                    return (
                      <div key={d.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${cc.color}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{d.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: cc.color, background: cc.color + '14', padding: '1px 7px', borderRadius: 5 }}>{cc.label}</span>
                            {exp && <span style={{ fontSize: 10, fontWeight: 700, color: exp.c, background: exp.bg, padding: '1px 7px', borderRadius: 5 }}>{exp.l}</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 1 }}>{new Date(d.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}{d.expiry_date ? ` · validade ${new Date(d.expiry_date + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}` : ''}</div>
                        </div>
                        <button onClick={() => open(d)} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Abrir</button>
                        <button onClick={() => remove(d)} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '20px 22px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Novo documento</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span style={lbl}>Nome *</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Contrato de prestação de serviços" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>{CAT_KEYS.map(c => <option key={c} value={c}>{CATS[c].label}</option>)}</select></div>
                <div><span style={lbl}>Residente</span><select value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })} style={inp}><option value="">Instituição</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <div><span style={lbl}>Validade (opcional)</span><input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={inp} /></div>
              <div>
                <span style={lbl}>Ficheiro * (PDF, imagem)</span>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: '1.5px dashed var(--border)', borderRadius: 10, cursor: 'pointer', color: file ? 'var(--ink)' : 'var(--ink-4)', fontSize: 13 }}>
                  {file ? file.name : 'Escolher ficheiro'}
                  <input type="file" accept=".pdf,image/*,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
              <button onClick={save} disabled={saving || !form.name.trim() || !file} style={{ padding: '11px', background: (!form.name.trim() || !file || saving) ? 'var(--bg-3)' : '#0d6e42', color: (!form.name.trim() || !file || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!form.name.trim() || !file || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A carregar…' : 'Guardar documento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
