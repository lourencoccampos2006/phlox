'use client'

// components/institution/ProcessoIndividual.tsx
// ─────────────────────────────────────────────────────────────────────────────
// «Mostre-me o processo da Dona Maria.»
//
// ── A PERGUNTA A QUE ISTO RESPONDE ─────────────────────────────────────────
// É a pergunta que uma inspeção da Segurança Social faz, e era a única que o
// Phlox não sabia responder. O /conformidade dizia se a CASA estava em ordem;
// o processo de uma PESSOA estava espalhado por seis separadores da ficha, e
// para saber se estava completo era preciso abri-los todos e lembrar-se do
// que a portaria pede.
//
// Todos os programas que as casas portuguesas já usam vendem isto em primeiro
// lugar — «toda a informação administrativa, social e clínica num único
// local». É a pasta, e é por causa dela que se compra o programa.
//
// ── NINGUÉM PICA NADA ──────────────────────────────────────────────────────
// Cada linha é uma pergunta à base de dados, e não uma caixa para marcar à
// mão. Uma lista de caixas fica toda picada ao fim de um mês e passa a dizer
// que está tudo bem porque alguém, uma vez, disse que estava — e a inspeção
// chega dois anos depois.
//
// ── E FALA DO PHLOX, NÃO DA CASA ───────────────────────────────────────────
// O texto diz sempre o que falta AQUI. Há casas que guardam metade disto em
// papel, no arquivo, e não estão em falta com ninguém. Um programa que diga a
// uma casa dessas que ela está irregular está a mentir-lhe — e é a última vez
// que ela abre este ecrã.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import {
  processoPara, balanco, cumprido,
  type Dados, type Elemento,
} from '@/lib/processoIndividual'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

const ONDE: Record<Elemento['onde'], string> = {
  documentos: 'Documentos',
  ficha: 'Dados da pessoa',
  plano: 'O Plano',
  avaliacoes: 'Avaliações',
}

