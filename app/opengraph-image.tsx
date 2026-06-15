import { ImageResponse } from 'next/og'

// Imagem OG global — gerada dinamicamente (sem precisar de ficheiro de design).
// Faz as partilhas do site terem uma pré-visualização profissional em vez de
// um cartão vazio. Cada página herda esta imagem (Next App Router).

export const runtime = 'edge'
export const alt = 'Phlox Clinical — Farmacologia clínica em português'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '80px',
          background: 'linear-gradient(135deg, #0b1120 0%, #0d4f3c 100%)',
          color: 'white', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: '#10b981' }} />
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#5eead4' }}>Phlox Clinical</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 900 }}>
          Farmacologia clínica, em português.
        </div>
        <div style={{ fontSize: 30, color: '#94a3b8', marginTop: 28, maxWidth: 880, lineHeight: 1.35 }}>
          Interações, registo de saúde, e ferramentas para instituições, profissionais e famílias.
        </div>
      </div>
    ),
    { ...size },
  )
}
