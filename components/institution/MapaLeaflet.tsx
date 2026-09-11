'use client'

// components/institution/MapaLeaflet.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O mapa da rota. Agora com um mapa a sério.
//
// A versão anterior desenhava tudo em SVG à mão: projeção Web Mercator própria,
// azulejos do OpenStreetMap a 55% de opacidade por baixo, e nada de arrastar
// nem de zoom. Funcionava, mas era um cartaz — e quem organiza transportes
// precisa de mexer no mapa: aproximar uma zona, ver onde fica uma porta.
//
// Duas mudanças:
//   • Leaflet, que traz arrastar, zoom e marcadores que não descolam do sítio.
//     São ~42 KB, carregados só quando alguém abre esta página.
//   • Fundo CARTO Positron em vez dos azulejos normais do OSM. O Positron é
//     desenhado precisamente para se pôr dados por cima: cinza claro, estradas
//     finas, poucos rótulos. O mapa do OSM é bonito sozinho e péssimo por baixo
//     de uma rota — era por isso que estava a 55% de opacidade, a tentar
//     desaparecer.
//
// O que NÃO mudou, de propósito: quem não tem coordenadas continua fora do
// mapa, listado à parte. Nunca se aproxima um ponto — um ponto errado manda uma
// carrinha à porta errada.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Rota, Paragem } from '@/lib/rotaTransporte'

export interface PontoCasa { lat: number; lon: number; nome: string }

