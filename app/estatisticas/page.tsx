'use client'
// app/estatisticas/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Estatísticas da casa, doze meses, com a IA a organizar.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Quero também uma página de estatísticas super completa, quero que tenha IA
//  para organizar.»
//
// ── PORQUE É QUE NÃO É O PAINEL ADMINISTRATIVO ──────────────────────────────
// O painel responde «como está a casa hoje»: o que falta fazer, quem precisa
// de atenção, o que está em falta. Isto responde outra pergunta — «o que mudou
// nos últimos doze meses» — e é a que se leva a uma reunião de direção, ao
// relatório anual e à Segurança Social.
//
// ── A IA ORGANIZA. NÃO CALCULA. ─────────────────────────────────────────────
// Os vinte e tantos números são calculados aqui, em lib/estatisticas.ts. A IA
// recebe só as frases de factos — nunca um nome, nunca um diagnóstico — e o
// seu trabalho é dizer quais interessam agora e por que ordem.
//
// Tudo o que ela escreve é conferido contra os números que recebeu
// (lib/estatisticas → numerosInventados). Um destaque com um número que não
// lhe foi dado é descartado.
//
// E a leitura da IA aparece SEMPRE por cima dos números, nunca em vez deles:
// se a IA falhar, a página continua completa. Ela é um atalho para o que
// importa, não o caminho para os dados.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { useOrgName } from '@/lib/useOrgName'
import ClinicalGate from '@/components/ClinicalGate'
import { printDoc } from '@/lib/print'
import { cartaSocial, anosDisponiveis, totalEmFalta } from '@/lib/cartaSocial'
import { leituraPartilhada } from '@/lib/leituraPartilhada'
import {
  SECOES, ultimosMeses, indicadores, comparar, variacaoEmPalavras, factosParaIA,
  type Indicador as Ind, type Dados, type Mes,
} from '@/lib/estatisticas'

type Organizado = {
  destaques: { titulo: string; porque: string; secao?: string }[]
  leitura: string
  descartados?: number
  erro?: string
  semDados?: string
}

