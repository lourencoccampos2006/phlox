'use client'

// components/institution/MedicacaoSOS.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A medicação SOS de uma pessoa: o que há, quando foi preciso, e registar.
//
// ── O QUE ESTE ECRÃ TEM DE FAZER EM CINCO SEGUNDOS ─────────────────────────
// Quem o abre está de pé ao lado de alguém com dores. Precisa de saber duas
// coisas antes de tocar em nada: o que é que esta pessoa tem para isto, e se
// já se deu hoje.
//
// Por isso as duas estão na mesma linha, antes de qualquer botão. A frase «Foi
// dado uma vez hoje, a última há 3 horas» é a razão de este ecrã existir —
// hoje essa resposta está na cabeça de quem esteve no turno anterior, e quando
// essa pessoa vai embora a resposta vai com ela.
//
// ── NÃO HÁ AQUI NENHUM BOTÃO BLOQUEADO ─────────────────────────────────────
// Mesmo depois do máximo do dia. Dizer «não pode» a alguém que está a olhar
// para uma pessoa com dores não impede nada: faz é com que o comprimido seja
// dado e não registado, que é o pior de todos os resultados.
//
// O que o ecrã faz é pôr a informação à frente e pedir o motivo. O que fica
// escrito é a verdade do que aconteceu.
//
// ── O MOTIVO É OBRIGATÓRIO, O RESULTADO NÃO ────────────────────────────────
// O motivo sabe-se no momento. Se resultou, não — ninguém sabe se a dor passou
// enquanto está a dar o comprimido. O resultado preenche-se depois, e é o que
// permite, ao fim de um mês, dizer se aquilo serve para alguma coisa.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { estiloFundoModal } from '@/lib/camadas'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  situacao, precisaDeRevisao, MOTIVOS_COMUNS, RESULTADOS, rotuloResultado,
  type MedSOS, type TomaSOS,
} from '@/lib/sos'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const CORES = {
  livre: { bg: 'var(--bg-2)', bd: 'var(--border)', fg: 'var(--ink-4)' },
  atencao: { bg: 'var(--badge-amber-bg)', bd: 'var(--badge-amber-border)', fg: 'var(--badge-amber-fg)' },
  limite: { bg: '#fff5f5', bd: '#fed7d7', fg: '#c53030' },
}

