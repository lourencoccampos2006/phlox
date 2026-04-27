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
    try {
      // Load AdSense script if not already loaded
      if (!document.querySelector('script[src*="adsbygoogle"]')) {
        const script = document.createElement('script')
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`
        script.async = true
        script.crossOrigin = 'anonymous'
        document.head.appendChild(script)
      }
      // Push ad
      setTimeout(() => {
        try {
          ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
          ;(window as any).adsbygoogle.push({})
        } catch {}
      }, 200)
    } catch {}
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