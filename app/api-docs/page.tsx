import Header from '@/components/Header'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Phlox — Integra verificação de interações no teu sistema',
  description: 'API farmacológica para farmácias, clínicas e hospitais. Verifica interações, obtém monografias e posologia via REST API.',
}

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/interactions',
    desc: 'Verifica interações entre 2-10 medicamentos',
    body: '{ "drugs": ["warfarin", "ibuprofen"] }',
    response: '{ "severity": "GRAVE", "summary": "...", "mechanism": "..." }',
  },
  {
    method: 'GET',
    path: '/api/v1/drugs/:name',
    desc: 'Informação clínica completa de um medicamento',
    body: null,
    response: '{ "name": "...", "indications": "...", "dosage": "..." }',
  },
  {
    method: 'POST',
    path: '/api/v1/safety',
    desc: 'Perfil de segurança (condução, gravidez, álcool)',
    body: '{ "drug": "lorazepam" }',
    response: '{ "driving": "EVITAR", "pregnancy": "CONTRA", ... }',
  },
]

const PLANS = [
  {
    name: 'Developer',
    price: '0€',
    sub: 'para sempre',
    limit: '100 pedidos/dia',
    features: ['Interações', 'Base de dados de fármacos', 'Sem SLA'],
    cta: 'Obter chave grátis',
    highlight: false,
  },
  {
    name: 'Farmácia',
    price: '49€',
    sub: '/mês',
    limit: '5.000 pedidos/dia',
    features: ['Todos os endpoints', 'SLA 99.9%', 'Suporte via email', 'Widget embebível'],
    cta: 'Começar — 49€/mês',
    highlight: true,
  },
  {
    name: 'Clínica / Hospital',
    price: 'Personalizado',
    sub: '',
    limit: 'Ilimitado',
    features: ['Volume personalizado', 'SLA 99.99%', 'Suporte dedicado', 'Integração assistida', 'RGPD DPA'],
    cta: 'Falar connosco',
    highlight: false,
  },
]

export default function APIPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '72px 0', background: 'white' }}>
        <div className="page-container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', marginBottom: 24 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>Phlox API v1 — Beta</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 44, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Farmacologia clínica<br />no teu sistema.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 32, maxWidth: 560 }}>
            Integra verificação de interações, monografias e perfis de segurança directamente na tua farmácia, clínica ou aplicação. REST API simples, documentada, com SLA.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="mailto:api@phlox.health?subject=Pedido de acesso à API"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Pedir acesso à API →
            </a>
            <a href="#endpoints"
              style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', color: 'var(--ink)', textDecoration: 'none', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 500, border: '1.5px solid var(--border-2)', letterSpacing: '-0.01em' }}>
              Ver documentação
            </a>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section id="endpoints" style={{ padding: '72px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Endpoints disponíveis</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em' }}>API Reference</h2>
          </div>

          {/* Auth example */}
          <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '20px', marginBottom: 24, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 10 }}>AUTENTICAÇÃO</div>
            <div style={{ color: '#86efac' }}>{'curl https://phlox.health/api/v1/interactions \\'}</div>
            <div style={{ color: '#86efac', paddingLeft: 16 }}>{'  -H "Authorization: Bearer pk_live_XXXXX" \\'}</div>
            <div style={{ color: '#86efac', paddingLeft: 16 }}>{'  -d \'{"drugs": ["warfarin", "ibuprofen"]}\''}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ENDPOINTS.map(ep => (
              <div key={ep.path} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, background: ep.method === 'GET' ? '#dbeafe' : '#dcfce7', color: ep.method === 'GET' ? '#1e40af' : '#166534', padding: '3px 8px', borderRadius: 5, letterSpacing: '0.04em' }}>{ep.method}</span>
                  <code style={{ fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{ep.path}</code>
                  <span style={{ fontSize: 13, color: 'var(--ink-4)', marginLeft: 'auto' }}>{ep.desc}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: ep.body ? '1fr 1fr' : '1fr', gap: 0 }}>
                  {ep.body && (
                    <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>REQUEST BODY</div>
                      <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>{ep.body}</pre>
                    </div>
                  )}
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 8 }}>RESPONSE</div>
                    <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>{ep.response}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '72px 0', borderBottom: '1px solid var(--border)', background: 'white' }}>
        <div className="page-container" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 10 }}>Preços da API</h2>
            <p style={{ fontSize: 16, color: 'var(--ink-4)' }}>Para integração em farmácias, clínicas e software de saúde.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {PLANS.map(plan => (
              <div key={plan.name} style={{ background: plan.highlight ? 'var(--green)' : 'white', border: `1px solid ${plan.highlight ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{plan.name}</div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: plan.highlight ? 'white' : 'var(--ink)', letterSpacing: '-0.02em' }}>{plan.price}</span>
                  {plan.sub && <span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginLeft: 4 }}>{plan.sub}</span>}
                </div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--green-2)', marginBottom: 18 }}>{plan.limit}</div>
                <div style={{ flex: 1, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--ink-2)', marginBottom: 8 }}>
                      <span style={{ color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--green-2)', flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <a href="mailto:api@phlox.health"
                  style={{ display: 'block', textAlign: 'center', padding: '11px', background: plan.highlight ? 'white' : 'var(--green)', color: plan.highlight ? 'var(--green)' : 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '72px 0' }}>
        <div className="page-container" style={{ maxWidth: 500, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.02em' }}>Pronto para integrar?</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.7 }}>Envia-nos um email e tratamos de tudo — chave de API, documentação e integração assistida.</p>
          <a href="mailto:api@phlox.health?subject=Integração API Phlox"
            style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 9, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
            api@phlox.health →
          </a>
        </div>
      </section>
    </div>
  )
}