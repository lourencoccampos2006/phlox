import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Phlox Clinical',
    short_name: 'Phlox',
    description: 'A plataforma de farmacologia clínica feita para Portugal',
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
      { name: 'Verificar Interações', url: '/interactions', description: 'Verifica interações medicamentosas' },
      { name: 'Phlox AI', url: '/ai', description: 'Farmacêutico virtual 24h' },
      { name: 'Os meus medicamentos', url: '/mymeds', description: 'Gestão de medicação' },
    ],
  }
}
