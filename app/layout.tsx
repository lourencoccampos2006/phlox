import type { Metadata, Viewport } from 'next'
import { Syne, Lora, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthContext'
import CookieBanner from '@/components/CookieBanner'
import AdScript from '@/components/AdScript'
import ClientLayout from '@/components/ClientLayout'
import { ToastProvider } from '@/components/Toast'

// Self-hospedadas (sem <link> para fonts.googleapis.com — menos um pedido de
// rede bloqueante) e com ajuste automático da métrica de fallback: o texto já
// nasce com o tamanho/altura de linha final, não há "salto" quando a fonte
// verdadeira chega. Ver nota em globals.css sobre o bug de scroll que isto corrige.
const syne = Syne({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-syne', display: 'swap' })
const lora = Lora({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], variable: '--font-lora', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains-mono', display: 'swap' })

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
  // Ícone de "Adicionar ao ecrã principal" — CORRIGIDO 2026-08-09: o <head>
  // linkava manualmente para public/manifest.json (só tinha o favicon.ico
  // como ícone, sem 192/512) em vez do manifest real gerado por
  // app/manifest.ts — o site nunca tinha, na prática, um ícone PWA a sério.
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Phlox',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d6e42',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${syne.variable} ${lora.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Google AdSense — apenas a meta de verificação do site (não define cookies).
            O SCRIPT de anúncios é carregado por <AdScript/> SÓ depois de o utilizador
            consentir cookies de publicidade (RGPD/ePrivacy). */}
        <meta name="google-adsense-account" content="ca-pub-3416387560941562" />
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
