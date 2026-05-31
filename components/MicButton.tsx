'use client'

// Botão de microfone para input de voz. Quando ativo, devolve o transcript ao
// componente pai via callback. Visualmente pulsa para indicar que está a ouvir.

import { useEffect } from 'react'
import { useSpeechToText } from '@/lib/useSpeechToText'

interface Props {
  onTranscript: (text: string) => void   // chamado a cada FINAL transcript
  onInterim?: (text: string) => void     // chamado a cada parcial
  lang?: string
  size?: number
}

export default function MicButton({ onTranscript, onInterim, lang = 'pt-PT', size = 38 }: Props) {
  const { supported, listening, transcript, interim, start, stop, error } = useSpeechToText(lang)

  useEffect(() => { if (transcript) onTranscript(transcript) }, [transcript]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onInterim?.(interim) }, [interim]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? 'Parar gravação' : 'Falar'}
      title={listening ? 'Parar gravação' : error || 'Falar (pt-PT)'}
      style={{
        width: size, height: size, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: listening ? '#dc2626' : '#f1f5f9',
        color: listening ? 'white' : '#64748b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.15s, transform 0.15s',
        boxShadow: listening ? '0 0 0 4px rgba(220,38,38,0.18)' : 'none',
        position: 'relative',
      }}
    >
      <svg width={Math.round(size * 0.42)} height={Math.round(size * 0.42)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      {listening && (
        <span style={{ position: 'absolute', inset: 0, borderRadius: 10, border: '2px solid rgba(220,38,38,0.6)', animation: 'micRing 1.4s ease-out infinite', pointerEvents: 'none' }} />
      )}
      <style>{`@keyframes micRing { 0%{transform:scale(1); opacity:1} 100%{transform:scale(1.6); opacity:0} }`}</style>
    </button>
  )
}
