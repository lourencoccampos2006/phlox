'use client'

// app/carta/page.tsx — Phlox Carta
// Gerador de cartas clínicas estruturadas:
// - Carta de referenciação
// - Nota de alta
// - Carta para médico de família
// - Relatório de intervenção farmacêutica
// - Declaração de aptidão

import { useState, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type CartaType = 'referenciacao' | 'alta' | 'medico_familia' | 'intervencao_farmaceutica' | 'aptidao'

interface CartaForm {
  tipo: CartaType
  // Remetente
  from_name: string
  from_role: string
  from_institution: string
  from_service: string
  // Destinatário
  to_name: string
  to_role: string
  to_institution: string
  // Doente
  patient_name: string
  patient_dob: string
  patient_sns: string
  // Clínico
  motivo: string
  historia: string
  medicacao: string
  exames: string
  diagnostico: string
  plano: string
  notas: string
}

const CARTA_TYPES: { id: CartaType; label: string; desc: string; color: string }[] = [
  { id: 'referenciacao',          label: 'Carta de Referenciação',              desc: 'Para especialidade ou hospital. Estrutura SOAP.',              color: '#1d4ed8' },
  { id: 'alta',                   label: 'Nota de Alta',                         desc: 'Resumo de internamento, medicação de alta, follow-up.',        color: '#0d6e42' },
  { id: 'medico_familia',         label: 'Carta para MF / CSP',                  desc: 'Da especialidade para os cuidados de saúde primários.',        color: '#7c3aed' },
  { id: 'intervencao_farmaceutica', label: 'Intervenção Farmacêutica',           desc: 'Registo formal de intervenção. Formato PCNE-compatível.',     color: '#0891b2' },
  { id: 'aptidao',               label: 'Declaração de Aptidão',               desc: 'Aptidão para trabalho, desporto ou actividade específica.',     color: '#d97706' },
]

const ROLE_OPTIONS = ['Farmacêutico', 'Médico', 'Médico de Família', 'Médico Especialista', 'Enfermeiro', 'Interno', 'Nutricionista', 'Fisioterapeuta']
const SPECIALTY_OPTIONS = ['Farmácia Clínica', 'Cardiologia', 'Pneumologia', 'Neurologia', 'Gastrenterologia', 'Endocrinologia', 'Nefrologia', 'Oncologia', 'Psiquiatria', 'Ortopedia', 'Ginecologia', 'Pediatria', 'Geriatria', 'Medicina Interna', 'Urgência', 'UCI', 'Cuidados Paliativos', 'Medicina Geral e Familiar']

const EMPTY_FORM: CartaForm = {
  tipo: 'referenciacao',
  from_name: '', from_role: 'Farmacêutico', from_institution: '', from_service: '',
  to_name: '', to_role: 'Médico Especialista', to_institution: '',
  patient_name: '', patient_dob: '', patient_sns: '',
  motivo: '', historia: '', medicacao: '', exames: '', diagnostico: '', plano: '', notas: '',
}

const SEL_STYLE: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }
const INP_STYLE: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }
const TA_STYLE: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }
const LBL_STYLE: React.CSSProperties = { display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }

