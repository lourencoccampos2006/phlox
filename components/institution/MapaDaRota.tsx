'use client'

// components/institution/MapaDaRota.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O mapa da rota de transportes.
//
// É um mapa a sério — coordenadas reais, obtidas uma vez por morada
// (app/api/geocode, OpenStreetMap) e guardadas na ficha. As distâncias e as
// direções são verdadeiras: a projeção corrige a longitude pelo cosseno da
// latitude, por isso à latitude de Portugal um quilómetro para norte e um para
// leste medem o mesmo no ecrã.
//
// O que NÃO é: um mapa de azulejos. Sem estradas, sem rótulos de terceiros,
// sem logótipo de ninguém. Um mapa de tiles é uma imagem de outra pessoa
// colada no meio do produto — quebra a paleta, quebra a tipografia, e enche o
// ecrã de informação que quem conduz já conhece de cor.
//
// O que fica é a planta: a casa no centro, cada paragem no seu sítio real, o
// caminho pela ordem das horas, e uma escala em quilómetros para se perceber
// a distância. Desenhado com as mesmas linhas finas e a mesma paleta do resto
// do painel — e legível a preto e branco, porque acaba impresso.
//
// Regra da casa: quem não tem coordenadas NÃO aparece no mapa. Fica listado
// por baixo, com o motivo. Um ponto aproximado manda uma carrinha para o
// sítio errado.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { iniciais } from '@/lib/presenca'
import type { Rota, Paragem } from '@/lib/rotaTransporte'

export interface PontoCasa { lat: number; lon: number; nome: string }

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

const L = 720, A = 460, PAD = 54

