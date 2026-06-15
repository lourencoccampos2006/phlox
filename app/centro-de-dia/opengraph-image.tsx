import { ImageResponse } from 'next/og'

// Imagem OG dedicada à landing do Centro de Dia — partilha com mensagem dirigida.
export const runtime = 'edge'
export const alt = 'Phlox — o software do seu Centro de Dia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: 'linear-gradient(135deg, #0d9488 0%, #0f5f56 100%)', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#a7f3d0', marginBottom: 24 }}>☀️ Phlox · Centro de Dia</div>
        <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 920 }}>
          O dia dos seus utentes, as famílias tranquilas.
        </div>
        <div style={{ fontSize: 28, color: '#d1fae5', marginTop: 26, maxWidth: 880, lineHeight: 1.35 }}>
          As famílias veem como correu o dia, sem ter de ligar. Montado de raiz para si.
        </div>
      </div>
    ),
    { ...size },
  )
}
