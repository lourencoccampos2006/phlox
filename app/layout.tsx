import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-clinical.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Phlox Clinical — Farmacologia Clínica em Português',
    template: '%s | Phlox Clinical',
  },
  description: 'Plataforma de farmacologia clínica e ciências da saúde. Verificador de interações, casos clínicos, tutoria IA, rondas farmacêuticas. Para profissionais, estudantes e famílias.',
  keywords: ['farmacologia', 'interações medicamentosas', 'farmácia clínica', 'medicina', 'INFARMED', 'Portugal'],
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Phlox Clinical',
    title: 'Phlox Clinical — Farmacologia Clínica em Português',
    description: 'Plataforma de farmacologia clínica. Interações, protocolos, casos clínicos, tutoria IA.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox Clinical',
    description: 'Farmacologia clínica em português. Para profissionais, estudantes e famílias.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: BASE_URL },
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
        <meta name="theme-color" content="#0d6e42" />
        <link rel="manifest" href="/manifest.json" />
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