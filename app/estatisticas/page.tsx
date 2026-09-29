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
import { leituraPartilhada } from '@/lib/leituraPartilhada'
import {
  SECOES, ultimosMeses, indicadores, comparar, variacaoEmPalavras, factosParaIA,
  type Indicador, type Dados, type Mes,
} from '@/lib/estatisticas'

type Organizado = {
  destaques: { titulo: string; porque: string; secao?: string }[]
  leitura: string
  descartados?: number
  erro?: string
  semDados?: string
}

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
      lista('avaliacoes', () => scope.filter(supabase.from('assessments').select('id, scale, date')).gte('date', desde)),
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
    return <ClinicalGate emoji="📊" accent={bp.accent}
      title="Estatísticas"
      description="Doze meses da casa em números, com a IA a dizer o que merece atenção. Faz parte do plano Institucional." />
  }
  if (!scope.isManager) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          As estatísticas da casa são só para quem a dirige.
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-2)', minHeight: '100vh' }}>
      <div style={{
        maxWidth: 1180, margin: '0 auto',
        padding: 'var(--space-10) clamp(14px,2.5vw,24px) var(--space-16)',
      }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10,
            }}>Estatísticas · {meses[0].rotulo} a {meses[meses.length - 1].rotulo}</div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,34px)', fontWeight: 400,
              margin: 0, letterSpacing: '-0.015em', color: 'var(--ink)',
            }}>{nomeCasa || 'A casa'}, em números</h1>
            <p style={{ margin: '7px 0 0', fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 620 }}>
              Doze meses. Cada número diz como se calcula — e nenhum é estimado: onde
              não há registos, diz-se o que falta.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={imprimir} disabled={!dados} style={botao()}>Imprimir</button>
            <button onClick={organizar} disabled={aOrganizar || !factos.length}
              style={{ ...botao(), background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>
              {aOrganizar ? 'A organizar…' : 'Organizar com IA'}
            </button>
          </div>
        </header>

        {erro && (
          <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>{erro}</p>
        )}

        {/* ── A leitura da IA, por cima e nunca em vez dos números ────────── */}
        {ia && <Leitura ia={ia} cor={bp.accent} />}

        {!dados ? (
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)' }}>A somar os doze meses…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {SECOES.map(s => {
              const daSecao = todos.filter(i => i.secao === s.id)
              if (!daSecao.length) return null
              return (
                <section key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                      {s.rotulo}
                    </h2>
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>{s.porque}</span>
                  </div>
                  <div className="est-grelha">
                    {daSecao.map(i => (
                      <Cartao key={i.id} ind={i} meses={meses} cor={bp.accent} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        .est-grelha { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 1080px) { .est-grelha { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        @media (max-width: 800px)  { .est-grelha { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 460px)  { .est-grelha { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}

const botao = (): React.CSSProperties => ({
  minHeight: 42, padding: '0 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
  border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--ink)',
})

/* ── Um indicador ─────────────────────────────────────────────────────────── */
function Cartao({ ind, meses, cor }: { ind: Indicador; meses: Mes[]; cor: string }) {
  const [porque, setPorque] = useState(false)
  const c = comparar(ind.serie)
  const variou = variacaoEmPalavras(c, meses)

  // Uma subida é boa ou má consoante o indicador. Pintar tudo de verde quando
  // sobe fazia as quedas parecerem boas notícias.
  const corDaVariacao = !variou || c.variacao === null || c.variacao === 0 ? 'var(--ink-4)'
    : ind.sentido === 'neutro' ? 'var(--ink-4)'
    : (c.variacao > 0) === (ind.sentido === 'subir_bom') ? '#16a34a' : '#dc2626'

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg)',
      padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--ink-5)', lineHeight: 1.3,
      }}>{ind.titulo}</div>

      {ind.vazio ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>
          {ind.vazio}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 23, fontWeight: 700,
              lineHeight: 1.1, color: 'var(--ink)',
            }}>{ind.valor}</span>
            {ind.unidade && (
              <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{ind.unidade}</span>
            )}
          </div>
          {variou && (
            <div style={{ fontSize: 11.5, color: corDaVariacao, fontWeight: 600 }}>{variou}</div>
          )}
          {ind.serie.some(v => v !== null) && <Faisca serie={ind.serie} cor={cor} />}
        </>
      )}

      {/* «Como se calcula». Um número que ninguém consegue explicar é um número
          em que ninguém confia — e a primeira vez que alguém não conseguir
          reproduzir a conta, deixa de acreditar na página inteira. */}
      <button onClick={() => setPorque(p => !p)} style={{
        marginTop: 'auto', paddingTop: 4, background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, color: 'var(--ink-5)',
        textAlign: 'left',
      }}>{porque ? 'esconder' : 'como se calcula'}</button>
      {porque && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.55 }}>
          {ind.comoSeCalcula}
        </p>
      )}
    </div>
  )
}

