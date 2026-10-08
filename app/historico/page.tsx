'use client'

// app/historico/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O LIVRO DE REGISTOS DA CASA — refeito de raiz na linguagem da mesa.
//
// ── O QUE ESTAVA ERRADO, E NÃO É O ASPETO ──────────────────────────────────
// Era um invólucro de 37 linhas: um título em serifa de 34px, um parágrafo de
// três linhas a explicar o que é um histórico, e dentro de um cartão o
// `LivroDeRegistos` com sessenta entradas em fila.
//
// Três problemas a sério, nenhum deles de cor:
//
//  1. SEM PESQUISA. Este livro é o que se abre quando alguém pergunta «quem
//     deu a medicação à Dona Maria na quinta-feira?». Sem uma caixa de
//     pesquisa, a resposta é rolar sessenta linhas e esperar pela sorte.
//
//  2. SEM DATAS. Carregava os últimos 60 (ou 250) registos. Se a pergunta é
//     sobre o mês passado, não havia maneira de chegar lá.
//
//  3. O ASSUNTO ERA UMA BOLA DE COR COM AS INICIAIS DA PESSOA. Uma bola de
//     24px com duas letras brancas, com a cor gerada do id. Parece decoração
//     porque é: a cor não quer dizer nada que se possa aprender.
//
// Passa a uma TABELA: hora, código do assunto, quem fez, sobre quem, o quê.
// Com pesquisa, intervalo de datas e filtro por assunto. Os dias separam-se
// com uma linha de grupo, e as horas alinham em coluna — que é o que permite
// ler um turno de cima a baixo.
//
// ── A FRONTEIRA ────────────────────────────────────────────────────────────
// O livro pertence à instituição. Nada disto sai daqui para o Phlox: ver a
// nota em supabase/sprint137_activity_log.sql. Nenhuma rota /api/admin pode
// tocar nesta tabela.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useOrgName } from '@/lib/useOrgName'
import { familiaDaAcao } from '@/lib/registo'
import { ptDate } from '@/lib/ptTime'
import { eFaltaDeSetup } from '@/lib/setupCodes'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Entrada {
  id: string
  action: string
  summary: string
  actor_name: string | null
  subject_id: string | null
  subject_name: string | null
  created_at: string
  meta: any
}

/* ── O CÓDIGO DE UM ASSUNTO ─────────────────────────────────────────────────
   A bola de cor com as iniciais da pessoa não dizia nada que se pudesse
   aprender — a cor saía do id. Quatro letras do ASSUNTO dizem o que é a
   entrada, e repetem-se sempre iguais, que é o que faz um código. */
const CODIGO_FAMILIA: Record<string, string> = {
  'Presenças': 'PRES',
  'Transportes': 'TRAN',
  'Roupa': 'ROUP',
  'Serviços': 'SERV',
  'Tarefas': 'TARE',
  'Medicação': 'MED',
  'Cuidado do dia': 'CUID',
  'Ocorrências': 'OCOR',
  'Famílias': 'FAM',
  'Refeições': 'REFE',
  'Outros': '—',
}

/** Quantos dias para trás. Não há «tudo»: 250 linhas sem data é o mesmo que nada. */
const JANELAS = [
  { id: '7', rotulo: '7 dias', dias: 7 },
  { id: '30', rotulo: '30 dias', dias: 30 },
  { id: '90', rotulo: '3 meses', dias: 90 },
  { id: '365', rotulo: '12 meses', dias: 365 },
] as const
type JanelaId = (typeof JANELAS)[number]['id']

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

const diaLongo = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

