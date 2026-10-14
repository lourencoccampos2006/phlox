'use client'
// app/calendario-do-ano/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O ano inteiro num ecrã.
//
// ── PORQUE É QUE NÃO É O /calendario QUE JÁ EXISTE ─────────────────────────
// O /calendario é pessoal: as consultas e os exames de uma pessoa, um mês de
// cada vez, preso ao `user_id`. Este é da casa, e o que faz não é mostrar um
// mês — é mostrar DOZE, porque a pergunta que se faz a um calendário de
// parede numa direção técnica é de longo alcance: quando é a Páscoa, em que
// semana cai o 25 de Abril, quantos aniversários há em março, que documentos
// caducam antes do verão.
//
// ── O QUE ELE NÃO FAZ ───────────────────────────────────────────────────────
// Não guarda cópias. As atividades, as visitas, as consultas, os prazos e as
// validades continuam a viver onde sempre viveram; isto lê-as. Copiá-las
// criava uma segunda verdade que se desencontrava da primeira em silêncio.
//
// Só o que não tinha sítio nenhum — a festa de Natal, a semana de obras, a
// visita da segurança social — é que fica guardado aqui (sprint166).
//
// ── «FEIO E INÚTIL» (Fernando, 2026-10-13) ─────────────────────────────────
// Tinha razão nas duas, e eram o mesmo problema visto de dois lados.
//
// INÚTIL: lia onze fontes e não escrevia em nenhuma. Via-se uma consulta num
// dia e não havia como marcar outra; via-se a ginástica de quarta e não havia
// como pôr a de quinta. A única coisa que se podia acrescentar era uma marca
// de texto livre com uma cor — ou seja, tudo o que importa era só de leitura.
// Agora o «Marcar» pergunta o que é e escreve na ferramenta de quem é dono do
// assunto (ver components/institution/MarcarNoCalendario), e diz para onde
// foi. Continua a não guardar cópias de nada.
//
// FEIO: doze meses de números de 10px com pontos de 3,5 px. Isso é a única
// coisa que CABE num ano inteiro — e é aí que estava o erro, porque a pergunta
// do dia a dia («o que há esta semana?») não é uma pergunta de um ano. Faltava
// a vista de um MÊS, onde o que está marcado se lê por palavras em vez de se
// adivinhar por uma cor. É agora a que abre; o ano continua a um toque, para
// a pergunta de longo alcance que o fez nascer.
//
// Num telemóvel sete colunas de texto não dão: a vista de mês passa a lista de
// dias, que é o que um telemóvel faz bem.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { ptDate } from '@/lib/ptTime'
import ClinicalGate from '@/components/ClinicalGate'
import { carregarAno } from '@/lib/carregarAno'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Botao, Seletor, Vazio,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import MarcarNoCalendario from '@/components/institution/MarcarNoCalendario'
import {
  MESES, DIAS_CURTOS, ORIGENS, grelhaDoMes, porDia, porExtenso,
  contarPorOrigem, corDe, corDaMarca, rotuloDe, ehBissexto, diasDoAno,
  type Marca, type Origem,
} from '@/lib/calendario'

