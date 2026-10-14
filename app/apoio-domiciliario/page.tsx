'use client'

// app/apoio-domiciliario/page.tsx
// ═══════════════════════════════════════════════════════════════════════════
// APOIO DOMICILIÁRIO — a equipa é que vai lá
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO ───────────────────────────────────────────────────────────────
// «Quero uma parte para o serviço de apoio ao domicílio.» (Fernando)
//
// ── PORQUE É QUE NADA DO QUE JÁ EXISTE SERVIA ──────────────────────────────
// Toda a aplicação assume que a pessoa está cá dentro. O /o-dia marca a
// chegada; a /patients tem um número de quarto; a `attendance` é uma linha por
// dia a dizer que alguém entrou. O apoio domiciliário é o inverso: a pessoa
// está em casa dela e a equipa é que se desloca.
//
// Isso muda o que o ecrã tem de responder. Numa casa, a pergunta é «o que
// falta fazer a esta pessoa»; aqui é «a casa de quem é que ainda não fomos».
// São duas perguntas diferentes e por isso são duas páginas diferentes.
//
// ── O QUE ESTA PÁGINA TEM DE ACERTAR ───────────────────────────────────────
//  1. A ORDEM. Uma volta faz-se por horas, e a lista tem de estar na ordem por
//     que se anda. Uma lista alfabética obriga quem vai a reconstruir a ordem
//     de cabeça todas as manhãs.
//  2. COMO SE ENTRA. A chave da vizinha, a filha que abre às nove, o cão no
//     quintal. Quem vai pela primeira vez a uma casa precisa disto antes de
//     precisar de qualquer outra coisa — e por isso está na linha, não atrás
//     de um toque.
//  3. «NÃO ESTAVA NINGUÉM». Tem de se poder registar, porque é o que explica à
//     família porque não houve almoço e é o primeiro sinal de que se passou
//     algo. Sem este botão, a visita não se registava e o dia ficava igual a
//     um dia em que ninguém foi.
//
// ── O QUE ESTA PÁGINA NÃO FAZ ──────────────────────────────────────────────
// Não calcula o caminho entre as casas. O mapa e a rota já existem no
// /apoio-servicos, feitos e testados, e refazê-los aqui era ter dois mapas a
// discordar. Daqui aponta-se para lá.

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
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { registar, ACOES } from '@/lib/registo'
import {
  SERVICOS, DIAS, voltaDoDia, estadoDaParada, diasEmPalavras,
  rotuloDoServico, codigoDoServico, lerSAD, semTabelaSAD,
  type PlanoSAD, type ServicoDoPlano, type VisitaSAD, type ParadaDaVolta,
} from '@/lib/apoioDomiciliario'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Botao, Seletor,
  Vazio, Aviso, Folha, Campo, Codigo, CAIXA, CAIXA_TEXTO, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

type Vista = 'volta' | 'quem'

interface Pessoa { id: string; name: string; address?: string | null; telefone?: string | null }

