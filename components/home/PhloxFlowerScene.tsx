'use client'

// A cena 3D do herói: "Phlox Clinical" em texto extrudido real + uma flor
// Phlox desenhada só de CONTORNO (linhas finas, sem preenchimento — nunca mais
// um "bloco horroroso"). Em repouso, roda devagar. Ao iniciar o scroll, fecha-
// se (pétalas dobram para dentro) e "engole" o texto (que encolhe e desvanece
// em direção ao centro), no mesmo instante — uma única animação coreografada.
// Progresso vem de fora (scrollRef, calculado localmente pela posição do
// herói — nunca pinado, o scroll normal nunca é intercetado).

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, Text3D } from '@react-three/drei'
import * as THREE from 'three'

// Pétala salverforme com recorte na ponta (referência real de Phlox: 5 lóbulos
// planos a abrir de um tubo central, ponta muitas vezes recortada/entalhada).
const PETAL_POINTS = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(-0.32, 0.18, -0.34, 0.62, -0.16, 0.84)
  s.quadraticCurveTo(-0.06, 0.94, 0, 0.8)
  s.quadraticCurveTo(0.06, 0.94, 0.16, 0.84)
  s.bezierCurveTo(0.34, 0.62, 0.32, 0.18, 0, 0)
  return s.getPoints(48).map(p => new THREE.Vector3(p.x, p.y, 0))
})()

const CLOSED_TILT = -1.22
const OPEN_TILT = -0.18

function PetalOutline({ index, total, scrollRef }: { index: number; total: number; scrollRef: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const angle = (index / total) * Math.PI * 2
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(PETAL_POINTS, true, 'catmullrom', 0.15)
    return new THREE.TubeGeometry(curve, 90, 0.012, 6, true)
  }, [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const target = THREE.MathUtils.lerp(OPEN_TILT, CLOSED_TILT, scrollRef.current)
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, target, 0.09)
  })
  return (
    <group rotation={[0, 0, angle]}>
      <mesh ref={mesh} geometry={geometry} rotation={[OPEN_TILT, 0, 0]}>
        <meshStandardMaterial color="#3f6b52" emissive="#3f6b52" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}

function FlowerOutline({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const p = scrollRef.current
    if (p < 0.02) g.rotation.y = state.clock.elapsedTime * 0.09
    g.scale.setScalar(THREE.MathUtils.lerp(1, 0.7, p))
  })
  return (
    <group ref={group} position={[0, -0.1, -0.3]}>
      {[0, 1, 2, 3, 4].map(i => (
        <PetalOutline key={i} index={i} total={5} scrollRef={scrollRef} />
      ))}
      <mesh>
        <torusGeometry args={[0.05, 0.011, 8, 24]} />
        <meshStandardMaterial color="#3f6b52" emissive="#3f6b52" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
    </group>
  )
}

function SwallowedText({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = scrollRef.current
    const s = THREE.MathUtils.lerp(1, 0.02, Math.min(1, p * 1.3))
    g.scale.setScalar(Math.max(0.001, s))
    g.position.z = THREE.MathUtils.lerp(0.55, -0.25, p)
    const mat = (g.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial | undefined
    if (mat) mat.opacity = Math.max(0, 1 - p * 1.5)
  })
  return (
    <group ref={group} position={[0, 0, 0.55]}>
      <Center>
        <Text3D font="/fonts/helvetiker_bold.typeface.json" size={0.16} height={0.035} curveSegments={12} bevelEnabled bevelThickness={0.006} bevelSize={0.005} bevelSegments={4}>
          Phlox Clinical
          <meshStandardMaterial color="#16181d" roughness={0.35} transparent />
        </Text3D>
      </Center>
    </group>
  )
}

export default function PhloxFlowerScene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.1, 4.4], fov: 32 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 4]} intensity={1.1} />
      <directionalLight position={[-3, 1, 2]} intensity={0.4} />
      <FlowerOutline scrollRef={scrollRef} />
      <SwallowedText scrollRef={scrollRef} />
    </Canvas>
  )
}
