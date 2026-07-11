'use client'

// Cena 3D real (WebGL, three.js/react-three-fiber) do herói da homepage — a
// flor Phlox a abrir. Substitui por completo a v1 (esferas a orbitar, rejeitada
// por Fernando como "horrorosa" e a "gritar feito por ia"). Desta vez:
//   - um objeto ÚNICO, específico da marca (Phlox = género de flor), não uma
//     nuvem abstrata de esferas — as 5 pétalas SÃO os 5 mundos, cada uma com a
//     cor exata do respetivo cartão em baixo na página (fio condutor visual);
//   - materiais foscos/planos (roughness alto, zero emissive, zero distort) —
//     sem "glow" nem qualquer forma de gradiente; sombra de contacto suave em
//     vez de luz a sangrar;
//   - a flor nasce fechada (botão) e ABRE à medida que se desce a página —
//     o momento "faz mais sentido ao arrastar" pedido, na linha da Apple.
// Só carregada em runtime via dynamic import ssr:false (ver HeroFlower.tsx).

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

const PETAL_SHAPE = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(-0.30, 0.22, -0.32, 0.74, 0, 1.02)
  s.bezierCurveTo(0.32, 0.74, 0.30, 0.22, 0, 0)
  return s
})()

const PETAL_GEOMETRY = new THREE.ExtrudeGeometry(PETAL_SHAPE, {
  depth: 0.045,
  bevelEnabled: true,
  bevelThickness: 0.012,
  bevelSize: 0.012,
  bevelSegments: 3,
  curveSegments: 20,
})
PETAL_GEOMETRY.translate(0, 0.14, -0.0225)

const CLOSED_TILT = -0.98
const OPEN_TILT = -0.2

function Petal({ index, total, accent, scrollRef }: { index: number; total: number; accent: string; scrollRef: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const angle = (index / total) * Math.PI * 2
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const p = scrollRef.current
    const target = THREE.MathUtils.lerp(CLOSED_TILT, OPEN_TILT, p)
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, target, 0.08)
  })
  return (
    <group rotation={[0, 0, angle]}>
      <mesh ref={mesh} geometry={PETAL_GEOMETRY} rotation={[CLOSED_TILT, 0, 0]}>
        <meshStandardMaterial color={accent} roughness={0.58} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Bloom({ accents, scrollRef }: { accents: string[]; scrollRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.rotation.z = state.clock.elapsedTime * 0.045
    const p = scrollRef.current
    g.rotation.x = THREE.MathUtils.lerp(-0.5, -0.32, p)
    g.position.y = THREE.MathUtils.lerp(-0.15, 0.05, p)
  })
  return (
    <group ref={group}>
      {accents.map((accent, i) => (
        <Petal key={accent} index={i} total={accents.length} accent={accent} scrollRef={scrollRef} />
      ))}
      <mesh position={[0, 0, 0.02]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshStandardMaterial color="#d3a94a" roughness={0.45} metalness={0.15} />
      </mesh>
    </group>
  )
}

export default function FlowerScene({ accents, scrollRef }: { accents: string[]; scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 3.1], fov: 38 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 4.5, 4]} intensity={1.5} />
      <directionalLight position={[-3, 1, -2]} intensity={0.55} />
      <directionalLight position={[0, -1, 3]} intensity={0.35} />
      <Bloom accents={accents} scrollRef={scrollRef} />
      <ContactShadows position={[0, -1.05, 0]} opacity={0.22} scale={5} blur={2.6} far={2} color="#16181d" />
    </Canvas>
  )
}
