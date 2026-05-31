'use client'

// useSpeechToText — wrapper minimal sobre Web Speech API. Funciona em Chrome,
// Edge e Safari iOS. Falha graciosamente em browsers sem suporte.
// Devolve o transcript parcial e final em pt-PT, e controla start/stop.

import { useEffect, useRef, useState } from 'react'

export interface SpeechHook {
  supported: boolean
  listening: boolean
  transcript: string                // parcial + final acumulado
  interim: string                   // o último pedaço ainda não confirmado
  start: () => void
  stop: () => void
  reset: () => void
  error: string
}

export function useSpeechToText(lang: string = 'pt-PT'): SpeechHook {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recogRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setSupported(true)
    const r = new SR()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (ev: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      if (finalText) setTranscript(t => (t ? t + ' ' : '') + finalText.trim())
      setInterim(interimText)
    }
    r.onerror = (ev: any) => { setError(ev?.error || 'speech_error'); setListening(false) }
    r.onend = () => { setListening(false); setInterim('') }
    recogRef.current = r
    return () => { try { r.stop() } catch { /* noop */ } }
  }, [lang])

  function start() {
    if (!recogRef.current || listening) return
    setError(''); setInterim('')
    try { recogRef.current.start(); setListening(true) } catch { setListening(false) }
  }
  function stop() {
    if (!recogRef.current) return
    try { recogRef.current.stop() } catch { /* noop */ }
    setListening(false); setInterim('')
  }
  function reset() { setTranscript(''); setInterim('') }

  return { supported, listening, transcript, interim, start, stop, reset, error }
}
