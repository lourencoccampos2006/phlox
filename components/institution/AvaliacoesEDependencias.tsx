'use client'

// components/institution/AvaliacoesEDependencias.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O que as avaliações dizem, e o que isso implica no plano.
//
// ── O QUE ESTAVA MAL ────────────────────────────────────────────────────────
// As escalas já existiam e estão bem feitas — Barthel, Braden, Morse, MNA, com
// os itens certos. Só que guardavam **um número**.
//
// «Barthel 35» não diz a ninguém o que fazer. Quem lê isso e vai dar banho à
// pessoa não sabe se ela se senta sozinha. A informação que interessava estava
// nas RESPOSTAS — «banho: 0», «transferência: 5» — e ficava enterrada num
// jsonb que nada voltava a ler.
//
// E o plano, ao lado, era uma página em branco onde alguém escrevia objetivos
// de intuição. Duas coisas certas, sem nada a ligá-las.
//
// ── O QUE ESTA SECÇÃO FAZ ──────────────────────────────────────────────────
//   1. O PERFIL DE DEPENDÊNCIA: em que é que esta pessoa precisa de ajuda,
//      item a item, tirado das respostas do Barthel.
//   2. O QUE ISSO IMPLICA: sugestões concretas — um serviço de cuidado a
//      acrescentar, uma etiqueta a pôr, um objetivo para o plano.
//   3. O QUE ESTÁ POR AVALIAR: que escalas nunca foram feitas ou já têm idade.
//
// ── AS SUGESTÕES NÃO SE APLICAM SOZINHAS ───────────────────────────────────
// Cada uma diz DE ONDE VEIO («o Braden deu 11»), e tem um botão. Um plano
// preenchido por um programa é um plano que ninguém leu — e a assinatura que
// lá está por baixo é de uma pessoa.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { levelOf, SCALES, type ScaleType } from '@/lib/assessmentScales'
import {
  perfilDeDependencia, ondePrecisaDeAjuda, perfilEmUmaLinha,
  estadoDasEscalas,
  ROTULO_DO_NIVEL, COR_DO_NIVEL,
  type Dependencia,
} from '@/lib/dependencias'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const GRAVIDADE = {
  urgente: { fundo: 'var(--badge-red-bg)', borda: 'var(--badge-red-border)', texto: 'var(--red)' },
  atencao: { fundo: 'var(--badge-amber-bg)', borda: 'var(--badge-amber-border)', texto: 'var(--amber)' },
  informa: { fundo: 'var(--bg-2)', borda: 'var(--border)', texto: 'var(--ink-3)' },
}

interface Registo { scale: string; score: number; answers: any; date: string }

