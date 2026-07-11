'use client'

// A cena WebGL real da flor decorativa — isolada num módulo próprio para que
// o import pesado de three.js/r3f só entre no bundle quando carregado por
// dynamic() a partir de DecorativeBloom.tsx (nunca no bundle principal).

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PETAL_POINTS = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(-0.32, 0.18, -0.34, 0.62, -0.16, 0.84)
  s.quadraticCurveTo(-0.06, 0.94, 0, 0.8)
  s.quadraticCurveTo(0.06, 0.94, 0.16, 0.84)
  s.bezierCurveTo(0.34, 0.62, 0.32, 0.18, 0, 0)
  return s.getPoints(36).map(p => new THREE.Vector3(p.x, p.y, 0))
})()

const CLOSED_TILT = -1.2
const OPEN_TILT = -0.2

function Petal({ index, accent, progressRef }: { index: number; accent: string; progressRef: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const angle = (index / 5) * Math.PI * 2
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(PETAL_POINTS, true, 'catmullrom', 0.15)
    return new THREE.TubeGeometry(curve, 60, 0.014, 6, true)
  }, [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const target = THREE.MathUtils.lerp(CLOSED_TILT, OPEN_TILT, progressRef.current)
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, target, 0.08)
  })
  return (
    <group rotation={[0, 0, angle]}>
      <mesh ref={mesh} geometry={geometry} rotation={[CLOSED_TILT, 0, 0]}>
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.45} />
      </mesh>
    </group>
  )
}

function Rig({ accent, progressRef }: { accent: string; progressRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.rotation.y = state.clock.elapsedTime * 0.15
  })
  return (
    <group ref={group}>
      {[0, 1, 2, 3, 4].map(i => <Petal key={i} index={i} accent={accent} progressRef={progressRef} />)}
    </group>
  )
}

export default function DecorativeBloomScene({ accent, progressRef }: { accent: string; progressRef: React.MutableRefObject<number> }) {
  return (
    <Canvas camera={{ position: [0, 0.6, 2.1], fov: 36 }} dpr={[1, 1.6]} gl={{ alpha: true, antialias: true }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 3]} intensity={1} />
      <Rig accent={accent} progressRef={progressRef} />
    </Canvas>
  )
}
