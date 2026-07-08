import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'
import AdScript from '@/components/AdScript'
import ClientLayout from '@/components/ClientLayout'
import { ToastProvider } from '@/components/Toast'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phloxclinical.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Phlox — o dia do seu centro de dia, as famílias tranquilas',
    template: '%s | Phlox',
  },
  description: 'O software para centros de dia e lares: o dia de cada utente, a medicação casa↔centro e as famílias a acompanhar. Também para quem cuida da sua saúde, da família, ou estuda saúde.',
  keywords: [
    'software centro de dia', 'software lar de idosos', 'ERPI', 'registo de cuidados',
    'portal das famílias', 'medicação de idosos', 'apoio ao cuidador',
    'a minha medicação', 'interações medicamentosas', 'Portugal', 'SNS',
    'estudar saúde', 'flashcards medicina', 'OSCE',
  ],
  authors: [{ name: 'Phlox Clinical', url: BASE_URL }],
  creator: 'Phlox Clinical',
  publisher: 'Phlox Clinical',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Phlox',
    title: 'Phlox — o dia do seu centro de dia, as famílias tranquilas',
    description: 'Presenças, medicação, atividades e o dia de cada utente num só sítio. As famílias veem como correu, sem ter de ligar.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox',
    description: 'O software para centros de dia e lares — e para quem cuida da sua saúde, da família, ou estuda saúde.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: { canonical: BASE_URL },
  category: 'health',
}

export const viewport: Viewport = {
  themeColor: '#0d6e42',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        {/* Google AdSense — apenas a meta de verificação do site (não define cookies).
            O SCRIPT de anúncios é carregado por <AdScript/> SÓ depois de o utilizador
            consentir cookies de publicidade (RGPD/ePrivacy). */}
        <meta name="google-adsense-account" content="ca-pub-3416387560941562" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
            <CookieBanner />
            <AdScript />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
