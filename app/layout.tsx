import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'
import ClientLayout from '@/components/ClientLayout'
import { SpeedInsights } from '@vercel/speed-insights/next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox-pi.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Phlox Clinical — Farmacologia Clínica em Português',
    template: '%s | Phlox Clinical',
  },
  description: 'A plataforma de farmacologia clínica feita para Portugal. Verificador de interações, rondas farmacêuticas, Arena de ligas, OSCE simulado, tutoria IA socrática. Para profissionais, estudantes e famílias.',
  keywords: [
    'farmacologia clínica', 'interações medicamentosas', 'farmácia clínica',
    'INFARMED', 'DGS', 'PCNE', 'ronda farmacêutica', 'reconciliação medicamentosa',
    'OSCE farmácia', 'casos clínicos', 'Portugal', 'SNS', 'medicamentos',
    'profissionais de saúde', 'estudantes de medicina', 'farmacêutico',
  ],
  authors: [{ name: 'Phlox Clinical', url: BASE_URL }],
  creator: 'Phlox Clinical',
  publisher: 'Phlox Clinical',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Phlox Clinical',
    title: 'Phlox Clinical — Farmacologia Clínica em Português',
    description: 'Verificador de interações, rondas farmacêuticas, Arena de ligas e OSCE simulado. A plataforma clínica para Portugal.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox Clinical',
    description: 'A plataforma de farmacologia clínica feita para Portugal. Para profissionais, estudantes e famílias.',
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
          <ClientLayout>
            {children}
          </ClientLayout>
          <CookieBanner />
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