export interface RotaCalculada {
  ordem: string[]
  minutosTotal: number
  kmTotal: number
  pernas: number[]
  geometria: [number, number][]   // [lon, lat] das estradas reais
  otimizada: boolean
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

export default function MapaLeaflet({
  rota, casa, cor, marcar, podeEditar, calculada, aCalcular, otimizar, alturaMin = 380,
}: {
  rota: Rota
  casa: PontoCasa | null
  cor: string
  marcar: (scheduleId: string) => void
  podeEditar: boolean
  calculada?: RotaCalculada | null
  aCalcular?: boolean
  otimizar?: () => void
  alturaMin?: number
}) {
  const caixa = useRef<HTMLDivElement | null>(null)
  const mapa = useRef<any>(null)
  const camada = useRef<any>(null)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')

  const comGeo = rota.paragens.filter(p => p.lat != null && p.lon != null) as (Paragem & { lat: number; lon: number })[]
  const semGeo = rota.paragens.filter(p => p.lat == null || p.lon == null)

  // A ordem a desenhar: a do serviço de rotas quando existe, senão a das horas.
  const ordenadas = calculada?.ordem?.length
    ? (calculada.ordem.map(id => comGeo.find(p => p.scheduleId === id)).filter(Boolean) as typeof comGeo)
    : comGeo

  // ── Arrancar o mapa, uma vez ───────────────────────────────────────────────
  useEffect(() => {
    let vivo = true
    if (!caixa.current || mapa.current) return
    ;(async () => {
      try {
        const L = (await import('leaflet')).default
        if (!vivo || !caixa.current || mapa.current) return

        const m = L.map(caixa.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,   // senão a página deixa de se conseguir percorrer
        }).setView([39.6, -8.0], 7)

        // Positron da CARTO: cinza claro, feito para levar dados por cima.
        // A atribuição é obrigatória — do OpenStreetMap e da CARTO.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd', maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(m)

        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m)

        // Arrastar funciona sempre; a roda só depois de clicar, para a página
        // não ficar presa quando alguém passa por cima a percorrer.
        m.on('click', () => m.scrollWheelZoom.enable())
        m.on('mouseout', () => m.scrollWheelZoom.disable())

        mapa.current = m
        camada.current = L.layerGroup().addTo(m)
        setPronto(true)
      } catch {
        if (vivo) setErro('Não foi possível carregar o mapa. A lista em baixo tem a rota toda.')
      }
    })()
    return () => {
      vivo = false
      if (mapa.current) { mapa.current.remove(); mapa.current = null }
    }
  }, [])

  // ── Redesenhar sempre que a rota muda ─────────────────────────────────────
  useEffect(() => {
    if (!pronto || !mapa.current || !camada.current) return
    let vivo = true
    ;(async () => {
      const L = (await import('leaflet')).default
      if (!vivo || !mapa.current) return
      camada.current.clearLayers()

      const pontos: [number, number][] = []

      // A estrada verdadeira, quando o serviço de rotas a devolveu. Senão, uma
      // linha tracejada entre as portas — que é uma ligação, não um caminho, e
      // o tracejado diz isso sem ser preciso escrever.
      if (calculada?.geometria?.length) {
        const linha = calculada.geometria.map(([lon, lat]) => [lat, lon] as [number, number])
        L.polyline(linha, { color: cor, weight: 4, opacity: 0.85, lineJoin: 'round' }).addTo(camada.current)
        pontos.push(...linha)
      } else if (ordenadas.length) {
        const seq: [number, number][] = []
        if (casa) seq.push([casa.lat, casa.lon])
        ordenadas.forEach(p => seq.push([p.lat, p.lon]))
        if (casa) seq.push([casa.lat, casa.lon])
        L.polyline(seq, { color: cor, weight: 2.5, opacity: 0.5, dashArray: '6 7' }).addTo(camada.current)
      }

      // A casa
      if (casa) {
        pontos.push([casa.lat, casa.lon])
        L.marker([casa.lat, casa.lon], {
          icon: L.divIcon({
            className: '', iconSize: [26, 26], iconAnchor: [13, 13],
            html: `<div style="width:26px;height:26px;border-radius:7px;background:var(--ink,#16211f);
              display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px/1 system-ui;
              box-shadow:0 1px 5px rgba(0,0,0,.3)">&#8962;</div>`,
          }),
        }).addTo(camada.current).bindTooltip(casa.nome, { direction: 'top' })
      }

      // As paragens, numeradas pela ordem do percurso
      ordenadas.forEach((p, i) => {
        pontos.push([p.lat, p.lon])
        const feito = p.feito
        const fundo = feito ? '#94a3b8' : cor
        const mk = L.marker([p.lat, p.lon], {
          icon: L.divIcon({
            className: '', iconSize: [30, 30], iconAnchor: [15, 15],
            html: `<div style="width:30px;height:30px;border-radius:50%;background:${fundo};
              border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
              color:#fff;font:700 12px/1 system-ui;box-shadow:0 1px 5px rgba(0,0,0,.35);
              ${feito ? 'opacity:.65' : ''}">${feito ? '&#10003;' : i + 1}</div>`,
          }),
        }).addTo(camada.current)

        const horaTexto = (p as any).horaEstimada || p.hora || null
        mk.bindTooltip(
          `<strong>${escapar(p.nome)}</strong>${horaTexto ? ` · ${escapar(horaTexto)}` : ''}` +
          (p.morada ? `<br><span style="opacity:.75">${escapar(p.morada)}</span>` : ''),
          { direction: 'top', offset: [0, -8] },
        )
        if (podeEditar) {
          mk.on('click', () => marcar(p.scheduleId))
          mk.getElement()?.style.setProperty('cursor', 'pointer')
        }
      })

      if (pontos.length === 1) mapa.current.setView(pontos[0], 14)
      else if (pontos.length > 1) mapa.current.fitBounds(L.latLngBounds(pontos), { padding: [34, 34], maxZoom: 16 })
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, rota, calculada, casa, cor, podeEditar])

  const nada = !comGeo.length && !casa

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 9, flexWrap: 'wrap' }}>
        <div style={MONO}>
          O percurso
          {calculada ? ` · ${calculada.kmTotal} km · ${calculada.minutosTotal} min` : ''}
        </div>
        {otimizar && comGeo.length > 1 && (
          <button onClick={otimizar} disabled={aCalcular} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 7,
            padding: '5px 11px', fontFamily: 'inherit', fontSize: 12, fontWeight: 650,
            color: aCalcular ? 'var(--ink-5)' : 'var(--ink-2)', cursor: aCalcular ? 'wait' : 'pointer',
          }}>
            {aCalcular ? 'A calcular…' : calculada?.otimizada ? 'Recalcular' : 'Ordem que faz menos quilómetros'}
          </button>
        )}
      </div>

      {nada ? (
        <div style={{
          border: '1px dashed var(--border)', borderRadius: 'var(--r-md)',
          padding: '26px 20px', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, textAlign: 'center',
        }}>
          Ainda não há moradas convertidas em pontos no mapa. Assim que as fichas tiverem
          morada, o percurso aparece aqui.
        </div>
      ) : (
        <div
          ref={caixa}
          style={{
            height: alturaMin, width: '100%', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-2)',
            zIndex: 0,
          }}
        />
      )}

      {erro && (
        <div style={{ marginTop: 9, fontSize: 12.5, color: '#b45309', lineHeight: 1.55 }}>{erro}</div>
      )}

      {semGeo.length > 0 && (
        <div style={{ marginTop: 11, fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink-3)', fontWeight: 650 }}>
            {semGeo.length === 1 ? 'Uma pessoa fica fora do mapa' : `${semGeo.length} pessoas ficam fora do mapa`}
          </strong>{' '}
          — {semGeo.map(p => p.nome).join(', ')}. Falta a morada na ficha, ou o mapa não a
          reconheceu. Não as colocamos por aproximação: um ponto errado manda a carrinha à porta errada.
        </div>
      )}
    </div>
  )
}

function escapar(v: unknown): string {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
