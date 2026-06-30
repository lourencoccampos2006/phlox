'use client'

import { useEffect, useRef } from 'react'
import { useConsent } from '@/lib/consent'

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
  // Sem consentimento de publicidade → não renderiza nem empurra anúncios (o script
  // do AdSense nem sequer está carregado). Respeita o RGPD/ePrivacy.
  const { ads } = useConsent()

  useEffect(() => {
    if (!ads || loaded.current) return
    // O script global do AdSense é carregado no <head> (app/layout.tsx).
    // Só empurramos a unidade quando o <ins> existe E tem largura > 0 — o
    // AdSense lança "no_div"/"availableWidth=0" se o contentor estiver oculto
    // ou com largura zero (tabs escondidas, display:none). Esperamos por isso.
    const t = setTimeout(() => {
      const el = adRef.current
      if (!el || el.offsetWidth === 0) return            // contentor ainda não pronto → não faz push
      if (el.getAttribute('data-adsbygoogle-status')) return // já preenchido
      loaded.current = true
      try {
        ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
        ;(window as any).adsbygoogle.push({})
      } catch { /* AdSense indisponível/bloqueado → ignora silenciosamente */ }
    }, 300)
    return () => clearTimeout(t)
  }, [ads])

  if (!ads) return null

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