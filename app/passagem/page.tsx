'use client'

// app/passagem/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A passagem de turno.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Da pesquisa aos programas que as casas já usam. Os três ingleses — Person
// Centred Software, Nourish, Log my Care — têm todos esta peça; nenhum dos
// portugueses a tem. É o que faz a informação atravessar a porta quando a
// equipa muda.
//
// Sem ela, cada turno começa do zero — ou, pior, começa com o que alguém se
// lembrou de dizer no corredor, que parece informado e não é.
//
// ── DUAS METADES, E A DE CIMA É A QUE IMPORTA ──────────────────────────────
// LER o que o turno anterior deixou, e ESCREVER o que este deixa.
//
// A de ler vem primeiro e vem aberta, porque é o primeiro gesto de quem chega
// — e porque um programa que ponha a escrita à frente acaba com passagens
// escritas que ninguém leu.
//
// ── O QUE SE ESCREVE É SÓ O QUE MAIS NINGUÉM SABE ──────────────────────────
// As ocorrências, as recusas de medicação e o que ficou por fazer entram
// sozinhas, calculadas a partir do que já foi registado durante o turno (ver
// lib/passagemDeTurno.ts). Quem sai de oito horas não vai reescrever a queda
// que já registou nas ocorrências.
//
// O que se escreve é o que não está em sítio nenhum: «a Dona Maria passou a
// noite inquieta», «o filho do Sr. António liga amanhã».
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor, type Shift } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate } from '@/lib/ptTime'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { carregarODia } from '@/lib/carregarODia'
import { nomesDe } from '@/lib/perfisVisiveis'
import { Bolha } from '@/components/institution/Responsavel'
import {
  montarPassagem, comNotas, resumoDaPassagem, turnoSeguinte,
  ROTULO_ORIGEM, COR_ORIGEM,
  type Entrada, type Passagem, type NotaDePessoa,
} from '@/lib/passagemDeTurno'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}
const ROTULO_TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

