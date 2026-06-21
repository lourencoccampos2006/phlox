'use client'

// SavedResultView — renderiza o conteúdo de um item guardado DIRETAMENTE em
// /guardados, sem obrigar a reabrir a ferramenta. Genérico: percorre o payload
// `data` de qualquer ferramenta e mostra-o de forma legível (títulos, listas,
// pares chave/valor, achados com semáforo). Assim o resultado fica MESMO
// guardado e visível — corrige o bug de "abre vazio".

import { useMemo } from 'react'
import type { SavedItem } from '@/lib/saves'

const LABELS: Record<string, string> = {
  input: 'Entrada', drugs: 'Medicamentos', meds: 'Medicamentos', notes: 'Notas',
  overall: 'Resumo geral', summary: 'Resumo', headline: 'Resumo', title: 'Título',
  findings: 'Pontos relevantes', positives: 'Pontos positivos', warnings: 'Avisos',
  recommendation: 'Recomendação', recommendations: 'Recomendações', action: 'O que fazer',
  why: 'Porquê', what_it_is: 'O que é', what_it_treats: 'Trata', simple: 'Em simples',
  technical: 'Técnico', concept: 'Conceito', mnemonic: 'Mnemónica', breakdown: 'Desdobramento',
  questions: 'Perguntas', redFlags: 'Sinais de alarme', red_flags: 'Sinais de alarme',
  level: 'Nível', steps: 'Passos', tip: 'Dica', alt: 'Alternativa', topic: 'Tema',
}

const TL: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  green:  { bg: '#f0fff4', border: '#9ae6b4', color: '#1a4731', dot: '#10b981' },
  yellow: { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b' },
  red:    { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444' },
}

function label(key: string) { return LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function isEmpty(v: any): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
}

// Um "achado" com semáforo (level + title/explanation) — comum a várias ferramentas.
function isFinding(v: any): boolean {
  return v && typeof v === 'object' && typeof v.level === 'string' && (v.title || v.explanation || v.summary)
}

function FindingCard({ f }: { f: any }) {
  const tl = TL[f.level] || TL.yellow
  return (
    <div style={{ background: tl.bg, border: `1px solid ${tl.border}`, borderLeft: `4px solid ${tl.dot}`, borderRadius: '0 8px 8px 0', padding: '10px 12px', marginBottom: 6 }}>
      {(f.title || f.summary) && <div style={{ fontSize: 13.5, fontWeight: 700, color: tl.color, marginBottom: f.explanation ? 3 : 0 }}>{f.title || f.summary}</div>}
      {f.explanation && <div style={{ fontSize: 13, color: tl.color, lineHeight: 1.55, opacity: 0.95 }}>{f.explanation}</div>}
      {f.action && <div style={{ fontSize: 12.5, color: tl.color, marginTop: 5 }}><strong>O que fazer:</strong> {f.action}</div>}
    </div>
  )
}

// Renderiza um valor qualquer (string, número, array, objeto) recursivamente.
function Value({ v, depth = 0 }: { v: any; depth?: number }) {
  if (isEmpty(v)) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    const s = String(v)
    return <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s}</span>
  }
  if (Array.isArray(v)) {
    if (v.every(isFinding)) return <div>{v.map((f, i) => <FindingCard key={i} f={f} />)}</div>
    return (
      <ul style={{ margin: '2px 0', paddingLeft: 18 }}>
        {v.map((item, i) => (
          <li key={i} style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, marginBottom: 3 }}>
            {typeof item === 'object' && item !== null ? <Obj o={item} depth={depth + 1} /> : String(item)}
          </li>
        ))}
      </ul>
    )
  }
  if (typeof v === 'object') {
    if (isFinding(v)) return <FindingCard f={v} />
    return <Obj o={v} depth={depth + 1} />
  }
  return null
}

function Obj({ o, depth = 0 }: { o: Record<string, any>; depth?: number }) {
  const entries = Object.entries(o).filter(([, val]) => !isEmpty(val))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: depth === 0 ? 12 : 6 }}>
      {entries.map(([key, val]) => {
        const scalar = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean'
        return (
          <div key={key}>
            <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: scalar ? 2 : 4 }}>{label(key)}</div>
            <Value v={val} depth={depth} />
          </div>
        )
      })}
    </div>
  )
}

export default function SavedResultView({ item }: { item: SavedItem }) {
  const body = useMemo(() => {
    const d = item.data
    if (d == null) return null
    if (typeof d === 'string') return <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d}</div>
    if (typeof d !== 'object') return <Value v={d} />
    return <Obj o={d} />
  }, [item])

  if (!body) {
    return <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sem conteúdo guardado para mostrar.</div>
  }
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e8edf3', borderRadius: 10, padding: '14px 16px', marginTop: 10 }}>
      {body}
    </div>
  )
}
