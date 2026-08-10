'use client'

// InstallInstructions — "como adicionar o Phlox ao ecrã principal", por
// plataforma. 2026-08-09 (pedido do Fernando): verificar se o push funciona
// com o site instalado e explicar como se faz.
//
// Realidade técnica (verificada, não assumida): no ANDROID (Chrome/Edge) as
// notificações push já funcionam numa aba normal do browser — instalar dá só
// um ícone próprio, não é preciso para o push. No IPHONE/IPAD, o Safari só
// liga a Push API depois de o site estar adicionado ao ecrã principal e
// aberto a partir daí (exige iOS 16.4+) — sem isso, ativar notificações
// falha sempre, silenciosamente. Por isso as instruções do iOS deixam claro
// que este passo é OBRIGATÓRIO, e as do Android que é só um extra.

import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '@/lib/pushActivation'

export default function InstallInstructions({ compact }: { compact?: boolean }) {
  const [platform, setPlatform] = useState<'checking' | 'ios' | 'android' | 'other' | 'installed'>('checking')

  useEffect(() => {
    if (isStandalone()) { setPlatform('installed'); return }
    if (isIOS()) { setPlatform('ios'); return }
    if (/Android/i.test(navigator.userAgent)) { setPlatform('android'); return }
    setPlatform('other')
  }, [])

  if (platform === 'checking') return null

  if (platform === 'installed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#059669' }}>Já está a usar o Phlox instalado no ecrã principal.</div>
      </div>
    )
  }

  const box: React.CSSProperties = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: compact ? '12px 14px' : '14px 16px' }
  const step: React.CSSProperties = { display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }
  const num: React.CSSProperties = { width: 18, height: 18, borderRadius: '50%', background: 'var(--ink)', color: 'white', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }

  if (platform === 'ios') {
    return (
      <div style={box}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>
          No iPhone/iPad, isto é <u>necessário</u> para as notificações funcionarem
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={step}><span style={num}>1</span><span>Toque no ícone <strong>Partilhar</strong> (o quadrado com a seta para cima) na barra do Safari.</span></div>
          <div style={step}><span style={num}>2</span><span>Escolha <strong>"Adicionar ao Ecrã Principal"</strong>.</span></div>
          <div style={step}><span style={num}>3</span><span>Abra o Phlox a partir do novo ícone no ecrã principal — <strong>não</strong> numa aba do Safari. Só assim as notificações podem ser ativadas.</span></div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>Precisa do iOS 16.4 ou mais recente.</div>
      </div>
    )
  }

  // android / other
  return (
    <div style={box}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>
        Opcional — dá um ícone próprio ao Phlox
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={step}><span style={num}>1</span><span>Toque no menu (⋮) do Chrome, no canto superior direito.</span></div>
        <div style={step}><span style={num}>2</span><span>Escolha <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.</span></div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>No Android, as notificações já funcionam sem instalar — isto só deixa tudo mais parecido com uma aplicação.</div>
    </div>
  )
}
