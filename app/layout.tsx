import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-clinical.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: 'Phlox Clinical — Farmacologia Clínica', template: '%s | Phlox' },
  description: 'Verifica interações, interpreta análises, e acede a ferramentas farmacológicas clínicas em português. Grátis.',
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
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@400;500&display=swap"
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