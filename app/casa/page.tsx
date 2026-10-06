'use client'

// app/casa/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A casa — o trabalho que ela faz sobre si própria.
//
// ── A LACUNA QUE ISTO FECHA ────────────────────────────────────────────────
// Da pesquisa ao Ankira. A aplicação base deles tem doze módulos; o Phlox tinha
// alguma coisa para onze. O que faltava inteiro é o que eles chamam
// «Serviços»: a higiene dos espaços e a lavandaria.
//
// Tudo o que o Phlox sabia pendurava-se numa pessoa. Limpar o refeitório não se
// pendura em ninguém — e é metade do dia de trabalho de uma casa.
//
// ── E EM PORTUGAL TEM INSPEÇÃO PRÓPRIA ─────────────────────────────────────
// Um lar tem dois inspetores: a Segurança Social pela resposta social, e a ASAE
// pela cozinha. A ASAE, antes de olhar para o plano HACCP, pede os
// pré-requisitos — o plano de higienização registado e os registos de
// temperatura dos equipamentos de frio.
//
// Daí as duas metades desta página serem estas duas, e não outras.
//
// ── PORQUE É QUE A TEMPERATURA NÃO É UMA TAREFA ────────────────────────────
// Seria mais simples ter tudo numa lista de coisas por marcar. Mas uma arca a
// −12 °C não está «por fazer» nem «feita»: está mal. Uma lista de picar não
// tem onde pôr isso, e o que acontece é que alguém pica à mesma e o número
// perde-se.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { currentShiftFor } from '@/lib/institutionConfig'
import { ptDate, ptHHMM } from '@/lib/ptTime'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import Responsavel from '@/components/institution/Responsavel'
import {
  tarefasDeHoje, estadoDosEquipamentos, estadoDaLeitura, intervaloEmPalavras, resumoDaCasa,
  CATEGORIAS, ORDEM_DAS_CATEGORIAS, TIPOS_EQUIPAMENTO,
  type TarefaDaCasa, type TarefaDeHoje, type Equipamento, type Leitura,
  type EstadoDoEquipamento, type CategoriaDaCasa,
} from '@/lib/casa'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

type Vista = 'tarefas' | 'temperaturas'

