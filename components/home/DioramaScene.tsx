'use client'

// Cena 3D — o diorama isométrico da "rede" Phlox. Inspirado na referência que
// o Fernando mandou (vectrfl.com): um único cenário 3D contínuo (não objetos
// soltos) que a câmara percorre à medida que se desce a página, com um
// caminho que se desenha a ligar cada "edifício" e uma lista numerada que
// acompanha. Aqui: 5 edifícios = os 5 mundos do Phlox, o caminho é a "rede"
// que já é a metáfora central da homepage ("Toda a saúde, numa só rede").
// Materiais foscos planos, zero emissive/glow — só luz direcional real +
// sombra de contacto, como no diorama de referência.

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

export interface DioramaNode {
  accent: string
  tier: number // 1-3, altura/nº de blocos do edifício
}

const POSITIONS: [number, number, number][] = [
  [-5.2, 0, 0.6],
  [-2.6, 0, -0.9],
  [0, 0, 0.9],
  [2.6, 0, -0.7],
  [5.2, 0, 0.5],
]

function Building({ position, accent, tier }: { position: [number, number, number]; accent: string; tier: number }) {
  const blocks = useMemo(() => {
    const sizes = [0.95, 0.62, 0.36].slice(0, tier)
    let y = 0
    return sizes.map((s, i) => {
      const h = 0.5 - i * 0.08
      const by = y + h / 2
      y += h
      return { s, h, by }
    })
  }, [tier])

  return (
    <group position={position}>
      {blocks.map((b, i) => (
        <mesh key={i} position={[0, b.by, 0]} castShadow receiveShadow>
          <boxGeometry args={[b.s, b.h, b.s]} />
          <meshStandardMaterial color="#eef1ec" roughness={0.88} metalness={0.02} />
        </mesh>
      ))}
      <mesh position={[0, blocks[blocks.length - 1].by + blocks[blocks.length - 1].h / 2 + 0.08, 0]}>
        <boxGeometry args={[0.2, 0.16, 0.2]} />
        <meshStandardMaterial color={accent} roughness={0.5} metalness={0.05} />
      </mesh>
    </group>
  )
}

function PathReveal({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const tubularSegments = 160
  const radialSegments = 8

  const { geometry, totalIndices } = useMemo(() => {
    const pts = POSITIONS.map(p => new THREE.Vector3(p[0], 0.035, p[2]))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35)
    const geo = new THREE.TubeGeometry(curve, tubularSegments, 0.045, radialSegments, false)
    const idx = geo.getIndex()
    return { geometry: geo, totalIndices: idx ? idx.count : 0 }
  }, [])

  useFrame(() => {
    const p = scrollRef.current
    const segShown = Math.min(tubularSegments, Math.max(1, Math.floor(p * tubularSegments) + 2))
    const count = Math.min(totalIndices, segShown * radialSegments * 6)
    geometry.setDrawRange(0, count)
  })

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#c2542f" roughness={0.45} metalness={0.08} />
    </mesh>
  )
}

function Rig({ scrollRef, children }: { scrollRef: React.MutableRefObject<number>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = scrollRef.current
    g.position.x = THREE.MathUtils.lerp(2.6, -2.6, p)
  })
  return <group ref={group}>{children}</group>
}

export default function DioramaScene({ nodes, scrollRef }: { nodes: DioramaNode[]; scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 6.4, 9.6], fov: 30 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
      shadows
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
      <Rig scrollRef={scrollRef}>
        {nodes.map((n, i) => (
          <Building key={i} position={POSITIONS[i]} accent={n.accent} tier={n.tier} />
        ))}
        <PathReveal scrollRef={scrollRef} />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.28} scale={16} blur={2.2} far={3} color="#16181d" />
      </Rig>
    </Canvas>
  )
}
