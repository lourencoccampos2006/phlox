'use client'

// "Este turno" — as três barras no fundo da sidebar
// (docs/designs/Painel Phlox.html).
//
// Busca os seus próprios números em vez de os receber do painel. Assim aparece
// em TODAS as páginas institucionais, que é onde faz falta: quem está no /mar a
// marcar tomas quer ver quanto falta sem voltar ao painel. O custo é uma
// consulta leve por sessão de navegação — três contagens, sem linhas.
//
// Não mostra percentagens. "30 de 34" diz o que falta; "88%" obriga a fazer a
// conta de cabeça para saber que faltam quatro pessoas.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { ptDate } from '@/lib/ptTime'

type Linha = { etiqueta: string; feito: number; total: number }

export default function TurnoResumo({ cor }: { cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [linhas, setLinhas] = useState<Linha[] | null>(null)

  useEffect(() => {
    if (!user || !supabase) return
    let vivo = true
    const d = ptDate()
    const tol = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }

    ;(async () => {
      const [p, mar, meds, cr, att] = await Promise.all([
        tol(scope.filter(supabase.from('patients').select('id')).eq('active', true)),
        tol(scope.filter(supabase.from('mar_records').select('status')).eq('date', d)),
        tol(scope.filter(supabase.from('patient_meds').select('shifts,active'))),
        tol(scope.filter(supabase.from('care_records').select('patient_id')).eq('date', d)),
        tol(scope.filter(supabase.from('attendance').select('status')).eq('date', d)),
      ])
      if (!vivo) return

      const utentes = ((p as any).data || []).length
      const devidas = ((meds as any).data || [])
        .filter((m: any) => m.active !== false)
        .reduce((s: number, m: any) => s + (Array.isArray(m.shifts) && m.shifts.length ? m.shifts.length : 1), 0)
      const dadas = ((mar as any).data || [])
        .filter((t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken').length
      const comRegisto = new Set(((cr as any).data || []).map((r: any) => r.patient_id)).size
      const presentes = ((att as any).data || []).filter((a: any) => a.status === 'present').length

      setLinhas([
        { etiqueta: 'Medicação', feito: dadas, total: devidas },
        { etiqueta: 'Registos', feito: comRegisto, total: utentes },
        { etiqueta: 'Presenças', feito: presentes, total: utentes },
      ])
    })()

    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  // Enquanto não chega, nada. Um esqueleto a piscar na sidebar em cada
  // navegação é mais barulho do que informação.
  if (!linhas) return null
  // Uma casa sem utentes nem medicação não tem turno para resumir.
  if (linhas.every(l => l.total === 0)) return null

  return (
    <div style={{ marginTop: 'var(--space-10)', paddingTop: 'var(--space-9)', borderTop: '1px solid var(--border)' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink-5)', fontWeight: 700,
        marginBottom: 'var(--space-7)', paddingLeft: 'var(--space-5)',
      }}>Este turno</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)', padding: '0 var(--space-5)' }}>
        {linhas.map(l => (
          <div key={l.etiqueta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{l.etiqueta}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-4)' }}>
                {l.total ? `${l.feito}/${l.total}` : '—'}
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: cor,
                width: `${l.total ? Math.min(100, (l.feito / l.total) * 100) : 0}%`,
                transition: 'width .4s',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
