import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Phlox Clinical — Documentação',
  description: 'Documentação da API REST do Phlox Clinical para integração com sistemas de saúde.',
}

const ENDPOINTS = [
  {
    method: 'POST', path: '/api/interactions',
    title: 'Verificar Interações',
    desc: 'Analisa interações entre dois ou mais medicamentos.',
    auth: 'Opcional',
    body: '{ "medications": ["Varfarina 5mg", "Ibuprofeno 400mg"] }',
    response: '{ "severity": "GRAVE", "interactions": [...], "summary": "..." }',
    plan: 'Free',
  },
  {
    method: 'POST', path: '/api/bula',
    title: 'Tradutor de Bula',
    desc: 'Simplifica o texto técnico de uma bula para linguagem acessível.',
    auth: 'Opcional',
    body: '{ "text": "texto da bula..." }',
    response: '{ "what_it_is": "...", "how_to_take": "...", "warnings": "...", "side_effects": "...", "interactions": "..." }',
    plan: 'Free',
  },
  {
    method: 'POST', path: '/api/dose-crianca',
    title: 'Dose Pediátrica',
    desc: 'Calcula dose correcta por peso para crianças.',
    auth: 'Opcional',
    body: '{ "drug": "Paracetamol", "weight_kg": 15, "age_years": 4 }',
    response: '{ "dose": "250mg", "frequency": "a cada 6h", "max_daily": "1000mg", "warnings": [...] }',
    plan: 'Free',
  },
  {
    method: 'POST', path: '/api/quickcheck',
    title: 'Análise Rápida de Medicação',
    desc: 'Análise completa de uma lista de medicamentos: interações, critérios Beers, duplicações.',
    auth: 'Obrigatória',
    body: '{ "medications": "lista...", "mode": "simple|technical" }',
    response: '{ "risk_score": 72, "alerts": [...], "recommendations": [...] }',
    plan: 'Student+',
  },
  {
    method: 'POST', path: '/api/briefing',
    title: 'Briefing Clínico',
    desc: 'Gera briefing clínico completo com alertas e sugestões terapêuticas.',
    auth: 'Obrigatória',
    body: '{ "medications": "...", "reason": "...", "patient": { "age": 72, "conditions": "..." } }',
    response: '{ "summary": "...", "alerts": [...], "suggestions": [...], "labs_recommended": [...] }',
    plan: 'Pro+',
  },
  {
    method: 'POST', path: '/api/reconciliacao',
    title: 'Reconciliação Medicamentosa',
    desc: 'Compara duas listas de medicamentos e identifica discrepâncias.',
    auth: 'Obrigatória',
    body: '{ "before": "lista antes...", "after": "lista depois...", "context": "..." }',
    response: '{ "discrepancies": [...], "unintentional_omissions": [...], "recommendations": [...] }',
    plan: 'Pro+',
  },
]

const METHOD_STYLE: Record<string, { bg: string; color: string }> = {
  GET:    { bg: '#d1fae5', color: '#065f46' },
  POST:   { bg: '#dbeafe', color: '#1e40af' },
  DELETE: { bg: '#fee2e2', color: '#991b1b' },
}

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  'Free':     { bg: 'var(--bg-3)', color: 'var(--ink-4)' },
  'Student+': { bg: '#ede9fe', color: '#6d28d9' },
  'Pro+':     { bg: '#dbeafe', color: '#1d4ed8' },
}

export default function ApiDocsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:820 }}>

        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:10 }}>Documentação</div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,32px)', color:'var(--ink)', fontWeight:400, marginBottom:10 }}>API Phlox Clinical</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.7, maxWidth:560 }}>
            API REST para integração com sistemas de saúde, farmácias e plataformas clínicas. Autenticação via Bearer token (token da sessão Supabase).
          </p>
          <div style={{ marginTop:14, padding:'12px 16px', background:'var(--ink)', borderRadius:8, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'#94a3b8' }}>Base URL:</div>
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'#22c55e', fontWeight:700 }}>https://phlox-clinical.com/api</div>
          </div>
        </div>

        {/* Auth */}
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'20px', marginBottom:20 }}>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Autenticação</div>
          <p style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.7, marginBottom:12 }}>
            Endpoints marcados como "Obrigatória" requerem um Bearer token no header Authorization. O token é o access_token da sessão Supabase do utilizador autenticado.
          </p>
          <div style={{ background:'var(--ink)', borderRadius:7, padding:'14px 16px', fontFamily:'var(--font-mono)', fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
            <span style={{ color:'#7c3aed' }}>Authorization</span>: Bearer <span style={{ color:'#22c55e' }}>{'<seu_access_token>'}</span>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
            Rate limit: 60 requests/minuto por IP · endpoints Free: sem limite de autenticação
          </div>
        </div>

        {/* Endpoints */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {ENDPOINTS.map((ep, i) => {
            const ms = METHOD_STYLE[ep.method] || METHOD_STYLE.POST
            const ps = PLAN_STYLE[ep.plan] || PLAN_STYLE['Free']
            return (
              <div key={i} style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                {/* Header */}
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:ms.color, background:ms.bg, padding:'3px 8px', borderRadius:4, letterSpacing:'0.06em', flexShrink:0 }}>
                    {ep.method}
                  </span>
                  <code style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--ink)', fontWeight:700 }}>{ep.path}</code>
                  <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:ps.color, background:ps.bg, padding:'2px 7px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                      {ep.plan}
                    </span>
                    <span style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>Auth: {ep.auth}</span>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding:'14px 18px' }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:6 }}>{ep.title}</div>
                  <p style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.6, marginBottom:12 }}>{ep.desc}</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }} className="code-grid">
                    <div>
                      <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Request Body</div>
                      <div style={{ background:'var(--bg-2)', borderRadius:6, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-2)', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{ep.body}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Response (200)</div>
                      <div style={{ background:'var(--bg-2)', borderRadius:6, padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:11, color:'#0d6e42', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{ep.response}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contact */}
        <div style={{ marginTop:24, padding:'20px', background:'var(--ink)', borderRadius:10, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#f8fafc', marginBottom:8 }}>Integração institucional?</div>
          <p style={{ fontSize:13, color:'#64748b', marginBottom:14 }}>Para planos de API com maior rate limit, suporte dedicado ou integração com Sifarma/SClínico, contacta-nos.</p>
          <a href="mailto:api@phlox-clinical.com" style={{ display:'inline-block', background:'#1d4ed8', color:'white', textDecoration:'none', padding:'10px 22px', borderRadius:7, fontSize:13, fontWeight:700 }}>
            api@phlox-clinical.com
          </a>
        </div>
      </div>
      <style>{`@media(max-width:640px){.code-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}