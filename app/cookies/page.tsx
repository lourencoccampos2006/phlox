'use client'

import Link from 'next/link'
import { COOKIE_CATEGORIES, LEGAL_UPDATED } from '@/lib/legal'
import { setConsent, useConsent } from '@/lib/consent'

export default function CookiesPage() {
  const { consent } = useConsent()

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>Política de Cookies</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Cookies</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 26 }}>Última atualização: {LEGAL_UPDATED}</p>

        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 26 }}>
          Usamos cookies (e tecnologias semelhantes) para o site funcionar e, com o seu consentimento,
          para mostrar publicidade. Os cookies de publicidade só são ativados se aceitar — pode mudar a
          sua escolha aqui a qualquer momento.
        </p>

        {/* Gestor de consentimento */}
        <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 30 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>A sua escolha</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 14 }}>
            Estado atual: <strong>{consent === 'accepted' ? 'Publicidade aceite' : consent === 'declined' ? 'Apenas cookies essenciais' : 'Ainda não escolheu'}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setConsent('declined')} style={{ padding: '9px 16px', background: consent === 'declined' ? 'var(--ink)' : 'white', color: consent === 'declined' ? 'white' : 'var(--ink-3)', border: '1.5px solid var(--border-2)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Apenas essenciais</button>
            <button onClick={() => setConsent('accepted')} style={{ padding: '9px 18px', background: consent === 'accepted' ? 'var(--green-2)' : 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Aceitar publicidade</button>
          </div>
        </div>

        {/* Tabela por categoria */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
          {COOKIE_CATEGORIES.map(c => (
            <div key={c.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.always ? '#15803d' : (consent === 'accepted' || c.id === 'push' ? '#1d4ed8' : '#94a3b8'), background: c.always ? '#f0fdf4' : '#f1f5f9', border: `1px solid ${c.always ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 6, padding: '2px 9px' }}>
                  {c.always ? 'Sempre ativos' : (c.id === 'ads' ? (consent === 'accepted' ? 'Ativos (consentiu)' : 'Inativos') : 'Opcional')}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>{c.desc}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{c.examples}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.7 }}>
          Para saber que fornecedores tratam dados em nosso nome, veja os{' '}
          <Link href="/subprocessadores" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>subprocessadores</Link>{' '}
          e a <Link href="/privacy" style={{ color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>política de privacidade</Link>.
        </p>
      </div>
    </div>
  )
}