/** O turno ANTERIOR a este, e em que dia caiu. */
function turnoAnterior(turno: string, hoje: string, temNoite: boolean): { turno: string; dia: string } {
  const ontem = () => {
    const d = new Date(hoje + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  if (!temNoite) {
    // Um centro de dia fecha à noite: antes da manhã está a tarde de ONTEM.
    return turno === 'tarde' ? { turno: 'manha', dia: hoje } : { turno: 'tarde', dia: ontem() }
  }
  if (turno === 'tarde') return { turno: 'manha', dia: hoje }
  if (turno === 'noite') return { turno: 'tarde', dia: hoje }
  // A manhã recebe da noite, que começou ONTEM e atravessou a meia-noite.
  return { turno: 'noite', dia: ontem() }
}

export default function PassagemDeTurno() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const cor = bp.accent
  const hoje = ptDate()
  const temNoite = shiftsFor(institution).includes('noite')

  const [turno, setTurno] = useState<Shift>(currentShiftFor(institution))
  const [turnoTocado, setTurnoTocado] = useState(false)
  useEffect(() => { if (!turnoTocado) setTurno(currentShiftFor(institution)) }, [institution, turnoTocado])

  const [minha, setMinha] = useState<Passagem | null>(null)
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [anterior, setAnterior] = useState<Passagem | null>(null)
  const [entradasAnterior, setEntradasAnterior] = useState<Entrada[]>([])
  const [leram, setLeram] = useState<{ id: string; nome: string }[]>([])
  const [euLi, setEuLi] = useState(false)

  const [texto, setTexto] = useState('')
  const [notas, setNotas] = useState<NotaDePessoa[]>([])
  const [pessoas, setPessoas] = useState<{ id: string; name: string }[]>([])

  // A síntese por IA. Nunca entra sozinha no texto: fica como proposta, e só
  // vai para a caixa se a pessoa carregar em «Usar isto». Uma passagem de
  // turno escrita por um modelo e publicada sem ninguém a ler é a última
  // coisa que uma casa precisa.
  const [sintese, setSintese] = useState<string>('')
  const [aPensar, setAPensar] = useState(false)
  const [erroIa, setErroIa] = useState('')

  const [carregando, setCarregando] = useState(true)
  /**
   * Já houve uma leitura a sério?
   *
   * `carregando` não chega: entre o primeiro render e a chegada da casa há um
   * instante em que o utilizador existe mas `scope.orgId` ainda é nulo, e aí
   * `carregando` passa a falso com tudo vazio. O ecrã diz então que o turno
   * anterior não deixou nada — a quem acabou de chegar e precisa de saber se
   * houve uma queda.
   *
   * Apanhado na /casa, onde a mesma estrutura mostrava «A casa está tratada
   * por hoje» antes de a primeira consulta ter respondido.
   */
  const [jaCarregou, setJaCarregou] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState('')
  const [indisponivel, setIndisponivel] = useState(false)

  const anteriorRef = useMemo(() => turnoAnterior(turno, hoje, temNoite), [turno, hoje, temNoite])

  // ── Carregar ──────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    // A mesma guarda do /o-dia: enquanto `pronto` for falso não se sabe se há
    // casa, e desenhar «não há nada» durante esse instante é dizer à pessoa
    // que o turno anterior não deixou nada escrito.
    if (!scope.pronto) return
    if (!user || !scope.orgId) { setCarregando(false); return }
    setCarregando(true)

    const [minhaR, anteriorR, utentesR, diaR] = await Promise.all([
      supabase.from('handovers').select('*')
        .eq('org_id', scope.orgId).eq('date', hoje).eq('shift', turno).maybeSingle(),
      supabase.from('handovers').select('*')
        .eq('org_id', scope.orgId).eq('date', anteriorRef.dia).eq('shift', anteriorRef.turno)
        .eq('completed', true).maybeSingle(),
      supabase.from('patients').select('id, name')
        .eq('org_id', scope.orgId).eq('active', true).order('name'),
      carregarODia(supabase, scope.orgId, turno),
    ])

    // A tabela existe? Se não, isto é uma migração por correr e não uma
    // avaria — e quem está do outro lado não tem de ver o código do Postgres.
    if (minhaR.error && isSetupError(minhaR.error)) {
      setIndisponivel(true); setJaCarregou(true); setCarregando(false)
      return
    }
    setIndisponivel(false)

    const p: Passagem | null = minhaR.error ? null : minhaR.data
    setMinha(p)
    setTexto(p?.general_notes || '')
    setNotas(Array.isArray(p?.patients_summary) ? p!.patients_summary : [])
    setPessoas(utentesR.error ? [] : (utentesR.data || []))

    // O que ficou por fazer sai do MESMO sítio que o /o-dia usa. Uma segunda
    // montagem do dia acabaria por discordar da primeira, e no dia em que
    // discordassem ninguém confiava em nenhuma das duas.
    const naoFeitas = (diaR.tarefas || [])
      .filter(t => !t.feito && !t.naoPrestado && scope.ve(t.area))
      .map(t => ({ chave: t.chave, nome: t.nome, oQue: t.oQue, patientId: t.patientId }))

    setEntradas(comNotas(
      await montarPassagem(supabase, scope.orgId, turno, { hoje, naoFeitas }), p))

    // ── A do turno anterior ────────────────────────────────────────────────
    const ant: Passagem | null = anteriorR.error ? null : anteriorR.data
    setAnterior(ant)
    if (ant?.id) {
      setEntradasAnterior(comNotas(
        await montarPassagem(supabase, scope.orgId, anteriorRef.turno, { hoje: anteriorRef.dia }), ant))

      const lids = await supabase.from('passagem_leituras')
        .select('user_id, nome, lida_em').eq('passagem_id', ant.id)
      const linhas = lids.error ? [] : (lids.data || [])
      setEuLi(linhas.some((l: any) => l.user_id === user.id))

      // Os nomes vêm da vista `perfis_visiveis`, e não da `profiles`: para
      // escrever «Ana» ao lado de um visto não é preciso o email, o NIF nem o
      // identificador do Stripe de ninguém (sprint168).
      const semNome = linhas.filter((l: any) => !l.nome).map((l: any) => l.user_id)
      const mapa = semNome.length ? await nomesDe(supabase, semNome) : new Map()
      setLeram(linhas.map((l: any) => ({
        id: l.user_id, nome: l.nome || mapa.get(l.user_id) || 'Colega',
      })))
    } else {
      setEntradasAnterior([]); setLeram([]); setEuLi(false)
    }

    setJaCarregou(true)
    setCarregando(false)
  }, [user, supabase, scope, hoje, turno, anteriorRef])

  useEffect(() => { carregar() }, [carregar])

  // ── Gravar o rascunho ─────────────────────────────────────────────────────
  async function gravar(fechar: boolean) {
    if (!user || !scope.orgId || gravando) return
    setGravando(true)
    const quem = (user as any)?.name || user?.email || ''

    const corpo = scope.stamp({
      user_id: user.id, date: hoje, shift: turno,
      general_notes: texto.trim() || null,
      patients_summary: notas.filter(n => n.nota?.trim()),
      from_user_id: user.id, autor_nome: quem,
      completed: fechar,
      ...(fechar ? { fechada_em: new Date().toISOString() } : {}),
    })

    // Uma passagem por casa, por dia, por turno — quem chega a meio acrescenta
    // à que existe em vez de abrir uma segunda. Duas passagens do mesmo turno
    // são duas verdades sobre a mesma noite.
    const { error } = await supabase.from('handovers')
      .upsert(corpo, { onConflict: 'org_id,date,shift' })

    if (error) {
      setGravando(false)
      setErro(reportError('passagem-gravar', error, isSetupError(error) ? MSG.unavailable : MSG.save))
      return
    }

    // ── E avisa o mural ────────────────────────────────────────────────────
    // Só ao ENTREGAR, nunca ao guardar um rascunho.
    //
    // ── PORQUE É QUE O RECADO É CURTO ───────────────────────────────────────
    // A tentação é despejar a passagem inteira no mural. Não se faz: o mural é
    // uma conversa, e uma passagem inteira lá dentro rola para cima ao fim de
    // três recados — fica escrita e ilegível. Pior, passa a haver duas cópias
    // da mesma passagem, e no dia em que alguém corrigir uma, a outra fica a
    // mentir.
    //
    // O recado diz que existe e quanto pesa. A passagem vive numa página, onde
    // tem recibo de leitura e onde o que foi corrigido aparece corrigido.
    //
    // O `/api/team-messages` empurra a notificação a toda a gente sozinho, por
    // isso isto também é o que faz o telemóvel da equipa tocar.
    if (fechar) {
      const graves = entradas.filter(e => e.gravidade === 'alta').length
      const linhas = [
        `🔄 Passagem d${turno === 'manha' ? 'a manhã' : turno === 'tarde' ? 'a tarde' : 'a noite'} entregue${quem ? ` por ${quem}` : ''}.`,
        resumoDaPassagem(entradas),
        texto.trim() ? `\n${texto.trim().slice(0, 300)}` : '',
        '\nAbra «Passagem de turno» no menu para a ler toda e marcar que a leu.',
      ].filter(Boolean).join(' ')

      try {
        const { data: sessao } = await supabase.auth.getSession()
        await fetch('/api/team-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessao?.session?.access_token}`,
          },
          body: JSON.stringify({
            body: linhas, channel: 'geral',
            priority: graves ? 'importante' : 'normal',
          }),
        })
      } catch {
        // A passagem JÁ está entregue. Se o recado não saiu, isso não pode
        // desfazer o trabalho de quem acabou o turno nem fazê-lo achar que
        // falhou — a página seguinte mostra-a entregue, que é a verdade.
      }
    }

    setGravando(false)
    setErro('')
    carregar()
  }

  // ── Resumir com IA ────────────────────────────────────────────────────────
  /**
   * Reescreve o que já está registado como «o que mudou e o que é urgente».
   *
   * ── O QUE A IA RECEBE, E O QUE NÃO ──────────────────────────────────────
   * Recebe só o que a equipa JÁ registou — as ocorrências, as recusas, os
   * cuidados não prestados, agrupados por pessoa. Não recebe a ficha de
   * ninguém, nem a medicação, nem o histórico.
   *
   * Não é uma precaução vaga: é o que impede o modelo de escrever uma frase
   * clinicamente plausível sobre alguém a partir de dados que ninguém pôs na
   * passagem. Ele reescreve, não acrescenta.
   *
   * ── E NUNCA PUBLICA SOZINHA ─────────────────────────────────────────────
   * O resultado fica como PROPOSTA, ao lado da caixa. Quem sai do turno lê e
   * decide. Uma passagem escrita por um modelo e entregue sem ninguém a ter
   * lido é pior do que uma passagem em branco — a em branco pelo menos
   * ninguém confunde com informação.
   */
  async function resumirComIa() {
    if (aPensar || !entradas.length) return
    setAPensar(true); setErroIa(''); setSintese('')

    // Agrupado por pessoa, que é a forma que a rota espera.
    const porPessoa = new Map<string, { patient_id: string; patient_name: string; decisions: string[] }>()
    const gerais: string[] = []
    for (const e of entradas) {
      const linha = [e.titulo, e.detalhe].filter(Boolean).join(' — ')
      if (!e.patientId) { gerais.push(`${ROTULO_ORIGEM[e.origem]}: ${linha}`); continue }
      const atual = porPessoa.get(e.patientId)
        || { patient_id: e.patientId, patient_name: e.nome || 'Utente', decisions: [] }
      atual.decisions.push(`${ROTULO_ORIGEM[e.origem]}: ${linha}`)
      porPessoa.set(e.patientId, atual)
    }

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao?.session?.access_token
      const r = await fetch('/api/ward/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shift: turno,
          from_name: (user as any)?.name || user?.email || 'Equipa',
          from_role: 'profissional de saúde',
          general_notes: [texto.trim(), ...gerais].filter(Boolean).join('\n'),
          patients: [...porPessoa.values()].map(p => ({ ...p, open_tasks: 0 })),
        }),
      }).then(x => x.json())

      if (r.error) { setErroIa(r.error); return }
      const linhas = [
        ...(r.patients_summary || []).map((p: any) =>
          `${p.patient_name}: ${p.registado}${p.action_needed ? ` → ${p.action_needed}` : ''}`),
        r.general_notes || '',
      ].filter(Boolean)
      setSintese(linhas.join('\n'))
    } catch {
      // A passagem NUNCA fica por fazer por causa da IA. Diz-se que não saiu, e
      // a caixa de escrever continua lá exactamente como estava.
      setErroIa('A síntese não saiu. Escreva à mão — o que está em cima continua a entrar sozinho.')
    } finally { setAPensar(false) }
  }

  // ── Marcar como lida ──────────────────────────────────────────────────────
  async function marcarLida() {
    if (!user || !anterior?.id || euLi) return
    const quem = (user as any)?.name || user?.email || ''
    // O ecrã responde já — quem marca isto está a vestir a bata.
    setEuLi(true)
    setLeram(l => [...l, { id: user.id, nome: quem || 'Eu' }])

    const { error } = await supabase.from('passagem_leituras').insert(scope.stamp({
      user_id: user.id, passagem_id: anterior.id, nome: quem,
      lida_em: new Date().toISOString(),
    }))
    // Chave única violada = já estava marcada, que é o resultado que se queria.
    if (error && !/duplicate key/i.test(error.message)) {
      setEuLi(false)
      setLeram(l => l.filter(x => x.id !== user.id))
      setErro(reportError('passagem-lida', error, isSetupError(error) ? MSG.unavailable : MSG.save))
    } else setErro('')
  }

  function mudarNota(patientId: string, nome: string, nota: string) {
    setNotas(p => {
      const sem = p.filter(n => n.patient_id !== patientId)
      return nota.trim() ? [...sem, { patient_id: patientId, nome, nota }] : sem
    })
  }

  const fechada = !!minha?.completed
  const turnos = shiftsFor(institution)
  const seguinte = turnoSeguinte(turno, temNoite)

  if (indisponivel) {
    return (
      <div style={{ padding: 'var(--space-14)', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          A passagem de turno ainda não está montada
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Falta um passo de configuração desta casa. Assim que estiver feito, esta página
          passa a juntar sozinha o que aconteceu em cada turno.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 820, margin: '0 auto' }}>

      <header style={{ marginBottom: 'var(--space-9)' }}>
        <span style={{ ...MONO, color: cor }}>Passagem de turno</span>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
          color: 'var(--ink)', letterSpacing: '-0.025em', margin: 'var(--space-4) 0 0', lineHeight: 1.1,
        }}>{ROTULO_TURNO[turno] || turno}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 'var(--space-5) 0 0', lineHeight: 1.55 }}>
          {carregando ? 'A juntar o que aconteceu…' : resumoDaPassagem(entradas)}
        </p>
      </header>

      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 'var(--space-9)' }}>
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

      {/* ══ O QUE O TURNO ANTERIOR DEIXOU ══════════════════════════════════ */}
      {/* Vem primeiro, e vem aberto. É o primeiro gesto de quem chega — e um
          programa que ponha a escrita à frente acaba com passagens escritas
          que ninguém leu. */}
      {anterior && (
        <section style={{
          marginBottom: 'var(--space-11)',
          borderRadius: 'var(--r-xl)',
          border: `1.5px solid ${euLi ? 'var(--border)' : cor}`,
          background: 'var(--bg)', overflow: 'hidden',
        }}>
          <header style={{
            padding: 'var(--space-7) var(--space-8)', borderBottom: '1px solid var(--border)',
            background: euLi ? 'transparent' : 'var(--bg-2)',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <span style={{ ...MONO, fontSize: 9.5, color: euLi ? 'var(--ink-4)' : cor }}>
                Deixado pelo turno da {(ROTULO_TURNO[anteriorRef.turno] || '').toLowerCase()}
              </span>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginTop: 4 }}>
                {anterior.autor_nome || 'Turno anterior'}
              </div>
            </div>
            {!euLi && (
              <button onClick={marcarLida} style={{
                minHeight: 40, padding: '0 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: 'none', background: cor, color: '#fff',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              }}>Li a passagem</button>
            )}
          </header>

          <div style={{ padding: 'var(--space-8)' }}>
            {anterior.general_notes && (
              <p style={{
                fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.65, margin: '0 0 var(--space-7)',
                whiteSpace: 'pre-wrap',
              }}>{anterior.general_notes}</p>
            )}

            {entradasAnterior.length === 0 && !anterior.general_notes ? (
              <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: 0 }}>
                O turno anterior não deixou nada a assinalar.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {entradasAnterior.map(e => <LinhaEntrada key={e.chave} e={e} />)}
              </div>
            )}

            {/* Quem já leu. É o «read receipt» que os programas ingleses
                vendem — e no dia em que alguma coisa correr mal, é a única
                forma de responder a «mas isso estava na passagem?». */}
            {leram.length > 0 && (
              <div style={{
                marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)',
                borderTop: '1px solid var(--bg-3)',
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <span style={{ ...MONO, fontSize: 9.5 }}>Leram</span>
                {leram.map(l => <Bolha key={l.id} id={l.id} nome={l.nome} compacto />)}
                <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>
                  {leram.map(l => l.nome.split(' ')[0]).join(', ')}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══ O QUE ESTE TURNO DEIXA ═════════════════════════════════════════ */}
      <section>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: 'var(--space-7)', paddingBottom: 'var(--space-5)', borderBottom: '1px solid var(--ink)',
        }}>
          <span style={MONO}>Para o turno da {(ROTULO_TURNO[seguinte] || '').toLowerCase()}</span>
          {fechada && (
            <span style={{ ...MONO, color: 'var(--badge-green-fg)' }}>Entregue</span>
          )}
        </div>

        {/* O que entra sozinho. Aparece antes da caixa de escrita de propósito:
            quem vê que a queda já lá está não a reescreve — e percebe que o
            que falta escrever é só o resto. */}
        <div style={{ marginTop: 'var(--space-8)' }}>
          {carregando || !jaCarregou ? (
            <p style={{ fontSize: 13.5, color: 'var(--ink-4)' }}>A carregar…</p>
          ) : entradas.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
              Nada registado neste turno até agora. As ocorrências, as tomas recusadas e o que
              ficar por fazer entram aqui sozinhas — não é preciso escrevê-las.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {entradas.map(e => <LinhaEntrada key={e.chave} e={e} />)}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 'var(--space-6)', lineHeight: 1.5 }}>
                Isto entra sozinho, do que a equipa registou. Se corrigir uma ocorrência ou uma
                toma, a passagem acompanha — não há aqui uma segunda cópia.
              </p>
            </>
          )}
        </div>

        {scope.canEdit && !fechada && (
          <>
            <div style={{ marginTop: 'var(--space-10)' }}>
              <span style={{ ...MONO, display: 'block', marginBottom: 7 }}>
                O que mais ninguém sabe
              </span>
              <textarea
                value={texto} onChange={e => setTexto(e.target.value)}
                rows={4}
                placeholder="O que não está registado em mais lado nenhum. Ex.: a família do Sr. António liga amanhã de manhã; o frigorífico da copa está a fazer barulho."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                  fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6,
                  background: 'var(--bg)', color: 'var(--ink)', resize: 'vertical',
                }} />
            </div>

            {/* A síntese por IA. Fica DEBAIXO da caixa, e não por cima: quem
                abre a página tem de ver primeiro um sítio para escrever, e só
                depois a hipótese de não ter de o fazer. Ao contrário, a
                primeira coisa que a equipa aprende é a carregar no botão. */}
            {entradas.length > 0 && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                {!sintese && (
                  <button onClick={resumirComIa} disabled={aPensar} style={{
                    minHeight: 38, padding: '0 14px', borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border-2)', background: 'transparent',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    color: 'var(--ink-4)', cursor: aPensar ? 'default' : 'pointer',
                    opacity: aPensar ? 0.6 : 1,
                  }}>{aPensar ? 'A resumir…' : 'Resumir o turno com IA'}</button>
                )}

                {erroIa && (
                  <p style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 7, lineHeight: 1.5 }}>{erroIa}</p>
                )}

                {sintese && (
                  <div style={{
                    marginTop: 8, padding: '12px 14px', borderRadius: 'var(--r-md)',
                    border: '1px dashed var(--border-2)', background: 'var(--bg-2)',
                  }}>
                    <span style={{ ...MONO, fontSize: 9.5, display: 'block', marginBottom: 7 }}>
                      Proposta — leia antes de usar
                    </span>
                    <p style={{
                      fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}>{sintese}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
                      <button onClick={() => { setTexto(t => (t.trim() ? t.trim() + '\n\n' : '') + sintese); setSintese('') }}
                        style={{
                          minHeight: 34, padding: '0 12px', borderRadius: 'var(--r-sm)',
                          border: 'none', background: cor, color: '#fff',
                          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        }}>Usar isto</button>
                      <button onClick={() => setSintese('')} style={{
                        minHeight: 34, padding: '0 12px', borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border-2)', background: 'transparent',
                        fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                        color: 'var(--ink-4)', cursor: 'pointer',
                      }}>Deitar fora</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Uma nota por pessoa, e só para quem precisa. Uma lista com
                trinta caixas de texto abertas é uma lista que ninguém enche —
                e as que ficam por encher fazem a passagem parecer por
                acabar. */}
            <NotasPorPessoa
              pessoas={pessoas} notas={notas} cor={cor} aoMudar={mudarNota} />

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 'var(--space-9)' }}>
              <button onClick={() => gravar(false)} disabled={gravando} style={{
                minHeight: 44, padding: '0 18px', borderRadius: 'var(--r-md)',
                border: '1.5px solid var(--border-2)', background: 'transparent',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                color: 'var(--ink-3)', cursor: gravando ? 'default' : 'pointer', opacity: gravando ? 0.6 : 1,
              }}>Guardar rascunho</button>

              <button onClick={() => gravar(true)} disabled={gravando} style={{
                minHeight: 44, padding: '0 20px', borderRadius: 'var(--r-md)',
                border: 'none', background: cor, color: '#fff',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: gravando ? 'default' : 'pointer', opacity: gravando ? 0.6 : 1,
              }}>Entregar ao turno seguinte</button>
            </div>

            <p style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 'var(--space-6)', lineHeight: 1.5 }}>
              Enquanto for rascunho é só seu. Depois de entregue, quem entrar ao turno seguinte
              vê-a e marca que a leu.
            </p>
          </>
        )}

        {fechada && (
          <div style={{
            marginTop: 'var(--space-9)', padding: '13px 15px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55,
          }}>
            Entregue{minha?.autor_nome ? ` por ${minha.autor_nome}` : ''}. O turno da{' '}
            {(ROTULO_TURNO[seguinte] || '').toLowerCase()} vai encontrá-la ao abrir esta página.
          </div>
        )}
      </section>

      <p style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 'var(--space-12)', lineHeight: 1.6 }}>
        O que aparece aqui vem de <Link href="/incidents" style={{ color: cor, fontWeight: 700 }}>Ocorrências</Link>,{' '}
        <Link href="/mar" style={{ color: cor, fontWeight: 700 }}>Medicação</Link>,{' '}
        <Link href="/o-dia" style={{ color: cor, fontWeight: 700 }}>O dia</Link> e do mural.
        Registe lá, e a passagem escreve-se quase sozinha.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function LinhaEntrada({ e }: { e: Entrada }) {
  const cor = COR_ORIGEM[e.origem]
  const conteudo = (
    <>
      <span aria-hidden style={{
        width: 3, alignSelf: 'stretch', flexShrink: 0, borderRadius: 2, background: cor,
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
          {e.titulo}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.45 }}>
          <span style={{ color: cor, fontWeight: 700 }}>{ROTULO_ORIGEM[e.origem]}</span>
          {e.detalhe && <span> · {e.detalhe}</span>}
        </div>
      </div>
      {e.gravidade === 'alta' && (
        <span style={{
          flexShrink: 0, alignSelf: 'center', fontSize: 10, fontWeight: 700,
          padding: '3px 8px', borderRadius: 999,
          background: 'var(--badge-amber-bg)', color: 'var(--badge-amber-fg)',
          border: '1px solid var(--badge-amber-border)',
        }}>atenção</span>
      )}
    </>
  )

  const estilo: React.CSSProperties = {
    display: 'flex', gap: 11, padding: '10px 12px',
    borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
    background: 'var(--bg)', textDecoration: 'none',
  }

  return e.href
    ? <Link href={e.href} style={estilo}>{conteudo}</Link>
    : <div style={estilo}>{conteudo}</div>
}

