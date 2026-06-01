'use client'

// /saude-agora — A ferramenta única "preciso de ajuda agora".
// Combina antiga /triagem (decidir para onde ir) e /socorros (passo-a-passo
// de primeiros socorros) numa só, com tabs. Substitui as duas — o utilizador
// reportou que estava confuso ter duas ferramentas separadas.
//
// 2026-06-01.

import { useState } from 'react'
import dynamic from 'next/dynamic'

// Reaproveita as duas páginas existentes como componentes (HOCs):
//   - /triagem é o motor "devo ir ao médico ou às urgências"
//   - /socorros é o "o que faço agora numa emergência"
// Importação dinâmica evita ssr issues e mantém os ficheiros separados
// (cada um já tinha lógica significativa).
const TriagemView = dynamic(() => import('@/app/triagem/page'), { ssr: false })
const SocorrosView = dynamic(() => import('@/app/socorros/page'), { ssr: false })

type Tab = 'decidir' | 'agir'

export default function SaudeAgoraPage() {
  const [tab, setTab] = useState<Tab>('decidir')
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', position: 'sticky', top: 56, zIndex: 30 }}>
        <div className="page-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            Preciso de ajuda agora
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>
            Saúde · Agora
          </h1>
          <div style={{ display: 'flex', gap: 4, marginTop: 12, borderBottom: 'none' }}>
            <button onClick={() => setTab('decidir')}
              style={{
                padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: `3px solid ${tab === 'decidir' ? '#1d4ed8' : 'transparent'}`,
                fontSize: 13.5, fontWeight: tab === 'decidir' ? 800 : 600,
                color: tab === 'decidir' ? '#1d4ed8' : '#475569', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>🩺 Devo ir ao médico?</button>
            <button onClick={() => setTab('agir')}
              style={{
                padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: `3px solid ${tab === 'agir' ? '#dc2626' : 'transparent'}`,
                fontSize: 13.5, fontWeight: tab === 'agir' ? 800 : 600,
                color: tab === 'agir' ? '#dc2626' : '#475569', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>🚨 Primeiros socorros</button>
          </div>
        </div>
      </div>

      <div>
        {tab === 'decidir' ? <TriagemView /> : <SocorrosView />}
      </div>
    </div>
  )
}
