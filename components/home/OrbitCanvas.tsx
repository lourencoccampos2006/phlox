'use client'

// Cena 3D real (WebGL via three.js/react-three-fiber) para o herói da homepage.
// Só é carregada em runtime, via dynamic import ssr:false a partir de HeroOrbit.tsx
// — nunca entra no bundle inicial nem corre no servidor. Ambient rotation contínua
// + inclinação e deslocação ligadas ao scroll (lidas de scrollRef, atualizadas fora
// do ciclo de render do React via useFrame, sem re-renderizar em cada pixel).

import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Html, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

export interface OrbitNodeData {
  tag: string
  accent: string
}

function Rig({ scrollRef, children }: { scrollRef: React.MutableRefObject<number>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const s = scrollRef.current
    g.rotation.y += delta * 0.16
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.42 + s * 0.5, 0.06)
    g.position.y = THREE.MathUtils.lerp(g.position.y, -s * 0.7, 0.06)
  })
  return <group ref={group}>{children}</group>
}

function Core() {
  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial color="#0d3320" emissive="#22c55e" emissiveIntensity={0.7} distort={0.25} speed={1.4} roughness={0.3} metalness={0.1} />
      </mesh>
    </Float>
  )
}

function OrbitNode({ index, total, node }: { index: number; total: number; node: OrbitNodeData }) {
  const angle = (index / total) * Math.PI * 2
  const radius = 2.5
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  return (
    <Float speed={1.8 + index * 0.25} rotationIntensity={0} floatIntensity={1.2}>
      <group position={[x, 0, z]}>
        <mesh>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color={node.accent} emissive={node.accent} emissiveIntensity={1.2} roughness={0.35} />
        </mesh>
        <Html center distanceFactor={8} occlude={false} style={{ pointerEvents: 'none' }}>
          <span className="orbit-node-label">{node.tag}</span>
        </Html>
      </group>
    </Float>
  )
}

export default function OrbitCanvas({ nodes }: { nodes: OrbitNodeData[] }) {
  const scrollRef = useRef(0)
  useEffect(() => {
    function onScroll() {
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 1.1)))
      scrollRef.current = p
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Canvas
      camera={{ position: [0, 1.1, 6.2], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 4, 4]} intensity={1.3} color="#4ade80" />
      <pointLight position={[-4, -2, -3]} intensity={0.7} color="#60a5fa" />
      <Rig scrollRef={scrollRef}>
        <Core />
        {nodes.map((n, i) => (
          <OrbitNode key={n.tag} index={i} total={nodes.length} node={n} />
        ))}
      </Rig>
    </Canvas>
  )
}
