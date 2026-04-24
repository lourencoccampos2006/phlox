import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = 'https://phlox.health'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Phlox — Plataforma Farmacológica Clínica',
    template: '%s | Phlox',
  },
  description: 'Plataforma farmacológica clínica all-in-one. Verifica interações, interpreta análises, e estuda farmacologia. Dados FDA e NIH. Gratuito.',
  keywords: ['interações medicamentosas', 'verificador de interações', 'farmacologia', 'análises clínicas', 'medicamentos'],
  authors: [{ name: 'Phlox Clinical' }],
  creator: 'Phlox Clinical',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: BASE_URL,
    siteName: 'Phlox Clinical',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, interpreta análises clínicas e estuda farmacologia.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, interpreta análises clínicas e estuda farmacologia.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalOrganization',
  name: 'Phlox Clinical',
  url: BASE_URL,
  description: 'Plataforma farmacológica clínica com dados verificados FDA/NIH.',
  medicalSpecialty: 'Pharmacology',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
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