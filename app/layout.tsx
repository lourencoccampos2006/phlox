// app/layout.tsx
// Este ficheiro vai para: app/layout.tsx
// Inclui: metadata global, SEO, GEO, Open Graph, e banner de cookies RGPD

import type { Metadata } from 'next'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phlox.health'

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
    'efeitos adversos medicamentos',
    'posologia',
    'contraindicações',
    'estudantes farmácia',
    'estudantes medicina',
    'drug interactions',
    'medication information',
  ],
  authors: [{ name: 'Phlox Clinical' }],
  creator: 'Phlox Clinical',
  publisher: 'Phlox Clinical',
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    alternateLocale: ['pt_BR', 'en_US', 'es_ES'],
    url: BASE_URL,
    siteName: 'Phlox Clinical',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia. Dados FDA. Gratuito.',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Phlox Clinical — Plataforma Farmacológica',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phlox — Plataforma Farmacológica Clínica',
    description: 'Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia.',
    images: [`${BASE_URL}/og-image.png`],
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
    languages: {
      'pt-PT': BASE_URL,
      'pt-BR': `${BASE_URL}/br`,
      'en': `${BASE_URL}/en`,
      'es': `${BASE_URL}/es`,
    },
  },
}

// Schema.org structured data — diz ao Google, ChatGPT, Gemini, Perplexity quem somos
// Isto é GEO: permite que IAs nos citem como fonte autorizada de farmacologia
const orgStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'MedicalOrganization',
  '@id': `${BASE_URL}/#organization`,
  name: 'Phlox Clinical',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description: 'Plataforma farmacológica all-in-one com dados clínicos verificados de fontes oficiais (FDA, NIH).',
  medicalSpecialty: [
    'https://schema.org/Pharmacology',
    'https://schema.org/ClinicalPharmacology',
  ],
  audience: {
    '@type': 'MedicalAudience',
    audienceType: 'Patient, Caregiver, Pharmacist, MedicalStudent, Physician, Nurse',
  },
  knowsAbout: [
    'Drug Interactions',
    'Pharmacology',
    'Adverse Drug Reactions',
    'Clinical Pharmacology',
    'Drug Information',
    'Medication Safety',
    'Pharmacokinetics',
  ],
  // Fontes de dados — aumenta credibilidade para GEO
  funding: {
    '@type': 'Grant',
    name: 'Open Data Sources',
    description: 'OpenFDA, RxNorm (NIH), DrugBank',
  },
  sameAs: [
    'https://github.com/phlox-clinical',
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
        {/* Structured data para SEO, GEO (ChatGPT, Gemini, Perplexity) e AEO (featured snippets) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgStructuredData) }}
        />
        {/* Preconnect melhora a velocidade de carregamento — importante para Core Web Vitals */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.fda.gov" />
        <link rel="dns-prefetch" href="https://rxnav.nlm.nih.gov" />
      </head>
      <body>
        {children}
        {/* Banner RGPD — obrigatório na Europa */}
        <CookieBanner />
      </body>
    </html>
  )
}