export default function ACasa() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cor = blueprintFor(institution).accent
  const hoje = ptDate()
  const turno = currentShiftFor(institution)

  const [vista, setVista] = useState<Vista>('tarefas')
  const [tarefas, setTarefas] = useState<TarefaDaCasa[]>([])
  const [execucoes, setExecucoes] = useState<any[]>([])
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [leituras, setLeituras] = useState<Leitura[]>([])

  const [carregando, setCarregando] = useState(true)
  /**
   * Já houve uma leitura a sério?
   *
   * `carregando` não chega. Entre o primeiro render e a chegada da casa há um
   * instante em que o utilizador existe mas `scope.orgId` ainda é nulo —
   * `carregando` passa a falso com a lista vazia, e o ecrã diz «A casa está
   * tratada por hoje» a uma casa onde nada foi feito.
   *
   * Medido: o teste apanhou exactamente essa frase antes de a primeira
   * consulta sequer ter respondido. É a mesma falsa boa notícia que o /o-dia
   * dava com «Nada marcado para tarde» e catorze doses por dar — e uma falsa
   * boa notícia é pior do que um ecrã em branco, porque quem a lê vai-se
   * embora descansado.
   */
  const [jaCarregou, setJaCarregou] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erro, setErro] = useState('')
  const [aMarcar, setAMarcar] = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    // A mesma guarda do /o-dia: enquanto não se sabe se há casa, não se desenha
    // «não há nada».
    if (!scope.pronto) return
    if (!user || !scope.orgId) { setCarregando(false); return }
    setCarregando(true)

    const q = (t: string) => supabase.from(t).select('*').eq('org_id', scope.orgId)
    const [ts, ex, eq, lt] = await Promise.all([
      q('tarefas_da_casa').eq('ativo', true).order('ordem'),
      q('tarefas_da_casa_execucoes').eq('data', hoje),
      q('equipamentos').eq('ativo', true).order('ordem'),
      q('leituras_temperatura').eq('data', hoje),
    ])

    if (ts.error && isSetupError(ts.error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    setTarefas(ts.error ? [] : (ts.data || []))
    setExecucoes(ex.error ? [] : (ex.data || []))
    setEquipamentos(eq.error ? [] : (eq.data || []))
    setLeituras(lt.error ? [] : (lt.data || []))
    setJaCarregou(true)
    setCarregando(false)
  }, [user, supabase, scope, hoje])

  useEffect(() => { carregar() }, [carregar])

  const doDia = useMemo(() => tarefasDeHoje(tarefas, execucoes), [tarefas, execucoes])
  const estados = useMemo(
    () => estadoDosEquipamentos(equipamentos, leituras, hoje), [equipamentos, leituras, hoje])
  const resumo = useMemo(() => resumoDaCasa(doDia, estados), [doDia, estados])

  // ── Marcar uma tarefa ─────────────────────────────────────────────────────
  async function marcar(t: TarefaDeHoje) {
    if (!user || aMarcar.has(t.tarefa.id)) return
    setAMarcar(p => new Set(p).add(t.tarefa.id))
    const quem = (user as any)?.name || user?.email || ''
    const antes = execucoes

    // O ecrã responde já. Quem limpa dez quartos não espera meio segundo a
    // olhar para um botão — toca outra vez, e ficam duas marcas.
    setExecucoes(p => t.feito
      ? p.filter(x => x.tarefa_id !== t.tarefa.id)
      : [...p, { tarefa_id: t.tarefa.id, data: hoje, turno, feito_por: quem }])

    const r = t.feito
      ? await supabase.from('tarefas_da_casa_execucoes')
          .delete().eq('tarefa_id', t.tarefa.id).eq('data', hoje)
      : await supabase.from('tarefas_da_casa_execucoes').insert(scope.stamp({
          user_id: user.id, tarefa_id: t.tarefa.id, data: hoje, turno,
          feito_por: quem, produto: t.tarefa.produto,
        }))

    setAMarcar(p => { const n = new Set(p); n.delete(t.tarefa.id); return n })
    // Chave única violada = já estava marcada, que é o resultado que se queria.
    if (r.error && !/duplicate key/i.test(r.error.message)) {
      setExecucoes(antes)
      setErro(reportError('casa-marcar', r.error, isSetupError(r.error) ? MSG.unavailable : MSG.save))
    } else setErro('')
  }

  async function atribuir(t: TarefaDaCasa, id: string | null, nome: string | null) {
    const antes = tarefas
    setTarefas(p => p.map(x => x.id === t.id ? { ...x, responsavel_id: id, responsavel: nome } : x))
    const { error } = await supabase.from('tarefas_da_casa')
      .update({ responsavel_id: id, responsavel: nome }).eq('id', t.id)
    if (error) {
      setTarefas(antes)
      setErro(reportError('casa-atribuir', error, isSetupError(error) ? MSG.unavailable : MSG.save))
    } else setErro('')
  }

  // ── Registar uma temperatura ──────────────────────────────────────────────
  async function medir(e: Equipamento, valor: number, acao: string) {
    if (!user) return
    const quem = (user as any)?.name || user?.email || ''
    const { data, error } = await supabase.from('leituras_temperatura').insert(scope.stamp({
      user_id: user.id, equipamento_id: e.id, data: hoje, hora: ptHHMM(),
      valor, acao: acao.trim() || null, medido_por: quem,
    })).select().single()

    if (error || !data) {
      setErro(reportError('casa-temperatura', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return false
    }
    setErro('')
    setLeituras(p => [...p, data])
    return true
  }

  if (indisponivel) {
    return (
      <div style={{ padding: 'var(--space-14)', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          Os serviços da casa ainda não estão montados
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Falta um passo de configuração. Assim que estiver feito, esta página traz o plano de
          higienização e os registos de temperatura já preenchidos.
        </p>
      </div>
    )
  }

  const foraDoIntervalo = estados.reduce((n, e) => n + e.foraDoIntervalo.length, 0)

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 880, margin: '0 auto' }}>

      <header style={{ marginBottom: 'var(--space-9)' }}>
        <span style={{ ...MONO, color: cor }}>A casa</span>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
          color: 'var(--ink)', letterSpacing: '-0.025em', margin: 'var(--space-4) 0 0', lineHeight: 1.1,
        }}>Serviços gerais</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 'var(--space-5) 0 0', lineHeight: 1.55 }}>
          {carregando ? 'A ver o que há para fazer…' : resumo}
        </p>
      </header>

      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      <div style={{
        display: 'flex', borderRadius: 'var(--r-md)', overflow: 'hidden',
        border: '1.5px solid var(--border-2)', width: 'fit-content',
        maxWidth: '100%', marginBottom: 'var(--space-9)',
      }}>
        {([['tarefas', 'Limpeza e lavandaria'], ['temperaturas', 'Temperaturas']] as [Vista, string][]).map(([v, rot]) => {
          const on = vista === v
          return (
            <button key={v} onClick={() => setVista(v)} style={{
              minHeight: 40, padding: '0 14px', border: 'none', cursor: 'pointer',
              background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              {rot}
              {/* O contador só aparece onde há um problema. Um contador a zero
                  em cada separador ensina a ignorar os contadores. */}
              {v === 'temperaturas' && foraDoIntervalo > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 999,
                  background: on ? 'rgba(255,255,255,.22)' : 'var(--badge-amber-bg)',
                  color: on ? '#fff' : 'var(--badge-amber-fg)',
                }}>{foraDoIntervalo}</span>
              )}
            </button>
          )
        })}
      </div>

      {carregando || !jaCarregou ? (
        <div style={{ padding: 'var(--space-12) 0', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
      ) : vista === 'tarefas' ? (
        <Tarefas
          lista={doDia} cor={cor} aMarcar={aMarcar} marcar={marcar}
          supabase={supabase} orgId={scope.orgId} euId={user?.id}
          podeEditar={scope.canEdit} atribuir={atribuir}
        />
      ) : (
        <Temperaturas estados={estados} cor={cor} medir={medir} podeEditar={scope.canEdit} />
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 'var(--space-12)', lineHeight: 1.6 }}>
        O plano de higienização e os registos de temperatura são o que a ASAE pede primeiro, antes
        sequer de olhar para o plano HACCP. Cada linha guarda a data, o produto e quem fez — que é o
        conteúdo que um registo de higienização tem de ter.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMPEZA E LAVANDARIA
// ─────────────────────────────────────────────────────────────────────────────

function Tarefas({ lista, cor, aMarcar, marcar, supabase, orgId, euId, podeEditar, atribuir }: {
  lista: TarefaDeHoje[]; cor: string
  aMarcar: Set<string>; marcar: (t: TarefaDeHoje) => void
  supabase: any; orgId: string | null; euId?: string | null; podeEditar: boolean
  atribuir: (t: TarefaDaCasa, id: string | null, nome: string | null) => void
}) {
  // Por assunto, que é como o trabalho se reparte: quem está na lavandaria não
  // quer a lista da cozinha pelo meio.
  const grupos = useMemo(() => {
    const m = new Map<CategoriaDaCasa, TarefaDeHoje[]>()
    for (const t of lista) {
      const c = t.tarefa.categoria
      const l = m.get(c)
      if (l) l.push(t); else m.set(c, [t])
    }
    return ORDEM_DAS_CATEGORIAS.filter(c => m.has(c)).map(c => ({ categoria: c, tarefas: m.get(c)! }))
  }, [lista])

  if (!lista.length) {
    return (
      <div style={{
        padding: 'var(--space-14)', borderRadius: 'var(--r-xl)',
        border: '1px dashed var(--border-2)', textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>
          Nada marcado para hoje
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
          O plano de higienização vem preenchido com o que uma casa faz de facto. Se está vazio,
          é porque as tarefas de hoje já foram todas desligadas do plano.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {grupos.map(g => {
        const cat = CATEGORIAS[g.categoria]
        const porFazer = g.tarefas.filter(t => !t.feito).length
        return (
          <section key={g.categoria}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 'var(--space-5)' }}>
              <span style={{ ...MONO, fontSize: 10, color: cat.cor }}>{cat.icone} {cat.label}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{
                fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
                color: porFazer ? cor : 'var(--badge-green-fg)',
              }}>{porFazer ? `${porFazer} por fazer` : 'tudo feito'}</span>
            </div>

            <div style={{
              borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
              background: 'var(--bg)', opacity: porFazer ? 1 : 0.7,
            }}>
              {g.tarefas.map((t, i) => (
                <div key={t.tarefa.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
                  padding: 'var(--space-6) var(--space-8)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--bg-3)',
                  borderLeft: `3px solid ${t.feito ? 'transparent' : cat.cor}`,
                }}>
                  <button
                    onClick={() => marcar(t)}
                    disabled={aMarcar.has(t.tarefa.id) || !podeEditar}
                    aria-label={t.feito ? `Desmarcar ${t.tarefa.nome}` : `Marcar ${t.tarefa.nome} como feito`}
                    style={{
                      width: 30, height: 30, flexShrink: 0, borderRadius: 9,
                      cursor: podeEditar ? 'pointer' : 'default',
                      border: `1.5px solid ${t.feito ? cor : 'var(--border-2)'}`,
                      background: t.feito ? cor : 'transparent',
                      color: '#fff', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: aMarcar.has(t.tarefa.id) ? 0.5 : 1,
                    }}>{t.feito ? '✓' : ''}</button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35,
                      textDecoration: t.feito ? 'line-through' : 'none',
                      textDecorationColor: 'var(--ink-5)',
                    }}>{t.tarefa.nome}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.4 }}>
                      {[
                        t.tarefa.zona,
                        t.tarefa.produto,
                        t.tarefa.hora,
                        // Quem fez. Aparece DEPOIS de feito, e é isto que
                        // transforma a lista num registo de higienização.
                        t.feito && t.feitoPor ? `feito por ${t.feitoPor}` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  {!t.feito && (
                    <Responsavel
                      supabase={supabase} orgId={orgId} euId={euId}
                      valorId={t.tarefa.responsavel_id} valorNome={t.tarefa.responsavel}
                      podeEditar={podeEditar}
                      aoEscolher={(id, nome) => atribuir(t.tarefa, id, nome)}
                      compacto
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPERATURAS
// ─────────────────────────────────────────────────────────────────────────────

function Temperaturas({ estados, cor, medir, podeEditar }: {
  estados: EstadoDoEquipamento[]; cor: string; podeEditar: boolean
  medir: (e: Equipamento, valor: number, acao: string) => Promise<boolean | undefined>
}) {
  if (!estados.length) {
    return (
      <div style={{
        padding: 'var(--space-14)', borderRadius: 'var(--r-xl)',
        border: '1px dashed var(--border-2)', textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>
          Sem equipamentos de frio
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
          Esta casa não tem equipamentos de frio registados.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      {estados.map(e => <Equip key={e.equipamento.id} e={e} cor={cor} medir={medir} podeEditar={podeEditar} />)}
    </div>
  )
}

function Equip({ e, cor, medir, podeEditar }: {
  e: EstadoDoEquipamento; cor: string; podeEditar: boolean
  medir: (eq: Equipamento, valor: number, acao: string) => Promise<boolean | undefined>
}) {
  const [valor, setValor] = useState('')
  const [acao, setAcao] = useState('')
  const [aGravar, setAGravar] = useState(false)

  const numero = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
  const valido = numero !== null && !Number.isNaN(numero)
  // Mostra-se o estado ANTES de gravar: quem está a escrever −12 numa arca que
  // devia estar a −18 vê logo que está mal, e não depois de submeter.
  const estadoPrevisto = valido ? estadoDaLeitura(numero, e.equipamento) : null
  const vaiFicarFora = estadoPrevisto === 'fora'

  const problema = e.foraDoIntervalo.length > 0

  async function gravar() {
    if (!valido || aGravar) return
    // Uma leitura fora do intervalo sem nada escrito é a pior linha que um
    // caderno pode ter: prova que se viu e não diz que se fez alguma coisa.
    if (vaiFicarFora && !acao.trim()) return
    setAGravar(true)
    const ok = await medir(e.equipamento, numero!, acao)
    setAGravar(false)
    if (ok) { setValor(''); setAcao('') }
  }

  return (
    <section style={{
      borderRadius: 'var(--r-xl)', background: 'var(--bg)',
      border: `1px solid ${problema ? 'var(--badge-amber-border)' : 'var(--border)'}`,
      overflow: 'hidden',
    }}>
      <header style={{
        padding: 'var(--space-7) var(--space-8)',
        borderBottom: '1px solid var(--border)',
        background: problema ? 'var(--badge-amber-bg)' : 'transparent',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>
            {e.equipamento.nome}
          </span>
          <div style={{ fontSize: 11.5, color: problema ? 'var(--badge-amber-fg)' : 'var(--ink-4)', marginTop: 3 }}>
            {[TIPOS_EQUIPAMENTO[e.equipamento.tipo], e.equipamento.zona, intervaloEmPalavras(e.equipamento)]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          color: problema ? 'var(--badge-amber-fg)'
            : e.emFalta ? cor : 'var(--badge-green-fg)',
        }}>
          {problema ? 'fora do intervalo'
            : e.emFalta ? `falta${e.emFalta > 1 ? 'm' : ''} ${e.emFalta}`
            : 'em dia'}
        </span>
      </header>

      {/* As de hoje */}
      {e.leiturasHoje.length > 0 && (
        <div style={{
          display: 'flex', gap: 7, flexWrap: 'wrap',
          padding: 'var(--space-6) var(--space-8)', borderBottom: '1px solid var(--bg-3)',
        }}>
          {e.leiturasHoje.map(l => {
            const fora = estadoDaLeitura(Number(l.valor), e.equipamento) === 'fora'
            return (
              <span key={l.id} title={[l.hora, l.medido_por, l.acao].filter(Boolean).join(' · ')}
                style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: 5,
                  padding: '5px 10px', borderRadius: 999,
                  background: fora ? 'var(--badge-amber-bg)' : 'var(--bg-2)',
                  border: `1px solid ${fora ? 'var(--badge-amber-border)' : 'var(--border)'}`,
                  color: fora ? 'var(--badge-amber-fg)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                }}>
                {Number(l.valor)} °C
                <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.75 }}>{l.hora}</span>
              </span>
            )
          })}
        </div>
      )}

      {podeEditar && (
        <div style={{ padding: 'var(--space-7) var(--space-8)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '0 1 140px', minWidth: 120 }}>
              <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 5 }}>Agora marca</span>
              <input
                value={valor} onChange={ev => setValor(ev.target.value)}
                inputMode="decimal" placeholder="−18"
                aria-label={`Temperatura de ${e.equipamento.nome}, em graus`}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 44,
                  borderRadius: 'var(--r-md)',
                  border: `1.5px solid ${vaiFicarFora ? 'var(--badge-amber-border)' : 'var(--border)'}`,
                  fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
                  background: 'var(--bg)', color: 'var(--ink)',
                }} />
            </label>

            {!vaiFicarFora && (
              <button onClick={gravar} disabled={!valido || aGravar} style={{
                minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)',
                border: 'none', background: valido ? cor : 'var(--bg-3)',
                color: valido ? '#fff' : 'var(--ink-5)',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: valido && !aGravar ? 'pointer' : 'default',
              }}>Registar</button>
            )}
          </div>

          {/* Fora do intervalo: pede-se o que foi feito, e só depois se grava.
              Não é burocracia — é a diferença entre um registo que mostra que a
              casa reagiu e um que mostra que a casa viu e deixou andar. */}
          {vaiFicarFora && (
            <div style={{
              marginTop: 10, padding: '11px 13px', borderRadius: 'var(--r-md)',
              background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--badge-amber-fg)', lineHeight: 1.5 }}>
                {numero} °C está fora de {intervaloEmPalavras(e.equipamento)}.
              </div>
              <input
                value={acao} onChange={ev => setAcao(ev.target.value)}
                placeholder="O que fez? Ex.: baixei o termóstato e avisei a manutenção"
                aria-label="O que foi feito"
                style={{
                  width: '100%', boxSizing: 'border-box', marginTop: 8,
                  padding: '10px 12px', minHeight: 42, borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--badge-amber-border)',
                  fontFamily: 'inherit', fontSize: 13.5,
                  background: 'var(--bg)', color: 'var(--ink)',
                }} />
              <button onClick={gravar} disabled={!acao.trim() || aGravar} style={{
                marginTop: 8, minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-sm)',
                border: 'none',
                background: acao.trim() ? 'var(--badge-amber-fg)' : 'var(--bg-3)',
                color: acao.trim() ? '#fff' : 'var(--ink-5)',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                cursor: acao.trim() && !aGravar ? 'pointer' : 'default',
              }}>Registar a leitura e o que fez</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