/** Uma nota sobre uma pessoa em concreto. */
function NotasPorPessoa({ pessoas, notas, cor, aoMudar }: {
  pessoas: { id: string; name: string }[]
  notas: NotaDePessoa[]
  cor: string
  aoMudar: (patientId: string, nome: string, nota: string) => void
}) {
  const [aEscolher, setAEscolher] = useState(false)
  const comNota = new Set(notas.map(n => n.patient_id))
  const disponiveis = pessoas.filter(p => !comNota.has(p.id))

  return (
    <div style={{ marginTop: 'var(--space-9)' }}>
      <span style={{ ...MONO, display: 'block', marginBottom: 7 }}>Sobre alguém em particular</span>

      {notas.length === 0 && !aEscolher && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-5)', lineHeight: 1.55, margin: '0 0 9px' }}>
          Só para quem precisar. A maior parte das noites não precisa de nenhuma.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {notas.map(n => (
          <div key={n.patient_id} style={{
            borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: '10px 12px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 7,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{n.nome}</span>
              <button onClick={() => aoMudar(n.patient_id, n.nome, '')} style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-5)',
                minHeight: 32, padding: '0 6px',
              }}>Tirar</button>
            </div>
            <textarea
              value={n.nota} onChange={e => aoMudar(n.patient_id, n.nome, e.target.value)}
              rows={2}
              placeholder="Ex.: passou a noite inquieta; comeu pouco ao jantar."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 11px',
                borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55,
                background: 'var(--bg)', color: 'var(--ink)', resize: 'vertical',
              }} />
          </div>
        ))}
      </div>

      {aEscolher ? (
        <div style={{
          marginTop: 9, maxHeight: 240, overflowY: 'auto',
          borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 5,
        }}>
          {disponiveis.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-4)' }}>
              Já escreveu sobre toda a gente.
            </div>
          )}
          {disponiveis.map(p => (
            <button key={p.id}
              onClick={() => { aoMudar(p.id, p.name, ' '); setAEscolher(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                minHeight: 38, padding: '0 10px', borderRadius: 'var(--r-sm)',
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
              }}>{p.name}</button>
          ))}
        </div>
      ) : (
        <button onClick={() => setAEscolher(true)} style={{
          marginTop: 9, minHeight: 40, padding: '0 14px', borderRadius: 'var(--r-md)',
          border: `1.5px dashed ${cor}`, background: 'transparent',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: cor, cursor: 'pointer',
        }}>+ Escrever sobre alguém</button>
      )}
    </div>
  )
}