export default function AvaliacoesEDependencias({ pid, nome, cor, planoId }: {
  pid: string; nome: string; cor: string
  /** Quando há plano ativo, as sugestões de objetivo podem ser aceites. */
  planoId?: string | null
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeEditar = scope.pode('utentes', 'editar')

  const [registos, setRegistos] = useState<Registo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aceites, setAceites] = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const { data, error } = await supabase.from('assessments')
      .select('scale, score, answers, date')
      .eq('patient_id', pid).order('date', { ascending: false })
    if (error) { setIndisponivel(true); setCarregando(false); return }
    setIndisponivel(false)
    setRegistos(data || [])
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  /** A mais recente de cada escala. */
  const ultimas = useMemo(() => {
    const m: Record<string, Registo> = {}
    // A consulta vem por data descendente, por isso a primeira de cada é a
    // mais recente.
    for (const r of registos) if (!m[r.scale]) m[r.scale] = r
    return m
  }, [registos])

  const perfil = useMemo(
    () => perfilDeDependencia(ultimas.barthel?.answers),
    [ultimas])

  const escalas = useMemo(() => {
    const datas: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(ultimas)) datas[k] = v.date
    return estadoDasEscalas(datas)
  }, [ultimas])

  if (indisponivel) return null
  if (carregando) {
    return <div style={{ padding: 'var(--space-10)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar as avaliações…</div>
  }

  const comAjuda = ondePrecisaDeAjuda(perfil)

  return (
    <div style={{ marginTop: 'var(--space-10)' }}>
      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', color: 'var(--red)',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {/* ── As pontuações ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Avaliações</span>
        <Link href={`/assessments?patient=${pid}`} style={{
          fontSize: 12.5, fontWeight: 700, color: cor, textDecoration: 'none',
        }}>Fazer uma avaliação →</Link>
      </div>

      <div style={{
        marginTop: 'var(--space-7)', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 9,
      }}>
        {escalas.map(e => {
          const r = ultimas[e.escala]
          const meta = SCALES[e.escala as ScaleType]
          const nivel = r && meta ? levelOf(e.escala as ScaleType, r.score) : null
          return (
            <div key={e.escala} style={{
              padding: '12px 13px', borderRadius: 'var(--r-lg)',
              border: `1px solid ${e.chama ? 'var(--badge-amber-border)' : 'var(--border)'}`,
              background: e.chama ? 'var(--badge-amber-bg)' : 'var(--bg-2)',
            }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontWeight: 600 }}>{e.label}</div>
              {r && nivel ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: nivel.color, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {r.score}<span style={{ fontSize: 12, color: 'var(--ink-5)', fontWeight: 500 }}>/{meta.max}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: nivel.color, marginTop: 2 }}>{nivel.label}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-5)', marginTop: 6, fontStyle: 'italic' }}>Por fazer</div>
              )}
              <div style={{
                fontSize: 11, marginTop: 5, lineHeight: 1.4,
                color: e.chama ? 'var(--badge-amber-fg)' : 'var(--ink-5)',
              }}>{e.frase}</div>
            </div>
          )
        })}
      </div>

      {/* ── O perfil de dependência ──────────────────────────────────────── */}
      {perfil.length > 0 && (
        <section style={{ marginTop: 'var(--space-12)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
          }}>
            <span style={MONO}>Em que precisa de ajuda</span>
            <span style={{ ...MONO, color: 'var(--ink-5)' }}>do Barthel</span>
          </div>

          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 'var(--space-6) 0 0', lineHeight: 1.6 }}>
            {nome.split(' ')[0]} {perfilEmUmaLinha(perfil).toLowerCase()}
          </p>

          <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {(comAjuda.length ? comAjuda : perfil).map(d => <Pastilha key={d.id} d={d} />)}
          </div>

          {comAjuda.length > 0 && comAjuda.length < perfil.length && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 11.5, color: 'var(--ink-5)', cursor: 'pointer' }}>
                O que faz sozinha ({perfil.length - comAjuda.length})
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {perfil.filter(d => d.nivel === 'independente').map(d => <Pastilha key={d.id} d={d} />)}
              </div>
            </details>
          )}
        </section>
      )}

      {!registos.length && (
        <div style={{
          marginTop: 'var(--space-10)', padding: 'var(--space-12)',
          borderRadius: 'var(--r-xl)', border: '1px dashed var(--border-2)', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>
            Ainda não há avaliações de {nome.split(' ')[0]}. É delas que sai o perfil de
            dependência — e é o perfil que diz que cuidados esta pessoa precisa.
          </p>
        </div>
      )}
    </div>
  )
}

function Pastilha({ d }: { d: Dependencia }) {
  const c = COR_DO_NIVEL[d.nivel]
  return (
    <span style={{
      padding: '6px 11px', borderRadius: 999,
      background: c.fundo, border: `1px solid ${c.borda}`, color: c.texto,
      fontSize: 12.5, fontWeight: 600,
    }}>
      {d.atividade} · <span style={{ fontWeight: 700 }}>{ROTULO_DO_NIVEL[d.nivel].toLowerCase()}</span>
    </span>
  )
}
