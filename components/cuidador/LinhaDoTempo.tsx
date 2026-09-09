'use client'

// components/cuidador/LinhaDoTempo.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A linha do tempo de quem se cuida em casa.
//
// Do lado institucional há um livro de registos: quem fez o quê, quando. Do
// lado do cuidador não havia nada disso — havia páginas separadas para a
// medicação, para os vitais, para os sintomas, e nenhuma que respondesse à
// pergunta que se faz mesmo: **como é que ele tem estado?**
//
// Isto junta tudo o que ficou registado sobre uma pessoa, por dia. É o que se
// leva para a consulta e é o que mostra, de relance, as semanas em que o
// acompanhamento se perdeu — os buracos são tão informativos como as marcas.
//
// Não inventa nada: cada linha é um registo que existe. Um dia sem nada fica
// vazio, e é isso mesmo que se quer ver.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'

export interface EventoLinha {
  data: string                       // YYYY-MM-DD
  tipo: 'dose' | 'vital' | 'sintoma' | 'consulta' | 'nota'
  texto: string
  detalhe?: string | null
  alerta?: boolean
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

const COR: Record<EventoLinha['tipo'], string> = {
  dose: '#0d9488', vital: '#1d4ed8', sintoma: '#b45309',
  consulta: '#7c3aed', nota: 'var(--ink-4)',
}
const ROTULO: Record<EventoLinha['tipo'], string> = {
  dose: 'Medicação', vital: 'Medição', sintoma: 'Queixa',
  consulta: 'Consulta', nota: 'Nota',
}

export default function LinhaDoTempo({ eventos, dias = 30, vazioTexto }: {
  eventos: EventoLinha[]
  dias?: number
  vazioTexto?: string
}) {
  // Um dia por linha, do mais recente para trás — incluindo os dias vazios,
  // porque um buraco de duas semanas é o sinal mais claro que esta vista dá.
  const linhas = useMemo(() => {
    const porDia = new Map<string, EventoLinha[]>()
    eventos.forEach(e => {
      const d = String(e.data).slice(0, 10)
      if (!d) return
      if (!porDia.has(d)) porDia.set(d, [])
      porDia.get(d)!.push(e)
    })
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0)
    const out: { data: string; eventos: EventoLinha[] }[] = []
    for (let i = 0; i < dias; i++) {
      const d = new Date(hoje); d.setDate(d.getDate() - i)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      out.push({ data: k, eventos: porDia.get(k) || [] })
    }
    // Corta o silêncio do fim: não vale a pena mostrar quinze dias vazios
    // seguidos antes do primeiro registo que existe.
    while (out.length && !out[out.length - 1].eventos.length) out.pop()
    return out
  }, [eventos, dias])

  if (!linhas.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55, padding: '14px 0', textWrap: 'pretty' as any }}>
        {vazioTexto || 'Ainda não há nada registado. A linha do tempo enche-se à medida que fores marcando as tomas, as medições e o que for acontecendo.'}
      </div>
    )
  }

  const totalVazios = linhas.filter(l => !l.eventos.length).length

  return (
    <div>
      <div style={{ position: 'relative', paddingLeft: 78 }}>
        {/* A espinha */}
        <span style={{ position: 'absolute', left: 61, top: 6, bottom: 6, width: 1, background: 'var(--border)' }} />

        {linhas.map(l => {
          const d = new Date(l.data + 'T12:00:00')
          const vazio = !l.eventos.length
          const hoje = l.data === new Date().toISOString().slice(0, 10)
          return (
            <div key={l.data} style={{ position: 'relative', minHeight: vazio ? 22 : 40, paddingBottom: vazio ? 0 : 12 }}>
              {/* Data, à esquerda da espinha */}
              <span style={{
                position: 'absolute', left: -78, top: 0, width: 54, textAlign: 'right',
                ...MONO, fontSize: 9.5, color: hoje ? 'var(--ink)' : vazio ? 'var(--ink-5)' : 'var(--ink-4)',
                opacity: vazio ? 0.5 : 1,
              }}>
                {hoje ? 'hoje' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
              </span>

              {/* O nó */}
              <span style={{
                position: 'absolute', left: -20, top: 4,
                width: vazio ? 4 : 8, height: vazio ? 4 : 8, borderRadius: '50%',
                marginLeft: vazio ? 2 : 0,
                background: vazio ? 'var(--bg-4)' : l.eventos.some(e => e.alerta) ? '#b45309' : 'var(--ink-3)',
              }} />

              {vazio ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {l.eventos.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
                      <span style={{
                        ...MONO, fontSize: 8.5, color: COR[e.tipo], flexShrink: 0,
                        width: 62, letterSpacing: '0.1em',
                      }}>{ROTULO[e.tipo]}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, color: e.alerta ? '#78350f' : 'var(--ink-2)', lineHeight: 1.4 }}>{e.texto}</span>
                        {e.detalhe && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{e.detalhe}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalVazios > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 14, lineHeight: 1.5, textWrap: 'pretty' as any }}>
          Os pontos pequenos são dias sem nada registado — {totalVazios} de {linhas.length}.
          Não é uma cobrança: é só o que se vê quando se olha para trás.
        </div>
      )}
    </div>
  )
}
