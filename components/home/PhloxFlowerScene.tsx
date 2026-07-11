'use client'

// A cena 3D do herói: uma flor Phlox REAL — pétalas preenchidas, sombreadas,
// em duas camadas (como uma flor verdadeira, não um contorno geométrico) —
// com um centro de estames. Vive em fundo, desfocada pelo CSS do wrapper; o
// texto "Phlox Clinical" é DOM (fonte Syne real), sobreposto por cima, não
// faz parte desta cena. Em repouso roda visivelmente (mas devagar). Ao
// iniciar o scroll, fecha-se (pétalas dobram para dentro) em uníssono com o
// texto a encolher — ver PhloxHero.tsx para a coreografia do "engolir".
// Progresso vem de fora (scrollRef, calculado localmente pela posição do
// herói — nunca pinado, o scroll normal nunca é intercetado).

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Pétala salverforme com recorte na ponta (referência real de Phlox: 5 lóbulos
// planos a abrir de um tubo central, ponta muitas vezes recortada/entalhada).
const PETAL_SHAPE = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(-0.32, 0.18, -0.34, 0.62, -0.16, 0.84)
  s.quadraticCurveTo(-0.06, 0.94, 0, 0.8)
  s.quadraticCurveTo(0.06, 0.94, 0.16, 0.84)
  s.bezierCurveTo(0.34, 0.62, 0.32, 0.18, 0, 0)
  return s
})()

const CLOSED_TILT = -1.22
const OPEN_TILT = -0.18

function petalTexture(inner: string, outer: string, withDetail = false) {
  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, size, 0, 0)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  if (withDetail) {
    // "olho"/garganta — mancha mais saturada perto da base, como uma Phlox real
    const eye = ctx.createRadialGradient(size * 0.5, size * 0.94, size * 0.02, size * 0.5, size * 0.94, size * 0.55)
    eye.addColorStop(0, 'rgba(60,20,50,0.4)')
    eye.addColorStop(1, 'rgba(60,20,50,0)')
    ctx.fillStyle = eye
    ctx.fillRect(0, 0, size, size)

    // veios finos da base à ponta — dá textura orgânica, não plástico liso
    ctx.strokeStyle = 'rgba(50,20,40,0.16)'
    ctx.lineWidth = 1.4
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(size * 0.5 + i * 7, size * 0.96)
      ctx.quadraticCurveTo(size * 0.5 + i * 14, size * 0.55, size * 0.5 + i * 5, size * 0.06)
      ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Petal({
  index, total, scrollRef, inner, outer, radius, tilt, scale,
}: {
  index: number; total: number; scrollRef: React.MutableRefObject<number>
  inner: string; outer: string; radius: [number, number]; tilt: [number, number]; scale: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const angle = (index / total) * Math.PI * 2
  const geometry = useMemo(() => {
    const geo = new THREE.ShapeGeometry(PETAL_SHAPE, 24)
    const pos = geo.attributes.position
    // curva a pétala ligeiramente para a frente perto da ponta — uma pétala
    // real nunca é um plano perfeito, e é essa curvatura que apanha luz
    // e dá volume mesmo num objeto tão fino.
    for (let i = 0; i < pos.count; i++) {
      const y = Math.max(0, pos.getY(i))
      pos.setZ(i, pos.getZ(i) + Math.pow(y / 0.88, 1.7) * 0.1)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [])
  const map = useMemo(() => petalTexture(inner, outer, true), [inner, outer])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const target = THREE.MathUtils.lerp(tilt[0], tilt[1], scrollRef.current)
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, target, 0.09)
  })
  return (
    <group rotation={[0, 0, angle]} scale={scale}>
      <mesh ref={mesh} geometry={geometry} rotation={[tilt[0], 0, 0]} position={[0, radius[0], radius[1]]}>
        <meshPhysicalMaterial
          map={map}
          side={THREE.DoubleSide}
          roughness={0.55}
          clearcoat={0.2}
          clearcoatRoughness={0.4}
          emissive={outer}
          emissiveIntensity={0.04}
        />
      </mesh>
    </group>
  )
}

function Stamens() {
  const items = [0, 1, 2, 3, 4]
  return (
    <group position={[0, 0.02, 0]}>
      {items.map(i => {
        const a = (i / items.length) * Math.PI * 2
        return (
          <group key={i} rotation={[0.55, 0, a]}>
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.006, 0.008, 0.16, 6]} />
              <meshStandardMaterial color="#e4c67a" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <sphereGeometry args={[0.016, 8, 8]} />
              <meshStandardMaterial color="#c9a15a" emissive="#c9a15a" emissiveIntensity={0.4} roughness={0.4} />
            </mesh>
          </group>
        )
      })}
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshPhysicalMaterial color="#2f4a3a" emissive="#2f4a3a" emissiveIntensity={0.3} roughness={0.35} clearcoat={0.4} />
      </mesh>
    </group>
  )
}