export default function HistoricoPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const casa = useOrgName()
  const largo = useLargo()

  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [janela, setJanela] = useState<JanelaId>('7')
  const [familia, setFamilia] = useState('')
  const [procura, setProcura] = useState('')
  /** A entrada aberta à direita. Um resumo de uma linha corta-se na tabela. */
  const [aberta, setAberta] = useState<Entrada | null>(null)

  const carregar = useCallback(async () => {
    if (!user) return
    setCarregando(true)
    const dias = JANELAS.find(j => j.id === janela)!.dias
    const desde = new Date(Date.now() - dias * 86400000).toISOString()

    let q = supabase.from('activity_log')
      .select('id,action,summary,actor_name,subject_id,subject_name,created_at,meta')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(600)
    q = scope.orgId ? q.eq('org_id', scope.orgId) : q.eq('user_id', scope.userId)

    const { data, error } = await q
    if (error) {
      if (eFaltaDeSetup(error)) setSemTabela(true)
      setEntradas([])
    } else {
      setSemTabela(false)
      setEntradas(data || [])
    }
    setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, janela])

  useEffect(() => { carregar() }, [carregar])

  const familias = useMemo(
    () => [...new Set(entradas.map(e => familiaDaAcao(e.action)))].sort(),
    [entradas])

  const visiveis = useMemo(() => {
    const t = procura.trim().toLowerCase()
    return entradas.filter(e => {
      if (familia && familiaDaAcao(e.action) !== familia) return false
      if (!t) return true
      return (e.summary || '').toLowerCase().includes(t)
        || (e.subject_name || '').toLowerCase().includes(t)
        || (e.actor_name || '').toLowerCase().includes(t)
    })
  }, [entradas, familia, procura])

  /* Quantas entradas HOJE. É o número que diz se a casa está a registar — uma
     casa de trinta pessoas que faz dez registos num dia não está a registar. */
  const hoje = ptDate()
  const deHoje = useMemo(
    () => entradas.filter(e => e.created_at.slice(0, 10) === hoje).length,
    [entradas, hoje])

  const quemTrabalhou = useMemo(
    () => new Set(entradas.filter(e => e.created_at.slice(0, 10) === hoje).map(e => e.actor_name || 'Equipa')).size,
    [entradas, hoje])

  if (semTabela) {
    return (
      <Mesa>
        <Painel>
          <div style={{ padding: 14 }}>
            <AvisoDeSetup codigo="PHX-S3" oQue="O histórico ainda não está disponível nesta conta." />
          </div>
        </Painel>
      </Mesa>
    )
  }

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Registos</span>

          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>{casa || 'A casa'}</span>

          <input value={procura} onChange={e => setProcura(e.target.value)}
            placeholder="Procurar pessoa, quem fez, ou o quê…" aria-label="Procurar no livro"
            style={{ ...CAIXA, width: 280 }} />

          <Seletor
            opcoes={JANELAS.map(j => ({ id: j.id, rotulo: j.rotulo }))}
            ativa={janela} aoMudar={j => setJanela(j as JanelaId)} />

          {familias.length > 1 && (
            <select value={familia} onChange={e => setFamilia(e.target.value)}
              aria-label="Assunto" style={{ ...CAIXA, width: 160 }}>
              <option value="">Todos os assuntos</option>
              {familias.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}

          <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {deHoje} HOJE
            </span>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {quemTrabalhou} PESSOA{quemTrabalhou === 1 ? '' : 'S'} A REGISTAR
            </span>
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>O código diz de que assunto é a entrada</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Enche-se sozinho com o trabalho do dia — não se escreve nem se apaga aqui
          </span>
          <span style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
            É da casa. Não sai daqui.
          </span>
        </BarraDeEstado>
      }
    >
      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo && aberta ? 'minmax(420px, 1fr) minmax(320px, 420px)' : '1fr',
      }}>
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 48 }}>Hora</span>
              <span style={{ ...ROTULO, width: 52 }}>Assunto</span>
              <span style={{ ...ROTULO, flex: 1 }}>O que ficou registado</span>
              <span style={{ ...ROTULO, width: 130 }}>Sobre quem</span>
              <span style={{ ...ROTULO, width: 110 }}>Quem fez</span>
            </Cabecalho>
          }
          rodape={
            <>
              <span style={MONO}>{visiveis.length} de {entradas.length}</span>
              {(procura || familia) && (
                <button onClick={() => { setProcura(''); setFamilia('') }} style={{
                  ...MONO, fontSize: 'var(--t-meta)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--green)',
                }}>LIMPAR OS FILTROS</button>
              )}
              {entradas.length >= 600 && (
                <span style={{ ...MONO, color: 'var(--amber)', marginLeft: 'auto' }}>
                  600 É O MÁXIMO — ESTREITE A JANELA
                </span>
              )}
            </>
          }
        >
          {carregando ? (
            <ACarregar oQue="A abrir o livro…" />
          ) : visiveis.length === 0 ? (
            <Vazio
              titulo={entradas.length === 0 ? 'Ainda não há nada registado nesta janela.' : 'Nada corresponde ao filtro.'}
              oQueFazer={entradas.length === 0
                ? 'O livro enche-se sozinho à medida que a equipa vai trabalhando — não é preciso escrever aqui nada. Se está vazio num dia de trabalho, é sinal de que o registo está a ser feito fora do Phlox.'
                : 'Experimente alargar a janela de datas ou limpar a pesquisa.'} />
          ) : visiveis.map((e, i) => {
            const fam = familiaDaAcao(e.action)
            const novoDia = i === 0
              || e.created_at.slice(0, 10) !== visiveis[i - 1].created_at.slice(0, 10)
            const on = aberta?.id === e.id
            return (
              <div key={e.id}>
                {novoDia && (
                  <div style={{
                    padding: '5px 12px', background: 'var(--bg-2)',
                    borderTop: i ? '1px solid var(--border-2)' : 'none',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    <span style={ROTULO}>{diaLongo(e.created_at)}</span>
                  </div>
                )}
                <button onClick={() => setAberta(on ? null : e)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  textAlign: 'left', padding: '6px 12px', border: 'none',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${on ? 'var(--green)' : 'transparent'}`,
                  background: on ? 'var(--green-light)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <span style={{
                    ...MONO, fontSize: 'var(--t-dado)', width: 48, flexShrink: 0, color: 'var(--ink-3)',
                  }}>{hhmm(e.created_at)}</span>

                  <span style={{ width: 52, flexShrink: 0 }}>
                    <Codigo texto={CODIGO_FAMILIA[fam] || '—'} apagado={fam === 'Outros'} />
                  </span>

                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.summary}</span>

                  <span style={{
                    width: 130, flexShrink: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.subject_name || '—'}</span>

                  <span style={{
                    width: 110, flexShrink: 0, ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.actor_name || 'Equipa'}</span>
                </button>
              </div>
            )
          })}
        </Painel>

        {/* ── UMA ENTRADA POR INTEIRO ────────────────────────────────────────
            A tabela corta o resumo com reticências — é o preço de caberem
            trinta linhas no ecrã. Quem precisa do texto todo abre-a aqui. */}
        {aberta && largo && (
          <Painel
            cabeca={
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
              }}>
                <Botao onClick={() => setAberta(null)}>← FECHAR</Botao>
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                  {diaLongo(aberta.created_at)} · {hhmm(aberta.created_at)}
                </span>
              </div>
            }
          >
            <div style={{ padding: 14 }}>
              <div style={{ ...ROTULO, marginBottom: 4 }}>O que ficou registado</div>
              <p style={{
                fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.6,
                margin: '0 0 14px', whiteSpace: 'pre-wrap',
              }}>{aberta.summary}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <span>
                  <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Assunto</span>
                  <span style={{ fontSize: 'var(--t-dado)' }}>{familiaDaAcao(aberta.action)}</span>
                </span>
                <span>
                  <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Sobre quem</span>
                  <span style={{ fontSize: 'var(--t-dado)' }}>{aberta.subject_name || '—'}</span>
                </span>
                <span>
                  <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Quem fez</span>
                  <span style={{ fontSize: 'var(--t-dado)' }}>{aberta.actor_name || 'Equipa'}</span>
                </span>
                <span>
                  <span style={{ ...ROTULO, display: 'block', marginBottom: 2 }}>Acção</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{aberta.action}</span>
                </span>
              </div>

              <p style={{
                fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 16, lineHeight: 1.55,
              }}>
                Não se apaga nem se corrige. Se o que está escrito estiver errado, corrige-se
                no sítio onde foi registado — e fica aqui a segunda entrada, com a hora.
              </p>
            </div>
          </Painel>
        )}
      </div>
    </Mesa>
  )
}
