import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = 'https://phlox.health'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Phlox — Plataforma Farmacológica Clínica',
    template: '%s | Phlox Clinical',
  },
  description: 'Plataforma farmacológica all-in-one. Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia. Dados FDA. Gratuito.',
  keywords: [
    'interações medicamentosas',
    'verificador de interações',
    'informação sobre medicamentos',
    'farmacologia',
    'efeitos adversos',
    'posologia',
    'contraindicações',
    'estudantes farmácia',
    'estudantes medicina',
  ],
  authors: [{ name: 'Phlox Clinical' }],
  creator: 'Phlox Clinical',
  publisher: 'Phlox Clinical',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: BASE_URL,
    siteName: 'Phlox Clinical',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia. Dados FDA. Gratuito.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
}

const orgStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'MedicalOrganization',
  name: 'Phlox Clinical',
  url: BASE_URL,
  description: 'Plataforma farmacológica all-in-one com dados clínicos verificados.',
  medicalSpecialty: 'Pharmacology',
  audience: {
    '@type': 'MedicalAudience',
    audienceType: 'Patient, Caregiver, Pharmacist, Student, Physician',
  },
  knowsAbout: [
    'Drug Interactions',
    'Pharmacology',
    'Adverse Drug Reactions',
    'Clinical Pharmacology',
    'Drug Information',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-PT">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgStructuredData) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
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