/** Distância em km entre dois pontos (haversine). */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function MapaDaRota({ rota, casa, cor, marcar, podeEditar }: {
  rota: Rota
  /** a instituição, quando tem coordenadas — é a origem e o fim do percurso */
  casa: PontoCasa | null
  cor: string
  marcar: (scheduleId: string) => void
  podeEditar: boolean
}) {
  const [sobre, setSobre] = useState<string | null>(null)

  const comGeo = rota.paragens.filter(p => p.lat != null && p.lon != null) as (Paragem & { lat: number; lon: number })[]
  const semGeo = rota.paragens.filter(p => p.lat == null || p.lon == null)

  const plano = useMemo(() => {
    if (!comGeo.length) return null
    const pontos = casa ? [...comGeo, casa as any] : comGeo
    const lats = pontos.map(p => p.lat), lons = pontos.map(p => p.lon)
    const latC = (Math.min(...lats) + Math.max(...lats)) / 2
    // À latitude de Portugal, um grau de longitude é ~0,73 de um grau de
    // latitude em metros. Sem esta correção o mapa sai esticado na horizontal.
    const kx = Math.cos(latC * Math.PI / 180)

    const xs = lons.map(v => v * kx), ys = lats.map(v => v)
    let x0 = Math.min(...xs), x1 = Math.max(...xs)
    let y0 = Math.min(...ys), y1 = Math.max(...ys)
    // Com um ponto só (ou todos no mesmo sítio) não há extensão: dá-se-lhe uma.
    const MIN = 0.004
    if (x1 - x0 < MIN) { const c = (x0 + x1) / 2; x0 = c - MIN / 2; x1 = c + MIN / 2 }
    if (y1 - y0 < MIN) { const c = (y0 + y1) / 2; y0 = c - MIN / 2; y1 = c + MIN / 2 }

    // Mesma escala nos dois eixos — senão as distâncias mentem.
    const escala = Math.min((L - PAD * 2) / (x1 - x0), (A - PAD * 2) / (y1 - y0))
    const cxDes = (x0 + x1) / 2, cyDes = (y0 + y1) / 2
    const proj = (lat: number, lon: number) => ({
      x: L / 2 + (lon * kx - cxDes) * escala,
      y: A / 2 - (lat - cyDes) * escala,      // norte para cima
    })

    // Escala em km: escolhe um valor redondo que caiba bem no desenho.
    const grausPorPx = 1 / escala
    const kmPorPx = grausPorPx * 111.32
    const alvo = 150 * kmPorPx
    const passo = [0.2, 0.5, 1, 2, 5, 10, 20, 50].find(v => v >= alvo) ?? 100
    const barraPx = passo / kmPorPx

    return { proj, barraPx, passoKm: passo }
  }, [comGeo, casa])

  if (!rota.paragens.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55, padding: '16px 0 4px', textWrap: 'pretty' as any }}>
        Não há transportes marcados para hoje. Cria um horário recorrente numa pessoa e a rota aparece aqui.
      </div>
    )
  }

  const traco = plano && comGeo.length > 1
    ? comGeo.map(p => { const q = plano.proj(p.lat, p.lon); return `${q.x.toFixed(1)},${q.y.toFixed(1)}` }).join(' ')
    : ''

  const distanciaTotal = comGeo.length > 1
    ? comGeo.slice(1).reduce((s, p, i) => s + km(comGeo[i], p), 0) + (casa ? km(casa, comGeo[0]) + km(comGeo[comGeo.length - 1], casa) : 0)
    : null

  return (
    <div>
      {/* Números da rota */}
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 16 }}>
        <Num v={String(rota.paragens.length)} l={rota.paragens.length === 1 ? 'paragem' : 'paragens'} />
        {rota.primeira && <Num v={`${rota.primeira}–${rota.ultima}`} l="janela" mono />}
        {distanciaTotal != null && <Num v={`${distanciaTotal.toFixed(1)} km`} l={casa ? 'ida e volta à casa' : 'entre paragens'} />}
        <Num v={`${rota.feitas}/${rota.paragens.length}`} l="já feitas" c={rota.feitas === rota.paragens.length ? cor : undefined} />
      </div>

      {plano ? (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          background: 'var(--bg)', overflow: 'hidden',
        }}>
          <svg viewBox={`0 0 ${L} ${A}`} width="100%" style={{ display: 'block' }} role="img"
            aria-label={`Mapa da rota com ${comGeo.length} paragens`}>
            <defs>
              {/* Papel quadriculado leve: dá noção de escala sem competir com nada. */}
              <pattern id="mrGrelha" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M36 0H0V36" fill="none" stroke="var(--bg-3)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={L} height={A} fill="url(#mrGrelha)" />

            {/* Ligação casa → primeira e última → casa, a tracejado: é o
                trajeto que a carrinha faz mas que não tem paragem. */}
            {casa && comGeo.length > 0 && (() => {
              const c = plano.proj(casa.lat, casa.lon)
              const a = plano.proj(comGeo[0].lat, comGeo[0].lon)
              const z = plano.proj(comGeo[comGeo.length - 1].lat, comGeo[comGeo.length - 1].lon)
              return (
                <g>
                  <line x1={c.x} y1={c.y} x2={a.x} y2={a.y} stroke="var(--ink-5)" strokeWidth="1.25" strokeDasharray="3 5" />
                  <line x1={z.x} y1={z.y} x2={c.x} y2={c.y} stroke="var(--ink-5)" strokeWidth="1.25" strokeDasharray="3 5" />
                </g>
              )
            })()}

            {/* O percurso, pela ordem das horas */}
            {traco && <polyline points={traco} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />}

            {/* A casa */}
            {casa && (() => {
              const c = plano.proj(casa.lat, casa.lon)
              return (
                <g>
                  <rect x={c.x - 7} y={c.y - 7} width="14" height="14" fill="var(--ink)" transform={`rotate(45 ${c.x} ${c.y})`} />
                  <text x={c.x} y={c.y + 26} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)"
                    fontFamily="var(--font-mono)" letterSpacing="0.1em">{casa.nome.slice(0, 22).toUpperCase()}</text>
                </g>
              )
            })()}

            {/* As paragens */}
            {comGeo.map((p, i) => {
              const q = plano.proj(p.lat, p.lon)
              const activo = sobre === p.scheduleId
              return (
                <g key={p.scheduleId}
                  onClick={() => podeEditar && marcar(p.scheduleId)}
                  onMouseEnter={() => setSobre(p.scheduleId)}
                  onMouseLeave={() => setSobre(null)}
                  style={{ cursor: podeEditar ? 'pointer' : 'default' }}>
                  <circle cx={q.x} cy={q.y} r={activo ? 17 : 13} fill="var(--bg)" stroke={p.feito ? cor : 'var(--ink)'} strokeWidth="2" />
                  <text x={q.x} y={q.y + 4} textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={p.feito ? cor : 'var(--ink)'} fontFamily="var(--font-mono)"
                    style={{ textDecoration: p.feito ? 'line-through' : 'none' }}>{i + 1}</text>
                  {p.hora && (
                    <text x={q.x} y={q.y - 20} textAnchor="middle" fontSize="10.5" fill="var(--ink-4)" fontFamily="var(--font-mono)">{p.hora}</text>
                  )}
                  <text x={q.x} y={q.y + 28} textAnchor="middle" fontSize="11.5" fill={p.feito ? 'var(--ink-5)' : 'var(--ink-2)'}>
                    {p.nome.split(' ')[0]}
                  </text>
                </g>
              )
            })}

            {/* Escala e norte — o que faz disto um mapa e não um esquema */}
            <g transform={`translate(${PAD - 18} ${A - 22})`}>
              <line x1="0" y1="0" x2={plano.barraPx} y2="0" stroke="var(--ink-3)" strokeWidth="1.5" />
              <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--ink-3)" strokeWidth="1.5" />
              <line x1={plano.barraPx} y1="-4" x2={plano.barraPx} y2="4" stroke="var(--ink-3)" strokeWidth="1.5" />
              <text x={plano.barraPx / 2} y="-9" textAnchor="middle" fontSize="9.5" fill="var(--ink-4)"
                fontFamily="var(--font-mono)" letterSpacing="0.1em">{plano.passoKm < 1 ? `${plano.passoKm * 1000} M` : `${plano.passoKm} KM`}</text>
            </g>
            <g transform={`translate(${L - PAD + 6} ${PAD - 20})`}>
              <line x1="0" y1="16" x2="0" y2="-4" stroke="var(--ink-3)" strokeWidth="1.5" />
              <path d="M0 -9 L4 -1 L-4 -1 Z" fill="var(--ink-3)" />
              <text x="0" y="30" textAnchor="middle" fontSize="9.5" fill="var(--ink-4)" fontFamily="var(--font-mono)">N</text>
            </g>
          </svg>
        </div>
      ) : (
        <div style={{
          border: '1px dashed var(--border-2)', borderRadius: 'var(--r-lg)',
          padding: '26px 20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.55,
        }}>
          Ainda não há moradas convertidas em coordenadas.<br />
          Preenche a morada na ficha de cada pessoa e o mapa desenha-se sozinho.
        </div>
      )}

      {/* A ordem, em texto — para quem imprime e para quem lê com leitor de ecrã */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
        {rota.paragens.map((p, i) => (
          <button key={p.scheduleId}
            onClick={() => podeEditar && marcar(p.scheduleId)}
            onMouseEnter={() => setSobre(p.scheduleId)} onMouseLeave={() => setSobre(null)}
            disabled={!podeEditar}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
              border: `1px solid ${sobre === p.scheduleId ? 'var(--ink)' : 'var(--bg-3)'}`,
              borderRadius: 'var(--r-md)', padding: '9px 11px', background: 'var(--bg)',
              cursor: podeEditar ? 'pointer' : 'default', fontFamily: 'inherit', minWidth: 0,
              opacity: p.feito ? 0.55 : 1,
            }}>
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
              border: `1.5px solid ${p.feito ? cor : 'var(--ink-4)'}`, background: p.feito ? cor : 'transparent',
              color: p.feito ? 'white' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{p.lat != null ? i + 1 : '·'}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: p.feito ? 'line-through' : 'none' }}>
                {p.hora ? `${p.hora} · ` : ''}{p.nome}
              </span>
              <span style={{ ...MONO, display: 'block', marginTop: 2, fontSize: 9 }}>
                {p.lat != null ? p.zona : 'sem coordenadas'}
              </span>
            </span>
          </button>
        ))}
      </div>

      {semGeo.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 12, lineHeight: 1.5, textWrap: 'pretty' as any }}>
          {semGeo.length === 1 ? 'Uma pessoa não aparece no mapa' : `${semGeo.length} pessoas não aparecem no mapa`}
          {' '}({semGeo.map(p => p.nome.split(' ')[0]).join(', ')}) — sem morada, ou com uma morada que não foi possível localizar.
          Preferimos deixá-{semGeo.length === 1 ? 'la' : 'las'} de fora a pôr um ponto aproximado.
        </div>
      )}
    </div>
  )
}

function Num({ v, l, c, mono }: { v: string; l: string; c?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-serif)',
        fontSize: mono ? 19 : 24, fontWeight: mono ? 500 : 400,
        lineHeight: 1, color: c || 'var(--ink)', letterSpacing: '-0.01em',
      }}>{v}</div>
      <div style={{ ...MONO, marginTop: 6 }}>{l}</div>
    </div>
  )
}
