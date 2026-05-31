'use client'

// MyTopTools — atalhos para as 5 ferramentas que o utilizador mais usa.
// Aprende localmente via trackToolUse(); aparece no /inicio.
// Reduz confusão: o utilizador chega e tem logo o que precisa.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTopTools } from '@/lib/userPersona'

// Catálogo de rótulos amigáveis para os paths mais comuns
const LABELS: Record<string, { label: string; icon: string }> = {
  '/mymeds': { label: 'A minha medicação', icon: '💊' },
  '/familia': { label: 'Família', icon: '👨‍👩‍👧' },
  '/interactions': { label: 'Interações', icon: '⚗' },
  '/sintomas': { label: 'Sintomas', icon: '🌡' },
  '/bula': { label: 'Perceber bula', icon: '📄' },
  '/ai': { label: 'Phlox AI', icon: '✨' },
  '/arena': { label: 'Arena', icon: '🏆' },
  '/exam': { label: 'OSCE', icon: '🩺' },
  '/tutor': { label: 'AI Tutor', icon: '🧑‍🏫' },
  '/cases': { label: 'Casos clínicos', icon: '📚' },
  '/cockpit': { label: 'Cockpit', icon: '📊' },
  '/patients': { label: 'Doentes', icon: '👥' },
  '/calc': { label: 'Calculadoras', icon: '∑' },
  '/copiloto': { label: 'AI Copilot', icon: '🤖' },
  '/emergency': { label: 'Cartão emergência', icon: '🆘' },
  '/preparar-consulta': { label: 'Preparar consulta', icon: '📋' },
  '/motor-clinico': { label: 'Decision Engine', icon: '🧠' },
  '/atendimentos': { label: 'Atendimentos', icon: '📝' },
  '/vendas': { label: 'POS', icon: '🧾' },
}

export default function MyTopTools() {
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => { setPaths(getTopTools(5)) }, [])

  if (paths.length === 0) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>O que mais usas</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {paths.map(p => {
          const m = LABELS[p] || { label: p, icon: '→' }
          return (
            <Link key={p} href={p} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              background: 'white', border: '1px solid var(--border)', borderRadius: 999,
              textDecoration: 'none', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600,
            }}>
              <span style={{ fontSize: 14 }}>{m.icon}</span>{m.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
