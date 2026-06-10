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
    const W = 1080, H = 1080, M = 96
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d'); if (!ctx) return null

    // Fundo levemente off-white (editorial)
    ctx.fillStyle = '#fbfbfa'; ctx.fillRect(0, 0, W, H)
    // Cartão branco com margem
    const cardX = 56, cardY = 56, cardW = W - 112, cardH = H - 112, r = 40
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.fill()
    ctx.strokeStyle = '#ededed'; ctx.lineWidth = 2; roundRect(ctx, cardX, cardY, cardW, cardH, r); ctx.stroke()
    // Barra de acento à esquerda
    ctx.fillStyle = badge ? badgeColor : '#0d6e42'
    roundRect(ctx, cardX, cardY, 14, cardH, 7); ctx.fill()

    // Marca (topo)
    ctx.fillStyle = '#0d6e42'; ctx.font = '800 34px Georgia'
    ctx.fillText('Phlox', M, 168)
    ctx.fillStyle = '#b8bcc4'; ctx.font = '500 20px Arial'
    ctx.fillText('CLINICAL', M + 132, 168)

    let y = 300
    // Badge (pílula colorida)
    if (badge) {
      ctx.font = '800 30px Arial'
      const bw = ctx.measureText(badge.toUpperCase()).width + 56
      ctx.fillStyle = hexA(badgeColor, 0.12)
      roundRect(ctx, M, y - 38, bw, 56, 28); ctx.fill()
      ctx.fillStyle = badgeColor
      ctx.fillText(badge.toUpperCase(), M + 28, y); y += 86
    }

    // Título (serif grande)
    ctx.fillStyle = '#16181d'; ctx.font = '700 72px Georgia'
    for (const l of wrap(ctx, title, cardW - (M - cardX) - 64)) { ctx.fillText(l, M, y); y += 86 }
    y += 30

    // Linha divisória subtil
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); y += 56

    // Linhas de conteúdo
    ctx.fillStyle = '#3f3f46'; ctx.font = '400 38px Arial'
    for (const line of lines) {
      for (const l of wrap(ctx, line, cardW - (M - cardX) - 64)) { ctx.fillText(l, M, y); y += 56 }
      y += 18
    }

    // Rodapé
    ctx.fillStyle = '#a1a1aa'; ctx.font = '400 24px Arial'
    ctx.fillText(footer || 'Informação de apoio — confirma com o farmacêutico.', M, H - 150)
    // CTA destacado
    ctx.fillStyle = '#0d6e42'; ctx.font = '700 30px Arial'
    ctx.fillText('phloxclinical.com', M, H - 100)
    ctx.fillStyle = '#8b8f99'; ctx.font = '400 24px Arial'
    ctx.fillText('Saúde, medicação e estudo — em português.', M, H - 64)

    return new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.95))
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + w, y, x + w, y + h, rad)
    ctx.arcTo(x + w, y + h, x, y + h, rad)
    ctx.arcTo(x, y + h, x, y, rad)
    ctx.arcTo(x, y, x + w, y, rad)
    ctx.closePath()
  }
  function hexA(hex: string, a: number): string {
    const h = hex.replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
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
