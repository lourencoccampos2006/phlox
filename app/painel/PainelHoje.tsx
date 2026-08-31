'use client'

// PainelHoje — o painel de lares e centros de dia, montado a partir de
// docs/designs/Painel Phlox.html.
//
// ── O QUE ESTA PÁGINA É ───────────────────────────────────────────────────
// Cinco vistas dos MESMOS dados da casa: Hoje, Cuidados, Pessoas, Equipa,
// Gestão. Os separadores no topo NÃO abrem ferramentas — trocam o que o painel
// mostra. As ferramentas vivem na barra lateral (as oito do núcleo) e nas
// pastas ao fundo desta página; um separador que saltasse para /care-log
// deixava de ser um painel e passava a ser um menu com outro nome.
//
// ── A REGRA QUE MANDA AQUI ────────────────────────────────────────────────
// Todos os números saem de registos reais. As contas estão em painelAbas.ts,
// separadas da apresentação para poderem ser lidas sem o ruído do JSX; onde não
// há dados, o bloco diz o que falta em vez de desenhar uma forma bonita sobre
// nada. Um painel destes é onde alguém decide sobre pessoas.
//
// ── CARREGAMENTO ──────────────────────────────────────────────────────────
// O separador "Hoje" carrega de imediato. Os outros quatro só vão à base de
// dados quando são abertos pela primeira vez, e ficam em memória depois disso.
// Puxar tudo de uma vez seriam vinte e tal consultas para mostrar cinco
// números — a maioria delas para separadores que ninguém abriu.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { useOrgName } from '@/lib/useOrgName'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { iconForHref } from '@/lib/clinicalIcons'
import { ptDate, ptGreeting } from '@/lib/ptTime'
import { ultimosDias } from '@/lib/painelDados'
import {
  FaixaKpi, CartaoLinha, CartaoBarras, CartaoRosca, CartaoTabela, CartaoLista, CartaoPastas, type Pasta,
} from './painelPecas'
import {
  ABAS, abaHoje, abaCuidados, abaPessoas, abaEquipa, abaGestao,
  type AbaId, type Base, type CruCuidados, type CruPessoas, type CruEquipa, type CruGestao,
} from './painelAbas'

const ABA_VALIDA = (v: string | null): AbaId =>
  (ABAS.some(a => a.id === v) ? v : 'hoje') as AbaId

