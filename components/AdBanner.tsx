'use client'

import { useEffect, useRef } from 'react'

interface AdBannerProps {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  style?: React.CSSProperties
}

// Google AdSense banner. O publisher ID já está no <head> (app/layout.tsx);
// usamos a env NEXT_PUBLIC_ADSENSE_ID se existir, senão o fallback hardcoded,
// para o bloco NUNCA depender só da variável (causa comum de não aparecer).
const PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || 'ca-pub-3416387560941562'

export default function AdBanner({ slot, format = 'auto', style }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const loaded = useRef(false)
  const publisherId = PUBLISHER_ID

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    // O script global do AdSense é carregado no <head> (app/layout.tsx).
    // Aqui só empurramos a unidade de anúncio quando o slot está montado.
    setTimeout(() => {
      try {
        ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
        ;(window as any).adsbygoogle.push({})
      } catch {}
    }, 200)
  }, [])

  return (
    <div style={{ overflow: 'hidden', textAlign: 'center', ...style }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}