import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, CAIXA,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function EstatisticasPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const nomeCasa = useOrgName()

  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [ia, setIa] = useState<Organizado | null>(null)
  const [aOrganizar, setAOrganizar] = useState(false)

  // O ano a reportar. Arranca no ano PASSADO: o reporte anual faz-se sobre um
  // ano fechado, e quem abre isto em março quer o de 2026, não os dois meses e
  // meio que já correram de 2027.
  const [anoCarta, setAnoCarta] = useState(() => new Date().getFullYear() - 1)
  /* A Carta Social era um acordeao no meio da pagina — 70px de cabecalho
     todos os dias por uma coisa que se faz uma vez por ano. Passa a vista. */
  const [vista, setVista] = useState<'numeros' | 'carta'>('numeros')
  const largo = useLargo()

  const meses = useMemo(() => ultimosMeses(12), [])
  const desde = meses[0].iso + '-01'

  const carregar = useCallback(async () => {
    if (!user || !scope.orgId) return
    // Cada consulta em separado: uma tabela de uma migração por correr não
    // pode deixar a página inteira em branco. Devolve lista vazia e o cartão
    // diz o que falta.
    //
    // E todas passam pela `leituraPartilhada`: no plano gratuito do Supabase o
    // que custa é o NÚMERO de chamadas, e esta página faz doze. Sem a cache,
    // sair e voltar dentro de cinco minutos custava as doze outra vez — medido
    // em 22 pedidos por abertura.
    const lista = async (chave: string, fazer: () => any): Promise<any[]> => {
      try {
        const { data, error } = await leituraPartilhada<{ data: any[] | null; error: any }>(
          `est:${chave}`, fazer)
        return error ? [] : (data || [])
      } catch { return [] }
    }
    const [
      todasAsPessoas, membros, tomas, registos, ocorrencias,
      atividades, avaliacoes, mensalidades, financas, visitas, mensagens, org,
    ] = await Promise.all([
      // Uma leitura só, e separam-se depois em memória. Antes eram duas — uma
      // com `active = true` e outra com `false` — para o mesmo conjunto.
      //
      // `select('*')` de propósito: `date_of_birth`, `acordo` e `admission_date`
      // são colunas recentes, e nomear uma que não exista faz o PostgREST
      // recusar a consulta INTEIRA — a página ficava vazia, sem erro nenhum.
      lista('pessoas', () => scope.filter(supabase.from('patients').select('*'))),
      lista('membros', () => scope.filter(supabase.from('org_members').select('user_id')).eq('active', true)),
      lista('tomas', () => scope.filter(supabase.from('mar_records').select('status, date, patient_id, recorded_by_id')).gte('date', desde)),
      lista('registos', () => scope.filter(supabase.from('care_records').select('date, patient_id, recorded_by_id')).gte('date', desde)),
      lista('ocorrencias', () => scope.filter(supabase.from('incidents').select('id, type, status, date')).gte('date', desde)),
      lista('atividades', () => scope.filter(supabase.from('activities').select('id, date, status')).gte('date', desde)),
      // `score` e `patient_id` sao para a folha da Carta Social: sem eles nao
      // ha como dizer o grau de dependencia de cada pessoa. Acrescentar
      // colunas a um select e seguro; sao colunas que existem ha muito.
      lista('avaliacoes', () => scope.filter(supabase.from('assessments').select('id, scale, date, score, patient_id')).gte('date', desde)),
      lista('mensalidades', () => scope.filter(supabase.from('billing_entries').select('*')).gte('month', desde)),
      lista('financas', () => scope.filter(supabase.from('finance_entries').select('kind, amount, date')).gte('date', desde)),
      lista('visitas', () => scope.filter(supabase.from('visit_requests').select('id, requested_date, status')).gte('requested_date', desde)),
      lista('mensagens', () => scope.filter(supabase.from('family_thread_messages').select('id, created_at')).gte('created_at', desde)),
      lista('casa', () => supabase.from('organizations').select('capacity').eq('id', scope.orgId)),
    ])
    setDados({
      // `active` pode vir a null em linhas antigas; quem não está marcado como
      // inativo conta como ativo, que é o que o resto da aplicação assume.
      utentes: todasAsPessoas.filter((p: any) => p.active !== false),
      arquivados: todasAsPessoas.filter((p: any) => p.active === false),
      membros, tomas, registos, ocorrencias,
      atividades, avaliacoes, mensalidades, financas, visitas, mensagens,
      capacidade: (org[0] as any)?.capacity ?? null,
    })
  }, [user, scope.orgId, scope.filter, supabase, desde])

  useEffect(() => { carregar() }, [carregar])

  const todos = useMemo(
    () => (dados ? indicadores(dados, meses) : []),
    [dados, meses],
  )
  const factos = useMemo(() => factosParaIA(todos, meses), [todos, meses])

  async function organizar() {
    if (!factos.length) return
    setAOrganizar(true); setIa(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/estatisticas/organizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({
          factos, casa: nomeCasa || undefined,
          periodo: `${meses[0].rotulo} a ${meses[meses.length - 1].rotulo}`,
        }),
      }).then(x => x.json())
      setIa(r)
    } catch {
      setIa({ destaques: [], leitura: '', erro: 'Não foi possível organizar agora. Os números em baixo estão todos certos.' })
    } finally { setAOrganizar(false) }
  }

  // ── A folha da Carta Social ───────────────────────────────────────────────
  // Nenhuma consulta nova: sai do que esta pagina ja carregou. Uma segunda
  // leitura dos mesmos numeros acabaria por discordar da primeira.
  const quadros = useMemo(
    () => (dados ? cartaSocial({
      utentes: dados.utentes, arquivados: dados.arquivados,
      avaliacoes: dados.avaliacoes, capacidade: dados.capacidade,
    }, anoCarta) : []),
    [dados, anoCarta])
  const anos = useMemo(
    () => (dados ? anosDisponiveis({ utentes: dados.utentes, arquivados: dados.arquivados, avaliacoes: [] }) : []),
    [dados])
  const faltam = useMemo(() => totalEmFalta(quadros), [quadros])

  // O ano escolhido TEM de estar na lista oferecida. Se nao estiver, o
  // `<select>` desenha a primeira opcao e o quadro por baixo mostra outra — e
  // quem imprime a folha leva um ano na caixa e outro no papel.
  useEffect(() => {
    if (anos.length && !anos.includes(anoCarta)) setAnoCarta(anos[0])
  }, [anos, anoCarta])

  function imprimirCarta() {
    printDoc({
      docTitle: 'Carta Social',
      docSubtitle: `Reporte anual · ${anoCarta}`,
      institution: nomeCasa || undefined,
      sections: quadros.map(q => ({
        heading: q.titulo,
        note: `${q.porque} — ${q.base}.`,
        records: q.linhas.map(l => ({
          title: `${l.rotulo}: ${l.valor}${l.pct !== null && l.pct !== undefined ? ` (${l.pct}%)` : ''}`,
          meta: '',
        })),
      })),
      // Isto vai impresso, e tem de ir: um relatorio entregue a Seguranca
      // Social que nao diga sobre quantas pessoas foi calculado nao se
      // consegue defender se alguem perguntar.
      footerNote: faltam
        ? `Atenção: ${faltam} campo(s) por preencher nas fichas. Os quadros dizem sobre quantas pessoas foi feita cada conta.`
        : 'Calculado a partir das fichas e avaliações da instituição.',
    })
  }

  function imprimir() {
    printDoc({
      docTitle: 'Estatísticas',
      docSubtitle: `${meses[0].rotulo} a ${meses[meses.length - 1].rotulo}`,
      institution: nomeCasa || undefined,
      // Impresso, cada indicador leva a conta por baixo: numa reunião ou numa
      // inspeção, o papel tem de se explicar sozinho sem ninguém ao lado.
      sections: SECOES.map(s => ({
        heading: s.rotulo,
        note: s.porque,
        records: todos.filter(i => i.secao === s.id).map(i => ({
          title: `${i.titulo}: ${i.vazio ? '—' : i.valor}${i.unidade ? ` (${i.unidade})` : ''}`,
          meta: i.vazio || i.comoSeCalcula,
        })),
      })).filter(s => s.records.length),
      footerNote: 'Números calculados a partir dos registos da instituição',
    })
  }

  if (!user) return null
  const plano = (user?.plan || 'free') as string
  if (plano !== 'pro' && plano !== 'clinic') {
    return <ClinicalGate icone="chart" accent={bp.accent}
      title="Estatísticas"
      description="Doze meses da casa em números, com a IA a dizer o que merece atenção. Faz parte do plano Institucional." />
  }
  if (!scope.isManager) {
    return (
      <Mesa>
        <Painel>
          <Vazio titulo="As estatísticas da casa são só para quem a dirige."
            oQueFazer="São números sobre a casa inteira — ocupação, demora média, incidentes — e não sobre o trabalho de ninguém em particular. Quem gere a casa pode dar-lhe acesso em Equipa → Acessos." />
        </Painel>
      </Mesa>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Duas vistas, porque são dois trabalhos diferentes:

       OS NÚMEROS     doze meses, vinte e três indicadores — vê-se todos os dias
       CARTA SOCIAL   os quadros da Segurança Social — uma vez por ano

     Estavam na mesma página, com a Carta Social num acordeão a meio: fechada
     roubava 70px todos os dias, aberta empurrava os indicadores para fora do
     ecrã. Separadas, cada uma tem o ecrã todo quando é a vez dela.
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Mesa
      /* Oito secções empilhadas: isto lê-se de cima a baixo, não se trabalha
         nele. Sem isto, os oito painéis dividiam a altura da janela entre si
         e cada um ficava com meia linha de número à vista. */
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Em números</span>

          <span style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>{nomeCasa || 'A casa'}</span>

          <Seletor
            opcoes={[
              { id: 'numeros', rotulo: 'Os doze meses' },
              { id: 'carta', rotulo: faltam > 0 ? `Carta Social ${faltam}` : 'Carta Social' },
            ]}
            ativa={vista} aoMudar={v => setVista(v as 'numeros' | 'carta')} />

          {vista === 'numeros' ? (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {meses[0].rotulo.toUpperCase()} A {meses[meses.length - 1].rotulo.toUpperCase()}
            </span>
          ) : (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={ROTULO}>Ano</span>
              <select value={anoCarta} onChange={e => setAnoCarta(Number(e.target.value))}
                style={{ ...CAIXA, width: 90 }}>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {vista === 'numeros' ? (
              <>
                <Botao onClick={imprimir} disabled={!dados}>IMPRIMIR</Botao>
                <Botao feitio="principal" onClick={organizar} esperando={aOrganizar}
                  disabled={!factos.length}>
                  ORGANIZAR COM IA
                </Botao>
              </>
            ) : (
              <Botao onClick={imprimirCarta}>IMPRIMIR A FOLHA</Botao>
            )}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Cada número diz como se calcula</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>A melhorar</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>A piorar</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Nenhum número é estimado: onde não há registos, diz-se o que falta
          </span>
        </BarraDeEstado>
      }
    >
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      {vista === 'carta' ? (
        /* ══ A CARTA SOCIAL ══════════════════════════════════════════════ */
        !dados ? (
          <Painel><ACarregar oQue="A somar as fichas…" /></Painel>
        ) : (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>
                  Carta Social {anoCarta} — os quadros que a Segurança Social pede
                </span>
                {faltam > 0 && (
                  <span style={{
                    ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)',
                    fontWeight: 'var(--peso-forte)' as any,
                  }}>{faltam} POR PREENCHER</span>
                )}
              </Cabecalho>
            }
            rodape={
              <span style={MONO}>
                Os números saem das fichas desta casa, e nenhum é estimado. Confira antes
                de submeter: o reporte é da instituição, não do Phlox.
              </span>
            }
          >
            {quadros.map(q => (
              <div key={q.id}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap',
                  padding: '6px 12px', background: 'var(--bg-2)',
                  borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  <span style={ROTULO}>{q.titulo}</span>
                  <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{q.porque}</span>
                </div>

                {q.linhas.map(l => (
                  <div key={l.rotulo} style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 12, padding: '6px 12px', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', minWidth: 0 }}>
                      {l.rotulo}
                    </span>
                    <span style={{
                      ...MONO, flexShrink: 0, fontSize: 'var(--t-dado)',
                      fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
                    }}>
                      {l.valor}
                      {l.pct !== null && l.pct !== undefined && (
                        <span style={{ color: 'var(--ink-5)', fontWeight: 'var(--peso-normal)' as any }}>
                          {'  '}{l.pct}%
                        </span>
                      )}
                    </span>
                  </div>
                ))}

                {/* A BASE da conta, sempre. Um relatório que não diga sobre
                    quantas pessoas foi feito não se consegue defender se
                    alguém perguntar — e alguém pergunta. */}
                <div style={{
                  padding: '5px 12px 9px', fontSize: 'var(--t-meta)',
                  color: 'var(--ink-5)', lineHeight: 1.5,
                }}>
                  {q.base}.
                  {q.emFalta > 0 && q.ondeResolver && (
                    <span style={{ color: 'var(--amber)', fontWeight: 'var(--peso-corpo)' as any }}>
                      {' '}Faltam {q.emFalta} — {q.ondeResolver}.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Painel>
        )
      ) : !dados ? (
        <Painel><ACarregar oQue="A somar os doze meses…" /></Painel>
      ) : (
        <>
          {/* A leitura da IA, por cima e nunca EM VEZ dos números. */}
          {ia && <Leitura ia={ia} />}

          {SECOES.map(s2 => {
            const daSecao = todos.filter(i => i.secao === s2.id)
            if (!daSecao.length) return null
            return (
              <Painel key={s2.id}
                cabeca={
                  <Cabecalho>
                    <span style={{ ...ROTULO, flex: 1 }}>{s2.rotulo}</span>
                    <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{s2.porque}</span>
                  </Cabecalho>
                }
              >
                {/* Vinte e três cartões com borda eram vinte e três molduras a
                    competir com os números lá dentro. Células separadas por
                    filetes: a grelha é a moldura, e é uma só. */}
                <div className="est-grelha">
                  {daSecao.map(i => <Indicador key={i.id} ind={i} meses={meses} />)}
                </div>
              </Painel>
            )
          })}
        </>
      )}

      <style>{`
        /* O MESMO corte do resto da aplicação (1040px), e não os três próprios
           que esta página tinha (1080 / 800 / 460) — com cortes diferentes,
           quem arrastava a janela via esta página partir-se numa largura em
           que mais nenhuma partia. */
        .est-grelha { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); }
        .est-grelha > * { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .est-grelha > *:nth-child(4n) { border-right: none; }
        @media (max-width: 1040px) {
          .est-grelha { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .est-grelha > *:nth-child(4n) { border-right: 1px solid var(--border); }
          .est-grelha > *:nth-child(2n) { border-right: none; }
        }
        @media (max-width: 560px) {
          .est-grelha { grid-template-columns: 1fr; }
          .est-grelha > * { border-right: none !important; }
        }
      `}</style>
    </Mesa>
  )
}

/* ── Um indicador ──────────────────────────────────────────────────────────
   Era um `Cartao` com borda e raio próprios. Passa a célula de uma grelha
   com filetes — e muda de nome, porque «cartão» deixou de ser o que é. */
function Indicador({ ind, meses }: { ind: Ind; meses: Mes[] }) {
  const [porque, setPorque] = useState(false)
  const c = comparar(ind.serie)
  const variou = variacaoEmPalavras(c, meses)

  // Uma subida é boa ou má consoante o indicador. Pintar tudo de verde quando
  // sobe fazia as quedas parecerem boas notícias.
  const corDaVariacao = !variou || c.variacao === null || c.variacao === 0 ? 'var(--ink-4)'
    : ind.sentido === 'neutro' ? 'var(--ink-4)'
    : (c.variacao > 0) === (ind.sentido === 'subir_bom') ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ ...ROTULO, lineHeight: 1.35 }}>{ind.titulo}</div>

      {ind.vazio ? (
        <p style={{ margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5 }}>
          {ind.vazio}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
            <span style={{
              ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
              lineHeight: 1.1, color: 'var(--ink)',
            }}>{ind.valor}</span>
            {ind.unidade && (
              <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{ind.unidade}</span>
            )}
          </div>
          {variou && (
            <div style={{
              ...MONO, fontSize: 'var(--t-meta)', color: corDaVariacao,
              fontWeight: 'var(--peso-corpo)' as any,
            }}>{variou}</div>
          )}
          {ind.serie.some(v => v !== null) && <Faisca serie={ind.serie} />}
        </>
      )}

      {/* «Como se calcula». Um número que ninguém consegue explicar é um
          número em que ninguém confia — e a primeira vez que alguém não
          conseguir reproduzir a conta, deixa de acreditar na página inteira. */}
      <button onClick={() => setPorque(p => !p)} style={{
        marginTop: 'auto', paddingTop: 4, background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.06em',
        color: 'var(--ink-5)', textAlign: 'left',
      }}>{porque ? 'ESCONDER' : 'COMO SE CALCULA'}</button>
      {porque && (
        <p style={{
          margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.55,
        }}>{ind.comoSeCalcula}</p>
      )}
    </div>
  )
}

/** Doze meses em vinte e seis pixéis. Sem eixos: é a forma, não a leitura. */
function Faisca({ serie }: { serie: (number | null)[] }) {
  const vals: number[] = serie.map(v => (v === null ? 0 : v))
  const max = Math.max(1, ...vals)
  const L = 100, A = 26
  const passo = vals.length > 1 ? L / (vals.length - 1) : L
  const pontos = vals.map((v, i) => `${(i * passo).toFixed(1)},${(A - (v / max) * (A - 3)).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none"
      style={{ width: '100%', height: A, display: 'block', marginTop: 2 }} aria-hidden>
      <polyline points={pontos.join(' ')} fill="none" stroke="var(--green)" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* O último mês marcado: é o que se está a ler. */}
      <circle cx={(vals.length - 1) * passo} cy={A - (vals[vals.length - 1] / max) * (A - 3)}
        r="2" fill="var(--green)" />
    </svg>
  )
}

/* ── O que a IA organizou ─────────────────────────────────────────────────── */
function Leitura({ ia }: { ia: Organizado }) {
  const nada = !ia.destaques.length && !ia.leitura
  return (
    <Painel
      cabeca={
        <Cabecalho>
          <span style={{ ...ROTULO, flex: 1 }}>O que merece atenção</span>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
            ORGANIZADO POR IA
          </span>
        </Cabecalho>
      }
      rodape={
        <span style={MONO}>
          A IA só ordena e explica os números calculados em baixo. Não os calcula,
          e tudo o que escreve é conferido contra eles.
        </span>
      }
    >
      <div style={{ padding: '12px 14px' }}>
        {ia.semDados && (
          <p style={{ margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.65 }}>
            {ia.semDados}
          </p>
        )}
        {ia.erro && (
          <p style={{ margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.65 }}>
            {ia.erro}
          </p>
        )}

        {!!ia.destaques.length && ia.destaques.map((d, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '7px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
              width: 18, flexShrink: 0, paddingTop: 1,
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{
                display: 'block', fontSize: 'var(--t-corpo)',
                fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
              }}>{d.titulo}</span>
              <span style={{
                display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
                marginTop: 2, lineHeight: 1.55,
              }}>{d.porque}</span>
            </span>
          </div>
        ))}

        {ia.leitura && (
          <p style={{
            margin: '10px 0 0', fontSize: 'var(--t-dado)', color: 'var(--ink-3)',
            lineHeight: 1.7, maxWidth: '72ch',
          }}>{ia.leitura}</p>
        )}

        {nada && !ia.semDados && !ia.erro && (
          <p style={{ margin: 0, fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.65 }}>
            Nada a destacar: os números estão estáveis.
          </p>
        )}

        {/* Dizer que se descartou alguma coisa. Esconder isto era fingir que a
            IA acerta sempre — e a primeira vez que alguém desse por isso,
            deixava de confiar em tudo o que ela escreve. */}
        {!!ia.descartados && (
          <p style={{
            margin: '10px 0 0', fontSize: 'var(--t-meta)', color: 'var(--amber)', lineHeight: 1.55,
          }}>
            {ia.descartados === 1
              ? 'Deitei fora um destaque que citava um número que não lhe dei.'
              : `Deitei fora ${ia.descartados} destaques que citavam números que não lhes dei.`}
          </p>
        )}
      </div>
    </Painel>
  )
}
