'use client'

// Leitura de código de barras sem bibliotecas externas:
//  1) useWedgeScanner — leitores USB/Bluetooth atuam como teclado. Captamos
//     dígitos digitados muito depressa terminados em Enter → é um scan.
//  2) BarcodeDetector — API nativa do browser (Chrome/Android) para a câmara.

import { useEffect, useRef } from 'react'

// ── Leitor teclado-wedge ───────────────────────────────────────────────────────
// Deteta uma sequência rápida de carateres terminada em Enter, em qualquer parte
// da app (a não ser que o foco esteja num campo de texto livre que não o POS).
export function useWedgeScanner(onScan: (code: string) => void, enabled = true) {
  const buf = useRef('')
  const last = useRef(0)
  const cb = useRef(onScan)
  cb.current = onScan
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      // Permite scan mesmo com foco no input dedicado do POS (data-pos-scan)
      const inFreeField = el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !(el as HTMLElement).hasAttribute('data-pos-scan')))
      if (inFreeField) return
      const now = Date.now()
      if (now - last.current > 80) buf.current = '' // gap grande → começou nova leitura humana
      last.current = now
      if (e.key === 'Enter') {
        const code = buf.current.trim()
        buf.current = ''
        if (code.length >= 4) { e.preventDefault(); cb.current(code) }
        return
      }
      if (e.key.length === 1 && /[0-9A-Za-z]/.test(e.key)) buf.current += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

// ── Disponibilidade da câmara/BarcodeDetector ──────────────────────────────────
export function cameraScanAvailable(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window &&
    !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
}

// ── Scanner por câmara ─────────────────────────────────────────────────────────
// Liga a uma <video> e chama onScan quando deteta um código. Devolve stop().
export async function startCameraScan(video: HTMLVideoElement, onScan: (code: string) => void): Promise<() => void> {
  const AnyWin = window as any
  if (!('BarcodeDetector' in AnyWin)) throw new Error('Câmara de scan não suportada neste browser.')
  const detector = new AnyWin.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'itf'] })
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  video.srcObject = stream
  await video.play()
  let running = true
  let lastCode = ''
  let lastTime = 0
  const tick = async () => {
    if (!running) return
    try {
      const codes = await detector.detect(video)
      if (codes && codes.length) {
        const v = codes[0].rawValue
        const now = Date.now()
        if (v && (v !== lastCode || now - lastTime > 1500)) { lastCode = v; lastTime = now; onScan(v) }
      }
    } catch { /* frame inválido — ignora */ }
    if (running) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return () => {
    running = false
    stream.getTracks().forEach(t => t.stop())
    try { video.srcObject = null } catch { /* ignore */ }
  }
}
