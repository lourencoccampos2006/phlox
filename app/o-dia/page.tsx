'use client'

// app/o-dia/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O Dia — o trabalho de agora, de seis sítios, numa linha do tempo.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Para saber o que havia para fazer esta manhã era preciso abrir o /mar, o
// /activities, o /apoio-servicos, o /refeicoes e a ficha de cada pessoa. Cinco
// páginas, e nenhuma sabe da existência das outras.
//
// Na prática ninguém abre cinco páginas: abre uma, e o resto do dia acontece
// de memória — o que funciona até ao dia em que falta a pessoa que tem a
// memória.
//
// ── A RECLAMAÇÃO QUE DEU ESTA VERSÃO ───────────────────────────────────────
// «No /o-dia as coisas aparecem de forma estranha, não há horas, não há ordem,
// apenas tarefas, muda isso, é preciso haver horas para as coisas, medicação
// incluída.»
//
// Estava certo, e a causa não era a página: das seis fontes que a enchem, só
// as atividades sabiam a que horas eram. Tudo o resto sabia o TURNO — e um
// turno são sete horas. Dizer que a insulina é «de manhã» e o banho é «de
// manhã» é dizer que são a mesma coisa. A lista só podia sair um monte.
//
// O sprint170 dá hora à medicação, aos cuidados de rotina, às ações do plano e
// aos reforços. Esta página passa a ser um relógio.
//
// ── TRÊS VISTAS, PORQUE HÁ TRÊS PERGUNTAS ──────────────────────────────────
// Por HORA: «o que é para fazer a seguir». É a pergunta que se faz mais vezes
// num turno, e era a única que a página não sabia responder.
//
// Por PESSOA é como se faz uma ronda: vai-se ter com alguém e trata-se de tudo
// de uma vez. Por TAREFA é como se faz um turno: escolhe-se um trabalho e
// faz-se a toda a gente que precisa dele.
//
// ── NÃO HÁ AQUI UMA SEGUNDA VERDADE ────────────────────────────────────────
// Marcar aqui escreve nas mesmas tabelas de sempre. Quem marcar uma toma neste
// ecrã e abrir o /mar a seguir vê lá a marca, porque é a mesma linha.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor, type Shift } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate, ptHHMM } from '@/lib/ptTime'
import { useLiveData } from '@/lib/useLiveData'
import RegistarNaoPrestado from '@/components/institution/NaoPrestado'
import Responsavel from '@/components/institution/Responsavel'
import { rotuloMotivo } from '@/lib/naoPrestado'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  porPessoa, porTarefa, porHora, resumo, minutosDe,
  ROTULO_DA_FONTE, COR_DA_FONTE, type Tarefa, type Grupo,
} from '@/lib/oDia'
import { carregarODia, progressoDoDia } from '@/lib/carregarODia'
import { resumoDeQuemEstaFora, type AusenciaDoUtente } from '@/lib/ausenciasDoUtente'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}
const ROTULO_TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

type Vista = 'hora' | 'pessoa' | 'tarefa'

/** Em que tabela se escreve o responsável desta tarefa, e em que linha. */
const ONDE_ATRIBUIR: Partial<Record<Tarefa['fonte'], { tabela: string; campo: string }>> = {
  servico:   { tabela: 'servicos_do_utente', campo: 'servico_utente_id' },
  plano:     { tabela: 'plano_acoes',        campo: 'acao_id' },
  apoio:     { tabela: 'support_services',   campo: 'servico_id' },
  atividade: { tabela: 'activities',         campo: 'activity_id' },
  // A medicação e os reforços ficam de fora de propósito: uma dose não é de
  // ninguém em particular — é de quem estiver de turno. Pôr-lhe um dono era
  // convidar toda a gente a passar-lhe ao lado por não ser sua.
}

