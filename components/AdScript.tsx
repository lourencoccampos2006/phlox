'use client'

// AdScript — injeta o script do Google AdSense APENAS depois de o utilizador
// consentir cookies de publicidade. Sem consentimento → o script nunca é carregado
// e nenhum cookie de publicidade é definido (RGPD / ePrivacy / Diretiva e-Privacy).
// Reage à mudança de consentimento (se o utilizador aceitar mais tarde, carrega então).

import { useEffect, useState } from 'react'
import { getConsent, CONSENT_EVENT } from '@/lib/consent'

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3416387560941562'

export default function AdScript() {
  const [load, setLoad] = useState(false)

  useEffect(() => {
    const check = () => { if (getConsent() === 'accepted') setLoad(true) }
    check()
    window.addEventListener(CONSENT_EVENT, check)
    return () => window.removeEventListener(CONSENT_EVENT, check)
  }, [])

  useEffect(() => {
    if (!load) return
    // Evita duplicar o script se já existir.
    if (document.querySelector('script[data-phlox-adsense]')) return
    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    s.setAttribute('data-phlox-adsense', '1')
    document.head.appendChild(s)
  }, [load])

  return null
}
