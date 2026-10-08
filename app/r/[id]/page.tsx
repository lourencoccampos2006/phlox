// app/r/[id]/page.tsx — Página pública de resultado partilhado
// Acessível sem conta. Mostra o resultado e converte visitantes em utilizadores.

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'
import { reportError } from '@/lib/clientError'

interface Props { params: { id: string } }

async function getResult(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error: erroLeitura } = await supabase.from('shared_results').select('*').eq('id', id).single()
  if (erroLeitura) reportError('resultado-partilhado', erroLeitura)
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
    counter: 'Aconselhamento da farmácia',
  }
  return {
    title: `${titles[result.type] || 'Resultado'} | Phlox Clinical`,
    description: 'Resultado gerado pelo Phlox Clinical — plataforma de farmacologia clínica em português.',
  }
}

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  GRAVE:         { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
  MODERADA:      { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)' },
  LIGEIRA:       { color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)' },
  SEM_INTERACAO: { color: 'var(--green-3)', bg: 'var(--green-light)', border: 'var(--green-mid)' },
}

export default async function SharedResultPage({ params }: Props) {
  const result = await getResult(params.id)

  if (!result) return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-5)' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Resultado não encontrado</div>
        <p style={{ fontSize: 14, marginBottom: 20 }}>Este link expirou ou não existe.</p>
        <Link href="/" style={{ color: 'var(--green)', textDecoration: 'none', fontSize: 13 }}>Ir para o Phlox →</Link>
      </div>
    </div>
  )

  const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
  const isExpired = result.expires_at && new Date(result.expires_at) < new Date()

  // ── Aconselhamento da farmácia (modo balcão) — vista clara para o utente ──
  // Layout próprio (claro, simples): o utente recebe no telemóvel o que tomar,
  // como tomar, cuidados, e quando voltar. Sem linguagem técnica.
  if (result.type === 'counter' && data) {
    const rec = (data.recommended || []) as { name: string; dose?: string; duration?: string; notes?: string }[]
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-3)', fontFamily: 'system-ui, sans-serif', color: 'var(--ink-2)' }}>
        <div style={{ background: 'var(--green)', color: 'white', padding: '14px 0' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 18 }}>Phlox</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>Aconselhamento da farmácia</span>
          </div>
        </div>
        <div style={{ maxWidth: 560, margin: '24px auto', padding: '0 20px' }}>
          {isExpired && <div style={{ background: 'var(--badge-amber-bg)', color: 'var(--amber)', borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>Este aconselhamento expirou.</div>}
          {data.pharmacy && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 4 }}>{data.pharmacy}</div>}
          {data.complaint && <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, margin: '0 0 16px', lineHeight: 1.25 }}>{data.complaint}</h1>}

          {rec.length > 0 && (
            <section style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>O que pode tomar</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {rec.map((m, i) => (
                  <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '13px 15px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{m.name}</div>
                    {m.dose && <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 3 }}><b>Como tomar:</b> {m.dose}</div>}
                    {m.duration && <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 2 }}>Durante: {m.duration}</div>}
                    {m.notes && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 4 }}>{m.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(data.advice?.length || 0) > 0 && (
            <section style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Conselhos</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-3)', fontSize: 14, lineHeight: 1.7 }}>
                {data.advice.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {(data.avoid?.length || 0) > 0 && (
            <section style={{ marginBottom: 18, background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-xl)', padding: '12px 15px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>A evitar</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--badge-amber-fg)', fontSize: 13.5, lineHeight: 1.65 }}>
                {data.avoid.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {(data.refer_if?.length || 0) > 0 && (
            <section style={{ marginBottom: 18, background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-xl)', padding: '12px 15px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Procure o médico se</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--red)', fontSize: 13.5, lineHeight: 1.65 }}>
                {data.refer_if.map((a: string, i: number) => <li key={i}>{a}</li>)}
              </ul>
            </section>
          )}

          {data.followUp && <div style={{ fontSize: 14, color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '12px 15px', marginBottom: 18 }}><b>Voltar à farmácia:</b> {data.followUp}</div>}

          <p style={{ fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.55, marginBottom: 24 }}>Aconselhamento dado pela sua farmácia através do Phlox. Não substitui a consulta médica. Em emergência, ligue 112.</p>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 6 }}>Guarde a sua medicação no Phlox</div>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 14px', lineHeight: 1.6 }}>Lembretes de toma, interações e a sua saúde num só sítio. Grátis.</p>
            <Link href="/login" style={{ display: 'inline-block', padding: '11px 22px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 700 }}>Criar conta grátis →</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', fontFamily: 'sans-serif', color: 'var(--bg-2)' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid var(--ink-2)', padding: '12px 0' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="var(--green)"/>
              <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--bg-2)', letterSpacing: '-0.02em' }}>PHLOX CLINICAL</span>
          </div>
          <Link href="/login" style={{ padding: '7px 16px', background: 'var(--green)', color: 'var(--ink)', textDecoration: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700 }}>
            Criar conta grátis →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px' }}>
        {isExpired && (
          <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-2)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--ink-4)' }}>
            Este resultado expirou. Cria conta para guardar os teus resultados permanentemente.
          </div>
        )}

        {/* Result type label */}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
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
                <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.color}`, borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{data.severity}</div>
                  <p style={{ fontSize: 14, color: s.color, lineHeight: 1.7, margin: 0, fontWeight: 500 }}>{data.summary}</p>
                </div>
              )
            })()}
            {data.mechanism && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Mecanismo</div><p style={{ fontSize: 13, color: 'var(--ink-5)', lineHeight: 1.7, margin: 0 }}>{data.mechanism}</p></div>}
            {data.recommendation && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Recomendação</div><p style={{ fontSize: 13, color: 'var(--ink-5)', lineHeight: 1.7, margin: 0 }}>{data.recommendation}</p></div>}
            {data.alternatives?.length > 0 && (
              <div style={{ background: 'var(--green-3)', border: '1px solid var(--green-3)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Alternativas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.alternatives.map((a: string) => <span key={a} style={{ fontSize: 12, color: 'var(--green)', background: '#14532d30', border: '1px solid var(--green-3)', borderRadius: 'var(--r)', padding: '3px 9px' }}>{a}</span>)}
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
            <pre style={{ background: 'var(--ink)', border: '1px solid var(--ink-2)', borderRadius: 'var(--r-md)', padding: 16, fontSize: 12, color: 'var(--ink-5)', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 40, background: 'var(--ink)', border: '1px solid var(--ink-2)', borderRadius: 'var(--r-xl)', padding: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, marginBottom: 10 }}>Verifica a tua medicação</div>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20, lineHeight: 1.7 }}>
            Phlox Clinical — verificador de interações, análise de análises, care plan e mais. Grátis para começar.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interactions" style={{ padding: '10px 22px', background: 'var(--green)', color: 'var(--ink)', textDecoration: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700 }}>
              Verificar interações grátis →
            </Link>
            <Link href="/login" style={{ padding: '10px 18px', background: 'transparent', color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 'var(--r)', fontSize: 13, border: '1px solid var(--ink-2)' }}>
              Criar conta
            </Link>
          </div>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ink-2)', marginTop: 12 }}>
            Sem cartão de crédito · Cancela quando quiseres
          </p>
        </div>
      </div>
    </div>
  )
}