'use client'
// app/painel-dono/PainelAdmin.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O painel administrativo.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Preciso que melhores o /painel-dono. Primeiro, quero que o chames painel
//  administrativo. Segundo, precisa mesmo de melhorias!!!! Coloca-o mesmo como
//  um painel (estilo /painel mesmo) e a dar para ver tudo (menos as mensagens
//  confidenciais).»
//
// ── O QUE ELE ERA ───────────────────────────────────────────────────────────
// Uma lista de eventos («quem fez o quê a quem») com cinco separadores por
// cima. Era um relatório, não um painel: para saber se a casa está cheia, se
// as mensalidades estão cobradas ou se há planos por rever, era preciso abrir
// outras cinco páginas.
//
// ── O QUE É AGORA ───────────────────────────────────────────────────────────
// Cinco vistas dos MESMOS dados da casa, montadas com as peças do /painel
// (app/painel/painelPecas.tsx) — os mesmos cartões, a mesma grelha de doze
// colunas, o mesmo desenho. Não é parecido com o painel: é feito das mesmas
// peças, e por isso nunca se vai afastar dele.
//
// As contas estão em adminAbas.ts, separadas daqui. Um número que decide sobre
// pessoas e sobre dinheiro tem de se poder ler sem o ruído do JSX à volta.
//
// ── «MENOS AS MENSAGENS CONFIDENCIAIS» ──────────────────────────────────────
// Um recado dirigido a alguém não aparece aqui, e não é este ecrã que o
// impede: é a política `tm_dirigido` (sprint156), que é RESTRITIVA e não abre
// exceção para a direção. Por isso TODAS as leituras desta página vão com a
// sessão de quem está a ver — nunca com a chave de serviço, que passa por cima
// da RLS e traria tudo. Está dito no ecrã, ao pé do mural.
//
// ── CARREGAMENTO ────────────────────────────────────────────────────────────
// A primeira vista carrega de imediato; as outras só vão à base de dados
// quando são abertas, e ficam em memória. Puxar as cinco de uma vez eram mais
// de vinte consultas para mostrar números que talvez ninguém abra — e no plano
// gratuito do Supabase o que custa é o NÚMERO de chamadas.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { useOrgName } from '@/lib/useOrgName'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate } from '@/lib/ptTime'
import { nomesDe } from '@/lib/perfisVisiveis'
import { ultimosDias } from '@/lib/painelDados'
import {
  FaixaKpi, CartaoLinha, CartaoBarras, CartaoRosca, CartaoTabela, CartaoLista,
} from '../painel/painelPecas'
import { Painel, Vazio, ACarregar, Botao, MONO, ROTULO } from '@/components/ui/mesa'
import {
  ABAS_ADMIN, abaCasa, abaCuidado, abaEquipa, abaDinheiro, abaConformidade,
  type AbaAdminId, type BaseAdmin,
  type CruCasa, type CruCuidado, type CruEquipa, type CruDinheiro, type CruConformidade,
} from './adminAbas'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Um cartão sem título e sem explicação não tem nada a dizer — não se desenha. */
const temAlgoADizer = (d: { titulo: string; vazio?: string }) => !!(d.titulo || d.vazio)

