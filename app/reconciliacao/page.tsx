'use client'

// ─── NOVO: app/reconciliacao/page.tsx ───
// Reconciliação Medicamentosa — Pro+
// Compara lista de medicamentos antes/depois de internamento ou mudança de serviço.
// Identifica discrepâncias, omissões e adições não justificadas.

import { useState, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import ProfileSelector from '@/components/ProfileSelector'
import { extractFromFile } from '@/lib/docExtract'
import { lerMedsDoPerfil, medsComoTexto } from '@/lib/medsDoPerfil'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Discrepancy {
  type: 'added' | 'removed' | 'dose_changed' | 'frequency_changed' | 'intentional_omission'
  drug: string
  before: string
  after: string
  severity: 'critical' | 'moderate' | 'low'
  action_required: string
  justification_needed: boolean
}

interface ReconciliationResult {
  summary: string
  discrepancies: Discrepancy[]
  unintentional_omissions: string[]
  therapeutic_duplications: string[]
  recommendations: string[]
  reconciliation_complete: boolean
}

const DISC_STYLE = {
  critical: { bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', color: 'var(--red)', label: 'CRÍTICO', icon: 'alert' },
  moderate: { bg: 'var(--amber-light)', border: 'var(--badge-amber-border)', color: 'var(--badge-amber-fg)', label: 'MODERADO', icon: '⚠️' },
  low:      { bg: 'var(--green-light)', border: 'var(--green-mid)', color: 'var(--green-3)', label: 'INFO',     icon: 'ℹ️' },
}

const TYPE_LABELS = {
  added:                 { label: 'Adicionado',           icon: '➕', color: 'var(--green)' },
  removed:               { label: 'Removido',             icon: '➖', color: 'var(--red)' },
  dose_changed:          { label: 'Dose alterada',        icon: 'refresh', color: 'var(--amber)' },
  frequency_changed:     { label: 'Frequência alterada',  icon: 'clock',  color: 'var(--ink-2)' },
  intentional_omission:  { label: 'Omissão intencional',  icon: '⏸',  color: 'var(--roxo)' },
}

const EXAMPLES = {
  before: `Metformina 1000mg 2x/dia\nRamipril 5mg 1x/dia\nAtovastatina 20mg à noite\nAspirin 100mg 1x/dia\nOmeprazol 20mg 1x/dia`,
  after:  `Metformina 500mg 2x/dia\nEnalapril 10mg 2x/dia\nAtovastatina 40mg à noite\nHeparina BPMW 40mg SC 1x/dia\nOmeprazol 40mg 1x/dia\nFurosemida 40mg 1x/dia`,
}

export default function ReconciliacaoPage() {
  const { user, supabase } = useAuth()
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [decisions, setDecisions] = useState<Record<number, 'approved' | 'rejected'>>({})
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({})
  const [copied, setCopied] = useState(false)
  const [scanning, setScanning] = useState<'before' | 'after' | ''>('')
  const beforeFileRef = useRef<HTMLInputElement>(null)
  const afterFileRef = useRef<HTMLInputElement>(null)

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  // Foto da nota de alta / receita antiga → extrai a lista automaticamente.
  // O profissional não escreve nada: aponta a câmara e o Phlox preenche o lado.
  const onScan = (side: 'before' | 'after') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setScanning(side); setError('')
    try {
      let payload: any
      if (file.type.startsWith('image/')) {
        const b64 = await new Promise<string>((res, rej) => {
          const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = rej; rd.readAsDataURL(file)
        })
        payload = { image: b64, mimeType: file.type }
      } else {
        const ex = await extractFromFile(file)
        if (!ex.text || ex.text.trim().length < 10) throw new Error('Documento sem texto legível.')
        payload = { text: ex.text }
      }
      const r = await fetch('/api/receita-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui ler.')
      const lines = (j.meds || []).map((m: any) => `${m.name || ''}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`.trim()).filter(Boolean)
      if (!lines.length) throw new Error('Não identifiquei medicamentos. Tenta uma imagem mais nítida.')
      const text = lines.join('\n')
      if (side === 'before') setBefore(b => b.trim() ? b.trim() + '\n' + text : text)
      else setAfter(a => a.trim() ? a.trim() + '\n' + text : text)
      if (j.warning) setError(j.warning)
    } catch (err: any) { setError(err.message || 'Erro ao ler a imagem.') } finally { setScanning('') }
  }

  const handleProfile = async (p: any) => {
    if (!supabase) return
    const leitura = await lerMedsDoPerfil(supabase, p, (user as any)?.id, { codigo: 'reconciliacao-meds' })
    if (leitura.falhou) {
      // Numa reconciliação, uma lista "antes" vazia por engano faz parecer que
      // toda a medicação é nova. Mais vale dizer que não se leu.
      setError(leitura.aviso)
      return
    }
    if (leitura.meds.length) setBefore(medsComoTexto(leitura.meds))
  }

  const reconcile = async () => {
    if (!before.trim() || !after.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/reconciliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ before: before.trim(), after: after.trim(), context: context.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const decide = (i: number, v: 'approved' | 'rejected') => setDecisions(d => ({ ...d, [i]: d[i] === v ? undefined as any : v }))

  const exportNote = () => {
    if (!result) return
    const date = new Date().toLocaleDateString('pt-PT')
    const lines = [
      `RECONCILIAÇÃO MEDICAMENTOSA — ${date}`,
      context ? `Contexto: ${context}` : '',
      '',
      result.summary,
      '',
      `DISCREPÂNCIAS (${result.discrepancies.length}):`,
      ...result.discrepancies.map((d, i) => {
        const dec = decisions[i]
        const note = decisionNotes[i]
        const decLabel = dec === 'approved' ? ' [ACEITE]' : dec === 'rejected' ? ' [RECUSADO]' : ' [PENDENTE]'
        return `• ${TYPE_LABELS[d.type].label} — ${d.drug}${decLabel}${note ? ` — Nota: ${note}` : ''}\n  ${d.action_required}`
      }),
      result.unintentional_omissions.length ? `\nOMISSÕES NÃO INTENCIONAIS:\n${result.unintentional_omissions.map(o => `• ${o}`).join('\n')}` : '',
      result.therapeutic_duplications.length ? `\nDUPLICAÇÕES TERAPÊUTICAS:\n${result.therapeutic_duplications.map(d => `• ${d}`).join('\n')}` : '',
      `\nRECOMENDAÇÕES:\n${result.recommendations.map(r => `→ ${r}`).join('\n')}`,
      `\nGerado via Phlox Reconciliação · ${date}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(lines)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!isPro) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>

      <div className="page-container page-body" style={{ maxWidth:480, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius: 'var(--r-xl)', padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize: 'var(--t-destaque)', color:'var(--ink)', marginBottom:12 }}>Reconciliação Medicamentosa</div>
          <p style={{ fontSize: 'var(--t-corpo)', color:'var(--ink-4)', lineHeight:1.7, marginBottom:24 }}>
            Compara medicação antes e depois de internamento. Identifica discrepâncias, omissões não intencionais e duplicações terapêuticas.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'var(--ink-2)', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>
            Activar Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Reconciliação</span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Foto à nota de alta e à medicação anterior — ou cole as listas</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Dizemos o que mudou, o que foi omitido por engano e o que precisa de justificação
          </span>
        </BarraDeEstado>
      }
    >
      <div>
        {/* O título estava escrito DUAS VEZES seguidas — em migalha e em
            serifa de 28px — e depois explicado num parágrafo. Um título
            repetido a dois tamanhos é o sinal mais claro de um cabeçalho
            que ninguém leu em voz alta. */}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }} className="reconcil-grid">

          {/* Antes */}
          <div>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--green)' }} />
              Medicação ANTES do internamento
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
              {user && <div style={{ flex:1, minWidth:140 }}><ProfileSelector onChange={handleProfile} /></div>}
              <button type="button" onClick={() => beforeFileRef.current?.click()} disabled={!!scanning}
                style={{ padding:'8px 14px', background:'white', color:'var(--green)', border:'1.5px solid var(--green-mid)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer', whiteSpace:'nowrap' }}>
                {scanning==='before' ? 'A ler…' : '📷 Foto da lista'}
              </button>
              <input ref={beforeFileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" onChange={onScan('before')} style={{ display:'none' }} />
            </div>
            <textarea value={before} onChange={e => setBefore(e.target.value)}
              placeholder="Um medicamento por linha&#10;Ex: Metformina 1000mg 2x/dia&#10;    Ramipril 5mg 1x/dia"
              rows={10}
              style={{ width:'100%', border:'1.5px solid var(--green-mid)', borderRadius: 'var(--r-md)', padding:'12px 14px', fontSize: 'var(--t-dado)', fontFamily:'var(--font-mono)', outline:'none', resize:'vertical', lineHeight:1.7 }} />
          </div>

          {/* Depois */}
          <div>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--red)' }} />
              Medicação DEPOIS (nota de alta / prescrição actual)
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8, minHeight: 'var(--alvo)', alignItems:'center' }}>
              <button type="button" onClick={() => afterFileRef.current?.click()} disabled={!!scanning}
                style={{ padding:'8px 14px', background:'white', color:'var(--red)', border:'1.5px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer', whiteSpace:'nowrap' }}>
                {scanning==='after' ? 'A ler…' : '📷 Foto da nota de alta'}
              </button>
              <input ref={afterFileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" onChange={onScan('after')} style={{ display:'none' }} />
            </div>
            <textarea value={after} onChange={e => setAfter(e.target.value)}
              placeholder="Um medicamento por linha&#10;Ex: Metformina 500mg 2x/dia&#10;    Enalapril 10mg 2x/dia"
              rows={10}
              style={{ width:'100%', border:'1.5px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', padding:'12px 14px', fontSize: 'var(--t-dado)', fontFamily:'var(--font-mono)', outline:'none', resize:'vertical', lineHeight:1.7 }} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Contexto clínico (opcional)</div>
          <input value={context} onChange={e => setContext(e.target.value)}
            placeholder="Ex: Internamento por IC descompensada, alta após 5 dias, doente com DRC G3"
            style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding:'10px 14px', fontSize: 'var(--t-dado)', fontFamily:'var(--font-sans)', outline:'none' }} />
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={reconcile} disabled={!before.trim() || !after.trim() || loading}
            style={{ padding:'12px 24px', background:before.trim()&&after.trim()?'var(--ink-2)':'var(--bg-3)', color:before.trim()&&after.trim()?'white':'var(--ink-5)', border:'none', borderRadius: 'var(--r-md)', cursor:'pointer', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:8, opacity:loading?0.7:1 }}>
            {loading ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />A reconciliar...</> : '🔄 Reconciliar'}
          </button>
          <button onClick={() => { setBefore(EXAMPLES.before); setAfter(EXAMPLES.after) }}
            style={{ padding:'12px 18px', background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius: 'var(--r-md)', cursor:'pointer', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, fontFamily:'var(--font-sans)' }}>
            Ver exemplo
          </button>
        </div>

        {error && <div style={{ padding:'12px 16px', background:'var(--red-light)', border:'1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color:'var(--red)', marginBottom:16 }}>{error}</div>}

        {result && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Resumo */}
            <div style={{ padding:'16px 18px', background:result.reconciliation_complete?'var(--green-light)':'var(--amber-light)', border:`1px solid ${result.reconciliation_complete?'var(--green-mid)':'var(--badge-amber-border)'}`, borderRadius: 'var(--r-lg)', display:'flex', alignItems:'flex-start', gap:12 }}>
              <span style={{ fontSize: 'var(--t-destaque)', flexShrink:0 }}>{result.reconciliation_complete ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontSize: 'var(--t-meta)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:result.reconciliation_complete?'var(--green-2)':'var(--badge-amber-fg)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
                  {result.reconciliation_complete ? 'Reconciliação possível' : 'Requer revisão clínica'}
                </div>
                <div style={{ fontSize: 'var(--t-corpo)', color:'var(--ink)', lineHeight:1.6 }}>{result.summary}</div>
              </div>
            </div>

            {/* Discrepâncias */}
            {result.discrepancies.length > 0 && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                    Discrepâncias identificadas
                  </div>
                  <span style={{ marginLeft:'auto', fontSize: 'var(--t-meta)', fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{result.discrepancies.length}</span>
                </div>
                {result.discrepancies.map((d, i) => {
                  const s = DISC_STYLE[d.severity]
                  const t = TYPE_LABELS[d.type]
                  const dec = decisions[i]
                  return (
                    <div key={i} style={{ padding:'14px 18px', borderBottom:i<result.discrepancies.length-1?'1px solid var(--bg-3)':'none', background: dec === 'approved' ? 'var(--badge-green-bg)' : dec === 'rejected' ? 'var(--badge-red-bg)' : s.bg }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        <Icon name={s.icon} size={16} />
                        <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color:'var(--ink)' }}>{d.drug}</span>
                        <span style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:t.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 7px', borderRadius: 'var(--r-sm)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                          <Icon name={t.icon} size={15} />  {t.label}
                        </span>
                        <span style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:s.color, background:s.bg, border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius: 'var(--r-sm)', letterSpacing:'0.06em', textTransform:'uppercase', marginLeft:'auto' }}>
                          {s.label}
                        </span>
                      </div>
                      {(d.before || d.after) && (
                        <div style={{ display:'flex', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                          {d.before && <div style={{ fontSize: 'var(--t-meta)', color:'var(--red)', fontFamily:'var(--font-mono)' }}>Antes: {d.before}</div>}
                          {d.before && d.after && <div style={{ fontSize: 'var(--t-meta)', color:'var(--ink-4)' }}>→</div>}
                          {d.after && <div style={{ fontSize: 'var(--t-meta)', color:'var(--green)', fontFamily:'var(--font-mono)' }}>Depois: {d.after}</div>}
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--t-dado)', color:'var(--ink)', lineHeight:1.5, marginBottom:6 }}>{d.action_required}</div>
                      {d.justification_needed && (
                        <div style={{ fontSize: 'var(--t-meta)', color:'var(--roxo)', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
                          ✏️ Requer justificação clínica no processo
                        </div>
                      )}
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        <button onClick={() => decide(i, 'approved')}
                          style={{ padding:'5px 12px', background: dec==='approved'?'var(--green)':'white', color: dec==='approved'?'white':'var(--green)', border:'1.5px solid var(--green)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                          ✓ Aceitar
                        </button>
                        <button onClick={() => decide(i, 'rejected')}
                          style={{ padding:'5px 12px', background: dec==='rejected'?'var(--red)':'white', color: dec==='rejected'?'white':'var(--red)', border:'1.5px solid var(--red)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                          ✗ Recusar
                        </button>
                        {dec === 'rejected' && (
                          <input value={decisionNotes[i] || ''} onChange={e => setDecisionNotes(n => ({ ...n, [i]: e.target.value }))}
                            placeholder="Motivo (opcional)"
                            style={{ flex:1, minWidth:120, border:'1px solid var(--badge-red-border)', borderRadius: 'var(--r)', padding:'5px 10px', fontSize: 'var(--t-meta)', outline:'none', fontFamily:'var(--font-sans)' }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Omissões não intencionais */}
            {result.unintentional_omissions.length > 0 && (
              <div style={{ padding:'14px 16px', background:'var(--badge-red-bg)', border:'1px solid var(--badge-red-border)', borderRadius: 'var(--r-lg)' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:'var(--red)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  🚨 Possíveis omissões não intencionais
                </div>
                {result.unintentional_omissions.map((o, i) => (
                  <div key={i} style={{ fontSize: 'var(--t-dado)', color:'var(--red)', lineHeight:1.6, display:'flex', gap:8 }}>
                    <span style={{ flexShrink:0 }}>·</span>{o}
                  </div>
                ))}
              </div>
            )}

            {/* Duplicações */}
            {result.therapeutic_duplications.length > 0 && (
              <div style={{ padding:'14px 16px', background:'var(--amber-light)', border:'1px solid var(--badge-amber-border)', borderRadius: 'var(--r-lg)' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:'var(--badge-amber-fg)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  ⚠️ Possíveis duplicações terapêuticas
                </div>
                {result.therapeutic_duplications.map((d, i) => (
                  <div key={i} style={{ fontSize: 'var(--t-dado)', color:'var(--badge-amber-fg)', lineHeight:1.6, display:'flex', gap:8 }}>
                    <span style={{ flexShrink:0 }}>·</span>{d}
                  </div>
                ))}
              </div>
            )}

            {/* Recomendações */}
            {result.recommendations.length > 0 && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius: 'var(--r-lg)', padding:'16px 18px' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>Recomendações</div>
                {result.recommendations.map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <span style={{ color:'var(--ink-2)', fontSize: 'var(--t-dado)', flexShrink:0, marginTop:1 }}>→</span>
                    <div style={{ fontSize: 'var(--t-dado)', color:'var(--ink-2)', lineHeight:1.6 }}>{r}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Export actions */}
            <div style={{ display:'flex', gap:8, paddingTop:4 }}>
              <button onClick={exportNote}
                style={{ flex:1, padding:'12px', background: copied?'var(--badge-green-bg)':'var(--ink-2)', color: copied?'var(--green)':'white', border:'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer', transition:'all 0.2s' }}>
                {copied ? '✓ Copiado para clipboard' : '📋 Exportar nota clínica'}
              </button>
              <button onClick={() => window.print()}
                style={{ padding:'12px 18px', background:'white', color:'var(--ink)', border:'1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor:'pointer' }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(max-width:640px){.reconcil-grid{grid-template-columns:1fr!important}}`}</style>
    </Mesa>
  )
}