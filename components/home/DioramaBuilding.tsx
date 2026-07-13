'use client'

// Edifício do diorama — estilo vectrfl.com (referência do Fernando): massa
// retangular em blocos/andares, mas com cantos arredondados de verdade
// (RoundedBoxGeometry, nunca uma BoxGeometry crua), um telhado embutido
// próprio por andar, e linhas de painel/janela modeladas a sério (sulcos
// extrudidos, não uma textura pintada) — para nunca ler como "bloco sólido
// de primitivas rudimentares".

import { useMemo } from 'react'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// tira fina embutida na fachada — sugere grelha de janelas sem ser textura
function PanelLines({ w, h, faceZ, rows, cols }: { w: number; h: number; faceZ: number; rows: number; cols: number }) {
  const lines = useMemo(() => {
    const items: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const marginX = w * 0.16
    const usableW = w - marginX * 2
    const marginY = h * 0.18
    const usableH = h - marginY * 2
    for (let c = 0; c <= cols; c++) {
      const x = -w / 2 + marginX + (usableW * c) / cols
      items.push({ pos: [x, 0, faceZ], size: [0.006, usableH, 0.006] })
    }
    for (let rIdx = 0; rIdx <= rows; rIdx++) {
      const y = -h / 2 + marginY + (usableH * rIdx) / rows
      items.push({ pos: [0, y, faceZ], size: [usableW, 0.006, 0.006] })
    }
    return items
  }, [w, h, faceZ, rows, cols])
  return (
    <group>
      {lines.map((l, i) => (
        <mesh key={i} position={l.pos}>
          <boxGeometry args={l.size} />
          <meshStandardMaterial color="#c7cdc6" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Facade({ w, d, h }: { w: number; d: number; h: number }) {
  const rows = Math.max(1, Math.round(h / 0.22))
  return (
    <>
      <group position={[0, 0, d / 2 + 0.004]}>
        <PanelLines w={w} h={h} faceZ={0} rows={rows} cols={Math.max(2, Math.round(w / 0.22))} />
      </group>
      <group position={[0, 0, -d / 2 - 0.004]}>
        <PanelLines w={w} h={h} faceZ={0} rows={rows} cols={Math.max(2, Math.round(w / 0.22))} />
      </group>
      <group rotation={[0, Math.PI / 2, 0]} position={[0, 0, 0]}>
        <group position={[0, 0, w / 2 + 0.004]}>
          <PanelLines w={d} h={h} faceZ={0} rows={rows} cols={Math.max(2, Math.round(d / 0.22))} />
        </group>
        <group position={[0, 0, -w / 2 - 0.004]}>
          <PanelLines w={d} h={h} faceZ={0} rows={rows} cols={Math.max(2, Math.round(d / 0.22))} />
        </group>
      </group>
    </>
  )
}

interface Tier { w: number; d: number; h: number }

export function DioramaBuilding({ tiers, accent = '#0d6e42' }: { tiers: Tier[]; accent?: string }) {
  let y = 0
  const placed = tiers.map(t => {
    const by = y + t.h / 2
    y += t.h
    return { ...t, by }
  })
  const last = placed[placed.length - 1]
  const capW = last.w * 0.72
  const capD = last.d * 0.72
  const capH = 0.1
  const capY = y + capH / 2

  return (
    <group>
      {placed.map((t, i) => (
        <group key={i} position={[0, t.by, 0]}>
          <mesh castShadow receiveShadow>
            <primitive object={new RoundedBoxGeometry(t.w, t.h, t.d, 4, Math.min(0.045, t.h * 0.1))} attach="geometry" />
            <meshPhysicalMaterial color="#eef1ec" roughness={0.55} clearcoat={0.15} clearcoatRoughness={0.6} />
          </mesh>
          <Facade w={t.w} d={t.d} h={t.h} />
        </group>
      ))}
      {/* telhado embutido — mais pequeno que o último andar, com o mesmo tratamento de cantos */}
      <mesh position={[0, capY, 0]} castShadow receiveShadow>
        <primitive object={new RoundedBoxGeometry(capW, capH, capD, 4, 0.03)} attach="geometry" />
        <meshPhysicalMaterial color="#e2e7e1" roughness={0.5} clearcoat={0.2} clearcoatRoughness={0.5} />
      </mesh>
      {/* pequeno acento de marca no topo — cor do modo que o edifício representa */}
      <mesh position={[0, capY + capH / 2 + 0.05, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.09, 16]} />
        <meshPhysicalMaterial color={accent} roughness={0.35} clearcoat={0.4} />
      </mesh>
    </group>
  )
}
