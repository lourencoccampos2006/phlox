'use client'

// PlanAds — anúncio que SÓ aparece para utilizadores do plano gratuito (free).
// Qualquer plano pago (student/pro/clinic) não vê anúncios.
//
// Como ligar os anúncios reais (Google AdSense):
//  1. Cria conta em https://adsense.google.com e adiciona o domínio phloxclinical.com
//  2. Quando aprovado, copia o teu Publisher ID (ca-pub-XXXXXXXXXXXXXXXX)
//  3. Cria uma "unidade de anúncio" → copia o data-ad-slot (número)
//  4. No Cloudflare/Vercel: define NEXT_PUBLIC_ADSENSE_ID = ca-pub-XXXX
//  5. Passa o slot a este componente: <PlanAds slot="1234567890" />
//
// Enquanto NEXT_PUBLIC_ADSENSE_ID não existir, mostra um placeholder discreto
// (útil para veres onde os anúncios vão aparecer, sem partir o layout).

import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import AdBanner from '@/components/AdBanner'
import { useConsent } from '@/lib/consent'

interface PlanAdsProps {
  slot: string
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  style?: React.CSSProperties
  /** Mostra placeholder quando o AdSense ainda não está configurado. Default true. */
  placeholder?: boolean
}

// Cartão próprio do Phlox (zero cookies, zero rede de anúncios) — mostrado a quem é
// FREE mas não consentiu publicidade. Converte alguns em vez de deixar o espaço vazio.
function UpgradeNudge({ style }: { style?: React.CSSProperties }) {
  return (
    <Link href="/pricing" style={{ textDecoration: 'none', display: 'block', ...style }}>
      <div style={{ border: '1px solid var(--green-mid, #bbf7d0)', background: 'var(--green-light, #f0fdf4)', borderRadius: 10, padding: '11px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--green-2, #0d6e42)', fontWeight: 600, lineHeight: 1.4 }}>
          Sem anúncios e tudo desbloqueado com o Plus.
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--green-2, #0d6e42)', fontWeight: 800, whiteSpace: 'nowrap' }}>Ver planos →</span>
      </div>
    </Link>
  )
}

export default function PlanAds({ slot, format = 'horizontal', style, placeholder = true }: PlanAdsProps) {
  const { user, loading } = useAuth()
  const { ads } = useConsent()

  // Não decidir nada enquanto carrega — evita flash de anúncio a pagantes
  if (loading) return null
  // Só plano gratuito vê anúncios. Pagantes e organizações nunca.
  if (user && user.plan !== 'free') return null

  // Se o slot é um número real do AdSense → anúncio real (o publisher ID já está
  // no layout + no AdBanner). Slots não-numéricos (placeholders) → caixa neutra.
  const isRealSlot = /^\d{6,}$/.test(slot)
  if (isRealSlot) {
    // Sem consentimento de publicidade não há anúncio (RGPD) — em vez de espaço
    // vazio, sugerimos o upgrade com um cartão próprio (sem cookies).
    if (!ads) return <UpgradeNudge style={style} />
    return <AdBanner slot={slot} format={format} style={style} />
  }

  // Slot ainda não configurado → placeholder neutro (ou nada)
  if (!placeholder) return null
  return (
    <div
      aria-hidden
      style={{
        border: '1px dashed #d4d4d8',
        borderRadius: 6,
        padding: '10px 14px',
        textAlign: 'center',
        fontSize: 11,
        color: '#a1a1aa',
        letterSpacing: 0.3,
        background: '#fafafa',
        ...style,
      }}
    >
      Espaço publicitário · sem anúncios no Plus, Pro e Institucional
    </div>
  )
}
