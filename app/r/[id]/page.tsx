// app/r/[id]/page.tsx — Página pública de resultado partilhado
// Acessível sem conta. Mostra o resultado e converte visitantes em utilizadores.

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: { id: string } }

async function getResult(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase.from('shared_results').select('*').eq('id', id).single()
  if (data) {
    // Increment views (fire and forget)
    supabase.from('shared_results').update({ views: (data.views || 0) + 1 }).eq('id', id).then(() => {})
  }
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getResult(params.id)
  if (!result) return { title: 'Resultado não encontrado | Phlox' }
  const titles: Record<string, string> = {
    interaction: 'Análise de Interações Medicamentosas',
    labs: 'Análise de Análises Clínicas',
    care_plan: 'Care Plan Farmacológico',
    arena_result: 'Caso Clínico Phlox Arena',
    medication_review: 'Revisão de Medicação',
  }
  return {
    title: `${titles[result.type] || 'Resultado'} | Phlox Clinical`,
    description: 'Resultado gerado pelo Phlox Clinical — plataforma de farmacologia clínica em português.',
  }
}

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  GRAVE:         { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  MODERADA:      { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  LIGEIRA:       { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  SEM_INTERACAO: { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0' },
}

export default async function SharedResultPage({ params }: Props) {
  const result = await getResult(params.id)

  if (!result) return (
    <div style={{ minHeight: '100vh', background: '#050508', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#a1a1aa' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Resultado não encontrado</div>
        <p style={{ fontSize: 14, marginBottom: 20 }}>Este link expirou ou não existe.</p>
        <Link href="/" style={{ color: '#22c55e', textDecoration: 'none', fontSize: 13 }}>Ir para o Phlox →</Link>
      </div>
    </div>
  )

  const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
  const isExpired = result.expires_at && new Date(result.expires_at) < new Date()

  return (
    <div style={{ minHeight: '100vh', background: '#050508', fontFamily: 'sans-serif', color: '#fafafa' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #18181b', padding: '12px 0' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#22c55e"/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>PHLOX CLINICAL</span>
          </div>
          <Link href="/login" style={{ padding: '7px 16px', background: '#22c55e', color: '#050508', textDecoration: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700 }}>
            Criar conta grátis →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px' }}>
        {isExpired && (
          <div style={{ background: '#1c1917', border: '1px solid #292524', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#78716c' }}>
            Este resultado expirou. Cria conta para guardar os teus resultados permanentemente.
          </div>
        )}

        {/* Result type label */}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#52525b', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
          Resultado partilhado · Phlox Clinical
        </div>

        {/* Interaction result */}
        {result.type === 'interaction' && data && (
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.2 }}>
              {data.drugs?.join(' + ') || 'Análise de Interações'}
            </h1>
            {data.severity && (() => {
              const s = SEV_STYLE[data.severity] || SEV_STYLE.SEM_INTERACAO
              return (
                <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, borderRadius: 7, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{data.severity}</div>
                  <p style={{ fontSize: 14, color: s.color, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{data.summary}</p>
                </div>
              )
            })()}
            {data.mechanism && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Mecanismo</div><p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.7, margin: 0 }}>{data.mechanism}</p></div>}
            {data.recommendation && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontFamily: 'monospace', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Recomendação</div><p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.7, margin: 0 }}>{data.recommendation}</p></div>}
            {data.alternatives?.length > 0 && (
              <div style={{ background: '#052e16', border: '1px solid #14532d', borderRadius: 7, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Alternativas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.alternatives.map((a: string) => <span key={a} style={{ fontSize: 12, color: '#22c55e', background: '#14532d30', border: '1px solid #14532d', borderRadius: 4, padding: '3px 9px' }}>{a}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generic result for other types */}
        {result.type !== 'interaction' && data && (
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 20 }}>
              {result.title || 'Resultado Phlox'}
            </h1>
            <pre style={{ background: '#09090b', border: '1px solid #18181b', borderRadius: 8, padding: 16, fontSize: 12, color: '#a1a1aa', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 40, background: '#09090b', border: '1px solid #18181b', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, marginBottom: 10 }}>Verifica a tua medicação</div>
          <p style={{ fontSize: 13, color: '#52525b', marginBottom: 20, lineHeight: 1.7 }}>
            Phlox Clinical — verificador de interações, análise de análises, care plan e mais. Grátis para começar.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interactions" style={{ padding: '10px 22px', background: '#22c55e', color: '#050508', textDecoration: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
              Verificar interações grátis →
            </Link>
            <Link href="/login" style={{ padding: '10px 18px', background: 'transparent', color: '#52525b', textDecoration: 'none', borderRadius: 6, fontSize: 13, border: '1px solid #27272a' }}>
              Criar conta
            </Link>
          </div>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#27272a', marginTop: 12 }}>
            Sem cartão de crédito · Cancela quando quiseres
          </p>
        </div>
      </div>
    </div>
  )
}