export default function ApoioDomiciliarioPage() {
  const largo = useLargo()
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [vista, setVista] = useState<Vista>('volta')
  const [dia, setDia] = useState(() => ptDate())
  const [planos, setPlanos] = useState<PlanoSAD[]>([])
  const [servicos, setServicos] = useState<ServicoDoPlano[]>([])
  const [visitas, setVisitas] = useState<VisitaSAD[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [naoLeu, setNaoLeu] = useState(false)
  const [aEditarPlano, setAEditarPlano] = useState<{ plano: PlanoSAD | null; pid: string } | null>(null)
  const [aRegistar, setARegistar] = useState<ParadaDaVolta | null>(null)

  const podeVer = scope.pode('utentes', 'ver')
  const podeEditarPlano = scope.pode('utentes', 'editar')
  const podeRegistar = scope.pode('registos', 'editar')

  const carregar = useCallback(async () => {
    if (!user) { setACarregar(false); return }
    setACarregar(true); setNaoLeu(false)

    const [sad, pes] = await Promise.all([
      lerSAD(supabase, scope.filter, dia),
      scope.filter(supabase.from('patients')
        .select('id, name, address, telefone').eq('active', true).order('name')),
    ])

    if (sad.erro) {
      if (semTabelaSAD(sad.erro)) { setSemTabela(true); setACarregar(false); return }
      console.error('[phlox:apoio-domiciliario]', sad.erro)
      setNaoLeu(true); setACarregar(false)
      return
    }
    setSemTabela(false)
    setPlanos(sad.planos); setServicos(sad.servicos); setVisitas(sad.visitas)

    /* A lista de pessoas falhar não impede a volta de aparecer: o plano tem o
       `patient_id` e a parada mostra «Sem nome». Uma volta sem nomes é pouco,
       mas é muito mais do que uma página em branco a quem tem de sair agora. */
    if ((pes as any).error) console.error('[phlox:apoio-domiciliario:pessoas]', (pes as any).error)
    setPessoas(((pes as any).data || []) as Pessoa[])
    setACarregar(false)
  }, [user, supabase, scope.filter, dia])

  useEffect(() => { carregar() }, [carregar])

  const porId = useMemo(() => new Map(pessoas.map(p => [p.id, p])), [pessoas])
  const volta = useMemo(
    () => voltaDoDia(dia, planos, servicos, porId, visitas),
    [dia, planos, servicos, porId, visitas])

  const porFazer = volta.filter(p => estadoDaParada(p) === 'por-fazer').length
  const semResposta = volta.filter(p => estadoDaParada(p) === 'sem-resposta').length
  const ativos = planos.filter(p => p.ativo).length

  const servicosDe = useCallback(
    (planoId: string) => servicos.filter(s => s.plano_id === planoId),
    [servicos])

  if (!user) return null
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate icone="home" accent="var(--green)"
      title="Apoio domiciliário"
      description="A volta do dia, casa a casa: quem recebe apoio, que serviços, como se entra, e o registo de cada visita. Faz parte do plano Institucional." />
  }
  if (!podeVer) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
          A sua conta não tem acesso ao apoio domiciliário desta casa.
        </p>
      </div>
    )
  }

  const hoje = ptDate()
  const ontem = (d: string, n: number) => {
    const [a, m, x] = d.split('-').map(Number)
    const t = new Date(a, m - 1, x + n)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }

  return (
    <Mesa
      altura={vista === 'volta' ? 'janela' : 'documento'}
      barra={
        <BarraDeTrabalho>
          <Seletor<Vista>
            opcoes={[{ id: 'volta', rotulo: 'A volta' }, { id: 'quem', rotulo: 'Quem recebe' }]}
            ativa={vista} aoMudar={setVista} />

          {vista === 'volta' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Botao onClick={() => setDia(d => ontem(d, -1))} titulo="Dia anterior">‹</Botao>
              <span style={{
                ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink)', textTransform: 'none',
                letterSpacing: 0, minWidth: 96, textAlign: 'center',
              }}>
                {dia === hoje ? 'Hoje' : dia.split('-').reverse().join('/')}
              </span>
              <Botao onClick={() => setDia(d => ontem(d, 1))} titulo="Dia seguinte">›</Botao>
              {dia !== hoje && <Botao onClick={() => setDia(hoje)}>HOJE</Botao>}
            </span>
          )}

          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginLeft: largo ? 'auto' : undefined }}>
            {/* A rota e o mapa vivem no /apoio-servicos, feitos e testados.
                Daqui aponta-se para lá em vez de haver dois mapas. */}
            <Link href="/apoio-servicos" style={{ textDecoration: 'none' }}>
              <Botao titulo="O mapa e a ordem do caminho, nos transportes">VER NO MAPA</Botao>
            </Link>
            {podeEditarPlano && vista === 'quem' && (
              <Botao feitio="principal" onClick={() => setAEditarPlano({ plano: null, pid: '' })}>
                + QUEM RECEBE
              </Botao>
            )}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
            {ativos} {ativos === 1 ? 'PESSOA COM APOIO' : 'PESSOAS COM APOIO'}
          </span>
          {vista === 'volta' && (
            <>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                {volta.length} {volta.length === 1 ? 'CASA HOJE' : 'CASAS HOJE'}
              </span>
              {porFazer > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
                  {porFazer} POR IR
                </span>
              )}
              {semResposta > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)' }}>
                  {semResposta} SEM RESPOSTA
                </span>
              )}
            </>
          )}
        </BarraDeEstado>
      }
    >
      {semTabela ? (
        <div style={{ marginTop: 14 }}>
          <AvisoDeSetup codigo="PHX-A7"
            oQue="O apoio domiciliário ainda não está disponível nesta conta." />
        </div>
      ) : naoLeu ? (
        <div style={{ marginTop: 14 }}>
          <Aviso tom="atencao" titulo="Não foi possível ler o apoio domiciliário">
            Não é que não haja ninguém com apoio — é que não conseguimos ler.
            Tenta recarregar a página.
          </Aviso>
        </div>
      ) : aCarregar ? (
        <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)', marginTop: 14 }}>A montar a volta…</p>
      ) : vista === 'volta' ? (
        <AVolta volta={volta} dia={dia} hoje={hoje}
          podeRegistar={podeRegistar} onRegistar={setARegistar} />
      ) : (
        <QuemRecebe planos={planos} porId={porId} servicosDe={servicosDe}
          podeEditar={podeEditarPlano}
          onEditar={p => setAEditarPlano({ plano: p, pid: p.patient_id })} />
      )}

      {aEditarPlano && (
        <PlanoDoApoio
          plano={aEditarPlano.plano}
          pid={aEditarPlano.pid}
          servicosAtuais={aEditarPlano.plano ? servicosDe(aEditarPlano.plano.id) : []}
          /* Só quem ainda não tem plano, mais a própria pessoa quando se está
             a editar: a tabela tem unicidade por `patient_id` e oferecer
             alguém que já tem plano era oferecer um erro. */
          candidatos={pessoas.filter(p =>
            p.id === aEditarPlano.pid || !planos.some(x => x.patient_id === p.id))}
          pessoa={porId.get(aEditarPlano.pid) || null}
          onFechar={() => setAEditarPlano(null)}
          onGravado={() => { setAEditarPlano(null); carregar() }} />
      )}

      {aRegistar && (
        <RegistarVisita parada={aRegistar} dia={dia}
          onFechar={() => setARegistar(null)}
          onGravado={() => { setARegistar(null); carregar() }} />
      )}
    </Mesa>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A VOLTA DE UM DIA
