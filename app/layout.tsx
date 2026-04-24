import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-clinical.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: 'Phlox Clinical — Farmacologia Clínica', template: '%s | Phlox' },
  description: 'Plataforma farmacológica clínica em português. Interações, análises, protocolos, estudo. Dados FDA e NIH. Grátis.',
  openGraph: { type: 'website', locale: 'pt_PT', siteName: 'Phlox Clinical' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  )
}