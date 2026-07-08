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
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [],
    shortcuts: [
      { name: 'Os meus comprimidos', url: '/mymeds', description: 'A lista, os horários e os lembretes' },
      { name: 'Dão-se bem?', url: '/interactions', description: 'Ver se é seguro tomá-los juntos' },
      { name: 'Tirar uma dúvida', url: '/ai', description: 'Pergunte em português simples' },
    ],
  }
}
