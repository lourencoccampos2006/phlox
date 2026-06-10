'use client'

// ShareCard — gera um cartão visual (PNG via canvas) com o resultado e a marca
// Phlox, para partilhar (WhatsApp/Instagram). Motor de viralidade: cada partilha
// expõe a marca e traz novos utilizadores.
//
// Uso:
//   <ShareCard title="Varfarina + Ibuprofeno" badge="GRAVE" badgeColor="#dc2626"
//              lines={["Risco de hemorragia grave.", "Fala com o farmacêutico."]} />

import { useState, useRef } from 'react'

interface Props {
  title: string
  badge?: string
  badgeColor?: string
  lines: string[]
  footer?: string
  label?: string  // texto do botão
}

export default function ShareCard({ title, badge, badgeColor = '#0d6e42', lines, footer, label = 'Partilhar' }: Props) {
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' '); const out: string[] = []; let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w } else line = test
    }
    if (line) out.push(line)
    return out
  }

  async function render(): Promise<Blob | null> {
    const W = 1080, H = 1080
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); if (!ctx) return null

    // Fundo branco editorial
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, W, 12)

    // Marca
    ctx.fillStyle = '#0d6e42'; ctx.font = '700 30px Arial'
    ctx.fillText('✚ PHLOX', 80, 130)
    ctx.fillStyle = '#8b8f99'; ctx.font = '400 22px Arial'
    ctx.fillText('phloxclinical.com', 80, 165)

    // Badge
    let y = 320
    if (badge) {
      ctx.fillStyle = badgeColor; ctx.font = '800 26px Arial'
      ctx.fillText(badge.toUpperCase(), 80, y); y += 50
    }

    // Título
    ctx.fillStyle = '#16181d'; ctx.font = '700 64px Georgia'
    for (const l of wrap(ctx, title, W - 160)) { ctx.fillText(l, 80, y); y += 78 }
    y += 24

    // Linhas
    ctx.fillStyle = '#3f3f46'; ctx.font = '400 36px Arial'
    for (const line of lines) {
      for (const l of wrap(ctx, line, W - 160)) { ctx.fillText(l, 80, y); y += 50 }
      y += 14
    }

    // Rodapé
    ctx.fillStyle = '#a1a1aa'; ctx.font = '400 24px Arial'
    ctx.fillText(footer || 'Informação de apoio — confirma com o teu farmacêutico.', 80, H - 90)
    ctx.fillStyle = '#0d6e42'; ctx.font = '700 26px Arial'
    ctx.fillText('Verifica a tua medicação em phloxclinical.com', 80, H - 50)

    return new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.92))
  }

  async function share() {
    setBusy(true)
    try {
      const blob = await render()
      if (!blob) throw new Error()
      const file = new File([blob], 'phlox.png', { type: 'image/png' })
      const navAny = navigator as any
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navAny.share({ files: [file], title: 'Phlox', text: `${title} — via Phlox` })
      } else {
        // Fallback: descarregar a imagem
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'phlox.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* utilizador cancelou ou sem suporte */ } finally { setBusy(false) }
  }

  return (
    <>
      <button onClick={share} disabled={busy} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
        background: 'white', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: '#374151',
      }}>
        <span>↗</span> {busy ? 'A preparar…' : label}
      </button>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  )
}
