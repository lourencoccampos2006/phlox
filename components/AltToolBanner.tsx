'use client'

// Banner pequeno para sinalizar que existe uma alternativa nesta página (ex:
// "Procuras a versão pessoal? Tens isto em /brief"). Não obriga, só orienta.

import Link from 'next/link'

export default function AltToolBanner({ text, href, label = 'Abrir →' }: { text: string; href: string; label?: string }) {
  return (
    <div className="focus-hide" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe',
      borderRadius: 10, marginBottom: 14, fontSize: 13, color: '#1e40af',
      fontFamily: 'var(--font-sans)', flexWrap: 'wrap',
    }}>
      <span>{text}</span>
      <Link href={href} style={{ fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', flexShrink: 0 }}>{label}</Link>
    </div>
  )
}