export default function ProcessoIndividual({ pid, nome, cor }: {
  pid: string; nome: string; cor: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()

  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(false)

  const grupos = useMemo(() => processoPara(institution), [institution])

  const carregar = useCallback(async () => {
    if (!pid || !user || !grupos.length) { setCarregando(false); return }
    setCarregando(true)

    // Quatro consultas em paralelo, e não quatro em fila. Isto vive por baixo
    // de uma ficha que já faz uma dúzia — encadeá-las acrescentava quatro idas
    // e voltas antes de a primeira linha aparecer.
    //
    // Nenhuma delas traz o conteúdo de nada: só se pergunta SE existe. A
    // categoria do documento, não o documento; o id do plano, não o plano.
    const [docs, ficha, planos, avals] = await Promise.all([
      supabase.from('documents').select('category').eq('patient_id', pid),
      supabase.from('patients').select('*').eq('id', pid).maybeSingle(),
      supabase.from('planos').select('id').eq('patient_id', pid).eq('estado', 'ativo').limit(1),
      supabase.from('assessments').select('patient_id').eq('patient_id', pid).limit(1),
    ])

    setDados({
      // Um erro aqui vale «não sei», e «não sei» desenha-se como «falta» — que
      // é o lado seguro: manda alguém confirmar uma coisa que já lá está, em
      // vez de dar por arrumado um processo que não está.
      categorias: new Set<string>(docs.error ? [] : (docs.data || []).map((d: any) => d.category)),
      ficha: ficha.error ? null : ficha.data,
      temPlano: !planos.error && (planos.data || []).length > 0,
      temAvaliacao: !avals.error && (avals.data || []).length > 0,
    })
    setCarregando(false)
  }, [pid, user, supabase, grupos.length])

  useEffect(() => { carregar() }, [carregar])

  // Numa farmácia ou numa clínica isto não existe: a portaria é dos lares e
  // dos centros de dia, e cobrar-lhes uma lei que não é delas seria inventar
  // obrigações.
  if (!grupos.length) return null
  if (!scope.ve('registos')) return null
  if (carregando || !dados) return null

  const b = balanco(grupos, dados)
  const completo = b.pct >= 100
  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || nome

  return (
    <section style={{ marginTop: 'var(--space-12)' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
      }}>
        <span style={MONO}>Processo individual</span>
        <span style={{ ...MONO, color: completo ? 'var(--badge-green-fg)' : 'var(--ink-5)' }}>
          {b.feitos} de {b.total}
        </span>
      </div>

      {/* A barra. Só conta o que a lei exige — uma casa que tenha tudo o que é
          pedido tem de conseguir chegar ao fim, senão a barra nunca enche e ao
          fim de duas semanas ninguém volta a olhar para ela. */}
      <div style={{ marginTop: 'var(--space-7)' }}>
        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${b.pct}%`,
            background: completo ? 'var(--badge-green-fg)' : cor,
            borderRadius: 'var(--r-sm)', transition: 'width .5s',
          }} />
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, margin: 'var(--space-5) 0 0' }}>
          {completo
            ? `Está tudo o que a Portaria 67/2012 pede para o processo de ${primeiroNome}.`
            : `Faltam ${b.faltam.filter(e => e.exigido).length === 1
                ? 'um elemento'
                : `${b.faltam.filter(e => e.exigido).length} elementos`} no processo de ${primeiroNome}, aqui no Phlox.`}
          {!completo && (
            <span style={{ display: 'block', marginTop: 4, color: 'var(--ink-5)', fontSize: 12.5 }}>
              O que a casa tenha em papel conta na mesma numa inspeção — isto diz só o que está cá dentro.
            </span>
          )}
        </p>
      </div>

      {/* O que falta primeiro, e sem ter de abrir nada. Quem só quer saber o
          que tem de tratar hoje não devia ter de percorrer as quinze linhas
          que já estão bem. */}
      {!completo && !aberto && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-7) 0 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {b.faltam.slice(0, 4).map(e => <LinhaEmFalta key={e.id} e={e} />)}
          {b.faltam.length > 4 && (
            <li style={{ fontSize: 12.5, color: 'var(--ink-5)', paddingLeft: 22 }}>
              e mais {b.faltam.length - 4}.
            </li>
          )}
        </ul>
      )}

      <button onClick={() => setAberto(a => !a)} style={{
        marginTop: 'var(--space-7)', minHeight: 38, padding: '0 14px',
        borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
      }}>{aberto ? 'Fechar a lista' : 'Ver o processo todo'}</button>

      {aberto && (
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {grupos.map(g => (
            <div key={g.grupo}>
              <div style={{ ...MONO, fontSize: 9.5, marginBottom: 8 }}>{g.grupo}</div>
              <div style={{
                borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                {g.elementos.map((e, i) => {
                  const ok = cumprido(e, dados)
                  return (
                    <div key={e.id} style={{
                      display: 'flex', gap: 11, padding: '11px 13px',
                      borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                      background: ok ? 'transparent' : 'var(--bg-2)',
                    }}>
                      <span aria-hidden style={{
                        width: 18, height: 18, flexShrink: 0, marginTop: 2, borderRadius: '50%',
                        border: `1.5px solid ${ok ? 'var(--badge-green-fg)' : 'var(--border-2)'}`,
                        background: ok ? 'var(--badge-green-fg)' : 'transparent',
                        color: 'var(--bg)', fontSize: 11, lineHeight: '15px', textAlign: 'center', fontWeight: 700,
                      }}>{ok ? '✓' : ''}</span>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 13.5, fontWeight: 600, lineHeight: 1.35,
                          color: ok ? 'var(--ink-3)' : 'var(--ink)',
                        }}>
                          {e.titulo}
                          {!e.exigido && (
                            <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-5)' }}>
                              opcional
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.45 }}>
                          {e.detalhe}
                        </div>
                        {!ok && (
                          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 4 }}>
                            Resolve-se em <strong style={{ color: 'var(--ink-4)' }}>{ONDE[e.onde]}</strong>
                            {e.base && ` · ${e.base}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Isto tem de estar escrito, e não em letra pequena escondida: uma
              casa que leia isto como um parecer jurídico e se fie nele fica
              pior do que estava. */}
          <p style={{ fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.55, margin: 0 }}>
            Esta lista segue a Portaria n.º 67/2012 e serve para organizar o trabalho.
            Não substitui aconselhamento jurídico nem a leitura do acordo de cooperação
            desta casa, que pode pedir mais coisas.
          </p>
        </div>
      )}
    </section>
  )
}

function LinhaEmFalta({ e }: { e: Elemento }) {
  return (
    <li style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, lineHeight: 1.45 }}>
      <span aria-hidden style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: e.exigido ? 'var(--badge-amber-fg)' : 'var(--ink-5)',
      }} />
      <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{e.titulo}</span>
      <span style={{ color: 'var(--ink-5)', fontSize: 11.5 }}>
        {ONDE[e.onde]}{!e.exigido && ' · opcional'}
      </span>
    </li>
  )
}
