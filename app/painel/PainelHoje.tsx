'use client'

// PainelHoje — o painel de lares e centros de dia, a partir de
// docs/designs/Painel Phlox.html.
//
// ── A REGRA QUE MANDA AQUI ────────────────────────────────────────────────
// Todos os números desta página saem de registos reais. Onde não há dados, o
// bloco diz que não há — não estima, não arredonda para cima, não preenche.
//
// Isto não é preciosismo. Esta sessão já encontrou duas fabricações neste
// produto: um dossier que dava 100% de adesão à medicação a quem tinha um dia
// registado, e uma passagem de turno que inventava "verificar TA às 22h". Ambas
// nasceram do mesmo instinto — o de que um ecrã com um campo vazio parece
// inacabado. Parece. Mas um número inventado num sítio onde se decide sobre
// pessoas é pior do que um espaço em branco.
//
// Em concreto, e ao contrário do lado pessoal: as doses devidas AQUI são
// calculáveis, porque patient_meds.shifts é text[] ('manha','tarde','noite') e
// não texto livre. É por isso que "41 de 48" pode aparecer no painel de uma
// instituição e não pode aparecer no dossier de uma pessoa.

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor, type ToolFolder } from '@/lib/institutionBlueprint'
import { iconForHref } from '@/lib/clinicalIcons'
import Icon from '@/components/Icon'
import { ptDate } from '@/lib/ptTime'
import { ultimosDias, serieDiaria, curvaDoDia, percentagemDia, mediaDaCasa, type Serie } from '@/lib/painelDados'

/* ── Peças ───────────────────────────────────────────────────────────────── */

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.13em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}

function Cartao({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      padding: 'var(--space-9) var(--space-10)', ...style,
    }}>{children}</div>
  )
}

/** Um número grande com o seu denominador e uma linha de contexto. */
function Numero({ etiqueta, valor, de, nota, alerta, serie, cor }: {
  etiqueta: string; valor: number; de?: number; nota?: string; alerta?: boolean
  serie?: Serie; cor?: string
}) {
  return (
    <div style={{ padding: 'var(--space-8) var(--space-9)', minWidth: 0 }}>
      <div style={{ ...MONO, marginBottom: 'var(--space-3)' }}>{etiqueta}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 34, lineHeight: 1,
          color: alerta ? '#b91c1c' : 'var(--ink)', letterSpacing: '-0.02em',
        }}>{valor}</span>
        {de != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--ink-5)' }}>/{de}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-5)', marginTop: 'var(--space-3)' }}>
        {nota && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.4, minWidth: 0 }}>{nota}</div>}
        {serie && serie.length > 1 && <Faisca serie={serie} cor={cor || 'var(--ink-5)'} />}
      </div>
    </div>
  )
}