export default function PainelAdmin({ extra }: { extra?: React.ReactNode }) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const nomeCasa = useOrgName()

  const [aba, setAba] = useState<AbaAdminId>('casa')
  const [base, setBase] = useState<BaseAdmin | null>(null)
  const [casa, setCasa] = useState<CruCasa | null>(null)
  const [cuidado, setCuidado] = useState<CruCuidado | null>(null)
  const [equipa, setEquipa] = useState<CruEquipa | null>(null)
  const [dinheiro, setDinheiro] = useState<CruDinheiro | null>(null)
  const [conf, setConf] = useState<CruConformidade | null>(null)
  const [erro, setErro] = useState('')

  const hoje = useMemo(() => ptDate(), [])
  const ha30 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return ptDate(d) }, [])
  const ha90 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 90); return ptDate(d) }, [])
  const dias = useMemo(() => ultimosDias(30), [])
  const mesAtual = useMemo(() => `${hoje.slice(0, 7)}-01`, [hoje])
  const mesEmPalavras = useMemo(() => `${MESES[+hoje.slice(5, 7) - 1]} de ${hoje.slice(0, 4)}`, [hoje])

  /* ── A base: o que todas as vistas precisam ────────────────────────────── */
  useEffect(() => {
    if (!user || !scope.orgId) return
    let vivo = true
    ;(async () => {
      // `select('*')` nas pessoas: `date_of_birth`, `acordo` e `admission_date`
      // são colunas recentes, e nomear uma que ainda não exista faz o PostgREST
      // recusar a consulta INTEIRA — o painel ficava vazio, sem erro nenhum.
      const [p, m, o] = await Promise.all([
        scope.filter(supabase.from('patients').select('*')).eq('active', true),
        scope.filter(supabase.from('org_members').select('user_id, role')).eq('active', true),
        supabase.from('organizations').select('capacity').eq('id', scope.orgId).maybeSingle(),
      ])
      if (!vivo) return
      if (p.error) { setErro('Não foi possível ler as pessoas da casa.'); return }

      // Os nomes de quem tem acesso; `org_members` só guarda ids.
      //
      // Por `nomesDe`, que lê a vista `perfis_visiveis` — a tabela `profiles`
      // devolvia o perfil INTEIRO (email, NIF, Stripe) a quem só precisava do
      // nome, e passou a devolver só a própria linha (sprint168).
      const ids = (m.data || []).map((x: any) => x.user_id)
      const nomes = await nomesDe(supabase, ids)
      if (!vivo) return
      setBase({
        utentes: p.data || [],
        membros: (m.data || []).map((x: any) => ({ ...x, nome: nomes.get(x.user_id) || 'Colega' })),
        capacidade: (o.data as any)?.capacity ?? null,
      })
    })()
    return () => { vivo = false }
  }, [user, supabase, scope.orgId, scope.filter])

  /* ── Cada vista traz o seu, uma vez só ─────────────────────────────────── */
  useEffect(() => {
    if (!base || !user) return
    let vivo = true
    // Uma consulta que falha (tabela de uma migração por correr) não pode
    // levar a vista atrás: devolve-se lista vazia e o cartão diz o que falta.
    const lista = async (q: any): Promise<any[]> => {
      try { const { data, error } = await q; return error ? [] : (data || []) } catch { return [] }
    }
    ;(async () => {
      if (aba === 'casa' && !casa) {
        const [candidaturas] = await Promise.all([
          lista(scope.filter(supabase.from('candidaturas').select('*')).eq('estado', 'em_espera')),
        ])
        if (vivo) setCasa({ candidaturas, saidas: [] })
      }
      if (aba === 'cuidado' && !cuidado) {
        const [mar30, care30, inc90, avaliacoes, meds] = await Promise.all([
          lista(scope.filter(supabase.from('mar_records').select('status, patient_id, recorded_by_id, date')).gte('date', ha30)),
          lista(scope.filter(supabase.from('care_records').select('patient_id, date, recorded_by_id')).gte('date', ha30)),
          lista(scope.filter(supabase.from('incidents').select('id, type, status, date')).gte('date', ha90)),
          lista(scope.filter(supabase.from('assessments').select('id, scale, date')).gte('date', ha90)),
          lista(scope.filter(supabase.from('patient_meds').select('id, patient_id')).eq('active', true)),
        ])
        if (vivo) setCuidado({ mar30, care30, inc90, avaliacoes, meds })
      }
      if (aba === 'equipa' && !equipa) {
        const [care30, mar30, recados] = await Promise.all([
          lista(scope.filter(supabase.from('care_records').select('patient_id, date, recorded_by_id')).gte('date', ha30)),
          lista(scope.filter(supabase.from('mar_records').select('status, recorded_by_id, date')).gte('date', ha30)),
          // A sessão de quem está a ver, e não a chave de serviço: é a RLS que
          // deixa de fora os recados dirigidos, e tem de continuar a poder.
          lista(scope.filter(supabase.from('team_messages').select('*'))
            .order('created_at', { ascending: false }).limit(30)),
        ])
        if (vivo) setEquipa({ care30, mar30, recados })
      }
      if (aba === 'dinheiro' && !dinheiro) {
        const [mensalidades, financas] = await Promise.all([
          lista(scope.filter(supabase.from('billing_entries').select('*')).eq('month', mesAtual)),
          lista(scope.filter(supabase.from('finance_entries').select('kind, amount, date')).gte('date', mesAtual)),
        ])
        if (vivo) setDinheiro({ mensalidades, financas })
      }
      if (aba === 'conformidade' && !conf) {
        const [planos, documentos, incAbertas, avaliacoes] = await Promise.all([
          lista(scope.filter(supabase.from('planos').select('id, patient_id, estado, rever_em')).eq('estado', 'ativo')),
          lista(scope.filter(supabase.from('documents').select('id, name, patient_id, expiry_date')).not('expiry_date', 'is', null)),
          lista(scope.filter(supabase.from('incidents').select('id, type, date, status')).neq('status', 'closed')),
          lista(scope.filter(supabase.from('assessments').select('id, patient_id, scale, date')).gte('date', ha90)),
        ])
        if (vivo) setConf({ planos, documentos, incAbertas, avaliacoes })
      }
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, base, user, supabase, scope.orgId])

  const nomeDaCasa = nomeCasa || bp.productName.replace(/^(O seu|A sua|a sua)\s+/i, '')
  const pessoas = cfg.personNounPlural

  const vista = useMemo(() => {
    if (!base) return null
    switch (aba) {
      case 'cuidado': return abaCuidado(base, cuidado, nomeDaCasa, dias)
      case 'equipa': return abaEquipa(base, equipa, nomeDaCasa)
      case 'dinheiro': return abaDinheiro(base, dinheiro, nomeDaCasa, mesEmPalavras)
      case 'conformidade': return abaConformidade(base, conf, nomeDaCasa, hoje, pessoas)
      default: return abaCasa(base, casa, nomeDaCasa, pessoas)
    }
  }, [aba, base, casa, cuidado, equipa, dinheiro, conf, nomeDaCasa, pessoas, dias, mesEmPalavras, hoje])

  if (erro) {
    return <Painel><Vazio titulo={erro} oQueFazer="Isto costuma ser a ligação. Os dados estão todos onde estavam." /></Painel>
  }
  if (!vista) {
    return <Painel><ACarregar oQue="A abrir o painel…" /></Painel>
  }

  // Sem moldura de pagina de proposito: quem decide a largura e o fundo e a
  // pagina, que tambem tem de albergar os relatorios por baixo. Duas molduras
  // encaixadas davam duas margens e dois fundos diferentes no mesmo ecra.
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Sem cabeçalho próprio, de propósito: a página já diz «Painel
            administrativo» e o nome da casa mesmo por cima. Repetir os dois
            aqui dava dois títulos iguais empilhados — foi o que o primeiro
            feitio fazia, e via-se logo na primeira captura. As ações da vista
            aberta ficam ao lado dos separadores, que é onde se está a olhar. */}

        {/* ── As cinco vistas ─────────────────────────────────────────────── */}
        <div className="pa-barra" style={{
          display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap',
          borderBottom: '1px solid var(--border)',
        }}>
          <nav className="pa-abas" style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1 }}>
            {ABAS_ADMIN.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                aria-current={aba === a.id ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', height: 36, padding: '0 14px',
                  background: 'none', border: 'none', cursor: 'pointer', marginBottom: -1,
                  ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.08em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                  fontWeight: (aba === a.id ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                  color: aba === a.id ? 'var(--green)' : 'var(--ink-4)',
                  borderBottom: `2px solid ${aba === a.id ? 'var(--green)' : 'transparent'}`,
                }}>{a.label}</button>
            ))}
          </nav>
          <div className="pa-acoes" style={{ display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 7 }}>
            {vista.acoes.map(a => (
              <Link key={a.href + a.label} href={a.href} style={{ textDecoration: 'none' }}>
                <Botao feitio={a.primaria ? 'principal' : 'contorno'}>{a.label.toUpperCase()}</Botao>
              </Link>
            ))}
          </div>
        </div>

        {!!vista.kpis.length && <FaixaKpi kpis={vista.kpis} cor={bp.accent} />}

        {/* Um cartão que não tem título nem nada a dizer NÃO se desenha.
            A primeira versão desenhava-o na mesma e a Conformidade ficava com
            duas caixas em branco por baixo dos números — uma forma bonita
            sobre nada, que é precisamente o que este painel não pode fazer.
            Uma vista que não usa gráfico de linha simplesmente não tem um. */}
        <div className="pn-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 10, alignItems: 'start',
        }}>
          {temAlgoADizer(vista.linha) && <CartaoLinha dados={vista.linha} cor={bp.accent} corSuave={bp.accentSoft} />}
          {temAlgoADizer(vista.barras) && <CartaoBarras dados={vista.barras} cor={bp.accent} />}
          {temAlgoADizer(vista.rosca) && <CartaoRosca dados={vista.rosca} cor={bp.accent} />}
          {temAlgoADizer(vista.tabela) && <CartaoTabela dados={vista.tabela} cor={bp.accent} />}
          {temAlgoADizer(vista.lista) && <CartaoLista dados={vista.lista} span={12} />}
        </div>

        {/* Porque é que há aqui uma coisa que a direção não vê. Dizer isto é
            melhor do que a direção descobrir um dia que havia recados que lhe
            escapavam e ficar a pensar o que mais lhe escapa. */}
        {aba === 'equipa' && (
          <p style={{
            margin: 0, ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
            lineHeight: 1.65, padding: '9px 14px', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          }}>
            Os recados dirigidos a pessoas concretas não aparecem aqui, nem a si.
            Quem os escreve e quem os recebe são os únicos que os leem — é a base
            de dados que o garante, não este ecrã.
          </p>
        )}

        {/* O livro de registos e a linha do tempo continuam onde estavam: são
            uma lista de eventos, não um cartão de painel, e é assim que uma
            inspeção os quer ver. */}
      </div>

      {extra}

      <style>{`
        /* Num telemovel os botoes de acao comiam os separadores: a barra
           tem flex 1 e encolhe em vez de quebrar a linha, por isso «Equipa» e
           «Dinheiro» ficavam escondidos por tras do botao preto. Abaixo dos
           760px cada um leva a sua linha. */
        @media (max-width: 760px) {
          .pa-barra > .pa-abas, .pa-barra > .pa-acoes { width: 100%; flex: none; }
          .pa-barra > .pa-acoes { padding-bottom: 10px; }
        }
        @media (max-width: 1180px) { .pn-grid > .pn-cel { grid-column: span 12 !important; } }
        @media (max-width: 1100px) { .pn-kpis { grid-template-columns: repeat(3,minmax(0,1fr)) !important; } }
        @media (max-width: 680px)  {
          .pn-kpis { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .pn-kpi-nota { align-items: flex-start !important; }
          .pn-kpi-nota > span { white-space: normal !important; overflow: visible !important; line-height: 1.35; }
        }
        @media (max-width: 720px) {
          .pn-tab { grid-template-columns: 1fr auto !important; gap: 6px 12px !important; }
          .pn-tab > :nth-child(2) { grid-column: 1 / -1; }
          .pn-tab > :nth-child(3) { grid-column: 1; }
          .pn-tab > :nth-child(4) { grid-column: 2; }
        }
      `}</style>
    </>
  )
}