export default function PainelHoje() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const nomeCasa = useOrgName()
  const params = useSearchParams()

  const [aba, setAba] = useState<AbaId>('hoje')
  const [pasta, setPasta] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [base, setBase] = useState<Base | null>(null)
  const [cuidados, setCuidados] = useState<CruCuidados | null>(null)
  const [pessoas, setPessoas] = useState<CruPessoas | null>(null)
  const [equipa, setEquipa] = useState<CruEquipa | null>(null)
  const [gestao, setGestao] = useState<CruGestao | null>(null)

  // O separador vem do endereço (?aba=cuidados), para os links da barra de topo
  // poderem apontar para uma vista concreta do painel.
  useEffect(() => { setAba(ABA_VALIDA(params.get('aba'))) }, [params])

  /** Uma consulta que nunca rebenta a página: sem a tabela, devolve lista vazia. */
  const tol = useCallback(async (q: any) => {
    try { const r = await q; return r?.error ? { data: [] } : r } catch { return { data: [] } }
  }, [])

  /* ── Base: o que o separador "Hoje" precisa ────────────────────────────── */
  const carregarBase = useCallback(async () => {
    if (!user) { setCarregando(false); return }
    setCarregando(true); setErro('')
    const d = ptDate()
    const desde7 = ultimosDias(7)[0]
    try {
      const [p, cr, mar, md, att, ac, inc, fam, h1, h2, h3] = await Promise.all([
        scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
        tol(scope.filter(supabase.from('care_records').select('patient_id,created_at,nutrition,shift')).eq('date', d)),
        tol(scope.filter(supabase.from('mar_records').select('patient_id,med_id,status,shift,recorded_at')).eq('date', d)),
        tol(scope.filter(supabase.from('patient_meds').select('id,patient_id,name,shifts,active'))),
        tol(scope.filter(supabase.from('attendance').select('patient_id,status')).eq('date', d)),
        tol(scope.filter(supabase.from('activities').select('id,title,start_time,type')).eq('date', d).order('start_time')),
        tol(scope.filter(supabase.from('incidents').select('id,patient_id,type,severity,date')).eq('status', 'open')),
        tol(scope.filter(supabase.from('family_thread_messages').select('id,patient_id,author_side,created_at')).order('created_at', { ascending: false }).limit(60)),
        tol(scope.filter(supabase.from('mar_records').select('date,status,recorded_at')).gte('date', desde7)),
        tol(scope.filter(supabase.from('care_records').select('date,patient_id')).gte('date', desde7)),
        tol(scope.filter(supabase.from('attendance').select('date,status')).gte('date', desde7)),
      ])
      if ((p as any).error) { setErro('Não foi possível carregar. Verifica a ligação.'); setCarregando(false); return }
      setBase({
        utentes: (p as any).data || [],
        registos: (cr as any).data || [],
        tomas: (mar as any).data || [],
        meds: ((md as any).data || []).filter((x: any) => x.active !== false),
        presencas: (att as any).data || [],
        atividades: (ac as any).data || [],
        ocorrencias: (inc as any).data || [],
        familia: (fam as any).data || [],
        hist: { tomas: (h1 as any).data || [], registos: (h2 as any).data || [], presencas: (h3 as any).data || [] },
      })
    } catch {
      setErro('Não foi possível carregar. Verifica a ligação.')
    }
    setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, tol])

  useEffect(() => { carregarBase() }, [carregarBase])

  /* ── Os outros quatro, só quando abertos ───────────────────────────────── */
  useEffect(() => {
    if (!user || !supabase || !base) return
    let vivo = true
    const hoje = ptDate()
    const d30 = ultimosDias(30)[0]
    const d90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const d14 = ultimosDias(14)[0]
    const d7 = ultimosDias(7)[0]
    const mes = hoje.slice(0, 7)

    ;(async () => {
      if (aba === 'cuidados' && !cuidados) {
        const [mar30, care30, feridas, aval, inc90] = await Promise.all([
          tol(scope.filter(supabase.from('mar_records').select('date,status,shift')).gte('date', d30)),
          tol(scope.filter(supabase.from('care_records').select('date,patient_id,nutrition')).gte('date', d30)),
          tol(scope.filter(supabase.from('wounds').select('id,patient_id,status,stage'))),
          tol(scope.filter(supabase.from('assessments').select('patient_id,scale,date'))),
          tol(scope.filter(supabase.from('incidents').select('id,patient_id,type,severity,date')).gte('date', d90)),
        ])
        if (vivo) setCuidados({
          mar30: (mar30 as any).data || [], care30: (care30 as any).data || [],
          feridas: (feridas as any).data || [], avaliacoes: (aval as any).data || [],
          inc90: (inc90 as any).data || [],
        })
      }

      if (aba === 'pessoas' && !pessoas) {
        const [msgs, visitas] = await Promise.all([
          tol(scope.filter(supabase.from('family_thread_messages').select('id,patient_id,author_side,created_at')).gte('created_at', d30 + 'T00:00:00')),
          tol(scope.filter(supabase.from('visit_requests').select('id,requested_date,requested_time,status')).eq('status', 'pending').order('requested_date')),
        ])
        if (vivo) setPessoas({ msgs: (msgs as any).data || [], visitas: (visitas as any).data || [] })
      }

      if (aba === 'equipa' && !equipa) {
        const fim = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        const [membros, escala, recados, care7] = await Promise.all([
          tol(scope.filter(supabase.from('team_members').select('id,name,role,status'))),
          tol(scope.filter(supabase.from('shift_assignments').select('date,shift,team_member_id')).gte('date', d14).lte('date', fim)),
          tol(scope.filter(supabase.from('team_messages').select('id,body,author_name,priority,created_at,resolved')).order('created_at', { ascending: false }).limit(10)),
          tol(scope.filter(supabase.from('care_records').select('date,shift,patient_id')).gte('date', d7)),
        ])
        if (vivo) setEquipa({
          membros: (membros as any).data || [],
          escala: (escala as any).data || [],
          recados: ((recados as any).data || []).filter((m: any) => !m.resolved),
          care7: (care7 as any).data || [],
        })
      }

      if (aba === 'gestao' && !gestao) {
        const [org, mensalidades, financas, entradas, aval] = await Promise.all([
          scope.orgId
            ? tol(supabase.from('organizations').select('capacity,monthly_fee').eq('id', scope.orgId).limit(1))
            : Promise.resolve({ data: [] }),
          tol(scope.filter(supabase.from('billing_entries').select('month,fee,subsidy,extras,discount,paid'))),
          tol(scope.filter(supabase.from('finance_entries').select('kind,amount,date')).gte('date', mes + '-01')),
          tol(scope.filter(supabase.from('patients').select('created_at')).eq('active', true)),
          tol(scope.filter(supabase.from('assessments').select('id,date')).gte('date', mes + '-01')),
        ])
        if (vivo) setGestao({
          org: ((org as any).data || [])[0] || null,
          mensalidades: (mensalidades as any).data || [],
          financas: (financas as any).data || [],
          entradas: (entradas as any).data || [],
          avalMes: (aval as any).data || [],
        })
      }
    })()

    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, base, user, supabase, scope.orgId, tol])

  /* ── A vista do separador aberto ───────────────────────────────────────── */
  const casa = nomeCasa || bp.productName.replace(/^(O seu|A sua|a sua)\s+/i, '')
  const bruto = String(user?.name || '').split(' ')[0]
  const primeiroNome = /^[\p{L}][\p{L}'’-]{1,}$/u.test(bruto) ? bruto : ''

  // Como se chamam as pessoas desta casa — "Residente" num lar, "Utente" num
  // centro de dia. Vai inteiro para as abas, para a concordância ser feita lá.
  const nomes = useMemo(() => ({ um: cfg.personNoun, muitos: cfg.personNounPlural }), [cfg.personNoun, cfg.personNounPlural])

  const vista = useMemo(() => {
    if (!base) return null
    switch (aba) {
      case 'cuidados': return abaCuidados(base, cuidados, casa)
      case 'pessoas': return abaPessoas(base, pessoas, casa, nomes)
      case 'equipa': return abaEquipa(base, equipa, casa)
      case 'gestao': return abaGestao(base, gestao, casa, nomes)
      default: return abaHoje(base, casa, primeiroNome, ptGreeting(), nomes)
    }
  }, [aba, base, cuidados, pessoas, equipa, gestao, casa, primeiroNome, nomes])

  const pastas: Pasta[] = useMemo(() => (bp.toolFolders || []).map(f => ({
    id: f.id, nome: f.label, hint: f.hint,
    mini: f.tools.slice(0, 4).map(t => iconForHref(t.href)),
    ferramentas: f.tools.map(t => ({ href: t.href, label: t.label, hint: t.hint, icone: iconForHref(t.href) })),
  })), [bp.toolFolders])

  /* ── Estados de partida ────────────────────────────────────────────────── */
  if (carregando) {
    return <div style={{ padding: 'var(--space-14)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar o dia…</div>
  }
  if (!user) {
    return (
      <div style={{ padding: 'var(--space-14)' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 'var(--space-5)' }}>A sessão expirou ou não foi possível confirmá-la.</p>
        <Link href="/login" style={{ color: bp.accent, fontWeight: 700, fontSize: 14 }}>Entrar de novo →</Link>
      </div>
    )
  }
  if (erro || !vista) {
    return (
      <div style={{ padding: 'var(--space-14)' }}>
        <p style={{ color: '#b91c1c', fontSize: 14, marginBottom: 'var(--space-5)' }}>{erro || 'Não foi possível montar o painel.'}</p>
        <button onClick={carregarBase} style={{
          padding: '9px 16px', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)',
          background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        }}>Tentar de novo</button>
      </div>
    )
  }

  /* ── O painel ──────────────────────────────────────────────────────────── */
  return (
    // --accent fica definido aqui e não só no shell: as legendas dos gráficos
    // usam-no, e uma peça não deve depender de um antepassado para saber a sua
    // própria cor.
    <div style={{ padding: '26px clamp(18px,2.6vw,34px) 80px', ['--accent' as any]: bp.accent }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Cabeçalho da vista */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--ink-4)', fontWeight: 500, marginBottom: 11,
            }}>{vista.eyebrow}</div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,34px)', fontWeight: 400, margin: 0,
              letterSpacing: '-0.015em', lineHeight: 1.15, maxWidth: '26ch', textWrap: 'pretty' as any, color: 'var(--ink)',
            }}>{vista.headline}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {vista.acoes.map(a => (
              <Link key={a.href + a.label} href={a.href} style={{
                minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--r-md)',
                padding: a.primaria ? '0 17px' : '0 15px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
                whiteSpace: 'nowrap',
                background: a.primaria ? 'var(--ink)' : 'transparent',
                color: a.primaria ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${a.primaria ? 'var(--ink)' : 'var(--border-2)'}`,
              }}>{a.label}</Link>
            ))}
          </div>
        </div>

        {!!vista.kpis.length && <FaixaKpi kpis={vista.kpis} cor={bp.accent} />}

        {/* A grelha de doze colunas do desenho */}
        <div className="pn-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 16, alignItems: 'start',
        }}>
          <CartaoLinha dados={vista.linha} cor={bp.accent} corSuave={bp.accentSoft} />
          <CartaoBarras dados={vista.barras} cor={bp.accent} />
          <CartaoRosca dados={vista.rosca} cor={bp.accent} />
          <CartaoTabela dados={vista.tabela} cor={bp.accent} />
          {/* No desenho a lista ocupa 4 colunas e as pastas ocupam a linha
              seguinte inteira — o que deixa oito colunas vazias ao lado da
              lista em todos os separadores. Aqui a lista e as pastas partilham
              a mesma linha (4+8): mesma ordem de leitura do desenho, sem o
              buraco. Sem pastas, a lista fica com a linha toda. */}
          <CartaoLista dados={vista.lista} span={pastas.length ? 4 : 12} />
          {!!pastas.length && (
            <CartaoPastas pastas={pastas} aberta={pasta} abrir={setPasta} fechar={() => setPasta(null)} span={8} />
          )}
        </div>
      </div>

      <style>{`
        /* Um clique na linha da tabela abre a ficha — só se muda o fundo. */
        .pn-linha:hover { background: var(--bg-2); }
        .pn-ferr:hover { border-color: var(--ink) !important; }

        /* A grelha do desenho é de doze colunas em ecrã grande. Abaixo de
           1180px os pares (7+5, 4+8) deixam de caber sem espremer os gráficos,
           por isso cada cartão passa a ocupar a linha inteira. */
        @media (max-width: 1180px) {
          .pn-grid > .pn-cel { grid-column: span 12 !important; }
        }
        /* Cinco números lado a lado só cabem em ecrã largo. */
        @media (max-width: 1100px) { .pn-kpis { grid-template-columns: repeat(3,minmax(0,1fr)) !important; } }
        @media (max-width: 680px)  {
          .pn-kpis { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          /* Em coluna estreita a nota não cabe numa linha e ficava cortada a
             meio da palavra ("Sem ocorrências em aber…"). Passa a quebrar. */
          .pn-kpi-nota { align-items: flex-start !important; }
          .pn-kpi-nota > span { white-space: normal !important; overflow: visible !important; line-height: 1.35; }
        }
        /* A tabela colapsa para duas colunas: nome + estado em cima, o resto
           por baixo. Quatro colunas num ecrã de 390px não cabem. */
        @media (max-width: 720px) {
          .pn-tab { grid-template-columns: 1fr auto !important; gap: 6px 12px !important; }
          .pn-tab > :nth-child(2) { grid-column: 1 / -1; }
          .pn-tab > :nth-child(3) { grid-column: 1; }
          .pn-tab > :nth-child(4) { grid-column: 2; }
        }
      `}</style>
    </div>
  )
}
