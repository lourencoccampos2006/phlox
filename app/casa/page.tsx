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
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo, Bandeira,
  Botao, Seletor, Vazio, ACarregar, Aviso, Marca, CAIXA,
  MONO as MONO_MESA, ROTULO, useLargo,
} from '@/components/ui/mesa'
import {
  tarefasDeHoje, estadoDosEquipamentos, estadoDaLeitura, intervaloEmPalavras, resumoDaCasa,
  CATEGORIAS, ORDEM_DAS_CATEGORIAS, TIPOS_EQUIPAMENTO,
  type TarefaDaCasa, type TarefaDeHoje, type Equipamento, type Leitura,
  type EstadoDoEquipamento, type CategoriaDaCasa,
} from '@/lib/casa'


type Vista = 'tarefas' | 'temperaturas'

export default function ACasa() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cor = blueprintFor(institution).accent
  const hoje = ptDate()
  const turno = currentShiftFor(institution)

  const largo = useLargo()
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
      <Mesa>
        <Painel>
          <Vazio titulo="Os serviços da casa ainda não estão montados."
            oQueFazer="Falta um passo de configuração. Assim que estiver feito, esta página traz o plano de higienização e os registos de temperatura já preenchidos." />
        </Painel>
      </Mesa>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Esta página diz de si própria que tem DUAS METADES: o plano de higienização
     e os registos de temperatura — as duas coisas que a ASAE pede antes de
     sequer olhar para o plano HACCP.

     E estavam atrás de um separador, uma de cada vez. Num ecrã de computador
     cabem as duas, e são as duas o trabalho da mesma manhã: quem limpa a
     cozinha e quem lê a arca são muitas vezes a mesma pessoa.

     No telemóvel voltam a ser separadores, porque não há outra maneira.
     ══════════════════════════════════════════════════════════════════════════ */
  const foraDoIntervalo = estados.reduce((n, e) => n + e.foraDoIntervalo.length, 0)
  const porFazer = doDia.filter(t => !t.feito).length
  const aCarregar = carregando || !jaCarregou

  const painelTarefas = (
    <Painel
      cabeca={
        <Cabecalho>
          <span style={{ ...ROTULO, flex: 1 }}>Limpeza, cozinha e lavandaria</span>
          <span style={{
            ...MONO_MESA, fontSize: 'var(--t-meta)',
            color: porFazer ? 'var(--amber)' : 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>
            {aCarregar ? '' : porFazer ? `${porFazer} POR FAZER` : 'TUDO FEITO'}
          </span>
        </Cabecalho>
      }
      rodape={
        <span style={MONO_MESA}>
          Cada linha guarda a data, o produto e quem fez — é o que um registo
          de higienização tem de ter
        </span>
      }
    >
      {aCarregar ? (
        <ACarregar oQue="A ver o que há para fazer…" />
      ) : (
        <Tarefas
          lista={doDia} aMarcar={aMarcar} marcar={marcar}
          supabase={supabase} orgId={scope.orgId} euId={user?.id}
          podeEditar={scope.canEdit} atribuir={atribuir}
        />
      )}
    </Painel>
  )

  const painelTemperaturas = (
    <Painel
      cabeca={
        <Cabecalho>
          <span style={{ ...ROTULO, flex: 1 }}>Equipamentos de frio</span>
          <span style={{ ...ROTULO, width: 66, textAlign: 'right' }}>Última</span>
          <span style={{ ...ROTULO, width: 74 }}>Hoje</span>
        </Cabecalho>
      }
      rodape={
        foraDoIntervalo > 0 ? (
          <span style={{ ...MONO_MESA, color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
            {foraDoIntervalo} leitura{foraDoIntervalo === 1 ? '' : 's'} fora do intervalo hoje
          </span>
        ) : (
          <span style={MONO_MESA}>Uma leitura fora do intervalo pede sempre o que foi feito</span>
        )
      }
    >
      {aCarregar ? (
        <ACarregar oQue="A ler os equipamentos…" />
      ) : (
        <Temperaturas estados={estados} medir={medir} podeEditar={scope.canEdit} />
      )}
    </Painel>
  )

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO_MESA, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>A casa</span>

          <span style={{ ...MONO_MESA, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {hoje.slice(8, 10)}/{hoje.slice(5, 7)}
          </span>

          {/* No telemóvel as duas metades voltam a ser separadores. */}
          {!largo && (
            <Seletor
              opcoes={[
                { id: 'tarefas', rotulo: `Limpeza${porFazer ? ` ${porFazer}` : ''}` },
                { id: 'temperaturas', rotulo: `Frio${foraDoIntervalo ? ` ${foraDoIntervalo}` : ''}` },
              ]}
              ativa={vista} aoMudar={v => setVista(v as Vista)} />
          )}

          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {aCarregar ? 'A ver o que há para fazer…' : resumo}
          </span>

          {!aCarregar && foraDoIntervalo > 0 && (
            <span style={{
              ...MONO_MESA, fontSize: 'var(--t-meta)', color: 'var(--amber)',
              fontWeight: 'var(--peso-forte)' as any, marginLeft: 'auto',
            }}>
              {foraDoIntervalo} LEITURA{foraDoIntervalo === 1 ? '' : 'S'} FORA DO INTERVALO
            </span>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO_MESA, color: 'var(--amber)' }}>Fora do intervalo — pede o que se fez</span>
          <span style={{ ...MONO_MESA, color: 'var(--green)' }}>Em dia</span>
          <span style={{ ...MONO_MESA, color: 'var(--ink-5)' }}>
            O plano de higienização e os registos de temperatura são o que a ASAE pede
            primeiro, antes sequer de olhar para o plano HACCP.
          </span>
        </BarraDeEstado>
      }
    >
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      {largo ? (
        <div style={{
          display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'start',
          gridTemplateColumns: 'minmax(360px, 1fr) minmax(380px, 1fr)',
        }}>
          {painelTarefas}
          {painelTemperaturas}
        </div>
      ) : vista === 'tarefas' ? painelTarefas : painelTemperaturas}
    </Mesa>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMPEZA, COZINHA E LAVANDARIA
// ─────────────────────────────────────────────────────────────────────────────

function Tarefas({ lista, aMarcar, marcar, supabase, orgId, euId, podeEditar, atribuir }: {
  lista: TarefaDeHoje[]
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
      <Vazio titulo="Nada marcado para hoje."
        oQueFazer="O plano de higienização vem preenchido com o que uma casa faz de facto. Se está vazio, é porque as tarefas de hoje já foram todas desligadas do plano." />
    )
  }

  return (
    <>
      {grupos.map(g => {
        const cat = CATEGORIAS[g.categoria]
        const porFazer = g.tarefas.filter(t => !t.feito).length
        return (
          <div key={g.categoria}>
            {/* A linha de grupo. Fica colada ao topo ao rolar, para se saber
                sempre em que parte da casa se está. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', background: 'var(--bg-2)',
              borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              <span style={{ ...ROTULO, flex: 1 }}>{cat.label}</span>
              <span style={{
                ...MONO_MESA, fontSize: 'var(--t-micro)',
                color: porFazer ? 'var(--amber)' : 'var(--green)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>{porFazer ? `${porFazer} POR FAZER` : 'FEITO'}</span>
            </div>

            {g.tarefas.map(t => (
              <div key={t.tarefa.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', borderBottom: '1px solid var(--border)',
                borderLeft: `3px solid ${t.feito ? 'transparent' : 'var(--amber)'}`,
              }}>
                <Marca
                  feito={t.feito}
                  aGravar={aMarcar.has(t.tarefa.id)}
                  onClick={podeEditar ? () => marcar(t) : undefined}
                  oQue={t.feito ? `Desmarcar ${t.tarefa.nome}` : `Marcar ${t.tarefa.nome} como feito`} />

                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-corpo)',
                    fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                    textDecoration: t.feito ? 'line-through' : 'none',
                    textDecorationColor: 'var(--ink-5)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.tarefa.nome}</span>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {[
                      t.tarefa.zona,
                      t.tarefa.produto,
                      t.tarefa.hora,
                      // Quem fez. Aparece DEPOIS de feito, e é isto que
                      // transforma a lista num registo de higienização.
                      t.feito && t.feitoPor ? `feito por ${t.feitoPor}` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>

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
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPERATURAS
// ─────────────────────────────────────────────────────────────────────────────

function Temperaturas({ estados, medir, podeEditar }: {
  estados: EstadoDoEquipamento[]; podeEditar: boolean
  medir: (e: Equipamento, valor: number, acao: string) => Promise<boolean | undefined>
}) {
  const [aberto, setAberto] = useState<string | null>(null)

  if (!estados.length) {
    return (
      <Vazio titulo="Esta casa não tem equipamentos de frio registados."
        oQueFazer="Os registos de temperatura são um dos pré-requisitos que a ASAE pede. Assim que houver equipamentos, aparecem aqui com o intervalo de cada um." />
    )
  }

  return (
    <>
      {estados.map(e => (
        <Equip key={e.equipamento.id} e={e} medir={medir} podeEditar={podeEditar}
          aberto={aberto === e.equipamento.id}
          aoAbrir={() => setAberto(a => a === e.equipamento.id ? null : e.equipamento.id)} />
      ))}
    </>
  )
}

function Equip({ e, medir, podeEditar, aberto, aoAbrir }: {
  e: EstadoDoEquipamento; podeEditar: boolean
  medir: (eq: Equipamento, valor: number, acao: string) => Promise<boolean | undefined>
  aberto: boolean
  aoAbrir: () => void
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
  const ultima = e.leiturasHoje.length ? e.leiturasHoje[e.leiturasHoje.length - 1] : null

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
    <div style={{
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${problema ? 'var(--amber)' : aberto ? 'var(--green)' : 'transparent'}`,
      background: aberto ? 'var(--green-light)' : 'transparent',
    }}>
      <button type="button" onClick={aoAbrir} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        textAlign: 'left', padding: '7px 12px', border: 'none',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
      }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{e.equipamento.nome}</span>
          <span style={{
            display: 'block', fontSize: 'var(--t-meta)',
            color: problema ? 'var(--amber)' : 'var(--ink-4)', marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {[TIPOS_EQUIPAMENTO[e.equipamento.tipo], e.equipamento.zona, intervaloEmPalavras(e.equipamento)]
              .filter(Boolean).join(' · ')}
          </span>
        </span>

        <span style={{
          ...MONO_MESA, width: 66, textAlign: 'right', flexShrink: 0,
          fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
          color: ultima == null ? 'var(--ink-5)'
            : estadoDaLeitura(Number(ultima.valor), e.equipamento) === 'fora' ? 'var(--amber)' : 'var(--ink-2)',
        }}>{ultima != null ? `${Number(ultima.valor)}°` : '—'}</span>

        <span style={{ width: 74, flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/* As leituras de hoje, por ordem. Três números em mono dizem mais
              do que «em dia»: vê-se a arca a subir ao longo do dia. */}
          {e.leiturasHoje.length === 0 ? (
            <span style={{
              ...MONO_MESA, fontSize: 'var(--t-micro)',
              color: e.emFalta ? 'var(--amber)' : 'var(--ink-5)',
            }}>{e.emFalta ? `FALTA${e.emFalta > 1 ? 'M' : ''} ${e.emFalta}` : '—'}</span>
          ) : e.leiturasHoje.map(l => {
            const fora = estadoDaLeitura(Number(l.valor), e.equipamento) === 'fora'
            return (
              <span key={l.id} title={[l.hora, l.medido_por, l.acao].filter(Boolean).join(' · ')} style={{
                ...MONO_MESA, fontSize: 'var(--t-micro)',
                fontWeight: (fora ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                color: fora ? 'var(--amber)' : 'var(--ink-4)',
              }}>{Number(l.valor)}</span>
            )
          })}
        </span>
      </button>

      {aberto && podeEditar && (
        <div style={{ padding: '0 12px 10px 12px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '0 1 130px', minWidth: 110 }}>
              <span style={{ ...ROTULO, display: 'block', marginBottom: 3 }}>Agora marca</span>
              <input
                value={valor} onChange={ev => setValor(ev.target.value)}
                inputMode="decimal" placeholder="−18"
                aria-label={`Temperatura de ${e.equipamento.nome}, em graus`}
                style={{
                  ...CAIXA, width: '100%',
                  ...MONO_MESA, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                  border: `1px solid ${vaiFicarFora ? 'var(--amber)' : 'var(--border-2)'}`,
                }} />
            </label>
            {!vaiFicarFora && (
              <Botao feitio="principal" onClick={gravar} esperando={aGravar} disabled={!valido}>
                REGISTAR
              </Botao>
            )}
          </div>

          {/* Fora do intervalo: pede-se o que foi feito, e só depois se grava.
              Não é burocracia — é a diferença entre um registo que mostra que a
              casa reagiu e um que mostra que a casa viu e deixou andar. */}
          {vaiFicarFora && (
            <div style={{ marginTop: 9 }}>
              <Aviso tom="atencao" titulo={`${numero} °C está fora de ${intervaloEmPalavras(e.equipamento)}`}>
                <input
                  value={acao} onChange={ev => setAcao(ev.target.value)}
                  placeholder="O que fez? Ex.: baixei o termóstato e avisei a manutenção"
                  aria-label="O que foi feito"
                  style={{ ...CAIXA, width: '100%', marginTop: 6 }} />
                <div style={{ marginTop: 7 }}>
                  <Botao feitio="principal" onClick={gravar} esperando={aGravar} disabled={!acao.trim()}>
                    REGISTAR A LEITURA E O QUE FEZ
                  </Botao>
                </div>
              </Aviso>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