export default function MedicacaoSOS({ pid, nome, cor }: { pid: string; nome: string; cor: string }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const podeDar = scope.pode('medicacao', 'editar')

  const [meds, setMeds] = useState<MedSOS[]>([])
  const [tomas, setTomas] = useState<TomaSOS[]>([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aDar, setADar] = useState<MedSOS | null>(null)
  const [aAvaliar, setAAvaliar] = useState<TomaSOS | null>(null)

  const carregar = useCallback(async () => {
    if (!pid || !user) return
    setCarregando(true)
    const [m, t] = await Promise.all([
      // `*` de propósito. O PostgREST recusa o SELECT inteiro quando uma coluna
      // não existe — e aqui isso é o comportamento certo: enquanto a migração
      // não correr, a consulta falha, o `indisponivel` liga-se e a secção
      // simplesmente não aparece. Com a lista escrita à mão dava o mesmo
      // resultado, mas também partiria se alguém renomeasse um campo.
      supabase.from('patient_meds').select('*')
        .eq('patient_id', pid).eq('active', true).eq('sos', true).order('name'),
      // Trinta dias: chega para a conta de «isto está a ser preciso todos os
      // dias?» sem trazer um ano de histórico para um cartão.
      supabase.from('tomas_sos')
        .select('id, med_id, patient_id, dada_em, motivo, resultado, dada_por')
        .eq('patient_id', pid)
        .gte('dada_em', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('dada_em', { ascending: false }),
    ])
    if (m.error) {
      // A migração ainda não correu, ou esta pessoa não pode ver medicação.
      // Esconde-se a secção: uma caixa vazia diria «não tem SOS nenhum».
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setMeds(m.data || [])
    setTomas(t.error ? [] : (t.data || []))
    setCarregando(false)
  }, [pid, user, supabase])

  useEffect(() => { carregar() }, [carregar])

  async function registar(med: MedSOS, motivo: string) {
    if (!user) return
    const { data, error } = await supabase.from('tomas_sos').insert(scope.stamp({
      user_id: user.id, patient_id: pid, med_id: med.id,
      dada_em: new Date().toISOString(), motivo,
      dada_por: (user as any).name || user.email || '',
    })).select().single()
    if (error || !data) {
      setErro(reportError('sos-registar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }
    setErro(''); setTomas(prev => [data, ...prev]); setADar(null)
  }

  async function avaliar(toma: TomaSOS, resultado: string) {
    const antes = tomas
    setTomas(prev => prev.map(t => t.id === toma.id ? { ...t, resultado } : t))
    setAAvaliar(null)
    const { error } = await supabase.from('tomas_sos').update({ resultado }).eq('id', toma.id)
    if (error) { setTomas(antes); setErro(reportError('sos-avaliar', error, MSG.save)) }
  }

  const avisos = useMemo(
    () => meds.map(m => precisaDeRevisao(m, tomas)).filter(Boolean) as { vezes: number; frase: string }[],
    [meds, tomas])

  // As tomas por avaliar são as de hoje e de ontem sem resultado: mais atrás do
  // que isso, já ninguém se lembra se resultou, e perguntar seria pedir a
  // alguém que invente.
  const porAvaliar = useMemo(() => {
    const limite = Date.now() - 2 * 86400000
    return tomas.filter(t => !t.resultado && +new Date(t.dada_em) >= limite)
  }, [tomas])

  if (indisponivel) return null
  if (carregando) {
    return <div style={{ padding: 'var(--space-10)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
  }
  if (!meds.length) return null

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Medicação SOS</span>
        <span style={{ ...MONO, color: 'var(--ink-5)' }}>quando for preciso</span>
      </div>

      {erro && (
        <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{erro}</div>
      )}

      {avisos.map((a, i) => (
        <div key={i} style={{
          marginTop: 'var(--space-7)', padding: '11px 14px', borderRadius: 'var(--r-lg)',
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
          fontSize: 13, color: 'var(--badge-amber-fg)', lineHeight: 1.55,
        }}>{a.frase}</div>
      ))}

      <div style={{ marginTop: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {meds.map(m => {
          const s = situacao(m, tomas)
          const c = CORES[s.gravidade]
          return (
            <div key={m.id} style={{
              padding: 'var(--space-7)', borderRadius: 'var(--r-xl)',
              border: `1px solid ${c.bd}`, background: c.bg,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>
                    {m.name}{m.dose ? <span style={{ fontWeight: 500, color: 'var(--ink-3)' }}> · {m.dose}</span> : null}
                  </div>
                  {m.sos_para && (
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>Para {m.sos_para.toLowerCase()}</div>
                  )}
                  <div style={{ fontSize: 12.5, color: c.fg, marginTop: 6, lineHeight: 1.5, fontWeight: s.gravidade === 'livre' ? 500 : 600 }}>
                    {s.frase}
                  </div>
                </div>
                {podeDar && (
                  <button onClick={() => setADar(m)} style={{
                    flexShrink: 0, minHeight: 44, padding: '0 20px', borderRadius: 'var(--r-md)',
                    border: 'none', background: cor, color: '#fff',
                    fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
                  }}>Dar agora</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Como correu. Só do que foi dado nas últimas 48 horas — mais atrás do
          que isso, perguntar seria pedir a alguém que invente. */}
      {porAvaliar.length > 0 && podeDar && (
        <div style={{ marginTop: 'var(--space-9)' }}>
          <div style={{ ...MONO, marginBottom: 8 }}>Como correu?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {porAvaliar.map(t => {
              const med = meds.find(m => m.id === t.med_id)
              return (
                <button key={t.id} onClick={() => setAAvaliar(t)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  width: '100%', textAlign: 'left', padding: '11px 13px', minHeight: 44,
                  borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
                  background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {med?.name || 'Medicamento'} — {t.motivo}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                      {new Date(t.dada_em).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {t.dada_por ? ` · ${t.dada_por}` : ''}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: cor }}>dizer</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* O histórico. Sem isto, «foi dado 3 vezes hoje» é um número sem cara. */}
      {tomas.length > 0 && (
        <details style={{ marginTop: 'var(--space-9)' }}>
          <summary style={{ ...MONO, cursor: 'pointer' }}>
            {tomas.length === 1 ? '1 toma nos últimos 30 dias' : `${tomas.length} tomas nos últimos 30 dias`}
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tomas.map(t => {
              const med = meds.find(m => m.id === t.med_id)
              return (
                <div key={t.id} style={{
                  padding: '9px 12px', borderRadius: 'var(--r-md)',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5,
                }}>
                  <strong>{med?.name || 'Medicamento'}</strong> — {t.motivo}
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
                    {new Date(t.dada_em).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {t.dada_por ? ` · ${t.dada_por}` : ''}
                    {rotuloResultado(t.resultado) ? ` · ${rotuloResultado(t.resultado)}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </details>
      )}

      {aDar && <FolhaDar med={aDar} nome={nome} tomas={tomas} cor={cor}
        aoFechar={() => setADar(null)} aoRegistar={motivo => registar(aDar, motivo)} />}

      {aAvaliar && <FolhaAvaliar cor={cor}
        aoFechar={() => setAAvaliar(null)} aoEscolher={r => avaliar(aAvaliar, r)} />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function FolhaDar({ med, nome, tomas, cor, aoFechar, aoRegistar }: {
  med: MedSOS; nome: string; tomas: TomaSOS[]; cor: string
  aoFechar: () => void; aoRegistar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const s = situacao(med, tomas)
  const c = CORES[s.gravidade]

  return (
    <div onClick={aoFechar} style={{ ...estiloFundoModal, alignItems: 'flex-end', padding: 0 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={`Dar ${med.name}`}
        style={{
          width: '100%', maxWidth: 460, background: 'var(--bg, #fff)',
          borderRadius: '18px 18px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))',
          maxHeight: '86vh', overflowY: 'auto',
        }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink, #111)' }}>
          {med.name}{med.dose ? ` · ${med.dose}` : ''}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-4, #6b7280)', marginTop: 3 }}>
          a {nome.split(' ')[0]}
        </div>

        {/* A informação ANTES do botão, sempre. É esta frase que evita a segunda
            dose que ninguém sabia que era a segunda. */}
        <div style={{
          marginTop: 14, padding: '11px 13px', borderRadius: 'var(--r-lg)',
          background: c.bg, border: `1px solid ${c.bd}`,
          fontSize: 13, color: c.fg, fontWeight: s.gravidade === 'livre' ? 500 : 700, lineHeight: 1.5,
        }}>{s.frase}</div>

        <div style={{ marginTop: 16 }}>
          <span style={{ ...MONO, display: 'block', marginBottom: 8 }}>Porque é que está a dar</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MOTIVOS_COMUNS.map(m => (
              <button key={m} onClick={() => setMotivo(m)} style={{
                padding: '7px 12px', borderRadius: 999, minHeight: 36, cursor: 'pointer',
                border: `1.5px solid ${motivo === m ? cor : 'var(--border, #e5e7eb)'}`,
                background: motivo === m ? cor + '14' : 'transparent',
                color: motivo === m ? cor : 'var(--ink-3, #374151)',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              }}>{m}</button>
            ))}
          </div>
          <input
            value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="ou escreva o que se passa"
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--border, #e5e7eb)',
              fontFamily: 'inherit', fontSize: 14, minHeight: 44,
            }} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={aoFechar} style={{
            flex: '0 0 auto', minHeight: 46, padding: '0 18px', borderRadius: 11,
            border: '1px solid var(--border-2, #d1d5db)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3, #374151)', cursor: 'pointer',
          }}>Cancelar</button>
          <button
            onClick={() => { setAGravar(true); aoRegistar(motivo.trim()) }}
            disabled={!motivo.trim() || aGravar}
            style={{
              flex: 1, minHeight: 46, borderRadius: 11, border: 'none',
              background: motivo.trim() ? cor : 'var(--bg-3, #e5e7eb)',
              color: motivo.trim() ? '#fff' : 'var(--ink-5, #9ca3af)',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              cursor: motivo.trim() && !aGravar ? 'pointer' : 'default',
            }}>{aGravar ? 'A registar…' : 'Dei agora'}</button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-5, #9ca3af)', marginTop: 10, lineHeight: 1.5 }}>
          Fica registada a hora exata e quem deu. A pergunta «resultou?» aparece
          a seguir — responde-se quando se souber.
        </div>
      </div>
    </div>
  )
}

function FolhaAvaliar({ cor, aoFechar, aoEscolher }: {
  cor: string; aoFechar: () => void; aoEscolher: (r: string) => void
}) {
  return (
    <div onClick={aoFechar} style={{ ...estiloFundoModal, alignItems: 'flex-end', padding: 0 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Como correu"
        style={{
          width: '100%', maxWidth: 460, background: 'var(--bg, #fff)',
          borderRadius: '18px 18px 0 0', padding: '20px 18px calc(18px + env(safe-area-inset-bottom))',
        }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink, #111)', marginBottom: 4 }}>
          Como correu?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-4, #6b7280)', marginBottom: 16, lineHeight: 1.5 }}>
          É isto que permite, ao fim de um mês, dizer se aquele medicamento serve
          para alguma coisa a esta pessoa.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RESULTADOS.map(r => (
            <button key={r.id} onClick={() => aoEscolher(r.id)} style={{
              textAlign: 'left', padding: '13px 14px', borderRadius: 11, minHeight: 48,
              border: '1.5px solid var(--border, #e5e7eb)', background: 'transparent',
              fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600,
              color: 'var(--ink, #111)', cursor: 'pointer',
            }}>{r.label}</button>
          ))}
        </div>
        <button onClick={aoFechar} style={{
          width: '100%', minHeight: 44, marginTop: 12, borderRadius: 11,
          border: '1px solid var(--border-2, #d1d5db)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink-3, #374151)', cursor: 'pointer',
        }}>Ainda não sei</button>
      </div>
    </div>
  )
}
