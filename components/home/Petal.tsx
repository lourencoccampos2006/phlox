// A marca do Phlox é uma flor — em vez de puxar um pacote de ícones genérico
// (Heroicons/Feather/etc., o mesmo em qualquer site), este glifo de 5 pétalas
// é desenhado à mão para este projeto e reaproveitado como assinatura visual:
// ícone dos "5 mundos", acento decorativo no herói, nó nos diagramas de
// processo. Sem animação — só um desenho estático, gráfico, próprio.

const PETAL_D = 'M50 50 C36 39 34 17 50 3 C66 17 64 39 50 50 Z'
const ANGLES = [0, 72, 144, 216, 288]

export default function Petal({
  size = 22,
  color = 'currentColor',
  outline = false,
  className,
}: {
  size?: number
  color?: string
  outline?: boolean
  className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      {ANGLES.map((deg) => (
        <path
          key={deg}
          d={PETAL_D}
          transform={`rotate(${deg} 50 50)`}
          fill={outline ? 'none' : color}
          stroke={outline ? color : 'none'}
          strokeWidth={outline ? 1.6 : 0}
        />
      ))}
      <circle cx="50" cy="50" r="7" fill={outline ? 'none' : 'var(--bg)'} stroke={outline ? color : 'none'} strokeWidth={outline ? 1.6 : 0} />
    </svg>
  )
}
