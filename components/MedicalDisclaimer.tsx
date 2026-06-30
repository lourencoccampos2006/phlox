'use client'

// MedicalDisclaimer — o aviso canónico de "não é dispositivo médico", reutilizável.
// Substitui os disclaimers ad-hoc espalhados pela app, garantindo uma mensagem única
// e coerente. Texto-fonte em lib/legal (MEDICAL_DEVICE_STATEMENT).
//   variant="compact" → uma linha discreta (rodapé de ferramentas)
//   variant="full"    → caixa com o enquadramento completo

import Link from 'next/link'
import { MEDICAL_DEVICE_STATEMENT } from '@/lib/legal'

export default function MedicalDisclaimer({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  if (variant === 'compact') {
    return (
      <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5, padding: '8px 0' }}>
        ⓘ {MEDICAL_DEVICE_STATEMENT.short}{' '}
        <Link href="/dispositivo-medico" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none' }}>Saber mais</Link>
      </div>
    )
  }
  return (
    <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Enquadramento</div>
      {MEDICAL_DEVICE_STATEMENT.long.map((p, i) => (
        <p key={i} style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: i === 0 ? '0 0 8px' : '0 0 8px' }}>{p}</p>
      ))}
      <Link href="/dispositivo-medico" style={{ fontSize: 12.5, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>Porque é que o Phlox não é um dispositivo médico →</Link>
    </div>
  )
}