const DIAS_LONGOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarioDoAnoPage() {
  const largo = useLargo()
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const hoje = useMemo(() => ptDate(), [])
  const [ano, setAno] = useState(() => +ptDate().slice(0, 4))
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [falharam, setFalharam] = useState<string[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [escondidas, setEscondidas] = useState<Origem[]>([])
  const [diaAberto, setDiaAberto] = useState<string | null>(null)
  /* O dia em que se vai marcar. Null = não está a marcar nada.
     É o DIA e não um booleano porque o «Marcar» pode vir da barra (e então é
     hoje, ou o dia 1 do mês que se está a ver) ou do painel de um dia (e então
     é esse). Um booleano obrigava a perguntar a data outra vez a quem já
     tocou no dia. */
  const [aMarcarEm, setAMarcarEm] = useState<string | null>(null)
  /* MÊS abre primeiro. O ano inteiro foi o pedido original e continua a um
     toque, mas a pergunta de todos os dias é «o que há esta semana». */
  const [vista, setVista] = useState<'mes' | 'ano'>('mes')
  const [mesVisto, setMesVisto] = useState(() => +ptDate().slice(5, 7) - 1)

  const podeVer = scope.pode('utentes', 'ver')
  const podeEditar = scope.pode('utentes', 'editar')

  const carregar = useCallback(async () => {
    if (!user) { setACarregar(false); return }
    setACarregar(true)
    try {
      const { marcas: m, falharam: f } = await carregarAno(supabase, scope.filter, ano)
      setMarcas(m); setFalharam(f)
    } catch (e) {
      toast.error('Não foi possível montar o ano',
        reportError('calendario-ano', e, 'Tenta recarregar a página.'))
    } finally { setACarregar(false) }
  }, [user, supabase, scope.filter, ano, toast])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(
    () => marcas.filter(m => !escondidas.includes(m.origem)),
    [marcas, escondidas],
  )
  const doDia = useMemo(() => porDia(visiveis), [visiveis])
  /* A LEGENDA CONTA O QUE SE ESTÁ A VER, E NÃO O ANO INTEIRO.
     Com a vista de mês, outubro mostrava uma linha e a legenda por baixo dizia
     «Atividades 11 · Visitas 3 · Feriados 14» — os números do ano. Quem lê um
     mês e vê onze atividades procura-as no ecrã e não as encontra.
     Conta-se sobre `marcas` e não sobre `visiveis` de propósito: esconder uma
     origem não lhe pode apagar o número, senão deixa de haver forma de a
     voltar a mostrar. */
  const contagem = useMemo(() => {
    if (vista === 'ano') return contarPorOrigem(marcas)
    const prefixo = `${ano}-${String(mesVisto + 1).padStart(2, '0')}-`
    return contarPorOrigem(marcas.filter(m => m.data.startsWith(prefixo)))
  }, [marcas, vista, ano, mesVisto])

  const abertas = diaAberto ? (doDia.get(diaAberto) || []) : []

  /* ── ANDAR DE MÊS A MÊS ATRAVESSA O ANO ──────────────────────────────────
     De dezembro, o «›» vai a janeiro do ano seguinte e não a janeiro outra
     vez. Sem isto, o fim do ano era uma parede: a única forma de ver janeiro
     era mudar de vista, mudar de ano e voltar. */
  const mudarMes = (d: number) => {
    const t = mesVisto + d
    if (t < 0) { setAno(a => a - 1); setMesVisto(11) }
    else if (t > 11) { setAno(a => a + 1); setMesVisto(0) }
    else setMesVisto(t)
  }

  const anoDeHoje = +hoje.slice(0, 4)
  const mesDeHoje = +hoje.slice(5, 7) - 1
  const estaEmHoje = vista === 'ano'
    ? ano === anoDeHoje
    : ano === anoDeHoje && mesVisto === mesDeHoje
  const irParaHoje = () => { setAno(anoDeHoje); setMesVisto(mesDeHoje) }

  /* O dia que o «Marcar» da barra propõe. Hoje, quando se está no mês de
     hoje; senão o dia 1 do mês que se está a ver — porque marcar uma coisa
     para hoje estando a olhar para março do ano que vem era quase sempre
     errado, e ninguém repara que a data ficou na de hoje. */
  const diaDeAbertura = estaEmHoje && vista === 'mes'
    ? hoje
    : `${ano}-${String(mesVisto + 1).padStart(2, '0')}-01`

  if (!user) return null
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate icone="calendar" accent="var(--green)"
      title="Calendário do ano"
      description="O ano inteiro num ecrã: aniversários, atividades, visitas, consultas, prazos e feriados, tudo marcado sozinho. Faz parte do plano Institucional." />
  }
  if (!podeVer) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
          A sua conta não tem acesso ao calendário da casa.
        </p>
      </div>
    )
  }

  /* A MOLDURA — refeita (2026-10-08).

     Tinha «Calendário do ano» a 25px/800 com um parágrafo por baixo, e a
     barra lateral já diz «Calendário do ano». O ano, as setas e o «Marcar»
     sobem para a barra de trabalho, onde ficam à vista ao rolar os doze
     meses — que era o problema: a meio do ano já não se via em que ano se
     estava nem como mudar.

     A legenda-filtro desce para a barra de estado. Continua a clicar-se:
     é a melhor ideia desta página e não se toca nela, só se muda de sítio. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <Seletor<'mes' | 'ano'>
            opcoes={[{ id: 'mes', rotulo: 'Mês' }, { id: 'ano', rotulo: 'Ano' }]}
            ativa={vista} aoMudar={setVista} />

          {/* O título do que se está a ver. Na vista de mês as setas andam de
              mês a mês e o ano fica por trás, pequeno: a meio de novembro o
              que importa saber é que é novembro. Na vista de ano, o ano é o
              que as setas mudam, e é ele que está em grande. */}
          {vista === 'mes' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Botao onClick={() => mudarMes(-1)} titulo="Mês anterior">‹</Botao>
              <span style={{
                ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
                color: 'var(--ink)', minWidth: 112, textAlign: 'center', textTransform: 'none',
                letterSpacing: 0,
              }}>
                {MESES[mesVisto]} <span style={{ color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>{ano}</span>
              </span>
              <Botao onClick={() => mudarMes(1)} titulo="Mês seguinte">›</Botao>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Botao onClick={() => setAno(a => a - 1)} titulo="Ano anterior">‹</Botao>
              <span style={{
                ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
                color: 'var(--ink)', minWidth: 54, textAlign: 'center',
              }}>{ano}</span>
              <Botao onClick={() => setAno(a => a + 1)} titulo="Ano seguinte">›</Botao>
            </span>
          )}

          {/* O pedido dele, dito no ecrã. Num ano bissexto vê-se porquê: o
              29 de fevereiro está lá, e nos outros anos não está.
              Só na vista de ano — numa vista de mês é ruído. */}
          {vista === 'ano' && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
              {ehBissexto(ano) ? `BISSEXTO · ${diasDoAno(ano)} DIAS` : `${diasDoAno(ano)} DIAS`}
            </span>
          )}

          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginLeft: largo ? 'auto' : undefined }}>
            {!estaEmHoje && <Botao onClick={irParaHoje}>HOJE</Botao>}
            {/* Se a tabela das marcas não respondeu, este botão abria um
                formulário que ia falhar a gravar no fim. Melhor não haver
                botão do que haver um que desiste depois de a pessoa escrever.
                As atividades, as consultas e as visitas não dependem dela —
                mas o escolhedor oferece as quatro, e oferecer uma que vai
                falhar é pior do que esperar um minuto. */}
            {podeEditar && !falharam.includes('Marcado à mão') && (
              <Botao feitio="principal" onClick={() => setAMarcarEm(diaDeAbertura)}>MARCAR</Botao>
            )}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          {/* A LEGENDA É O FILTRO. Clicar numa origem esconde-a do ano
              inteiro. Estava a meio da página, a 16px do topo do conteúdo;
              aqui está sempre no ecrã, que é o que uma legenda tem de ser. */}
          {ORIGENS.filter(o => contagem[o.id]).map(o => {
            const fora = escondidas.includes(o.id)
            return (
              <button key={o.id} aria-pressed={!fora}
                onClick={() => setEscondidas(e => fora ? e.filter(x => x !== o.id) : [...e, o.id])}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  ...MONO, fontSize: 'var(--t-meta)',
                  color: fora ? 'var(--border-2)' : 'var(--ink-3)',
                  textDecoration: fora ? 'line-through' : 'none',
                }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 'var(--r)', flexShrink: 0,
                  background: fora ? 'var(--border-2)' : o.cor,
                }} />
                {o.rotulo}
                <span style={{ color: 'var(--ink-5)' }}>{contagem[o.id]}</span>
              </button>
            )
          })}
        </BarraDeEstado>
      }
    >
      {/* Uma fonte que não respondeu tem de se ver. Um calendário a que falta
          silenciosamente as visitas parece completo e engana. */}
      {falharam.length > 0 && (
        <div style={{
          margin: '14px 0 0', padding: '11px 14px', borderRadius: 'var(--r-lg)',
          background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-bg)', fontSize: 'var(--t-meta)',
          color: 'var(--amber)', lineHeight: 1.6,
        }}>
          Não consegui ler {falharam.length === 1 ? 'uma fonte' : `${falharam.length} fontes`}:{' '}
          <strong>{falharam.join(', ').toLowerCase()}</strong>. O resto do ano está certo —
          só falta o que vinha daí.
        </div>
      )}

      {/* A legenda-filtro subiu para a barra de estado, onde está sempre no
          ecrã em vez de desaparecer ao rolar os doze meses. */}


      {aCarregar ? (
        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>A montar o ano…</p>
      ) : vista === 'mes' ? (
        /* Sete colunas de texto não cabem num telemóvel: ou a letra fica
           ilegível ou os títulos saem todos cortados na segunda palavra. Em
           ecrã estreito a mesma informação é uma LISTA dos dias que têm algo,
           que é mais útil do que uma grelha apertada — e é o que um telemóvel
           faz bem. */
        largo
          ? <GrelhaDoMes ano={ano} mes={mesVisto} hoje={hoje} doDia={doDia}
              onAbrir={setDiaAberto} onMarcar={podeEditar ? setAMarcarEm : undefined} />
          : <ListaDoMes ano={ano} mes={mesVisto} hoje={hoje} doDia={doDia} onAbrir={setDiaAberto} />
      ) : (
        <>
          <div className="ano-grelha">
            {MESES.map((nome, mes) => (
              <Mes key={mes} ano={ano} mes={mes} nome={nome} hoje={hoje}
                doDia={doDia} aberto={diaAberto} onAbrir={setDiaAberto}
                onVerMes={() => { setMesVisto(mes); setVista('mes') }} />
            ))}
          </div>

          {!marcas.length && (
            <p style={{ marginTop: 18, fontSize: 'var(--t-dado)', color: 'var(--ink-5)', lineHeight: 1.7 }}>
              Só os feriados, para já. Os aniversários aparecem sozinhos assim que as pessoas
              tiverem data de nascimento na ficha — que é o que a{' '}
              <Link href="/patients" style={{ color: 'var(--green)' }}>inscrição</Link> passou a
              perguntar.
            </p>
          )}
        </>
      )}

      {diaAberto && (
        <PainelDoDia data={diaAberto} marcas={abertas} onFechar={() => setDiaAberto(null)}
          person={cfg.personNoun.toLowerCase()}
          /* O botão de marcar neste dia. É aqui que ele importa mais: em
             toque não há `hover`, e o painel abre com um toque em qualquer
             sítio da casa do dia. */
          onMarcar={podeEditar && !falharam.includes('Marcado à mão')
            ? () => { const d = diaAberto; setDiaAberto(null); setAMarcarEm(d) }
            : undefined} />
      )}

      {aMarcarEm && (
        <MarcarNoCalendario data={aMarcarEm}
          onFechar={() => setAMarcarEm(null)}
          onGravado={onde => {
            setAMarcarEm(null)
            // A `invalidar` já foi feita lá dentro; aqui só se volta a ler.
            carregar()
            // Dizer PARA ONDE foi. Quem marca uma consulta a partir do
            // calendário tem de saber que a vai encontrar na Agenda.
            toast.success(`Marcado. Ficou em ${onde}.`)
          }} />
      )}

      <style>{`
        .ano-grelha { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 1000px) { .ano-grelha { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px)  { .ano-grelha { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 460px)  { .ano-grelha { grid-template-columns: 1fr; } }
      `}</style>
    </Mesa>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// UM MÊS, EM GRANDE — a vista que faltava
