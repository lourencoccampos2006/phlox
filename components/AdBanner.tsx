'use client'

import { useEffect, useRef } from 'react'

interface AdBannerProps {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  style?: React.CSSProperties
}

// Google AdSense banner — only use on blog pages, never on tool pages
// Replace NEXT_PUBLIC_ADSENSE_ID in .env with your actual publisher ID (ca-pub-XXXXXXXXXX)
export default function AdBanner({ slot, format = 'auto', style }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const loaded = useRef(false)

  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_ID

  useEffect(() => {
    if (!publisherId || loaded.current) return
    loaded.current = true
    // O script global do AdSense é carregado no <head> (app/layout.tsx).
    // Aqui só empurramos a unidade de anúncio quando o slot está montado.
    setTimeout(() => {
      try {
        ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
        ;(window as any).adsbygoogle.push({})
      } catch {}
    }, 200)
  }, [publisherId])

  if (!publisherId) return null

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