// ═══════════════════════════════════════════════════════════════════════════
function AVolta({ volta, dia, hoje, podeRegistar, onRegistar }: {
  volta: ParadaDaVolta[]; dia: string; hoje: string
  podeRegistar: boolean
  onRegistar: (p: ParadaDaVolta) => void
}) {
  if (!volta.length) {
    return (
      <div style={{ marginTop: 14 }}>
        <Vazio titulo={dia === hoje ? 'Nenhuma casa marcada para hoje' : 'Nenhuma casa marcada para este dia'}
          oQueFazer="Os dias de cada pessoa vêm do plano dela. Em «Quem recebe» marca-se quem recebe apoio e em que dias." />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {volta.map((p, i) => {
        const estado = estadoDaParada(p)
        const cor = estado === 'feita' ? 'var(--green)'
          : estado === 'sem-resposta' ? 'var(--red)' : 'var(--amber)'
        const visita = p.visitas[0]

        return (
          <div key={p.plano.id} style={{
            display: 'flex', gap: 'var(--space-7)', padding: 'var(--space-7) var(--space-6)',
            borderBottom: '1px solid var(--bg-2)', borderLeft: `3px solid ${cor}`,
            background: estado === 'feita' ? 'var(--bg-2)' : 'var(--bg)',
            alignItems: 'flex-start', flexWrap: 'wrap',
          }}>
            {/* A ordem da volta e a hora. É por aqui que quem vai lê a lista. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 46 }}>
              <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>{i + 1}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-dado)',
                fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
              }}>{p.plano.hora_prevista?.slice(0, 5) || '—'}</span>
            </div>

            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <Link href={`/patients/${p.plano.patient_id}`} style={{
                  fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                  color: 'var(--ink)', textDecoration: 'none',
                }}>{p.nome}</Link>
                {p.telefone && (
                  <a href={`tel:${p.telefone}`} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)',
                    color: 'var(--green)', textDecoration: 'none',
                  }}>{p.telefone}</a>
                )}
              </div>

              {p.morada && (
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.45 }}>
                  {p.morada}
                </div>
              )}

              {/* COMO SE ENTRA fica à vista, e não atrás de um toque. É a
                  primeira coisa de que quem chega a uma porta precisa. */}
              {p.plano.como_entrar && (
                <div style={{
                  fontSize: 'var(--t-meta)', color: 'var(--amber)', marginTop: 4,
                  lineHeight: 1.45, display: 'flex', gap: 5,
                }}>
                  <span style={{ ...MONO, color: 'var(--amber)', flexShrink: 0 }}>Entrar</span>
                  <span>{p.plano.como_entrar}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {p.servicosDeHoje.length === 0 ? (
                  <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                    Sem serviços marcados para este dia.
                  </span>
                ) : p.servicosDeHoje.map(s => {
                  const feito = !!visita?.feitos?.includes(s.servico)
                  return (
                    <Codigo key={s.id} texto={codigoDoServico(s.servico)}
                      cor={feito ? 'var(--green)' : 'var(--ink-4)'} apagado={!feito} />
                  )
                })}
              </div>

              {visita && (
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 6, lineHeight: 1.5 }}>
                  {visita.sem_resposta
                    ? <span style={{ color: 'var(--red)' }}>Não estava ninguém em casa.</span>
                    : <>
                        {visita.chegou_as && `Chegou às ${visita.chegou_as.slice(0, 5)}`}
                        {visita.saiu_as && `, saiu às ${visita.saiu_as.slice(0, 5)}`}
                        {visita.quem && ` · ${visita.quem}`}
                      </>}
                  {visita.nao_feito && (
                    <div style={{ color: 'var(--amber)', marginTop: 2 }}>Não feito: {visita.nao_feito}</div>
                  )}
                  {visita.notas && <div style={{ marginTop: 2 }}>{visita.notas}</div>}
                  {p.visitas.length > 1 && (
                    <div style={{ marginTop: 2 }}>
                      {p.visitas.length} visitas registadas neste dia.
                    </div>
                  )}
                </div>
              )}
            </div>

            {podeRegistar && (
              <div style={{ flexShrink: 0 }}>
                <Botao feitio={p.visitas.length ? 'contorno' : 'principal'} onClick={() => onRegistar(p)}>
                  {p.visitas.length ? 'OUTRA VISITA' : 'REGISTAR'}
                </Botao>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEM RECEBE APOIO
// ═══════════════════════════════════════════════════════════════════════════
function QuemRecebe({ planos, porId, servicosDe, podeEditar, onEditar }: {
  planos: PlanoSAD[]
  porId: Map<string, Pessoa>
  servicosDe: (id: string) => ServicoDoPlano[]
  podeEditar: boolean
  onEditar: (p: PlanoSAD) => void
}) {
  if (!planos.length) {
    return (
      <div style={{ marginTop: 14 }}>
        <Vazio titulo="Ninguém com apoio domiciliário, para já"
          oQueFazer="Marca quem recebe apoio em casa, em que dias e que serviços. A volta de cada dia monta-se sozinha a partir daí." />
      </div>
    )
  }

  /* Os inativos no fim e apagados. Um plano que acabou não se apaga — é o que
     prova à Segurança Social que o apoio existiu entre duas datas. */
  const ordenados = [...planos].sort((a, b) =>
    (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1)
    || (porId.get(a.patient_id)?.name || '').localeCompare(porId.get(b.patient_id)?.name || '', 'pt'))

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      {ordenados.map(p => {
        const pessoa = porId.get(p.patient_id)
        const seus = servicosDe(p.id)
        return (
          <Painel key={p.id} cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1, color: p.ativo ? 'var(--ink)' : 'var(--ink-5)' }}>
                {pessoa?.name || 'Sem nome'}{p.ativo ? '' : ' · terminado'}
              </span>
              <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                {diasEmPalavras(p.dias)}
                {p.hora_prevista ? ` · ${p.hora_prevista.slice(0, 5)}` : ''}
              </span>
              {podeEditar && <Botao onClick={() => onEditar(p)}>MUDAR</Botao>}
            </Cabecalho>
          }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', padding: 'var(--space-6) 0' }}>
              {pessoa?.address && (
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>{pessoa.address}</div>
              )}
              {p.como_entrar && (
                <div style={{ display: 'flex', gap: 6, fontSize: 'var(--t-dado)', lineHeight: 1.5 }}>
                  <span style={{ ...MONO, color: 'var(--amber)', flexShrink: 0 }}>Entrar</span>
                  <span style={{ color: 'var(--ink-2)' }}>{p.como_entrar}</span>
                </div>
              )}

              {seus.length === 0 ? (
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--amber)' }}>
                  Plano sem serviços — ninguém sabe o que fazer quando lá chegar.
                </div>
              ) : seus.map(s => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-6)',
                  alignItems: 'baseline', paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--bg-2)',
                }}>
                  <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}>
                    {rotuloDoServico(s.servico)}
                    {s.notas && <span style={{ color: 'var(--ink-4)' }}> — {s.notas}</span>}
                  </span>
                  <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                    {(s.dias || []).length ? diasEmPalavras(s.dias) : 'como o plano'}
                  </span>
                </div>
              ))}

              {(p.desde || p.ate) && (
                <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                  {p.desde ? `DESDE ${p.desde.split('-').reverse().join('/')}` : ''}
                  {p.ate ? `${p.desde ? ' · ' : ''}ATÉ ${p.ate.split('-').reverse().join('/')}` : ''}
                </div>
              )}
              {p.notas && (
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5 }}>{p.notas}</div>
              )}
            </div>
          </Painel>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// O PLANO DE UMA PESSOA
// ═══════════════════════════════════════════════════════════════════════════
function PlanoDoApoio({
  plano, pid, servicosAtuais, candidatos, pessoa, onFechar, onGravado,
}: {
  plano: PlanoSAD | null
  pid: string
  servicosAtuais: ServicoDoPlano[]
  candidatos: Pessoa[]
  pessoa: Pessoa | null
  onFechar: () => void
  onGravado: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [aGravar, setAGravar] = useState(false)

  const [f, setF] = useState({
    patient_id: pid,
    ativo: plano?.ativo ?? true,
    dias: (plano?.dias || []) as number[],
    hora_prevista: plano?.hora_prevista?.slice(0, 5) || '',
    desde: plano?.desde || '',
    ate: plano?.ate || '',
    como_entrar: plano?.como_entrar || '',
    notas: plano?.notas || '',
  })

  /* Os serviços como um mapa de id → {ligado, dias, notas}. Guarda-se o que
     está e o que passa a estar, para só escrever as diferenças. */
  const [sv, setSv] = useState<Record<string, { on: boolean; dias: number[]; notas: string }>>(() => {
    const m: Record<string, { on: boolean; dias: number[]; notas: string }> = {}
    for (const s of SERVICOS) {
      const atual = servicosAtuais.find(x => x.servico === s.id)
      m[s.id] = { on: !!atual, dias: (atual?.dias || []) as number[], notas: atual?.notas || '' }
    }
    return m
  })

  const alternarDia = (n: number) =>
    setF(x => ({ ...x, dias: x.dias.includes(n) ? x.dias.filter(d => d !== n) : [...x.dias, n].sort() }))

  const ligados = SERVICOS.filter(s => sv[s.id].on)
  const impedimento = !f.patient_id ? 'Falta escolher a pessoa.'
    : !f.dias.length ? 'Falta marcar em que dias se vai lá.'
    : !ligados.length ? 'Falta marcar que serviços se prestam.'
    : f.ate && f.desde && f.ate < f.desde ? 'A data de fim está antes da de início.'
    : null

  async function gravar() {
    if (!user || impedimento) return
    setAGravar(true)
    try {
      const corpo = {
        patient_id: f.patient_id,
        ativo: f.ativo,
        dias: f.dias,
        hora_prevista: f.hora_prevista || null,
        desde: f.desde || null,
        ate: f.ate || null,
        como_entrar: f.como_entrar.trim() || null,
        notas: f.notas.trim() || null,
      }

      let planoId = plano?.id || ''
      if (plano) {
        const { error } = await supabase.from('sad_planos').update(corpo).eq('id', plano.id)
        if (error) throw error
      } else {
        /* `select().single()` e não um insert cego: o id do plano é preciso
           para gravar os serviços a seguir, e sem ele as duas escritas ficavam
           um plano sem serviços — exactamente o estado que a página avisa ser
           inútil. */
        const { data, error } = await supabase.from('sad_planos')
          .insert(scope.stamp({ ...corpo, user_id: user.id })).select('id').single()
        if (error) throw error
        planoId = data.id
      }

      // ── Os serviços: escrever só as diferenças ──────────────────────────
      const aApagar = servicosAtuais.filter(s => !sv[s.servico]?.on).map(s => s.id)
      if (aApagar.length) {
        const { error } = await supabase.from('sad_servicos').delete().in('id', aApagar)
        if (error) throw error
      }

      for (const s of SERVICOS) {
        const novo = sv[s.id]
        if (!novo.on) continue
        const atual = servicosAtuais.find(x => x.servico === s.id)
        const linha = { dias: novo.dias, notas: novo.notas.trim() || null }
        if (atual) {
          const igual = JSON.stringify(atual.dias || []) === JSON.stringify(novo.dias)
            && (atual.notas || '') === (novo.notas.trim() || '')
          if (igual) continue
          const { error } = await supabase.from('sad_servicos').update(linha).eq('id', atual.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('sad_servicos')
            .insert(scope.stamp({ ...linha, plano_id: planoId, servico: s.id, user_id: user.id }))
          if (error) throw error
        }
      }

      registar({ supabase, scope, user }, {
        ...ACOES.apoioPlano(pessoa?.name || 'a pessoa', !plano, ligados.length),
        subjectId: f.patient_id, subjectName: pessoa?.name || null, entityId: planoId,
      })
      toast.success(plano ? 'Plano de apoio mudado.' : 'Plano de apoio criado.')
      onGravado()
    } catch (e) {
      toast.error('Não foi possível guardar o plano',
        reportError('apoio-plano', e, 'O que escreveste não se perdeu.'))
    } finally { setAGravar(false) }
  }

  return (
    <Folha titulo={plano ? `Apoio a ${pessoa?.name || 'esta pessoa'}` : 'Quem passa a receber apoio'} aoFechar={onFechar}>
      {!plano && (
        <Campo rotulo="Quem" obrigatorio para="ad-quem">
          {candidatos.length === 0 ? (
            <div style={{ fontSize: 'var(--t-dado)', color: 'var(--amber)', lineHeight: 1.5 }}>
              Todas as pessoas da casa já têm plano de apoio domiciliário.
            </div>
          ) : (
            <select id="ad-quem" value={f.patient_id} autoFocus
              onChange={e => setF(x => ({ ...x, patient_id: e.target.value }))} style={CAIXA}>
              <option value="">Escolher…</option>
              {candidatos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Campo>
      )}

      <Campo rotulo="Em que dias se vai lá" obrigatorio>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 2 }}>
          {DIAS.map(d => {
            const on = f.dias.includes(d.n)
            return (
              <button key={d.n} type="button" onClick={() => alternarDia(d.n)}
                aria-pressed={on} title={d.rotulo} className="mesa-botao"
                style={{
                  minWidth: 44, padding: '0 6px', cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                  background: on ? 'var(--green)' : 'transparent',
                  color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                  border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                  fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                }}>{d.rotulo.slice(0, 3)}</button>
            )
          })}
        </div>
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Campo rotulo="Hora prevista" para="ad-hora">
          <input id="ad-hora" type="time" value={f.hora_prevista}
            onChange={e => setF(x => ({ ...x, hora_prevista: e.target.value }))} style={CAIXA} />
        </Campo>
        <Campo rotulo="Desde" para="ad-desde">
          <input id="ad-desde" type="date" value={f.desde}
            onChange={e => setF(x => ({ ...x, desde: e.target.value }))} style={CAIXA} />
        </Campo>
        <Campo rotulo="Até (se já acabou)" para="ad-ate">
          <input id="ad-ate" type="date" value={f.ate}
            onChange={e => setF(x => ({ ...x, ate: e.target.value }))} style={CAIXA} />
        </Campo>
      </div>

      {/* A pergunta mais prática desta folha, e por isso tem o seu próprio
          espaço e um exemplo. Quem vai pela primeira vez a uma casa precisa de
          saber isto antes de saber qualquer outra coisa. */}
      <Campo rotulo="Como se entra" para="ad-entrar"
        ajuda="Quem abre, onde está a chave, a que horas, o cão, a campainha que não se toca.">
        <textarea id="ad-entrar" rows={2} value={f.como_entrar}
          onChange={e => setF(x => ({ ...x, como_entrar: e.target.value }))}
          placeholder="A chave está na vizinha do 2.º esquerdo. A filha abre às 9h."
          style={CAIXA_TEXTO} />
      </Campo>

      <Campo rotulo="Que serviços" obrigatorio
        ajuda="A lista é a da Portaria 38/2013, que é a que a tutela pergunta. Um serviço sem dias próprios segue os dias do plano.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
          {SERVICOS.map(s => {
            const e = sv[s.id]
            return (
              <div key={s.id} style={{
                border: '1px solid var(--bg-2)', borderRadius: 'var(--r-md)',
                padding: '7px 9px', background: e.on ? 'var(--bg-2)' : 'var(--bg)',
              }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={e.on}
                    onChange={ev => setSv(m => ({ ...m, [s.id]: { ...m[s.id], on: ev.target.checked } }))}
                    style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0, accentColor: 'var(--green)' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>{s.rotulo}</span>
                      {/* Dizer o que é da Portaria e o que não é. Uma casa que
                          preenche a Carta Social precisa de saber a diferença,
                          e misturá-los fazia-a declarar o que não presta. */}
                      {!s.naPortaria && (
                        <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                          fora da portaria
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1 }}>
                      {s.oQue}
                    </span>
                  </span>
                </label>

                {e.on && (
                  <div style={{ paddingLeft: 25, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {DIAS.map(d => {
                        const on = e.dias.includes(d.n)
                        return (
                          <button key={d.n} type="button" title={d.rotulo}
                            onClick={() => setSv(m => ({
                              ...m,
                              [s.id]: {
                                ...m[s.id],
                                dias: on ? m[s.id].dias.filter(x => x !== d.n) : [...m[s.id].dias, d.n].sort(),
                              },
                            }))}
                            aria-pressed={on}
                            style={{
                              width: 30, height: 26, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--t-micro)', borderRadius: 'var(--r-sm)', lineHeight: 1,
                              background: on ? 'var(--green)' : 'transparent',
                              color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                              border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                            }}>{d.rotulo.slice(0, 1)}{d.n === 4 || d.n === 5 ? d.rotulo.slice(1, 2).toLowerCase() : ''}</button>
                        )
                      })}
                      <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', alignSelf: 'center', paddingLeft: 4 }}>
                        {e.dias.length ? diasEmPalavras(e.dias) : 'como o plano'}
                      </span>
                    </div>
                    <input value={e.notas} placeholder="Nota (opcional)"
                      onChange={ev => setSv(m => ({ ...m, [s.id]: { ...m[s.id], notas: ev.target.value } }))}
                      style={{ ...CAIXA, height: 28, fontSize: 'var(--t-meta)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Campo>

      <Campo rotulo="Notas" para="ad-notas">
        <textarea id="ad-notas" rows={2} value={f.notas}
          onChange={e => setF(x => ({ ...x, notas: e.target.value }))} style={CAIXA_TEXTO} />
      </Campo>

      {plano && (
        <Campo rotulo="O apoio continua?">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', paddingTop: 2 }}>
            <input type="checkbox" checked={f.ativo}
              onChange={e => setF(x => ({ ...x, ativo: e.target.checked }))}
              style={{ width: 17, height: 17, accentColor: 'var(--green)' }} />
            <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)' }}>
              {f.ativo ? 'Sim — entra na volta dos dias marcados.'
                : 'Terminado — sai da volta, mas o registo do que foi feito fica.'}
            </span>
          </label>
        </Campo>
      )}

      {impedimento && (
        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '10px 0 0' }}>{impedimento}</p>
      )}

      <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
        <Botao feitio="principal" onClick={gravar} disabled={!!impedimento} esperando={aGravar}>GUARDAR</Botao>
        <Botao onClick={onFechar}>CANCELAR</Botao>
      </div>
    </Folha>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTAR UMA VISITA
// ═══════════════════════════════════════════════════════════════════════════
function RegistarVisita({ parada, dia, onFechar, onGravado }: {
  parada: ParadaDaVolta; dia: string
  onFechar: () => void
  onGravado: () => void
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const [aGravar, setAGravar] = useState(false)

  const agora = new Date().toTimeString().slice(0, 5)
  const [f, setF] = useState({
    chegou_as: agora, saiu_as: '',
    quem: user?.name || user?.email?.split('@')[0] || '',
    // Abre com TODOS os serviços do dia marcados, porque o caso normal é
    // ter-se feito o que estava previsto. Quem não fez tira — é um toque em vez
    // de quatro, e é o lado certo para errar: o que ficou por fazer é a
    // excepção, e tem o seu próprio campo a pedir o porquê.
    feitos: parada.servicosDeHoje.map(s => s.servico),
    sem_resposta: false, nao_feito: '', notas: '',
  })

  const emFalta = parada.servicosDeHoje.filter(s => !f.feitos.includes(s.servico))

  async function gravar() {
    if (!user) return
    setAGravar(true)
    try {
      const { error } = await supabase.from('sad_visitas').insert(scope.stamp({
        user_id: user.id,
        patient_id: parada.plano.patient_id,
        data: dia,
        // Numa visita sem resposta não houve chegada nem saída: a equipa bateu
        // à porta e foi-se. Gravar a hora como «chegou» dizia que entrou.
        chegou_as: f.sem_resposta ? null : (f.chegou_as || null),
        saiu_as: f.sem_resposta ? null : (f.saiu_as || null),
        quem: f.quem.trim() || null,
        feitos: f.sem_resposta ? [] : f.feitos,
        sem_resposta: f.sem_resposta,
        nao_feito: f.nao_feito.trim() || null,
        notas: f.notas.trim() || null,
      }))
      if (error) throw error

      registar({ supabase, scope, user }, {
        ...ACOES.apoioVisita(parada.nome, f.sem_resposta, f.sem_resposta ? 0 : f.feitos.length),
        subjectId: parada.plano.patient_id, subjectName: parada.nome,
      })
      onGravado()
    } catch (e) {
      toast.error('Não foi possível registar a visita',
        reportError('apoio-visita', e, 'O que escreveste não se perdeu.'))
    } finally { setAGravar(false) }
  }

  return (
    <Folha titulo={`Visita a ${parada.nome}`} aoFechar={onFechar}>
      {/* «NÃO ESTAVA NINGUÉM» EM PRIMEIRO. Quem abre esta folha depois de
          bater a uma porta fechada quer uma coisa só, e não há razão para a
          obrigar a passar por seis campos que não se aplicam. */}
      <div style={{
        marginTop: 12, padding: '9px 11px', borderRadius: 'var(--r-md)',
        border: `1px solid ${f.sem_resposta ? 'var(--red)' : 'var(--border-2)'}`,
        background: f.sem_resposta ? 'var(--badge-red-bg, var(--bg-2))' : 'var(--bg)',
      }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.sem_resposta}
            onChange={e => setF(x => ({ ...x, sem_resposta: e.target.checked }))}
            style={{ marginTop: 3, width: 17, height: 17, flexShrink: 0, accentColor: 'var(--red)' }} />
          <span>
            <span style={{ display: 'block', fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>
              Não estava ninguém em casa
            </span>
            <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1, lineHeight: 1.45 }}>
              Fica registado que se foi lá. É o que explica à família porque não
              houve apoio hoje — e o primeiro sinal de que algo se passou.
            </span>
          </span>
        </label>
      </div>

      {!f.sem_resposta && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Campo rotulo="Chegou às" para="av-chegou">
              <input id="av-chegou" type="time" value={f.chegou_as}
                onChange={e => setF(x => ({ ...x, chegou_as: e.target.value }))} style={CAIXA} />
            </Campo>
            <Campo rotulo="Saiu às" para="av-saiu">
              <input id="av-saiu" type="time" value={f.saiu_as}
                onChange={e => setF(x => ({ ...x, saiu_as: e.target.value }))} style={CAIXA} />
            </Campo>
          </div>

          <Campo rotulo="O que ficou feito"
            ajuda={parada.servicosDeHoje.length ? undefined : 'O plano não prevê serviços para este dia da semana.'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
              {parada.servicosDeHoje.map(s => {
                const on = f.feitos.includes(s.servico)
                return (
                  <label key={s.id} style={{
                    display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer',
                    padding: '6px 9px', borderRadius: 'var(--r-md)',
                    border: '1px solid var(--bg-2)',
                    background: on ? 'var(--bg-2)' : 'var(--bg)',
                  }}>
                    <input type="checkbox" checked={on}
                      onChange={() => setF(x => ({
                        ...x,
                        feitos: on ? x.feitos.filter(y => y !== s.servico) : [...x.feitos, s.servico],
                      }))}
                      style={{ width: 17, height: 17, flexShrink: 0, accentColor: 'var(--green)' }} />
                    <span style={{ fontSize: 'var(--t-dado)', color: on ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {rotuloDoServico(s.servico)}
                      {s.notas && <span style={{ color: 'var(--ink-5)' }}> — {s.notas}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          </Campo>
        </>
      )}

      {/* O porquê só se pergunta quando há alguma coisa por fazer. Um campo
          «não feito» sempre visível numa visita completa é um campo a sugerir
          que algo correu mal. */}
      {(f.sem_resposta || emFalta.length > 0) && (
        <Campo rotulo={f.sem_resposta ? 'O que se fez a seguir' : 'Porque é que ficou por fazer'} para="av-naofeito"
          ajuda={f.sem_resposta
            ? 'Telefonou-se a quem? Avisou-se a família? Voltou-se mais tarde?'
            : `Ficou por fazer: ${emFalta.map(s => rotuloDoServico(s.servico).toLowerCase()).join(', ')}.`}>
          <textarea id="av-naofeito" rows={2} value={f.nao_feito}
            onChange={e => setF(x => ({ ...x, nao_feito: e.target.value }))}
            placeholder={f.sem_resposta
              ? 'Telefonou-se à filha, que vem ver.'
              : 'A pessoa recusou o banho.'}
            style={CAIXA_TEXTO} />
        </Campo>
      )}

      <Campo rotulo="Quem foi" para="av-quem">
        <input id="av-quem" value={f.quem}
          onChange={e => setF(x => ({ ...x, quem: e.target.value }))}
          placeholder="O nome de quem foi — ou os dois nomes, se foram dois."
          style={CAIXA} />
      </Campo>

      <Campo rotulo="Notas" para="av-notas">
        <textarea id="av-notas" rows={2} value={f.notas}
          onChange={e => setF(x => ({ ...x, notas: e.target.value }))}
          placeholder="Como estava, o que disse, o que faz falta levar na próxima."
          style={CAIXA_TEXTO} />
      </Campo>

      <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
        <Botao feitio="principal" onClick={gravar} esperando={aGravar}>REGISTAR</Botao>
        <Botao onClick={onFechar}>CANCELAR</Botao>
      </div>
    </Folha>
  )
}