// ═══════════════════════════════════════════════════════════════════════════
//
// A grelha de doze meses mostra ONDE há coisas; esta mostra QUAIS. É a
// diferença entre um calendário de parede e uma agenda, e as duas perguntas
// são diferentes: «quando é a Páscoa» responde-se no ano, «o que há quarta»
// responde-se aqui.
//
// Três coisas por célula, e não mais. Com cinco, um dia cheio empurra a semana
// inteira para baixo e o mês deixa de caber num ecrã; com três, cabe, e o «+2»
// diz o que falta. Quem precisa de ver o resto toca no dia.
function GrelhaDoMes({ ano, mes, hoje, doDia, onAbrir, onMarcar }: {
  ano: number; mes: number; hoje: string
  doDia: Map<string, Marca[]>
  onAbrir: (d: string) => void
  /** Sem permissão de editar não há botão de marcar. */
  onMarcar?: (d: string) => void
}) {
  const semanas = grelhaDoMes(ano, mes)
  const [sobre, setSobre] = useState<string | null>(null)

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1,
        borderBottom: '1px solid var(--ink)', paddingBottom: 5, marginBottom: 1,
      }}>
        {DIAS_LONGOS.map((d, i) => (
          <div key={i} style={{ ...ROTULO, color: i >= 5 ? 'var(--ink-5)' : 'var(--ink-4)', paddingLeft: 3 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {semanas.flat().map((d, i) => {
          if (d === null) return <div key={i} style={{ background: 'var(--bg-2)', minHeight: 96 }} />
          const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const lista = doDia.get(iso) || []
          const eHoje = iso === hoje
          const fimDeSemana = i % 7 >= 5

          return (
            <div key={i} onMouseEnter={() => setSobre(iso)} onMouseLeave={() => setSobre(null)}
              style={{
                position: 'relative', minHeight: 96, padding: '4px 4px 5px',
                background: fimDeSemana ? 'var(--bg-2)' : 'var(--bg)',
                border: eHoje ? '1px solid var(--green)' : '1px solid var(--bg-2)',
                display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
              }}>
              {/* A casa inteira abre o dia. Um alvo de toque do tamanho da
                  célula — mas por BAIXO do conteúdo, para o botão de marcar
                  continuar a receber o seu próprio clique. */}
              <button type="button" onClick={() => onAbrir(iso)}
                aria-label={lista.length
                  ? `${porExtenso(iso)} — ${lista.length} ${lista.length === 1 ? 'coisa marcada' : 'coisas marcadas'}`
                  : `${porExtenso(iso)} — nada marcado`}
                style={{
                  position: 'absolute', inset: 0, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', lineHeight: 1,
                  fontWeight: (eHoje ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                  color: eHoje ? 'var(--green)' : fimDeSemana ? 'var(--ink-5)' : 'var(--ink-3)',
                  padding: '2px 3px', pointerEvents: 'none',
                }}>{d}</span>
                {/* O «+» aparece ao passar por cima de um dia, e não nas 31
                    casas ao mesmo tempo — 31 botões «+» é uma grelha de
                    botões, não um calendário. Em toque não há `hover`: lá,
                    marca-se pelo painel do dia, que abre com um toque em
                    qualquer sítio da casa. */}
                {onMarcar && sobre === iso && (
                  <button type="button" onClick={() => onMarcar(iso)}
                    title={`Marcar uma coisa para ${porExtenso(iso)}`}
                    style={{
                      marginLeft: 'auto', width: 20, height: 20, lineHeight: 1, padding: 0,
                      borderRadius: 'var(--r-sm)', border: '1px solid var(--border-2)',
                      background: 'var(--bg)', color: 'var(--ink-3)', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)',
                    }}>+</button>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                position: 'relative', pointerEvents: 'none',
              }}>
                {lista.slice(0, 3).map(m => (
                  <div key={m.id} style={{
                    display: 'flex', gap: 4, alignItems: 'baseline',
                    borderLeft: `2px solid ${corDaMarca(m)}`, paddingLeft: 4,
                  }}>
                    {m.hora && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)',
                        color: 'var(--ink-4)', flexShrink: 0, lineHeight: 1.35,
                      }}>{m.hora}</span>
                    )}
                    <span style={{
                      fontSize: 'var(--t-meta)', color: 'var(--ink-2)', lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{m.titulo}</span>
                  </div>
                ))}
                {lista.length > 3 && (
                  <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', paddingLeft: 6 }}>
                    +{lista.length - 3}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O MESMO MÊS, EM LISTA — para ecrãs estreitos
// ═══════════════════════════════════════════════════════════════════════════
//
// Só os dias que têm algo. Um mês de 31 linhas vazias num telemóvel são 31
// ecrãs de nada a rolar antes de chegar à primeira coisa que importa.
function ListaDoMes({ ano, mes, hoje, doDia, onAbrir }: {
  ano: number; mes: number; hoje: string
  doDia: Map<string, Marca[]>
  onAbrir: (d: string) => void
}) {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}-`
  const dias = [...doDia.keys()].filter(d => d.startsWith(prefixo)).sort()

  if (!dias.length) {
    return (
      <div style={{ marginTop: 14 }}>
        <Vazio titulo={`Nada marcado em ${MESES[mes].toLowerCase()}`}
          oQueFazer="Os aniversários, as atividades e as consultas aparecem aqui sozinhos. Para marcar uma coisa, usa o «Marcar» em cima." />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {dias.map(d => {
        const lista = doDia.get(d) || []
        const eHoje = d === hoje
        const n = +d.slice(8)
        // getDay(): 0=domingo. Queremos 0=segunda, como a grelha.
        const nomeDia = DIAS_LONGOS[(new Date(ano, mes, n).getDay() + 6) % 7]
        return (
          <button key={d} type="button" onClick={() => onAbrir(d)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              background: eHoje ? 'var(--bg-2)' : 'var(--bg)', fontFamily: 'inherit',
              border: 'none', borderBottom: '1px solid var(--bg-2)',
              borderLeft: eHoje ? '2px solid var(--green)' : '2px solid transparent',
              padding: '9px 10px',
            }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-destaque)', lineHeight: 1,
                fontWeight: 'var(--peso-forte)' as any, color: eHoje ? 'var(--green)' : 'var(--ink)',
              }}>{n}</span>
              <span style={{ ...ROTULO, color: 'var(--ink-4)' }}>{nomeDia}{eHoje ? ' · hoje' : ''}</span>
              <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginLeft: 'auto' }}>
                {lista.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {lista.map(m => (
                <div key={m.id} style={{
                  display: 'flex', gap: 6, alignItems: 'baseline',
                  borderLeft: `2px solid ${corDaMarca(m)}`, paddingLeft: 6,
                }}>
                  {m.hora && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)',
                      color: 'var(--ink-4)', flexShrink: 0,
                    }}>{m.hora}</span>
                  )}
                  <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.4 }}>{m.titulo}</span>
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Um mês, pequeno — uma das doze casas da vista de ano
// ═══════════════════════════════════════════════════════════════════════════
function Mes({ ano, mes, nome, hoje, doDia, aberto, onAbrir, onVerMes }: {
  ano: number; mes: number; nome: string; hoje: string
  doDia: Map<string, Marca[]>; aberto: string | null; onAbrir: (d: string) => void
  /** O nome do mês leva à vista de mês, que é onde se lê o que está marcado. */
  onVerMes: () => void
}) {
  const semanas = grelhaDoMes(ano, mes)
  // `reduce<number>` porque o array é de `number | null` e sem isto o
  // acumulador herda o `null` do elemento.
  const quantas = semanas.flat().reduce<number>((n, d) => {
    if (d === null) return n
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return n + (doDia.get(iso)?.length || 0)
  }, 0)

  return (
    <section style={{ border: '1px solid var(--bg-2)', borderRadius: 'var(--r-xl)', padding: '11px 10px 9px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8, padding: '0 3px' }}>
        {/* Era um `<h2>` morto. Vinte e oito pontos numa casa de março não
            dizem o que lá está — e a única forma de o saber era tocar dia a
            dia. O nome do mês é o atalho óbvio para a vista onde se lê. */}
        <h2 style={{ flex: 1, margin: 0 }}>
          <button type="button" onClick={onVerMes} title={`Ver ${nome} em grande`}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--t-dado)',
              fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
            }}>{nome}</button>
        </h2>
        {quantas > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', lineHeight: 1.1, color: 'var(--border-2)' }}>
            {quantas}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DIAS_CURTOS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, lineHeight: 1.1,
            color: i >= 5 ? 'var(--border-2)' : 'var(--ink-5)', paddingBottom: 4,
          }}>{d}</div>
        ))}

        {semanas.flat().map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const doDiaEste = doDia.get(iso) || []
          const eHoje = iso === hoje
          const estaAberto = iso === aberto
          const fimDeSemana = i % 7 >= 5
          // Até três pontos. Com mais, a casa fica preta e deixa de dizer nada.
          const cores = [...new Set(doDiaEste.map(corDaMarca))].slice(0, 3)

          return (
            <button key={i} onClick={() => onAbrir(iso)}
              title={doDiaEste.length ? doDiaEste.map(m => m.titulo).join(' · ') : undefined}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                border: estaAberto ? '1.5px solid var(--ink)' : eHoje ? '1.5px solid var(--green)' : '1.5px solid transparent',
                borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                /* O DIA QUE TEM ALGO TEM FUNDO. Antes, a única diferença entre
                   um dia cheio e um dia vazio eram três pontos de 3,5px — que
                   a 38px de casa não se vêem de pé, e muito menos num ano
                   inteiro. Com o fundo, as semanas cheias saltam à vista antes
                   de se ler número nenhum, que é a única coisa que uma vista
                   de ano consegue fazer bem. */
                background: estaAberto ? 'var(--bg-3)' : doDiaEste.length ? 'var(--bg-2)' : 'transparent',
              }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', lineHeight: 1,
                fontWeight: eHoje ? 700 : 500,
                color: eHoje ? 'var(--green)' : fimDeSemana ? 'var(--border-2)' : 'var(--ink-3)',
              }}>{d}</span>
              {/* 3,5px era menos de um pixel de tinta em muitos ecrãs. A 5px
                  a cor lê-se, e três cabem na casa sem se tocarem. */}
              <span style={{ display: 'flex', gap: 2, height: 5, alignItems: 'center' }}>
                {cores.map((c, j) => (
                  <span key={j} style={{ width: 5, height: 5, borderRadius: 'var(--r)', background: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O que há num dia
// ═══════════════════════════════════════════════════════════════════════════
function PainelDoDia({ data, marcas, onFechar, person, onMarcar }: {
  data: string; marcas: Marca[]; onFechar: () => void; person: string
  /** Marcar uma coisa NESTE dia. Sem permissão de editar, não aparece. */
  onMarcar?: () => void
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
      background: 'white', borderTop: '1px solid var(--border)',
      boxShadow: '0 -8px 32px rgba(11,17,32,.1)', maxHeight: '58vh', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
            {porExtenso(data, true)}
          </h3>
          {/* O PEDIDO DELE, NO SÍTIO ONDE SE DÁ POR ELE. Este painel abria
              com um toque num dia e só servia para ler. Era aqui que faltava
              poder acrescentar — sobretudo num tablet, onde o «+» da grelha
              não existe porque não há `hover`. */}
          {onMarcar && <Botao feitio="principal" onClick={onMarcar}>MARCAR NESTE DIA</Botao>}
          <button onClick={onFechar} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)',
            color: 'var(--border-2)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {!marcas.length ? (
          <p style={{ margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>
            Nada marcado neste dia{onMarcar ? ' — ainda.' : '.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {marcas.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px',
                border: '1px solid var(--bg-2)', borderRadius: 'var(--r-lg)',
                borderLeft: `3px solid ${corDaMarca(m)}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    {m.hora && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', lineHeight: 1.1, color: 'var(--ink)', fontWeight: 'var(--peso-forte)' as any }}>
                        {m.hora}
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{m.titulo}</span>
                    <span style={{ fontSize: 'var(--t-meta)', color: corDe(m.origem) }}>{rotuloDe(m.origem)}</span>
                  </div>
                  {m.detalhe && (
                    <p style={{ margin: '3px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.5 }}>
                      {m.detalhe}
                    </p>
                  )}
                  {/* O 29 de fevereiro. Sem esta linha a pessoa parecia ter
                      nascido a 28, e ninguém saberia porquê. */}
                  {m.movida && (
                    <p style={{ margin: '3px 0 0', fontSize: 'var(--t-meta)', color: 'var(--amber)', lineHeight: 1.5 }}>
                      A data certa é {porExtenso(m.movida)} — este ano não tem esse dia,
                      por isso assinala-se hoje.
                    </p>
                  )}
                </div>
                {m.quemId && (
                  <Link href={`/patients/${m.quemId}`} style={{
                    fontSize: 'var(--t-meta)', color: 'var(--green)', textDecoration: 'none',
                    whiteSpace: 'nowrap', fontWeight: 'var(--peso-corpo)' as any,
                  }}>Ver {person} →</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
