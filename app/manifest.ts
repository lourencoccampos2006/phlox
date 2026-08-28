import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Phlox',
    short_name: 'Phlox',
    description: 'O dia do seu centro de dia, as famílias tranquilas. E a sua saúde, num só sítio.',
    start_url: '/inicio',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0d6e42',
    orientation: 'portrait-primary',
    categories: ['health', 'medical', 'education'],
    lang: 'pt-PT',
    // Dois conjuntos, de propósito. O `any` é o ícone como ele é, usado onde
    // nada o recorta. O `maskable` tem a flor mais pequena porque o Android
    // corta o ícone com uma máscara que muda de fabricante para fabricante e só
    // garante o círculo central de 80% — com a flor a 78%, as pontas das
    // pétalas ficavam cortadas. Ver scripts/logo-maskable.mjs.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
    shortcuts: [
      { name: 'Os meus comprimidos', url: '/mymeds', description: 'A lista, os horários e os lembretes' },
      { name: 'Dão-se bem?', url: '/interactions', description: 'Ver se é seguro tomá-los juntos' },
      { name: 'Tirar uma dúvida', url: '/ai', description: 'Pergunte em português simples' },
    ],
  }
}