export default function CartaPage() {
  const { user, supabase } = useAuth()
  const [form, setForm] = useState<CartaForm>(EMPTY_FORM)
  const [carta, setCarta] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'tipo' | 'form' | 'result'>('tipo')
  const resultRef = useRef<HTMLDivElement>(null)

  const set = (k: keyof CartaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const currentType = CARTA_TYPES.find(t => t.id === form.tipo)!

  const generate = async () => {
    setLoading(true); setError(''); setCarta(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const res = await fetch('/api/carta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar carta')
      setCarta(data.carta)
      setStep('result')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!carta) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>${currentType.label} — Phlox</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.7; color: #111; padding: 32px; max-width: 780px; margin: 0 auto; }
      h1 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 11px; color: #555; }
      .section { margin-bottom: 16px; }
      .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #777; margin-bottom: 4px; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
      pre { font-family: Arial, sans-serif; white-space: pre-wrap; margin: 0; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="header">
      <div><strong>${form.from_name}</strong><br>${form.from_role}${form.from_institution ? ` · ${form.from_institution}` : ''}</div>
      <div style="text-align:right">${new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <h1>${currentType.label}</h1>
    <pre>${carta}</pre>
    <div class="footer">
      <span>Gerado com Phlox Clinical · phlox-pi.vercel.app</span>
      <span>Este documento deve ser revisto e assinado pelo profissional de saúde responsável</span>
    </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  const handleCopy = async () => {
    if (!carta) return
    await navigator.clipboard.writeText(carta)
  }

  if (step === 'tipo') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta Pro</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3.5vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>Phlox Carta</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            Cartas clínicas estruturadas em segundos. Referenciação, notas de alta, intervenção farmacêutica e mais. Geradas por AI, prontas para rever e assinar.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CARTA_TYPES.map(t => (
            <button key={t.id} onClick={() => { setForm(p => ({ ...p, tipo: t.id })); setStep('form') }}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s, box-shadow 0.12s', borderLeft: `4px solid ${t.color}` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderLeftColor = t.color }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, letterSpacing: '-0.01em' }}>{t.label}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>{t.desc}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (step === 'form') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <button onClick={() => setStep('tipo')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: `${currentType.color}15`, border: `1px solid ${currentType.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={currentType.color} strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>{currentType.label}</h1>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 2 }}>{currentType.desc}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Remetente */}
          <section>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />Remetente<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={LBL_STYLE}>Nome</label><input style={INP_STYLE} value={form.from_name} onChange={set('from_name')} placeholder="Dr. João Silva" /></div>
              <div><label style={LBL_STYLE}>Função</label><select style={SEL_STYLE} value={form.from_role} onChange={set('from_role')}>{ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}</select></div>
              <div><label style={LBL_STYLE}>Instituição</label><input style={INP_STYLE} value={form.from_institution} onChange={set('from_institution')} placeholder="Hospital / Farmácia / Clínica" /></div>
              <div><label style={LBL_STYLE}>Serviço / Especialidade</label><select style={SEL_STYLE} value={form.from_service} onChange={set('from_service')}><option value="">—</option>{SPECIALTY_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
          </section>

          {/* Destinatário */}
          <section>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />Destinatário<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={LBL_STYLE}>Nome (opcional)</label><input style={INP_STYLE} value={form.to_name} onChange={set('to_name')} placeholder="Ex.mo(a) Sr(a) Dr(a)..." /></div>
              <div><label style={LBL_STYLE}>Função / Especialidade</label><select style={SEL_STYLE} value={form.to_role} onChange={set('to_role')}>{ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}</select></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={LBL_STYLE}>Instituição de destino</label><input style={INP_STYLE} value={form.to_institution} onChange={set('to_institution')} placeholder="Hospital, centro de saúde, farmácia..." /></div>
            </div>
          </section>

          {/* Doente */}
          <section>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />Dados do Doente<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={LBL_STYLE}>Nome completo</label><input style={INP_STYLE} value={form.patient_name} onChange={set('patient_name')} placeholder="Nome completo do doente" /></div>
              <div><label style={LBL_STYLE}>Data de nascimento</label><input style={INP_STYLE} type="date" value={form.patient_dob} onChange={set('patient_dob')} /></div>
              <div><label style={LBL_STYLE}>Nº SNS (opcional)</label><input style={INP_STYLE} value={form.patient_sns} onChange={set('patient_sns')} placeholder="000 000 000" /></div>
            </div>
          </section>

          {/* Clínico */}
          <section>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />Informação Clínica<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={LBL_STYLE}>
                  {form.tipo === 'referenciacao' ? 'Motivo da referenciação' : form.tipo === 'intervencao_farmaceutica' ? 'Problema identificado' : 'Motivo principal'}
                </label>
                <input style={INP_STYLE} value={form.motivo} onChange={set('motivo')} placeholder={form.tipo === 'referenciacao' ? 'Ex: Avaliação de sopro cardíaco / Controlo de HTA resistente' : form.tipo === 'intervencao_farmaceutica' ? 'Ex: Interacção grave entre varfarina e ibuprofeno detectada' : 'Motivo principal da carta'} />
              </div>
              <div>
                <label style={LBL_STYLE}>
                  {form.tipo === 'alta' ? 'Resumo do internamento' : 'História clínica relevante'}
                </label>
                <textarea style={{ ...TA_STYLE, minHeight: 100 }} value={form.historia} onChange={set('historia')} rows={4}
                  placeholder={form.tipo === 'alta' ? 'Motivo de internamento, evolução, intercorrências...' : 'Antecedentes relevantes, diagnósticos activos, história da doença actual...'} />
              </div>
              <div>
                <label style={LBL_STYLE}>Medicação actual</label>
                <textarea style={{ ...TA_STYLE, minHeight: 80 }} value={form.medicacao} onChange={set('medicacao')} rows={3}
                  placeholder={'Varfarina 5mg 1x/dia\nMetoprolol 50mg 2x/dia\nFurosemida 40mg 1x/dia'} />
              </div>
              {form.tipo !== 'aptidao' && (
                <div>
                  <label style={LBL_STYLE}>Exames complementares relevantes</label>
                  <textarea style={{ ...TA_STYLE, minHeight: 70 }} value={form.exames} onChange={set('exames')} rows={3}
                    placeholder={'INR: 3.2 (06/01/2026)\nECO cardíaco: FE 45%, IT moderada\nTFG: 52 mL/min'} />
                </div>
              )}
              <div>
                <label style={LBL_STYLE}>
                  {form.tipo === 'intervencao_farmaceutica' ? 'Diagnóstico / Problema farmacoterapêutico' : 'Diagnóstico(s) activo(s)'}
                </label>
                <input style={INP_STYLE} value={form.diagnostico} onChange={set('diagnostico')} placeholder={form.tipo === 'intervencao_farmaceutica' ? 'Ex: Risco de hemorragia por interacção AINE+anticoagulante' : 'Ex: HTA, IC-FEr (FE 45%), DM2'} />
              </div>
              <div>
                <label style={LBL_STYLE}>
                  {form.tipo === 'alta' ? 'Plano de alta e seguimento' : form.tipo === 'intervencao_farmaceutica' ? 'Intervenção proposta / efectuada' : 'Pedido / Proposta terapêutica'}
                </label>
                <textarea style={{ ...TA_STYLE, minHeight: 80 }} value={form.plano} onChange={set('plano')} rows={3}
                  placeholder={form.tipo === 'alta' ? 'Alta com medicação descrita. Consulta externa em 4 semanas. Reavaliação de função renal em 2 semanas.' : form.tipo === 'intervencao_farmaceutica' ? 'Substituição de ibuprofeno por paracetamol 1g. Comunicado ao médico prescritor. INR a rever em 1 semana.' : 'Solicito avaliação/consulta de...'} />
              </div>
              <div>
                <label style={LBL_STYLE}>Notas adicionais (opcional)</label>
                <textarea style={{ ...TA_STYLE }} value={form.notas} onChange={set('notas')} rows={2} placeholder="Urgência, observações especiais, contacto para dúvidas..." />
              </div>
            </div>
          </section>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginTop: 20, fontSize: 13, color: '#991b1b' }}>{error}</div>
        )}

        <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
          <button onClick={generate} disabled={loading || !form.motivo || !form.patient_name}
            style={{ flex: 1, padding: '14px', background: loading || !form.motivo || !form.patient_name ? 'var(--bg-3)' : currentType.color, color: loading || !form.motivo || !form.patient_name ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading || !form.motivo || !form.patient_name ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', transition: 'background 0.15s' }}>
            {loading ? 'A gerar carta...' : `Gerar ${currentType.label}`}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
          Gerado por AI · Rever sempre antes de assinar e enviar
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => setStep('form')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Editar dados
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopy}
              style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copiar
            </button>
            <button onClick={handlePrint}
              style={{ padding: '9px 16px', background: currentType.color, border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
          </div>
        </div>

        <div ref={resultRef} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header da carta */}
          <div style={{ borderTop: `4px solid ${currentType.color}`, padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>{currentType.label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400 }}>{form.from_name || 'Profissional de Saúde'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{form.from_role}{form.from_institution ? ` · ${form.from_institution}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  {new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                {form.patient_name && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>Doente: {form.patient_name}</div>}
              </div>
            </div>
          </div>

          {/* Corpo */}
          <div style={{ padding: '28px', fontFamily: 'var(--font-sans)' }}>
            <pre style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--ink)', margin: 0 }}>
              {carta}
            </pre>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Gerado por Phlox Clinical · Rever antes de assinar</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>_________________________<br />Assinatura</div>
          </div>
        </div>
      </div>
    </div>
  )
}