export default function ODia() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const cor = bp.accent
  const hoje = ptDate()

  const [vista, setVista] = useState<Vista>('hora')
  const [turno, setTurno] = useState<Shift>(currentShiftFor(institution))
  const [turnoTocado, setTurnoTocado] = useState(false)
  const [soMeu, setSoMeu] = useState(false)
  // O useClinicPrefs arranca em 'nursing_home' e só lê o tipo real depois do
  // primeiro render — sem isto, um centro de dia abria no turno da noite.
  useEffect(() => { if (!turnoTocado) setTurno(currentShiftFor(institution)) }, [institution, turnoTocado])

  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  // Quem está fora hoje. As tarefas destas pessoas já não estão na lista — e
  // isso TEM de ser dito, senão quem conhece a casa conta as pessoas, dá menos
  // uma, e fica sem saber se o Phlox se enganou.
  const [fora, setFora] = useState<AusenciaDoUtente[]>([])
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [indisponivel, setIndisponivel] = useState(false)
  const [aMarcar, setAMarcar] = useState<Set<string>>(new Set())
  const [aExplicar, setAExplicar] = useState<Tarefa | null>(null)

  // ── O relógio ─────────────────────────────────────────────────────────────
  // A linha de «agora» tem de andar, senão ao fim de meia hora está a apontar
  // para o sítio errado — e uma linha que aponta para o sítio errado é pior do
  // que não haver linha nenhuma.
  //
  // Anda de minuto a minuto e só com o separador à vista. Não custa uma
  // chamada: é o relógio do telemóvel, não a base de dados.
  const [agora, setAgora] = useState(() => ptHHMM())
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setAgora(ptHHMM()) }, 60000)
    const aoVoltar = () => { if (!document.hidden) setAgora(ptHHMM()) }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [])

  // ── Carregar ──────────────────────────────────────────────────────────────
  // Qual e a montagem do dia que vale. Sem isto, tres ficavam em voo ao mesmo
  // tempo e ganhava a ultima a RESOLVER — que nao e a ultima a partir.
  const ultimoPedido = useRef(0)

  const carregar = useCallback(async () => {
    // Esperar que as permissoes cheguem. Enquanto nao chegam, `scope.ve()`
    // devolve falso para TUDO — e o filtro la em baixo deitava as dez tarefas
    // fora e gravava a lista vazia. Era isto que fazia o ecra dizer «Nada
    // marcado para tarde» com catorze doses por dar.
    //
    // ESTA LINHA VEM ANTES da de baixo, e nao depois. Ao contrario, o primeiro
    // render — em que `scope.orgId` ainda e nulo — fazia `setCarregando(false)`
    // com a lista vazia, e o ecra mostrava «Nada marcado para tarde» durante um
    // instante antes de as dez tarefas aparecerem. Um relampago a dizer que nao
    // ha nada para fazer e exatamente o tipo de coisa que faz alguem fechar a
    // pagina — e foi tambem o que fez a QA contar zero tarefas duas vezes.
    //
    // Quem nao tem casa nenhuma nao fica preso aqui: sem `orgId`, `pronto` e
    // verdadeiro, e a linha de baixo trata do caso.
    if (!scope.pronto) return
    if (!user || !scope.orgId) { setCarregando(false); return }
    const pedido = ++ultimoPedido.current
    setCarregando(true)

    // A montagem do dia vive em lib/carregarODia e NAO aqui: o /inicio mostra
    // a mesma percentagem, e duas montagens do mesmo dia acabavam sempre por
    // discordar. Quando discordassem, ninguem confiava em nenhuma das duas.
    const { tarefas: lista, falharam, fora: quemEstaFora } = await carregarODia(supabase, scope.orgId, turno)

    // A resposta que chega atrasada nao pode mandar. Tres montagens do dia
    // ficaram em voo ao mesmo tempo, e a que GANHAVA era a ultima a resolver
    // — nao a ultima a partir. Este numero diz qual e a que vale.
    if (pedido !== ultimoPedido.current) return

    if (falharam.includes('utentes')) {
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)
    // Uma lista mais curta por causa de uma falha nao pode passar por um dia
    // mais leve. Diz-se qual a fonte que nao respondeu.
    setErro(falharam.length
      ? `Nao consegui ler: ${falharam.join(', ')}. O que esta em baixo pode estar incompleto.`
      : '')

    // Quem nao ve a area nao recebe a tarefa. A RLS ja nao devolveria as
    // linhas, mas as atividades sao montadas a partir da lista de pessoas — e
    // essa vem sempre.
    //
    // `scope.pronto` la em cima garante que as permissoes ja chegaram: sem
    // isso, `ve()` devolvia falso para tudo e as dez tarefas eram filtradas
    // ate zero.
    setTarefas(lista.filter(t => scope.ve(t.area)))
    setFora(quemEstaFora)
    // Os nomes de quem está fora saem das PRÓPRIAS tarefas sempre que
    // possível. Quando alguém está fora há tanto tempo que já não tem tarefa
    // nenhuma, fica sem nome aqui — e aí o aviso diz «2 pessoas estão fora»
    // sem os nomear, que é melhor do que uma consulta a mais em cada carga.
    setNomes(new Map(lista.map(t => [t.patientId, t.nome])))
    setCarregando(false)
  }, [user, supabase, scope, hoje, turno])

  useEffect(() => { carregar() }, [carregar])

  useLiveData({
    supabase, userId: user?.id,
    table: ['mar_records', 'activity_participations', 'support_services',
            'dietary_reinforcements', 'plano_execucoes', 'servicos_execucoes',
            'cuidados_nao_prestados'],
    filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue,
    onChange: carregar,
  })

  // ── Marcar ────────────────────────────────────────────────────────────────
  async function marcar(t: Tarefa) {
    if (!user || aMarcar.has(t.chave)) return
    setAMarcar(p => new Set(p).add(t.chave))

    // O ecrã responde já. Quem toca num botão numa manhã cheia não espera meio
    // segundo a olhar para ele — toca outra vez, e ficam duas marcas.
    const antes = tarefas
    setTarefas(p => p.map(x => x.chave === t.chave ? { ...x, feito: !x.feito } : x))

    const falhou = await escrever(t, !t.feito)

    setAMarcar(p => { const n = new Set(p); n.delete(t.chave); return n })
    if (falhou) {
      // Devolve-se o ecrã ao que estava. Uma marca que parece feita e não está
      // é a pior das duas hipóteses: quem a pôs vai-se embora descansado.
      setTarefas(antes)
      setErro(falhou)
    } else setErro('')
  }

  // ── Atribuir ──────────────────────────────────────────────────────────────
  /**
   * Quem fica com isto.
   *
   * Escreve na linha de ORIGEM — no cuidado de rotina, na ação do plano, no
   * pedido de apoio — e não numa tabela de atribuições à parte. É a mesma
   * regra do resto da página: quem abrir o /apoio-servicos a seguir vê lá o
   * responsável, porque é a mesma linha.
   *
   * O aviso pessoal ao responsável não se escreve aqui. Sai sozinho, calculado
   * a partir desta coluna (lib/avisos.ts) — ver lá a nota sobre porque é que
   * um aviso calculado é melhor do que um aviso gravado.
   */
  async function atribuir(t: Tarefa, id: string | null, nome: string | null) {
    const onde = ONDE_ATRIBUIR[t.fonte]
    if (!onde || !user) return

    const antes = tarefas
    setTarefas(p => p.map(x =>
      x.chave === t.chave ? { ...x, responsavelId: id, responsavel: nome } : x))

    const { error } = await supabase.from(onde.tabela)
      .update({ responsavel_id: id, responsavel: nome })
      .eq('id', t.ref[onde.campo])

    if (error) {
      setTarefas(antes)
      setErro(reportError('o-dia-atribuir', error,
        isSetupError(error) ? MSG.unavailable : MSG.save))
    } else setErro('')
  }

  /** Escreve na tabela que é dona desta coisa. Devolve a mensagem de erro, ou ''. */
  async function escrever(t: Tarefa, feito: boolean): Promise<string> {
    const quem = (user as any)?.name || user?.email || ''

    if (t.fonte === 'plano') {
      if (!feito) {
        const { error } = await supabase.from('plano_execucoes')
          .delete().eq('acao_id', t.ref.acao_id).eq('data', hoje)
        return error ? reportError('o-dia-plano-desmarcar', error, MSG.save) : ''
      }
      const { error } = await supabase.from('plano_execucoes').insert(scope.stamp({
        user_id: user.id, acao_id: t.ref.acao_id, patient_id: t.patientId,
        data: hoje, turno: t.ref.turno || null, feito_por: quem,
      }))
      // Dois toques ao mesmo tempo dão violação de chave única — e isso quer
      // dizer que já ficou marcado, que é o resultado que se queria.
      if (error && !/duplicate key/i.test(error.message)) {
        return reportError('o-dia-plano', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'servico') {
      if (!feito) {
        const { error } = await supabase.from('servicos_execucoes')
          .delete().eq('servico_utente_id', t.ref.servico_utente_id).eq('data', hoje)
        return error ? reportError('o-dia-servico-desmarcar', error, MSG.save) : ''
      }
      const { error } = await supabase.from('servicos_execucoes').insert(scope.stamp({
        user_id: user.id, servico_utente_id: t.ref.servico_utente_id,
        patient_id: t.patientId, data: hoje, turno: t.ref.turno || null, feito_por: quem,
      }))
      // Dois toques ao mesmo tempo dão violação de chave única — e isso quer
      // dizer que já ficou marcado, que é o resultado que se queria.
      if (error && !/duplicate key/i.test(error.message)) {
        return reportError('o-dia-servico', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'medicacao') {
      if (!feito) {
        const { error } = await supabase.from('mar_records').delete()
          .eq('patient_id', t.patientId).eq('med_id', t.ref.med_id)
          .eq('date', hoje).eq('shift', t.ref.turno)
        return error ? reportError('o-dia-mar-desmarcar', error, MSG.save) : ''
      }
      const { error } = await supabase.from('mar_records').insert(scope.stamp({
        user_id: user.id, patient_id: t.patientId, med_id: t.ref.med_id,
        date: hoje, shift: t.ref.turno, status: 'administered',
        recorded_by: quem, recorded_at: new Date().toISOString(),
      }))
      if (error && !/duplicate key/i.test(error.message)) {
        return reportError('o-dia-mar', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'atividade') {
      const { error } = await supabase.from('activity_participations').upsert(scope.stamp({
        user_id: user.id, activity_id: t.ref.activity_id, patient_id: t.patientId,
        attended: feito, motivo: feito ? null : undefined,
      }), { onConflict: 'activity_id,patient_id' })
      if (error) {
        // 42P10 = «não há restrição única que case com o ON CONFLICT». Acontece
        // enquanto o índice do sprint158 não existir, e para quem está a usar a
        // aplicação é exatamente o mesmo que «ainda não está disponível».
        const porMontar = isSetupError(error) || String((error as any).code) === '42P10'
        return reportError('o-dia-atividade', error, porMontar ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'apoio') {
      const { error } = await supabase.from('support_services').update({
        status: feito ? 'concluido' : 'pedido',
        completed_by_id: feito ? user.id : null,
        completed_at: feito ? new Date().toISOString() : null,
      }).eq('id', t.ref.servico_id)
      if (error) {
        return reportError('o-dia-apoio', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'reforco') {
      const { error } = await supabase.from('dietary_reinforcements')
        .update({ given: feito }).eq('id', t.ref.reforco_id)
      if (error) {
        return reportError('o-dia-reforco', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    return ''
  }

  // ── O que se mostra ───────────────────────────────────────────────────────
  // O filtro «só o que é meu» corre ANTES do agrupamento, para os contadores
  // de cada grupo contarem o que está lá e não o que estaria sem o filtro.
  const visiveis = useMemo(
    () => (soMeu ? tarefas.filter(t => t.responsavelId === user?.id) : tarefas),
    [tarefas, soMeu, user?.id])

  const grupos: Grupo[] = useMemo(() => (
    vista === 'hora' ? porHora(visiveis)
      : vista === 'pessoa' ? porPessoa(visiveis)
      : porTarefa(visiveis)
  ), [vista, visiveis])

  const linhaResumo = useMemo(() => resumo(visiveis), [visiveis])
  const linhaDeQuemEstaFora = useMemo(
    () => resumoDeQuemEstaFora(fora, nomes), [fora, nomes])
  // A MESMA conta que o /inicio mostra. Vem de lib/carregarODia, de proposito,
  // e sempre sobre o dia INTEIRO — a percentagem não pode mudar por alguém ter
  // ligado um filtro no seu telemóvel.
  const progresso = useMemo(() => progressoDoDia(tarefas), [tarefas])
  const turnos = shiftsFor(institution)
  const meuTotal = useMemo(
    () => tarefas.filter(t => t.responsavelId === user?.id && !t.feito && !t.naoPrestado).length,
    [tarefas, user?.id])
  // Vale a pena mostrar a linha do tempo? Se ninguém marcou horas em lado
  // nenhum, «por hora» é uma pilha só com outro nome — e mais vale dizê-lo.
  const comHora = useMemo(() => visiveis.filter(t => t.hora).length, [visiveis])

  if (indisponivel) {
    return (
      <div style={{ padding: 'var(--space-14)', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          Ainda não consigo montar o dia
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Não consegui ler a lista de {cfg.personNounPlural.toLowerCase()}. Volte a entrar e tente outra vez.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 880, margin: '0 auto' }}>

      {/* ── O cabeçalho ──────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 'var(--space-9)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...MONO, color: cor }}>O dia</span>
          <span style={{ ...MONO, fontSize: 10 }}>{dataPorExtenso()}</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 'var(--space-7)', flexWrap: 'wrap', marginTop: 'var(--space-4)',
        }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
              color: 'var(--ink)', letterSpacing: '-0.025em', margin: 0, lineHeight: 1.1,
            }}>{ROTULO_TURNO[turno] || 'Agora'}</h1>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 'var(--space-5) 0 0', lineHeight: 1.55 }}>
              {carregando ? 'A juntar o que há para fazer…' : linhaResumo}
            </p>
          </div>

          {/* O anel. É a mesma percentagem que aparece no /inicio — o número
              vem do mesmo sítio, e por isso não há forma de discordarem. Passou
              a anel porque a barra ocupava uma linha inteira só para dizer um
              número, e aqui ao lado do título diz o mesmo sem roubar altura. */}
          {progresso && <Anel pct={progresso.pct} cor={cor} />}
        </div>
      </header>

      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {/* Quem está fora. Por cima da lista e nunca escondido: as tarefas
          destas pessoas não estão em baixo, e isso tem de se ver. */}
      {!carregando && linhaDeQuemEstaFora && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5,
        }}>
          {linhaDeQuemEstaFora}{' '}
          <span style={{ color: 'var(--ink-5)' }}>
            O que fosse para lhes fazer não aparece em baixo.
          </span>
        </div>
      )}

      {/* ── Turno, vista, e o que é meu ──────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {turnos.map(s => {
            const on = turno === s
            return (
              <button key={s} onClick={() => { setTurnoTocado(true); setTurno(s) }} style={{
                minHeight: 40, padding: '0 15px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: `1.5px solid ${on ? cor : 'var(--border-2)'}`,
                background: on ? cor : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              }}>{ROTULO_TURNO[s] || s}</button>
            )
          })}
        </div>

        {/* «Só o que é meu» — a lista de quem está de turno, e não a da casa.
            Um auxiliar com quinze coisas suas numa página de setenta passa o
            turno a procurar as suas. Só aparece quando há alguma coisa
            atribuída: um botão que filtra para zero não ajuda ninguém. */}
        {meuTotal > 0 && (
          <button
            onClick={() => setSoMeu(v => !v)}
            aria-pressed={soMeu}
            style={{
              minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${soMeu ? 'var(--ink)' : 'var(--border-2)'}`,
              background: soMeu ? 'var(--ink)' : 'transparent',
              color: soMeu ? '#fff' : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
            Só o que é meu
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              padding: '2px 6px', borderRadius: 999,
              background: soMeu ? 'rgba(255,255,255,.22)' : 'var(--bg-3)',
              color: soMeu ? '#fff' : 'var(--ink-3)',
            }}>{meuTotal}</span>
          </button>
        )}
      </div>

      <div style={{
        display: 'flex', borderRadius: 'var(--r-md)', overflow: 'hidden',
        border: '1.5px solid var(--border-2)', width: 'fit-content',
        maxWidth: '100%', marginBottom: 'var(--space-9)',
      }}>
        {([['hora', 'Por hora'], ['pessoa', `Por ${cfg.personNoun.toLowerCase()}`], ['tarefa', 'Por tarefa']] as [Vista, string][]).map(([v, rot]) => {
          const on = vista === v
          return (
            <button key={v} onClick={() => setVista(v)} style={{
              minHeight: 40, padding: '0 14px', border: 'none', cursor: 'pointer',
              background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            }}>{rot}</button>
          )
        })}
      </div>

      {/* ── A lista ──────────────────────────────────────────────────────── */}
      {carregando ? (
        <div style={{ padding: 'var(--space-12) 0', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
      ) : grupos.length === 0 ? (
        soMeu ? (
          <Vazio titulo="Nada seu neste turno">
            Não há nada atribuído a si em {(ROTULO_TURNO[turno] || '').toLowerCase()}.
            Desligue «Só o que é meu» para ver o turno todo.
          </Vazio>
        ) : (
          <Vazio titulo={`Nada marcado para ${(ROTULO_TURNO[turno] || '').toLowerCase()}`}>
            O dia enche-se sozinho a partir da medicação, das atividades, dos cuidados de
            rotina, dos pedidos de apoio e das ações do plano de cada pessoa. Se está vazio,
            é porque ainda não há nada escrito em nenhum desses sítios para agora.
          </Vazio>
        )
      ) : (
        <>
          {/* Quando ninguém marcou horas, «por hora» é uma pilha com outro
              nome. Mais vale dizê-lo, e dizer onde se marca — senão a vista
              nova parece avariada e ninguém volta a abri-la. */}
          {vista === 'hora' && comHora === 0 && (
            <div style={{
              marginBottom: 'var(--space-7)', padding: '12px 14px',
              borderRadius: 'var(--r-md)', background: 'var(--bg-2)',
              border: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55,
            }}>
              Ainda não há horas marcadas. Numa toma em{' '}
              <Link href="/mar" style={{ color: cor, fontWeight: 700 }}>Medicação</Link>
              {' '}ou num cuidado de rotina na ficha da pessoa, marque a hora — e ele passa a
              aparecer aqui no sítio certo. O que não tiver hora continua a aparecer no turno.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {vista === 'hora'
              ? <LinhaDoTempo
                  grupos={grupos} agora={agora} cor={cor}
                  aMarcar={aMarcar} marcar={marcar} explicar={t => setAExplicar(t)}
                  supabase={supabase} orgId={scope.orgId} euId={user?.id}
                  podeEditar={scope.canEdit} atribuir={atribuir}
                />
              : grupos.map(g => (
                  <CartaoGrupo
                    key={g.chave} g={g} cor={cor} vista={vista}
                    aMarcar={aMarcar} marcar={marcar} explicar={t => setAExplicar(t)}
                    supabase={supabase} orgId={scope.orgId} euId={user?.id}
                    podeEditar={scope.canEdit} atribuir={atribuir}
                  />
                ))}
          </div>
        </>
      )}

      {/* Porque é que não foi feito. A mesma folha do registo do dia e das
          atividades — é o que permite perguntar depois «o que é que esta
          pessoa tem recusado» e receber uma resposta que atravessa as áreas. */}
      {aExplicar && (
        <RegistarNaoPrestado
          patientId={aExplicar.patientId}
          nome={aExplicar.nome}
          area={aExplicar.area}
          oQue={aExplicar.oQue}
          origem="o-dia"
          turno={aExplicar.turno}
          aoFechar={() => setAExplicar(null)}
          aoGravar={(_frase, motivo) => {
            const chave = aExplicar.chave
            setTarefas(p => p.map(x => x.chave === chave ? { ...x, naoPrestado: { motivo, nota: null } } : x))
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A LINHA DO TEMPO
// ─────────────────────────────────────────────────────────────────────────────

interface AcoesDeLinha {
  aMarcar: Set<string>
  marcar: (t: Tarefa) => void
  explicar: (t: Tarefa) => void
  supabase: any
  orgId: string | null
  euId?: string | null
  podeEditar: boolean
  atribuir: (t: Tarefa, id: string | null, nome: string | null) => void
}

/**
 * As horas do turno, por ordem, com «agora» no sítio.
 *
 * ── PORQUE É QUE A LINHA DE «AGORA» É UMA LINHA ────────────────────────────
 * A alternativa era pintar de vermelho o que já passou da hora e não está
 * feito. Não se faz, por duas razões.
 *
 * A primeira: num centro de dia, metade das coisas acontecem quando calha, e
 * cobrar horas a quem nunca prometeu horas é a forma mais rápida de a equipa
 * desligar a página (ver a nota do Fernando sobre centros de dia).
 *
 * A segunda é que não é preciso. Uma linha horizontal com a hora a meio diz
 * onde estamos, e o que está por cima dela e por fazer vê-se sem etiqueta
 * nenhuma. A posição já é a informação.
 */
function LinhaDoTempo({ grupos, agora, cor, ...acoes }: { grupos: Grupo[]; agora: string; cor: string } & AcoesDeLinha) {
  const minAgora = minutosDe(agora) ?? 0

  // Antes de que grupo é que a linha entra? O primeiro cuja hora ainda não
  // chegou. Se já passaram todas, entra depois do último COM hora — nunca
  // depois do «a qualquer hora», que não está em sítio nenhum do relógio.
  const comHora = grupos.filter(g => g.hora)
  let posicao = comHora.findIndex(g => (minutosDe(g.hora) ?? 0) > minAgora)
  if (posicao === -1) posicao = comHora.length
  // Só se desenha a linha quando há mesmo horas para a situar entre elas.
  const mostrarAgora = comHora.length > 0

  let jaDesenhada = false
  let indiceComHora = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {grupos.map(g => {
        const antes: React.ReactNode[] = []
        if (g.hora) {
          if (mostrarAgora && !jaDesenhada && indiceComHora === posicao) {
            antes.push(<MarcaDeAgora key="agora" agora={agora} cor={cor} />)
            jaDesenhada = true
          }
          indiceComHora++
        } else if (mostrarAgora && !jaDesenhada) {
          // O grupo «a qualquer hora» é o último. Se a linha ainda não saiu,
          // sai agora — antes dele, no fim do relógio.
          antes.push(<MarcaDeAgora key="agora" agora={agora} cor={cor} />)
          jaDesenhada = true
        }

        return (
          <div key={g.chave} style={{ display: 'contents' }}>
            {antes}
            <BlocoDeHora g={g} cor={cor} passou={!!g.hora && (minutosDe(g.hora) ?? 0) <= minAgora} {...acoes} />
          </div>
        )
      })}
      {mostrarAgora && !jaDesenhada && <MarcaDeAgora agora={agora} cor={cor} />}
    </div>
  )
}

function MarcaDeAgora({ agora, cor }: { agora: string; cor: string }) {
  return (
    <div aria-label={`Agora são ${agora}`} style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: 'var(--space-2) 0',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: cor, flexShrink: 0 }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
        letterSpacing: '.1em', color: cor, whiteSpace: 'nowrap',
      }}>AGORA · {agora}</span>
      <span style={{ flex: 1, height: 1, background: cor, opacity: 0.35 }} />
    </div>
  )
}

/** Uma hora do turno: o cabeçalho, e as coisas que lhe pertencem. */
function BlocoDeHora({ g, cor, passou, ...acoes }: { g: Grupo; cor: string; passou: boolean } & AcoesDeLinha) {
  const tudoFeito = g.porFazer === 0

  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 'var(--space-5)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: g.hora ? 17 : 12.5, fontWeight: 700,
          letterSpacing: g.hora ? '-0.01em' : '.1em',
          textTransform: g.hora ? 'none' : 'uppercase',
          // A hora que já passou com coisas por fazer fica mais escura, e mais
          // nada. Sem etiqueta, sem vermelho, sem a palavra «atraso»: a
          // posição na lista já diz tudo o que há a dizer.
          color: tudoFeito ? 'var(--ink-5)' : passou ? 'var(--ink)' : 'var(--ink-3)',
          whiteSpace: 'nowrap',
        }}>{g.titulo}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{
          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
          color: tudoFeito ? 'var(--badge-green-fg)' : cor,
        }}>{g.subtitulo}</span>
      </div>

      <div style={{
        borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
        background: 'var(--bg)', overflow: 'visible',
        opacity: tudoFeito ? 0.68 : 1,
      }}>
        {g.tarefas.map((t, i) => (
          <LinhaTarefa
            key={t.chave} t={t} cor={cor} vista="hora" primeira={i === 0}
            mostrarHora={false} {...acoes}
          />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AS OUTRAS DUAS VISTAS
// ─────────────────────────────────────────────────────────────────────────────

function CartaoGrupo({ g, cor, vista, ...acoes }: { g: Grupo; cor: string; vista: Vista } & AcoesDeLinha) {
  const tudoFeito = g.porFazer === 0

  return (
    <section style={{
      borderRadius: 'var(--r-xl)', border: '1px solid var(--border)',
      background: 'var(--bg)', opacity: tudoFeito ? 0.72 : 1,
    }}>
      <header style={{
        padding: 'var(--space-7) var(--space-8)',
        borderBottom: '1px solid var(--border)',
        background: tudoFeito ? 'var(--bg-2)' : 'transparent',
        borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.3,
        }}>{g.titulo}</span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: tudoFeito ? 'var(--badge-green-fg)' : cor,
        }}>{g.subtitulo}</span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {g.tarefas.map((t, i) => (
          <LinhaTarefa key={t.chave} t={t} cor={cor} vista={vista} primeira={i === 0} mostrarHora {...acoes} />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function LinhaTarefa({
  t, cor, vista, primeira, mostrarHora,
  aMarcar, marcar, explicar, supabase, orgId, euId, podeEditar, atribuir,
}: { t: Tarefa; cor: string; vista: Vista; primeira: boolean; mostrarHora: boolean } & AcoesDeLinha) {
  const tratada = t.feito || !!t.naoPrestado
  const ocupada = aMarcar.has(t.chave)

  // Na vista por hora o cabeçalho já diz as horas, e o que falta saber é o quê
  // e a quem. Por tarefa o título do grupo diz o quê. Por pessoa diz de quem.
  const principal = vista === 'tarefa' ? t.nome : t.oQue
  // A origem sai daqui e passa a ser desenhada a parte, com a cor dela.
  const partes = vista === 'tarefa' ? [t.detalhe]
    : vista === 'hora' ? [t.nome, t.detalhe]
    : [t.detalhe]
  // A hora só entra na segunda linha nas vistas em que não há cabeçalho de
  // hora nenhum. Repeti-la debaixo de «08:00» era dizer duas vezes o mesmo.
  if (mostrarHora && t.hora) partes.unshift(t.hora)
  const restante = partes.filter(Boolean).join(' · ')
  const secundario = `${ROTULO_DA_FONTE[t.fonte]} ${restante}`

  const podeAtribuir = !!ONDE_ATRIBUIR[t.fonte] && !tratada

  // A barra de cor da origem. Num turno de setenta linhas, e a unica coisa que
  // deixa ver onde estao as doses sem ler a segunda linha de cada uma.
  const corDaFonte = COR_DA_FONTE[t.fonte]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
      padding: 'var(--space-6) var(--space-8)',
      borderTop: primeira ? 'none' : '1px solid var(--bg-3)',
      borderLeft: `3px solid ${tratada ? 'transparent' : corDaFonte}`,
      background: t.naoPrestado ? 'var(--bg-2)' : 'transparent',
    }}>
      <button
        onClick={() => marcar(t)}
        disabled={ocupada || !!t.naoPrestado}
        aria-label={t.feito ? `Desmarcar ${t.oQue}` : `Marcar ${t.oQue} como feito`}
        style={{
          width: 30, height: 30, flexShrink: 0, borderRadius: 9, cursor: t.naoPrestado ? 'default' : 'pointer',
          border: `1.5px solid ${t.feito ? cor : 'var(--border-2)'}`,
          background: t.feito ? cor : 'transparent',
          color: '#fff', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: ocupada ? 0.5 : 1,
        }}>{t.feito ? '✓' : ''}</button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35,
          textDecoration: tratada ? 'line-through' : 'none',
          textDecorationColor: 'var(--ink-5)',
        }}>{principal}</div>
        {(secundario || t.naoPrestado) && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.4 }}>
            {t.naoPrestado ? rotuloMotivo(t.naoPrestado.motivo) : (
              // A origem leva a cor da barra. Sem isto a barra era decoracao:
              // assim ela diz o que quer dizer logo na primeira linha que se
              // ler, e a seguir ja nao e preciso ler mais nenhuma.
              <>
                <span style={{ color: corDaFonte, fontWeight: 700 }}>{ROTULO_DA_FONTE[t.fonte]}</span>
                {restante && <span> · {restante}</span>}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quem fica com isto. Só nas fontes que têm dono: uma dose é de quem
          estiver de turno, e pôr-lhe um nome era convidar os outros a
          passar-lhe ao lado. */}
      {podeAtribuir && (
        <Responsavel
          supabase={supabase} orgId={orgId} euId={euId}
          valorId={t.responsavelId} valorNome={t.responsavel}
          podeEditar={podeEditar}
          aoEscolher={(id, nome) => atribuir(t, id, nome)}
          compacto
        />
      )}

      {/* «Não foi feito» aparece só enquanto houver alguma coisa a explicar.
          Depois de marcado, a pergunta já não se põe. */}
      {!t.feito && !t.naoPrestado && (
        <button onClick={() => explicar(t)} style={{
          flexShrink: 0, minHeight: 32, padding: '0 10px', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
        }}>Não foi feito</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PEÇAS PEQUENAS
// ─────────────────────────────────────────────────────────────────────────────

/** A percentagem do dia, em anel. */
function Anel({ pct, cor }: { pct: number; cor: string }) {
  const r = 22
  const volta = 2 * Math.PI * r
  const feito = Math.min(100, Math.max(0, pct))
  const completo = feito >= 100

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: 54, height: 54 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
          <circle cx="27" cy="27" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="5" />
          <circle
            cx="27" cy="27" r={r} fill="none"
            stroke={completo ? 'var(--badge-green-fg)' : cor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={volta}
            strokeDashoffset={volta * (1 - feito / 100)}
            transform="rotate(-90 27 27)"
            style={{ transition: 'stroke-dashoffset .5s' }}
          />
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
          color: completo ? 'var(--badge-green-fg)' : 'var(--ink)',
        }}>{feito}%</span>
      </div>
      <span style={{ ...MONO, fontSize: 9.5, writingMode: 'horizontal-tb' }}>do dia</span>
    </div>
  )
}

function Vazio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 'var(--space-14)', borderRadius: 'var(--r-xl)',
      border: '1px dashed var(--border-2)', textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>
        {titulo}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
        {children}
      </p>
    </div>
  )
}

/** «terça, 30 de setembro» — a data de hoje, em hora de Portugal. */
function dataPorExtenso(): string {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Lisbon',
  }).format(new Date())
}
