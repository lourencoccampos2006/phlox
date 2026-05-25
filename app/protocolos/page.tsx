'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { printDoc } from '@/lib/print'

interface Step { text: string; critical?: boolean }
interface Protocol {
  id: string; title: string; category: string; description?: string | null
  steps: Step[]; active: boolean; review_date?: string | null
}

const CATS: Record<string, { label: string; color: string }> = {
  fall:           { label: 'Quedas', color: '#dc2626' },
  pressure_ulcer: { label: 'Úlceras de pressão', color: '#b45309' },
  emergency:      { label: 'Emergência', color: '#991b1b' },
  admission:      { label: 'Admissão', color: '#0d6e42' },
  infection:      { label: 'Infeção / IACS', color: '#7c3aed' },
  restraint:      { label: 'Contenção', color: '#0891b2' },
  medication:     { label: 'Medicação', color: '#2563eb' },
  end_of_life:    { label: 'Fim de vida', color: '#64748b' },
  nutrition:      { label: 'Nutrição', color: '#16a34a' },
  other:          { label: 'Outro', color: '#374151' },
}
const CAT_KEYS = Object.keys(CATS)

// ─── Modelos clínicos PT prontos ──────────────────────────────────────────────
const TEMPLATES: Omit<Protocol, 'id' | 'active'>[] = [
  { title: 'Atuação na Queda', category: 'fall', description: 'Procedimento perante queda de residente.', steps: [
    { text: 'Não mobilizar o residente até avaliação. Avaliar estado de consciência, dor e mobilidade.', critical: true },
    { text: 'Verificar sinais de traumatismo (cabeça, anca, membros) e sinais vitais.' },
    { text: 'Se suspeita de fratura ou TCE — imobilizar e contactar 112.', critical: true },
    { text: 'Comunicar ao enfermeiro responsável e ao médico assistente.' },
    { text: 'Registar a ocorrência no Phlox (Ocorrências) com hora, local e circunstâncias.', critical: true },
    { text: 'Informar a família / representante legal.' },
    { text: 'Reavaliar escala de Morse e atualizar plano de prevenção de quedas.' },
  ]},
  { title: 'Prevenção de Úlceras de Pressão', category: 'pressure_ulcer', description: 'Medidas de prevenção segundo NPUAP/EPUAP.', steps: [
    { text: 'Avaliar risco com escala de Braden na admissão e periodicamente.', critical: true },
    { text: 'Posicionamento de 2 em 2 horas (acamados) — registar.' },
    { text: 'Superfície de apoio adequada (colchão/almofada anti-escaras) em alto risco.' },
    { text: 'Inspeção diária da pele, com foco nas proeminências ósseas.', critical: true },
    { text: 'Hidratação cutânea e manter pele seca e limpa.' },
    { text: 'Otimizar aporte nutricional e de hidratação.' },
    { text: 'Registar feridas existentes no módulo Gestão de Feridas.' },
  ]},
  { title: 'Emergência Médica / PCR', category: 'emergency', description: 'Atuação em paragem cardiorrespiratória.', steps: [
    { text: 'Confirmar inconsciência e ausência de respiração normal.', critical: true },
    { text: 'Pedir ajuda e ativar o 112 imediatamente.', critical: true },
    { text: 'Iniciar SBV — 30 compressões : 2 insuflações.', critical: true },
    { text: 'Usar DAE se disponível, seguindo as instruções.' },
    { text: 'Continuar até chegada do INEM ou recuperação.' },
    { text: 'Registar hora de início, manobras e desfecho.' },
  ]},
  { title: 'Admissão de Residente', category: 'admission', description: 'Checklist de acolhimento e avaliação inicial.', steps: [
    { text: 'Verificar documentação (identificação, declaração médica, medicação).', critical: true },
    { text: 'Criar ficha do residente no Phlox e registar medicação ativa.', critical: true },
    { text: 'Avaliação inicial: Barthel, Morse, Braden, MNA.' },
    { text: 'Registar alergias e condições clínicas relevantes.', critical: true },
    { text: 'Atribuir quarto e registar data de admissão.' },
    { text: 'Registar contactos de família / representante legal.' },
    { text: 'Elaborar plano individual de cuidados.' },
  ]},
  { title: 'Surto Infeccioso / IACS', category: 'infection', description: 'Controlo de infeção associada aos cuidados.', steps: [
    { text: 'Isolar o caso e aplicar precauções adequadas (contacto/gotícula).', critical: true },
    { text: 'Reforçar higiene das mãos e uso de EPI.', critical: true },
    { text: 'Notificar a autoridade de saúde quando aplicável.' },
    { text: 'Vigilância ativa de novos casos.' },
    { text: 'Limpeza e desinfeção reforçadas das superfícies.' },
    { text: 'Registar casos e medidas adotadas.' },
  ]},
  { title: 'Contenção Física', category: 'restraint', description: 'Uso excecional e regulado de contenção.', steps: [
    { text: 'Esgotar todas as alternativas não-restritivas primeiro.', critical: true },
    { text: 'Prescrição/indicação clínica documentada.', critical: true },
    { text: 'Consentimento informado (residente ou representante).', critical: true },
    { text: 'Monitorização e reavaliação periódica (mín. cada 2h).' },
    { text: 'Registar início, motivo, tipo e fim da contenção.' },
  ]},
  { title: 'Dupla Verificação de Medicação', category: 'medication', description: 'Segurança na administração de medicação.', steps: [
    { text: 'Confirmar os 5 certos: residente, fármaco, dose, via, hora.', critical: true },
    { text: 'Dupla verificação em fármacos de alto risco (anticoagulantes, insulina, opioides).', critical: true },
    { text: 'Verificar alergias antes de administrar.', critical: true },
    { text: 'Registar a administração no MAR, assinada.' },
    { text: 'Registar recusas e omissões com justificação.' },
  ]},
  { title: 'Cuidados em Fim de Vida', category: 'end_of_life', description: 'Conforto e dignidade na fase terminal.', steps: [
    { text: 'Priorizar controlo de sintomas (dor, dispneia, agitação).', critical: true },
    { text: 'Rever e suspender medicação não essencial.' },
    { text: 'Cuidados de conforto e higiene frequentes.' },
    { text: 'Comunicação contínua e apoio à família.', critical: true },
    { text: 'Respeitar a vontade do residente e diretivas antecipadas.', critical: true },
    { text: 'Registar plano de cuidados de conforto.' },
  ]},
]

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function ProtocolosPage() {
  const { user, supabase } = useAuth() as any
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [view, setView] = useState<Protocol | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const blank = { title: '', category: 'other', description: '', steps: [{ text: '', critical: false }] as Step[] }
  const [form, setForm] = useState<typeof blank>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('protocols').select('*').eq('user_id', user.id).order('category')
    if (error) { setTableMissing(true); setProtocols([]) }
    else { setTableMissing(false); setProtocols((data || []).map((p: any) => ({ ...p, steps: Array.isArray(p.steps) ? p.steps : [] }))) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'protocols', userId: user?.id, onChange: load })

  function openNew() { setForm(blank); setEditId(null); setShowEditor(true) }
  function openEdit(p: Protocol) { setForm({ title: p.title, category: p.category, description: p.description || '', steps: p.steps.length ? p.steps : [{ text: '', critical: false }] }); setEditId(p.id); setShowEditor(true) }
  function useTemplate(t: Omit<Protocol, 'id' | 'active'>) { setForm({ title: t.title, category: t.category, description: t.description || '', steps: t.steps }); setEditId(null); setShowTemplates(false); setShowEditor(true) }

  async function save() {
    if (!user || !form.title.trim()) return
    setSaving(true)
    const payload = { user_id: user.id, title: form.title.trim(), category: form.category, description: form.description || null, steps: form.steps.filter(s => s.text.trim()), active: true, updated_at: new Date().toISOString() }
    if (editId) await supabase.from('protocols').update(payload).eq('id', editId).eq('user_id', user.id)
    else await supabase.from('protocols').insert(payload)
    setSaving(false); setShowEditor(false); load()
  }
  async function toggleActive(p: Protocol) {
    await supabase.from('protocols').update({ active: !p.active }).eq('id', p.id).eq('user_id', user.id)
    setProtocols(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x))
  }
  async function remove(p: Protocol) {
    if (!confirm(`Eliminar o protocolo "${p.title}"?`)) return
    await supabase.from('protocols').delete().eq('id', p.id).eq('user_id', user.id)
    setView(null); load()
  }

  function printProtocol(p: Protocol) {
    printDoc({
      docTitle: p.title,
      docSubtitle: `Protocolo · ${CATS[p.category]?.label || p.category}`,
      institution: 'Lar / ERPI',
      sections: [
        ...(p.description ? [{ heading: 'Objetivo', records: [{ title: 'Descrição', body: p.description }] }] : []),
        { heading: 'Procedimento', records: [{ title: `${p.steps.length} passos`, bullets: p.steps.map((s, i) => `${i + 1}. ${s.critical ? '[CRÍTICO] ' : ''}${s.text}`) }] },
        { heading: 'Validação', records: [{ title: 'Aprovação', fields: [{ label: 'Diretor Técnico', value: '' }, { label: 'Data', value: '' }, { label: 'Revisão', value: '' }] }] },
      ],
      footerNote: 'Protocolo institucional · Phlox',
    })
  }

  // group by category
  const byCat = new Map<string, Protocol[]>()
  protocols.forEach(p => { if (!byCat.has(p.category)) byCat.set(p.category, []); byCat.get(p.category)!.push(p) })
  const orderedCats = CAT_KEYS.filter(c => byCat.has(c))

  // ── Editor field for steps ──
  const updateStep = (i: number, patch: Partial<Step>) => setForm(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, ...patch } : s) }))
  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { text: '', critical: false }] }))
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Governança clínica</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Protocolos</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Os protocolos da tua instituição — usados nos fluxos clínicos e imprimíveis.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowTemplates(true)} style={{ padding: '9px 15px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>Modelos</button>
            <button onClick={openNew} style={{ padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Protocolo</button>
          </div>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Base de dados por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>Corre <strong>supabase/sprint16_protocols.sql</strong> no SQL Editor do Supabase para ativar os protocolos.</div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}</div>
        ) : protocols.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 44, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>Sem protocolos ainda</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>Começa a partir de modelos clínicos prontos e adapta-os à tua instituição.</div>
            <button onClick={() => setShowTemplates(true)} style={{ padding: '10px 20px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)' }}>Ver modelos</button>
          </div>
        ) : (
          orderedCats.map(cat => (
            <div key={cat} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATS[cat].color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{CATS[cat].label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byCat.get(cat)!.map(p => (
                  <div key={p.id} onClick={() => setView(p)} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${CATS[cat].color}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, opacity: p.active ? 1 : 0.55 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.title}{!p.active && <span style={{ fontSize: 10, color: 'var(--ink-5)', marginLeft: 8 }}>(inativo)</span>}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{p.steps.length} passos{p.description ? ` · ${p.description}` : ''}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* VIEW */}
      {view && (
        <Modal title={view.title} onClose={() => setView(null)} wide>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: CATS[view.category]?.color, background: (CATS[view.category]?.color || '#000') + '14', padding: '3px 10px', borderRadius: 6 }}>{CATS[view.category]?.label}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => printProtocol(view)} style={{ padding: '7px 13px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>Imprimir</button>
            <button onClick={() => { openEdit(view); setView(null) }} style={{ padding: '7px 13px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#1d4ed8', fontFamily: 'var(--font-sans)' }}>Editar</button>
            <button onClick={() => toggleActive(view)} style={{ padding: '7px 13px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{view.active ? 'Desativar' : 'Ativar'}</button>
          </div>
          {view.description && <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>{view.description}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {view.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 12px', background: s.critical ? '#fef2f2' : 'var(--bg-2)', border: `1px solid ${s.critical ? '#fca5a5' : 'var(--border)'}`, borderRadius: 9 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: s.critical ? '#dc2626' : 'var(--ink-3)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{s.text}{s.critical && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginLeft: 6 }}>CRÍTICO</span>}</span>
              </div>
            ))}
          </div>
          <button onClick={() => remove(view)} style={{ marginTop: 16, padding: '8px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Eliminar protocolo</button>
        </Modal>
      )}

      {/* TEMPLATES */}
      {showTemplates && (
        <Modal title="Modelos de protocolo" onClose={() => setShowTemplates(false)} wide>
          <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 14 }}>Modelos clínicos prontos (Portugal). Escolhe um, adapta e guarda como teu.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TEMPLATES.map(t => (
              <button key={t.title} onClick={() => useTemplate(t)} style={{ textAlign: 'left', background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${CATS[t.category]?.color}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{t.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: CATS[t.category]?.color }}>{CATS[t.category]?.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{t.steps.length} passos · {t.description}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* EDITOR */}
      {showEditor && (
        <Modal title={editId ? 'Editar protocolo' : 'Novo protocolo'} onClose={() => setShowEditor(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Título *</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Atuação na Queda" style={inp} /></div>
              <div><span style={lbl}>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>{CAT_KEYS.map(c => <option key={c} value={c}>{CATS[c].label}</option>)}</select></div>
            </div>
            <div><span style={lbl}>Objetivo / descrição</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={inp} /></div>
            <div>
              <span style={lbl}>Passos do procedimento</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {form.steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-5)', width: 16, flexShrink: 0 }}>{i + 1}.</span>
                    <input value={s.text} onChange={e => updateStep(i, { text: e.target.value })} placeholder="Descreve o passo..." style={{ ...inp, flex: 1 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: s.critical ? '#dc2626' : 'var(--ink-5)', cursor: 'pointer', flexShrink: 0 }}>
                      <input type="checkbox" checked={!!s.critical} onChange={e => updateStep(i, { critical: e.target.checked })} /> crítico
                    </label>
                    <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={addStep} style={{ marginTop: 8, padding: '6px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>+ Adicionar passo</button>
            </div>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ padding: '11px', background: (!form.title.trim() || saving) ? 'var(--bg-3)' : '#0d6e42', color: (!form.title.trim() || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!form.title.trim() || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar protocolo'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: wide ? 620 : 520, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
