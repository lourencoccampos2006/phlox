'use client'

// /historico — o livro de registos da casa inteira.
//
// Tudo o que a equipa fez, por ordem, filtrável por assunto. Não se escreve
// aqui nada: enche-se sozinho à medida que se trabalha (ver lib/registo.ts).
//
// É da instituição e SÓ dela. O dono do Phlox não vê isto — ver a nota de
// fronteira em supabase/sprint137_activity_log.sql.

import LivroDeRegistos from '@/components/institution/LivroDeRegistos'
import { useOrgName } from '@/lib/useOrgName'

export default function HistoricoPage() {
  const casa = useOrgName()
  return (
    <div style={{ padding: '26px clamp(18px,2.6vw,34px) 80px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 11,
        }}>{casa || 'A casa'} · registos</div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,34px)', fontWeight: 400,
          margin: '0 0 8px', letterSpacing: '-0.015em', lineHeight: 1.15, color: 'var(--ink)',
        }}>Tudo o que ficou registado</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 26px', maxWidth: '58ch', lineHeight: 1.55 }}>
          Quem fez o quê, sobre quem e quando. Enche-se sozinho com o trabalho do dia —
          ninguém tem de escrever aqui. Não se apaga nem se corrige: é um registo.
        </p>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
          <LivroDeRegistos limite={60} titulo="" />
        </div>
      </div>
    </div>
  )
}