function FlowerBloom({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const p = scrollRef.current
    // roda no próprio plano (eixo Z, como um pião) — nunca fica de perfil,
    // ao contrário de rodar no eixo Y, que "desaparece" a meio da volta.
    if (p < 0.02) g.rotation.z = state.clock.elapsedTime * 0.32
    g.scale.setScalar(THREE.MathUtils.lerp(1, 0.72, p))
  })
  return (
    <group ref={group} position={[0, 0.55, -0.3]} rotation={[-0.32, 0, 0]}>
      {/* camada de trás — maior, mais escura, ligeiramente mais aberta: dá profundidade real de flor dupla */}
      {[0, 1, 2, 3, 4].map(i => (
        <Petal
          key={`b${i}`} index={i} total={5} scrollRef={scrollRef}
          inner="#7c4f7a" outer="#c98bb0" radius={[0.02, -0.03]} tilt={[OPEN_TILT - 0.12, CLOSED_TILT]} scale={1.06}
        />
      ))}
      {/* camada da frente — mais clara, mais luminosa, define a silhueta principal */}
      {[0, 1, 2, 3, 4].map(i => (
        <Petal
          key={`f${i}`} index={i + 0.5} total={5} scrollRef={scrollRef}
          inner="#a85f9e" outer="#f2c3dd" radius={[0.02, 0.01]} tilt={[OPEN_TILT, CLOSED_TILT]} scale={0.92}
        />
      ))}
      <Stamens />
    </group>
  )
}

// A raiz real em 3D — nasce mesmo da base da flor e cresce para baixo à
// medida que se dá scroll (mesmo progresso que fecha a flor), com volume,
// sombreado e textura reais — não uma linha achatada. Continua visualmente
// para o caminho SVG do resto da página (mesmo gradiente verde), mas aqui,
// no momento mais visto do site, é geometria 3D a sério.
const ROOT_SEGMENTS = 48
const ROOT_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.08, -0.3),
  new THREE.Vector3(0.17, -0.3, -0.34),
  new THREE.Vector3(-0.15, -0.72, -0.27),
  new THREE.Vector3(0.12, -1.14, -0.32),
  new THREE.Vector3(-0.08, -1.58, -0.34),
  new THREE.Vector3(0, -2.05, -0.3),
], false, 'catmullrom', 0.45)
const ROOT_POINTS = ROOT_CURVE.getSpacedPoints(ROOT_SEGMENTS)

const ROOT_RADIUS = 0.05

function RootStem({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const lastSeg = useRef(-1)
  const map = useMemo(() => petalTexture('#82b696', '#3f6b52'), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const p = scrollRef.current
    const grow = THREE.MathUtils.clamp((p - 0.1) / 0.85, 0, 1)
    const seg = Math.round(grow * ROOT_SEGMENTS)
    if (seg === lastSeg.current) return
    lastSeg.current = seg
    if (seg < 2) { m.visible = false; return }
    m.visible = true
    const tubularSegs = Math.max(6, seg)
    const sub = new THREE.CatmullRomCurve3(ROOT_POINTS.slice(0, seg + 1))
    const old = m.geometry
    // ligeiro afunilamento: mais grosso junto à flor, mais fino ao crescer —
    // TubeGeometry não suporta raio variável nativamente, por isso desloca-se
    // cada anel de vértices para dentro/fora do centro da curva por um fator
    // que diminui com a distância percorrida.
    const geo = new THREE.TubeGeometry(sub, tubularSegs, ROOT_RADIUS, 10, false)
    const posAttr = geo.attributes.position
    const radialCount = 11
    const ringCount = tubularSegs + 1
    for (let ring = 0; ring < ringCount; ring++) {
      const t = ring / (ringCount - 1)
      const center = sub.getPointAt(Math.min(1, t))
      const f = THREE.MathUtils.lerp(1, 0.55, t)
      for (let r = 0; r < radialCount; r++) {
        const idx = ring * radialCount + r
        if (idx >= posAttr.count) continue
        const vx = posAttr.getX(idx) - center.x
        const vy = posAttr.getY(idx) - center.y
        const vz = posAttr.getZ(idx) - center.z
        posAttr.setX(idx, center.x + vx * f)
        posAttr.setY(idx, center.y + vy * f)
        posAttr.setZ(idx, center.z + vz * f)
      }
    }
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
    m.geometry = geo
    old.dispose()
  })
  return (
    <mesh ref={mesh} visible={false}>
      <tubeGeometry args={[ROOT_CURVE, 4, ROOT_RADIUS, 10, false]} />
      <meshStandardMaterial map={map} roughness={0.65} metalness={0} />
    </mesh>
  )
}

export default function PhloxFlowerScene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 4.2], fov: 34 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 4]} intensity={1.5} color="#fff6ef" />
      <directionalLight position={[-3, 1, 2]} intensity={0.55} color="#d8c8ff" />
      <pointLight position={[0, 0.5, 2.6]} intensity={0.6} color="#f6dcee" distance={6} />
      <FlowerBloom scrollRef={scrollRef} />
    </Canvas>
  )
}

// Cena separada, à parte, SEM o blur CSS que a flor tem — um caule fino
// desfocado deixa de parecer caule (vira uma mancha). Aqui fica nítido, com
// a mesma câmara/posição da cena da flor para o ponto de nascença coincidir.
export function PhloxRootScene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 4.2], fov: 34 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 4]} intensity={1.4} color="#fff6ef" />
      <directionalLight position={[-3, 1, 2]} intensity={0.5} color="#cfe6d6" />
      <RootStem scrollRef={scrollRef} />
    </Canvas>
  )
}
