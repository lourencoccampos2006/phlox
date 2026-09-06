'use client'

// components/institution/ListaDePicking.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que a preparação da medicação passou a produzir, além de marcar quadrados.
//
// A grelha semanal diz "está preparado". Não diz o que é preciso ter em cima da
// mesa para o preparar — e é isso que faz alguém abrir a página na segunda-feira
// de manhã. Esta lista sai dos MESMOS dados (patient_meds.shifts, os turnos de
// cada medicamento ativo), somados por fármaco em vez de por pessoa:
//
//   Paracetamol 1g ......... 42 unidades   ·  6 pessoas
//
// E cruza com o stock: quando as existências não chegam para a semana, diz
// quanto falta. É a diferença entre "marcar o que já se fez" e "saber o que
// falta antes de começar".
//
// Regra da casa: nada é estimado. Se um medicamento não tem turnos marcados,
// conta uma dose por dia e a linha diz que foi assim que se contou.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'

export interface MedParaPicking {
  patient_id: string
  name: string
  dose?: string | null
  shifts?: string[] | null
}
export interface ItemStock { name: string; quantity: number; unit?: string | null; min_quantity?: number | null }

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

/** "Paracetamol 1g" e "paracetamol  1 g" são o mesmo para efeitos de soma. */
const chave = (nome: string, dose?: string | null) =>
  `${String(nome || '').trim().toLowerCase()}|${String(dose || '').trim().toLowerCase().replace(/\s+/g, '')}`

interface Linha {
  nome: string
  dose: string | null
  porSemana: number
  pessoas: number
  semHorario: boolean
  emStock: number | null
  unidade: string | null
  falta: number
}

export default function ListaDePicking({ meds, stock, dias = 7, cor }: {
  meds: MedParaPicking[]
  stock: ItemStock[]
  /** dias que a preparação cobre — a grelha é semanal */
  dias?: number
  cor: string
}) {
  const [aberto, setAberto] = useState(false)

  const linhas: Linha[] = useMemo(() => {
    const acc = new Map<string, Linha>()
    for (const m of meds) {
      if (!m.name) continue
      const k = chave(m.name, m.dose)
      const porDia = Array.isArray(m.shifts) && m.shifts.length ? m.shifts.length : 1
      const semHorario = !Array.isArray(m.shifts) || !m.shifts.length
      const linha = acc.get(k) || {
        nome: m.name.trim(), dose: m.dose?.trim() || null,
        porSemana: 0, pessoas: 0, semHorario: false,
        emStock: null, unidade: null, falta: 0,
      }
      linha.porSemana += porDia * dias
      linha.pessoas += 1
      linha.semHorario = linha.semHorario || semHorario
      acc.set(k, linha)
    }

    // Cruzar com o stock por nome. A correspondência é por texto — só se diz
    // que falta quando há mesmo uma linha de stock com aquele nome; sem isso,
    // fica "sem stock registado", que é diferente de "não há".
    const porNome = new Map<string, ItemStock>()
    stock.forEach(s => porNome.set(String(s.name || '').trim().toLowerCase(), s))

    return [...acc.values()].map(l => {
      const s = porNome.get(l.nome.toLowerCase())
      const emStock = s ? Number(s.quantity) || 0 : null
      return {
        ...l,
        emStock,
        unidade: s?.unit || null,
        falta: emStock != null && emStock < l.porSemana ? l.porSemana - emStock : 0,
      }
    }).sort((a, b) => (b.falta - a.falta) || (b.porSemana - a.porSemana))
  }, [meds, stock, dias])

  if (!linhas.length) return null

  const emFalta = linhas.filter(l => l.falta > 0)
  const total = linhas.reduce((s, l) => s + l.porSemana, 0)
  const mostrar = aberto ? linhas : linhas.slice(0, 6)

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...MONO, fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-4)', fontWeight: 700 }}>
          O que é preciso para a semana
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>
          {total} unidades · {linhas.length} {linhas.length === 1 ? 'medicamento' : 'medicamentos'}
        </span>
      </div>

      {emFalta.length > 0 && (
        <div style={{
          marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: '#78350f', lineHeight: 1.5,
        }}>
          <strong>{emFalta.length} {emFalta.length === 1 ? 'medicamento não chega' : 'medicamentos não chegam'} para a semana.</strong>{' '}
          {emFalta.slice(0, 3).map(l => `${l.nome} (faltam ${l.falta})`).join(', ')}
          {emFalta.length > 3 ? ` e mais ${emFalta.length - 3}.` : '.'}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {mostrar.map(l => (
          <div key={l.nome + l.dose} style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12,
            alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid var(--bg-3)',
          }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{l.nome}</span>
              {l.dose && <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}> {l.dose}</span>}
              <span style={{ ...MONO, display: 'block', marginTop: 3, fontSize: 9 }}>
                {l.pessoas} {l.pessoas === 1 ? 'pessoa' : 'pessoas'}
                {l.semHorario ? ' · sem turnos marcados, contado a 1/dia' : ''}
                {l.emStock == null ? ' · sem stock registado' : ` · ${l.emStock}${l.unidade ? ' ' + l.unidade : ''} em stock`}
              </span>
            </span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
                color: l.falta > 0 ? '#b45309' : 'var(--ink)',
              }}>{l.porSemana}</span>
              {l.falta > 0 && (
                <span style={{ display: 'block', ...MONO, fontSize: 9, color: '#b45309', marginTop: 2 }}>
                  faltam {l.falta}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {linhas.length > 6 && (
        <button onClick={() => setAberto(a => !a)} style={{
          marginTop: 12, minHeight: 36, padding: '0 12px', borderRadius: 8,
          border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--ink-3)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>{aberto ? 'Ver menos' : `Ver os outros ${linhas.length - 6}`}</button>
      )}

      <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 12, lineHeight: 1.5, textWrap: 'pretty' as any }}>
        Contado a partir dos turnos de cada medicamento ativo, para {dias} dias. O stock é cruzado por
        nome — um medicamento que exista em stock com outro nome aparece como “sem stock registado”.
      </div>
    </div>
  )
}