/** Anel de progresso. Sem biblioteca: é um círculo com o traço cortado. */
function Anel({ feito, total, cor }: { feito: number; total: number; cor: string }) {
  const r = 46, perimetro = 2 * Math.PI * r
  const fracao = total > 0 ? Math.min(1, feito / total) : 0
  return (
    <svg width={112} height={112} viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="13" />
      <circle cx="56" cy="56" r={r} fill="none" stroke={cor} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${perimetro * fracao} ${perimetro}`}
        transform="rotate(-90 56 56)" />
      <text x="56" y="52" textAnchor="middle" style={{ fontFamily: 'var(--font-serif)', fontSize: 27, fill: 'var(--ink)' }}>{feito}</text>
      <text x="56" y="68" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: 'var(--ink-5)', letterSpacing: '0.1em' }}>DE {total}</text>
    </svg>
  )
}

/** Barras por hora. Alturas relativas ao maior valor real — nunca a um teto inventado. */
function Barras({ dados, cor }: { dados: { hora: string; n: number }[]; cor: string }) {
  const maximo = Math.max(1, ...dados.map(d => d.n))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', height: 132 }}>
      {dados.map(d => (
        <div key={d.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: d.n ? 'var(--ink-3)' : 'var(--ink-5)' }}>{d.n}</span>
          <div style={{
            width: '100%', height: `${Math.max(2, (d.n / maximo) * 96)}px`,
            background: d.n ? cor : 'var(--bg-3)', borderRadius: 3, transition: 'height .3s',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-5)', letterSpacing: '0.06em' }}>{d.hora}</span>
        </div>
      ))}
    </div>
  )
}

/** Sparkline de 7 dias. Sem eixos nem números: serve para dizer "isto tem
 *  andado assim", e o valor exato está no número grande ao lado. */
function Faisca({ serie, cor }: { serie: Serie; cor: string }) {
  if (!serie.length) return null
  const max = Math.max(1, ...serie.map(p => p.valor))
  const L = 74, A = 18
  const pts = serie.map((p, i) => {
    const x = (i / Math.max(1, serie.length - 1)) * L
    const y = A - (p.valor / max) * A
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={L} cy={A - (serie[serie.length - 1].valor / max) * A} r={2.2} fill={cor} />
    </svg>
  )
}

/** A curva do dia, em área. Eixo Y ancorado no total DEVIDO, não no máximo
 *  atingido — assim a forma da curva diz o quanto falta, e não só o quanto se
 *  fez. Uma curva normalizada ao próprio máximo chega sempre ao topo e parece
 *  sempre um dia completo. */
function Area({ pontos, teto, cor }: { pontos: { hora: number; feitas: number }[]; teto: number; cor: string }) {
  const L = 560, A = 128
  const max = Math.max(1, teto)
  const x = (i: number) => (i / Math.max(1, pontos.length - 1)) * L
  const y = (v: number) => A - Math.min(1, v / max) * A
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.feitas).toFixed(1)}`).join(' ')
  const area = `0,${A} ${linha} ${L},${A}`
  return (
    <svg viewBox={`0 0 ${L} ${A + 18}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
      <polygon points={area} fill={cor} opacity={0.10} />
      <polyline points={linha} fill="none" stroke={cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => i % 3 === 0 && (
        <text key={p.hora} x={x(i)} y={A + 14} textAnchor={i === 0 ? 'start' : 'middle'}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--ink-5)' }}>{String(p.hora).padStart(2, '0')}H</text>
      ))}
    </svg>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, padding: 'var(--space-5) 0' }}>{children}</div>
}

/* ── Painel ──────────────────────────────────────────────────────────────── */

const n_dadas = (t: any[]) => t.filter(x => x.status === 'administered' || x.status === 'given' || x.status === 'taken').length
const medsDevidas = (m: any[]) => m.reduce((s, x) => s + (Array.isArray(x.shifts) && x.shifts.length ? x.shifts.length : 1), 0)

type Pendencia = { id: string; nome: string; falta: string; feito: number; total: number; estado: 'prioridade' | 'vigiar' | 'normal' }

export default function PainelHoje() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const cor = bp.accent

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [utentes, setUtentes] = useState<any[]>([])
  const [registos, setRegistos] = useState<any[]>([])
  const [tomas, setTomas] = useState<any[]>([])
  const [meds, setMeds] = useState<any[]>([])
  const [presencas, setPresencas] = useState<any[]>([])
  const [atividades, setAtividades] = useState<any[]>([])
  const [ocorrencias, setOcorrencias] = useState<any[]>([])
  const [familia, setFamilia] = useState<any[]>([])
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)
  // Sete dias de história — para as sparklines e para a comparação do ritmo.
  // São três consultas a mais; valem a pena porque um número sozinho não diz
  // se hoje está bom ou mau, e a alternativa era não mostrar tendência nenhuma
  // (ou, pior, desenhar uma inventada).
  const [hist, setHist] = useState<{ tomas: any[]; registos: any[]; presencas: any[] }>({ tomas: [], registos: [], presencas: [] })

  const carregar = useCallback(async () => {
    // Sem utilizador não há nada para carregar — mas também não se pode ficar
    // a girar. Antes o estado inicial era "a carregar" e esta saída antecipada
    // nunca o desligava: uma sessão que falhasse deixava a página com "A
    // carregar o dia…" para sempre, sem nunca dizer o que se passou.
    if (!user) { setCarregando(false); return }
    setCarregando(true); setErro('')
    const d = ptDate()
    const tolerante = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }
    try {
      const [p, cr, mar, md, att, ac, inc, fam] = await Promise.all([
        scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
        tolerante(scope.filter(supabase.from('care_records').select('patient_id,created_at')).eq('date', d)),
        tolerante(scope.filter(supabase.from('mar_records').select('patient_id,med_id,status,shift,recorded_at')).eq('date', d)),
        tolerante(scope.filter(supabase.from('patient_meds').select('id,patient_id,name,shifts,active'))),
        tolerante(scope.filter(supabase.from('attendance').select('patient_id,status')).eq('date', d)),
        tolerante(scope.filter(supabase.from('activities').select('id,title,start_time,type')).eq('date', d).order('start_time')),
        tolerante(scope.filter(supabase.from('incidents').select('id,patient_id,type,severity')).eq('status', 'open')),
        tolerante(scope.filter(supabase.from('family_thread_messages').select('id,patient_id,author_side,created_at')).eq('author_side', 'family').order('created_at', { ascending: false }).limit(30)),
      ])
      if ((p as any).error) { setErro('Não foi possível carregar. Verifica a ligação.'); setCarregando(false); return }

      const dias = ultimosDias(7)
      const desde = dias[0]
      const [h1, h2, h3] = await Promise.all([
        tolerante(scope.filter(supabase.from('mar_records').select('date,status')).gte('date', desde)),
        tolerante(scope.filter(supabase.from('care_records').select('date,patient_id')).gte('date', desde)),
        tolerante(scope.filter(supabase.from('attendance').select('date,status')).gte('date', desde)),
      ])
      setHist({ tomas: (h1 as any).data || [], registos: (h2 as any).data || [], presencas: (h3 as any).data || [] })
      setUtentes((p as any).data || [])
      setRegistos((cr as any).data || [])
      setTomas((mar as any).data || [])
      setMeds(((md as any).data || []).filter((x: any) => x.active !== false))
      setPresencas((att as any).data || [])
      setAtividades((ac as any).data || [])
      setOcorrencias((inc as any).data || [])
      setFamilia((fam as any).data || [])
    } catch {
      setErro('Não foi possível carregar. Verifica a ligação.')
    }
    setCarregando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { carregar() }, [carregar])

  /* ── Contas. Todas sobre registos reais. ──────────────────────────────── */
  const n = useMemo(() => {
    const total = utentes.length

    // Doses devidas hoje: soma dos turnos de cada medicamento ativo. `shifts` é
    // text[] ('manha','tarde','noite'); a null significa "todos os turnos", que
    // contamos como um — não inventamos três.
    const devidas = meds.reduce((s, m) => s + (Array.isArray(m.shifts) && m.shifts.length ? m.shifts.length : 1), 0)
    const dadas = tomas.filter(t => t.status === 'administered' || t.status === 'given' || t.status === 'taken').length
    const recusadas = tomas.filter(t => t.status === 'refused' || t.status === 'held').length

    const comRegisto = new Set(registos.map(r => r.patient_id)).size
    const presentes = presencas.filter(a => a.status === 'present').length
    const porChegar = presencas.filter(a => a.status === 'expected' || a.status === 'pending').length
    const ausentes = presencas.filter(a => a.status === 'absent').length

    // Famílias à espera: conversas cuja última mensagem é da família.
    const ultimaPorUtente = new Map<string, string>()
    familia.forEach(m => { if (!ultimaPorUtente.has(m.patient_id)) ultimaPorUtente.set(m.patient_id, m.author_side) })
    const familiasEspera = [...ultimaPorUtente.values()].filter(s => s === 'family').length

    return { total, devidas, dadas, recusadas, comRegisto, presentes, porChegar, ausentes, familiasEspera }
  }, [utentes, meds, tomas, registos, presencas, familia])

  // As séries de 7 dias. Uma só linha por métrica — a conta está em
  // lib/painelDados.ts, testável sem montar a página.
  const series = useMemo(() => {
    const dias = ultimosDias(7)
    const dado = (t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken'
    return {
      tomas: serieDiaria(hist.tomas, dias, dado),
      registos: serieDiaria(hist.registos, dias),
      presencas: serieDiaria(hist.presencas, dias, (a: any) => a.status === 'present'),
    }
  }, [hist])

  // O ritmo do dia: quantas tomas estavam dadas a cada hora, e como isso se
  // compara com o que a casa costuma ter feito à mesma hora.
  const ritmo = useMemo(() => {
    const agora = new Date()
    const curva = curvaDoDia(tomas.filter((t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken'), agora.getHours())
    const pct = percentagemDia(n_dadas(tomas), medsDevidas(meds))
    const porDia: Record<string, number> = {}
    hist.tomas.forEach((t: any) => {
      if (t.status !== 'administered' && t.status !== 'given' && t.status !== 'taken') return
      porDia[t.date] = (porDia[t.date] || 0) + 1
    })
    return { curva, pct, media: mediaDaCasa(porDia, ptDate()) }
  }, [tomas, meds, hist])

  // Tomas por hora, a partir do recorded_at real. Só as horas em que a casa
  // trabalha — mostrar as 24 encheria o gráfico de zeros.
  const porHora = useMemo(() => {
    const balde: Record<string, number> = { '08H': 0, '10H': 0, '12H': 0, '14H': 0, '16H': 0, '18H': 0 }
    tomas.forEach(t => {
      if (!t.recorded_at) return
      const h = new Date(t.recorded_at).getHours()
      const chave = h < 9 ? '08H' : h < 11 ? '10H' : h < 13 ? '12H' : h < 15 ? '14H' : h < 17 ? '16H' : '18H'
      if (chave in balde) balde[chave]++
    })
    return Object.entries(balde).map(([hora, n]) => ({ hora, n }))
  }, [tomas])

  // Por fazer, por utente: quantas das suas doses faltam e se tem registo do dia.
  const pendencias = useMemo<Pendencia[]>(() => {
    const medsPorUtente = new Map<string, any[]>()
    meds.forEach(m => { const a = medsPorUtente.get(m.patient_id) || []; a.push(m); medsPorUtente.set(m.patient_id, a) })
    const dadasPorUtente = new Map<string, number>()
    tomas.filter(t => t.status === 'administered' || t.status === 'given' || t.status === 'taken')
      .forEach(t => dadasPorUtente.set(t.patient_id, (dadasPorUtente.get(t.patient_id) || 0) + 1))
    const comOcorrencia = new Set(ocorrencias.map(o => o.patient_id))
    const comRegisto = new Set(registos.map(r => r.patient_id))

    return utentes.map(u => {
      const seus = medsPorUtente.get(u.id) || []
      const total = seus.reduce((s, m) => s + (Array.isArray(m.shifts) && m.shifts.length ? m.shifts.length : 1), 0)
      const feito = Math.min(total, dadasPorUtente.get(u.id) || 0)
      const semRegisto = !comRegisto.has(u.id)
      const faltamDoses = total - feito
      const partes: string[] = []
      if (faltamDoses > 0) partes.push(seus.slice(0, 2).map(m => m.name).join(' · ') || `${faltamDoses} tomas`)
      if (semRegisto) partes.push('registo do dia por fazer')
      return {
        id: u.id, nome: u.name,
        falta: partes.join(' · ') || 'Nada em falta',
        feito, total,
        estado: comOcorrencia.has(u.id) ? 'prioridade' : faltamDoses > 0 ? 'vigiar' : 'normal',
      } as Pendencia
    })
      .filter(p => p.falta !== 'Nada em falta')
      .sort((a, b) => (a.estado === 'prioridade' ? -1 : b.estado === 'prioridade' ? 1 : (b.total - b.feito) - (a.total - a.feito)))
      .slice(0, 8)
  }, [utentes, meds, tomas, registos, ocorrencias])

  // O `name` da conta é muitas vezes o prefixo do email. Tratar por
  // "qa1781881827891" é pior do que não tratar por nada, por isso só usamos o
  // nome quando parece mesmo um nome: letras, e sem os dígitos longos que
  // denunciam um identificador.
  const bruto = String(user?.name || '').split(' ')[0]
  const primeiroNome = /^[\p{L}][\p{L}'’-]{1,}$/u.test(bruto) ? bruto : ''
  const faltamTomas = Math.max(0, n.devidas - n.dadas)
  const faltamRegistos = Math.max(0, n.total - n.comRegisto)

  if (carregando) {
    return <div style={{ padding: 'var(--space-14)', color: 'var(--ink-4)', fontSize: 14 }}>A carregar o dia…</div>
  }
  if (!user) {
    return (
      <div style={{ padding: 'var(--space-14)' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 'var(--space-5)' }}>
          A sessão expirou ou não foi possível confirmá-la.
        </p>
        <Link href="/login" style={{ color: cor, fontWeight: 700, fontSize: 14 }}>Entrar de novo →</Link>
      </div>
    )
  }
  if (erro) {
    return (
      <div style={{ padding: 'var(--space-14)' }}>
        <p style={{ color: '#b91c1c', fontSize: 14, marginBottom: 'var(--space-5)' }}>{erro}</p>
        <button onClick={carregar} style={{ padding: '9px 16px', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Tentar de novo</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', display: 'flex', flexDirection: 'column', gap: 'var(--space-11)' }}>

      {/* Cabeçalho */}
      <div>
        <div style={{ ...MONO, marginBottom: 'var(--space-5)' }}>
          Painel · {bp.productName.replace('O seu ', '').replace('A sua ', '')} · {n.total} {(n.total === 1 ? cfg.personNoun : cfg.personNounPlural).toLowerCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 500,
            color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1.14, margin: 0, maxWidth: '22ch',
          }}>
            {/* A frase muda com o que falta mesmo. Sem nada a fazer, diz isso. */}
            {faltamTomas === 0 && faltamRegistos === 0
              ? <>Está tudo em dia{primeiroNome ? `, ${primeiroNome}` : ''}.</>
              : <>{bp.greetingLead(primeiroNome)}{' '}
                  {/* O verbo concorda com o conjunto: duas coisas em falta,
                      mesmo que sejam uma e uma, pedem plural ("Faltam 1 toma e
                      1 registo"); uma só coisa pede singular ("Falta 1 toma").
                      Estava "Faltam" fixo e dava a concordância errada no caso
                      mais comum, que é faltar só uma. */}
                  {(faltamTomas > 0 && faltamRegistos > 0) || faltamTomas > 1 || faltamRegistos > 1 ? 'Faltam' : 'Falta'}{' '}
                  {faltamTomas > 0 && <>{faltamTomas} {faltamTomas === 1 ? 'toma' : 'tomas'}</>}
                  {faltamTomas > 0 && faltamRegistos > 0 && ' e '}
                  {faltamRegistos > 0 && <>{faltamRegistos} {faltamRegistos === 1 ? 'registo' : 'registos'} do dia</>}.
                </>}
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexShrink: 0 }}>
            <Link href="/ronda-guiada" style={{
              padding: '11px 18px', background: 'var(--bg)', color: 'var(--ink-2)',
              border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)',
              fontSize: 13.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
            }}>Abrir ronda</Link>
            <Link href="/mar" style={{
              padding: '11px 20px', background: 'var(--ink)', color: 'white', borderRadius: 'var(--r-md)',
              fontSize: 13.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
            }}>Dar medicação</Link>
          </div>
        </div>
      </div>

      {/* Os cinco números */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden',
      }}>
        <Numero etiqueta="Presentes" valor={n.presentes} de={n.total} serie={series.presencas} cor={cor}
          nota={n.porChegar ? `${n.porChegar} por chegar` : presencas.length ? 'Todas as chegadas marcadas' : 'Presenças por marcar'} />
        <Numero etiqueta="Tomas dadas" valor={n.dadas} de={n.devidas} serie={series.tomas} cor={cor}
          nota={faltamTomas ? `${faltamTomas} por dar` : n.devidas ? 'Nada em falta' : 'Sem medicação prescrita'} />
        <Numero etiqueta="Registos do dia" valor={n.comRegisto} de={n.total} serie={series.registos} cor={cor}
          nota={faltamRegistos ? `${faltamRegistos} por fazer` : 'Todos feitos'} />
        <Numero etiqueta="A vigiar" valor={ocorrencias.length} alerta={ocorrencias.length > 0}
          nota={ocorrencias.length ? 'Ocorrências em aberto' : 'Sem ocorrências em aberto'} />
        <Numero etiqueta="Famílias" valor={n.familiasEspera} alerta={n.familiasEspera > 0}
          nota={n.familiasEspera ? 'À espera de resposta' : 'Sem mensagens por responder'} />
      </div>

      {/* Ritmo do dia */}
      <Cartao>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-8)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
          <span style={MONO}>Ritmo do dia · tomas dadas</span>
          {ritmo.media != null && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
              a casa costuma dar {ritmo.media} por dia
            </span>
          )}
        </div>
        {!ritmo.curva ? (
          <Vazio>Ainda não há tomas com hora registada hoje. A curva desenha-se à medida que a equipa marca.</Vazio>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-6)', marginBottom: 'var(--space-7)' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1, color: cor, letterSpacing: '-0.03em' }}>
                {ritmo.pct != null ? `${ritmo.pct}%` : '—'}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>
                {ritmo.pct != null ? 'das tomas do dia já dadas' : 'sem medicação prescrita para hoje'}
              </span>
            </div>
            <Area pontos={ritmo.curva} teto={n.devidas} cor={cor} />
          </>
        )}
      </Cartao>

      {/* Presenças + tomas por hora */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) minmax(320px,1.6fr)', gap: 'var(--space-10)' }} className="ph-2col">
        <Cartao>
          <div style={{ ...MONO, marginBottom: 'var(--space-8)' }}>Presenças</div>
          {presencas.length === 0 ? (
            <Vazio>Ainda ninguém marcou presenças hoje. <Link href="/care-log" style={{ color: cor, fontWeight: 700 }}>Marcar →</Link></Vazio>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)' }}>
              <Anel feito={n.presentes} total={n.total} cor={cor} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0, flex: 1 }}>
                {[['Presentes', n.presentes, cor], ['Por chegar', n.porChegar, 'var(--bg-4)'], ['Ausentes', n.ausentes, 'var(--bg-3)']].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-5)', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', color: 'var(--ink-3)' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: c as string, flexShrink: 0 }} />{l as string}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{v as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Cartao>

        <Cartao>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-8)' }}>
            <span style={MONO}>Tomas por hora</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>hoje</span>
          </div>
          {n.dadas === 0 ? (
            <Vazio>Sem tomas registadas hoje. O gráfico enche-se à medida que a equipa marca.</Vazio>
          ) : <Barras dados={porHora} cor={cor} />}
        </Cartao>
      </div>

      {/* Por fazer */}
      <Cartao style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--space-9) var(--space-10)', borderBottom: '1px solid var(--border)' }}>
          <span style={MONO}>Por fazer</span>
          <span style={{ ...MONO, letterSpacing: '0.09em' }}>{pendencias.length ? 'ocorrências primeiro' : ''}</span>
        </div>
        {pendencias.length === 0 ? (
          <div style={{ padding: 'var(--space-10)' }}>
            <Vazio>Nada por fazer. Todas as tomas dadas e todos os registos do dia feitos.</Vazio>
          </div>
        ) : pendencias.map(p => (
          <Link key={p.id} href={`/patients/${p.id}`} style={{
            display: 'grid', alignItems: 'center', gap: 'var(--space-5) var(--space-8)',
            padding: 'var(--space-7) var(--space-10)', borderBottom: '1px solid var(--bg-2)',
            textDecoration: 'none', color: 'inherit',
          }} className="ph-linha">
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 14, color: 'var(--ink)', fontWeight: 600, minWidth: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: p.estado === 'prioridade' ? '#b91c1c' : p.estado === 'vigiar' ? '#d97706' : 'var(--bg-4)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.falta}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${p.total ? (p.feito / p.total) * 100 : 0}%`, background: cor }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-4)' }}>{p.feito}/{p.total}</span>
            </span>
            <span style={{ ...MONO, fontSize: 9.5, textAlign: 'right', color: p.estado === 'prioridade' ? '#b91c1c' : p.estado === 'vigiar' ? '#92400e' : 'var(--ink-5)' }}>
              {p.estado === 'prioridade' ? 'prioridade' : p.estado === 'vigiar' ? 'vigiar' : ''}
            </span>
          </Link>
        ))}
      </Cartao>

      {/* A seguir */}
      <Cartao>
        <div style={{ ...MONO, marginBottom: 'var(--space-8)' }}>A seguir</div>
        {atividades.length === 0 ? (
          <Vazio>Sem atividades marcadas para hoje. <Link href="/activities" style={{ color: cor, fontWeight: 700 }}>Marcar uma →</Link></Vazio>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {atividades.slice(0, 4).map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-8)',
                padding: 'var(--space-6) 0', borderTop: i ? '1px solid var(--bg-2)' : 'none',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>
                    {a.title}{a.start_time ? ` às ${String(a.start_time).slice(0, 5)}` : ''}
                  </div>
                </div>
                <Link href="/activities" style={{
                  padding: '7px 15px', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)',
                  fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', textDecoration: 'none', flexShrink: 0,
                }}>Abrir</Link>
              </div>
            ))}
          </div>
        )}
      </Cartao>

      {/* As pastas de ferramentas — o que era o menu de 24 entradas */}
      {!!bp.toolFolders?.length && (
        <div id="ferramentas">
          <div style={{ ...MONO, marginBottom: 'var(--space-7)' }}>
            Ferramentas · {bp.toolFolders.length} pastas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 'var(--space-6)' }}>
            {bp.toolFolders.map((f: ToolFolder) => {
              const aberta = pastaAberta === f.id
              return (
                <div key={f.id} style={{
                  background: 'var(--bg)', border: `1px solid ${aberta ? cor + '55' : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)', overflow: 'hidden',
                }}>
                  <button onClick={() => setPastaAberta(aberta ? null : f.id)} style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                    padding: 'var(--space-8) var(--space-9)', fontFamily: 'inherit',
                  }}>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 'var(--space-6)' }}>
                      {f.tools.slice(0, 3).map(t => (
                        <span key={t.href} style={{
                          width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'var(--bg-2)',
                          display: 'grid', placeItems: 'center',
                        }}><Icon name={iconForHref(t.href)} size={14} color="var(--ink-4)" /></span>
                      ))}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{f.label}</div>
                    <div style={{ ...MONO, fontSize: 9.5 }}>{f.tools.length} ferramentas</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 'var(--space-4)', lineHeight: 1.5 }}>{f.hint}</div>
                  </button>
                  {aberta && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-4)' }}>
                      {f.tools.map(t => (
                        <Link key={t.href} href={t.href} title={t.hint} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-5)',
                          padding: 'var(--space-5)', borderRadius: 'var(--r-md)', textDecoration: 'none',
                          color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600,
                        }}>
                          <Icon name={iconForHref(t.href)} size={17} color="var(--ink-4)" />
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        .ph-linha:hover { background: var(--bg-2); }
        /* Quatro colunas em ecrã largo; duas linhas no telemóvel. As larguras
           mínimas fixas somavam 466px e faziam a página andar para o lado num
           ecrã de 390. */
        .ph-linha { grid-template-columns: minmax(120px,1.2fr) minmax(140px,2fr) 110px 96px; }
        @media (max-width: 760px) {
          .ph-linha { grid-template-columns: 1fr auto; }
          .ph-linha > :nth-child(2) { grid-column: 1 / -1; white-space: normal !important; }
          .ph-linha > :nth-child(3) { grid-column: 1; }
          .ph-linha > :nth-child(4) { grid-column: 2; }
        }
        @media (max-width: 900px) { .ph-2col { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
