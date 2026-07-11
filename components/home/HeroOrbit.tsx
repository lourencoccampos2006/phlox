'use client'

// Elemento 3D do herói da homepage — os 5 mundos do Phlox em órbita.
// Renderiza sempre a versão CSS (barata, sem dependências, idêntica em servidor
// e cliente — zero hydration mismatch) na primeira passagem; só troca para a
// cena WebGL real (OrbitCanvas, three.js/react-three-fiber) depois de montar,
// se o dispositivo suportar WebGL e o utilizador não tiver pedido menos
// movimento. Se qualquer uma dessas condições falhar, fica na versão CSS —
// que já é, sozinha, uma órbita 3D genuína (perspective + preserve-3d).

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { OrbitNodeData } from './OrbitCanvas'

const OrbitCanvas = dynamic(() => import('./OrbitCanvas'), { ssr: false })

function StaticOrbit({ nodes }: { nodes: OrbitNodeData[] }) {
  return (
    <div className="orbit-ring">
      {nodes.map((n, i) => (
        <div key={n.tag} className="orbit-node" style={{ ['--i' as string]: i, ['--accent' as string]: n.accent } as React.CSSProperties}>
          <span className="orbit-node-dot" />
          <span className="orbit-node-label">{n.tag}</span>
        </div>
      ))}
      <div className="orbit-core">
        <span className="orbit-core-mark">+</span>
      </div>
    </div>
  )
}

export default function HeroOrbit({ nodes }: { nodes: OrbitNodeData[] }) {
  const [can3d, setCan3d] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (gl) setCan3d(true)
    } catch {
      /* sem WebGL — fica na versão CSS */
    }
  }, [])

  return (
    <div className="orbit-wrap">
      <div className="orbit-stage">
        {can3d ? <OrbitCanvas nodes={nodes} /> : <StaticOrbit nodes={nodes} />}
      </div>
    </div>
  )
}
