'use client'

// A cena 3D do herói — modelo REAL descarregado (Sketchfab, "Blue Flower
// Bloom"), não geometria construída à mão. Tem esqueleto real (petalas +
// caule como SkinnedMesh) e uma animação real ("Anim Blye", 9.17s) que é
// uma oscilação orgânica suave — não um ciclo de floração/fecho (isso foi
// verificado por inspeção direta do ficheiro antes de assumir nada). Usa-se
// exatamente pelo que é: repouso vivo, natural, nunca robótico.

import { useLayoutEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

// a prop `camera={{position:...}}` do Canvas NÃO aponta a câmara para a
// origem sozinha — sem isto, um offset em X/Y só desloca a câmara na mesma
// direção -Z, nunca a inclina para o assunto (foi exatamente o que aconteceu
// no primeiro render: câmara a apontar para o lado, a flor meio fora do
// enquadramento).
function CameraLookAt({ target }: { target: [number, number, number] }) {
  const { camera } = useThree()
  useLayoutEffect(() => { camera.lookAt(...target) }, [camera, target])
  return null
}

const MODEL_URL = '/models/hero-flower.glb'

function HeroFlowerModel() {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, group)

  // NADA de SkeletonUtils.clone aqui — verificado por teste direto (não por
  // suposição) que produzia uma skeleton partida (bounding box explodia de
  // ~1 unidade para >20 unidades, flor deformada fora do ecrã). Só existe
  // uma instância deste modelo na página, por isso o cache partilhado do
  // useGLTF não é problema — usar a cena diretamente.
  useLayoutEffect(() => {
    scene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial
        if (!mat) return
        // a "Iris_and_blye" vem com emissive branco do ficheiro original —
        // sem clamp explícito, sob luz forte lava a cor real da pétala
        // (o mesmo erro de estouro que já aconteceu antes nesta secção).
        if (mat.emissive && !mat.emissive.equals(new THREE.Color(0, 0, 0))) {
          mat.emissiveIntensity = 0.12
        }
      })
    })
  }, [scene])

  useLayoutEffect(() => {
    const action = actions['Anim Blye']
    if (!action) return
    action.reset()
    action.setLoop(THREE.LoopPingPong, Infinity)
    // um pouco mais lenta que a gravação original — "quase impercetível",
    // não uma folha a tremer ao vento.
    action.timeScale = 0.35
    action.play()
    return () => { action.stop() }
  }, [actions])

  return (
    <group ref={group} position={[0.1, 0, 0]}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)

// valores calibrados por iteração visual direta (não adivinhados) contra a
// bounding box real do modelo — ver .superpowers/model_inspect nesta sessão.
const LOOK_TARGET: [number, number, number] = [-0.1, 0.78, 0]

export default function PhloxFlowerScene() {
  return (
    <Canvas
      camera={{ position: [-0.55, 0.6, 2.15], fov: 30 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      shadows
      style={{ width: '100%', height: '100%' }}
    >
      <CameraLookAt target={LOOK_TARGET} />
      {/* luz cinematográfica: principal quente a definir volume, preenchimento
          frio suave a abrir as sombras, rim a separar a flor do fundo — nunca
          uma luz plana única. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.2, 3.4, 2.6]} intensity={1.5} color="#fff6ea" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-2.4, 1.2, -1.6]} intensity={0.45} color="#cfe0ff" />
      <directionalLight position={[-0.6, 1.8, -2.4]} intensity={0.6} color="#e8e0ff" />
      <HeroFlowerModel />
    </Canvas>
  )
}