/** Doze meses em vinte e oito pixels. Sem eixos: é a forma, não a leitura. */
function Faisca({ serie, cor }: { serie: (number | null)[]; cor: string }) {
  const vals = serie.map(v => (v === null ? 0 : v))
  const max = Math.max(1, ...vals)
  const L = 100, A = 26
  const passo = vals.length > 1 ? L / (vals.length - 1) : L
  const pontos = vals.map((v, i) => `${(i * passo).toFixed(1)},${(A - (v / max) * (A - 3)).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none"
      style={{ width: '100%', height: A, display: 'block', marginTop: 2 }} aria-hidden>
      <polyline points={pontos.join(' ')} fill="none" stroke={cor} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* O último mês marcado: é o que se está a ler. */}
      <circle cx={(vals.length - 1) * passo} cy={A - (vals[vals.length - 1] / max) * (A - 3)}
        r="2" fill={cor} />
    </svg>
  )
}

/* ── O que a IA organizou ─────────────────────────────────────────────────── */
function Leitura({ ia, cor }: { ia: Organizado; cor: string }) {
  const nada = !ia.destaques.length && !ia.leitura
  return (
    <div style={{
      border: `1px solid ${cor}33`, background: `${cor}08`, borderRadius: 'var(--r-md)',
      padding: '16px 18px', marginBottom: 22,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: cor, marginBottom: 10,
      }}>O que merece atenção</div>

      {ia.semDados && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>{ia.semDados}</p>
      )}
      {ia.erro && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>{ia.erro}</p>
      )}

      {!!ia.destaques.length && (
        <ol style={{ margin: '0 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {ia.destaques.map((d, i) => (
            <li key={i} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>
              <strong>{d.titulo}</strong>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>
                {d.porque}
              </span>
            </li>
          ))}
        </ol>
      )}
      {ia.leitura && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7 }}>{ia.leitura}</p>
      )}

      {nada && !ia.semDados && !ia.erro && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
          Nada a destacar: os números estão estáveis.
        </p>
      )}

      {/* Dizer que se descartou alguma coisa. Esconder isto era fingir que a
          IA acerta sempre — e a primeira vez que alguém desse por isso,
          deixava de confiar em tudo o que ela escreve. */}
      {!!ia.descartados && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#92400e', lineHeight: 1.55 }}>
          {ia.descartados === 1
            ? 'Deitei fora um destaque que citava um número que não lhe dei.'
            : `Deitei fora ${ia.descartados} destaques que citavam números que não lhes dei.`}
        </p>
      )}

      <p style={{
        margin: '12px 0 0', fontSize: 10.5, color: 'var(--ink-5)', lineHeight: 1.5,
      }}>
        A IA só ordena e explica os números calculados em baixo. Não os calcula, e
        tudo o que escreve é conferido contra eles.
      </p>
    </div>
  )
}
