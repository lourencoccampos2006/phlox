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
  ROTULO_ORIGEM, CODIGO_ORIGEM,
  type Entrada, type Passagem, type NotaDePessoa,
} from '@/lib/passagemDeTurno'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo, Bandeira,
  Botao, Seletor, Vazio, ACarregar, Aviso, Grupo, CAIXA, CAIXA_TEXTO,
  MONO as MONO_MESA, ROTULO, useLargo,
} from '@/components/ui/mesa'

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

  const largo = useLargo()
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
      <Mesa>
        <Painel>
          <Vazio titulo="A passagem de turno ainda não está montada."
            oQueFazer="Falta um passo de configuração desta casa. Assim que estiver feito, esta página passa a juntar sozinha o que aconteceu em cada turno." />
        </Painel>
      </Mesa>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Era uma coluna de 820px com a leitura em cima e a escrita em baixo. Isso
     obriga a escolher: ou se vê o que o turno anterior deixou, ou se vê o que
     se está a escrever. Nunca os dois — e é exactamente para responder ao
     primeiro que se escreve o segundo.

     Passa a duas colunas, que é o gesto da passagem:

       ESQUERDA   o que ficou   — ler, e marcar que se leu
       DIREITA    o que fica    — o que entra sozinho, e o que falta escrever

     No telemóvel voltam a empilhar, porque não há outra maneira; a de ler
     continua em primeiro, que é o primeiro gesto de quem chega.
     ══════════════════════════════════════════════════════════════════════════ */
  const porLer = !!anterior && !euLi
  const aCarregar = carregando || !jaCarregou

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{ ...MONO_MESA, color: 'var(--green)' }}>Passagem</span>

          <Seletor
            opcoes={turnos.map(t => ({ id: t, rotulo: ROTULO_TURNO[t] || t }))}
            ativa={turno}
            aoMudar={t => { setTurnoTocado(true); setTurno(t as Shift) }} />

          <span style={{ ...MONO_MESA, color: 'var(--ink-4)' }}>
            {hoje.slice(8, 10)}/{hoje.slice(5, 7)}
          </span>

          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {aCarregar ? 'A juntar o que aconteceu…' : resumoDaPassagem(entradas)}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {fechada ? (
              <Codigo texto="ENTREGUE" cor="var(--green)" />
            ) : scope.canEdit ? (
              <>
                <Botao onClick={() => gravar(false)} esperando={gravando}>GUARDAR RASCUNHO</Botao>
                <Botao feitio="principal" onClick={() => gravar(true)} esperando={gravando}>
                  ENTREGAR À {(ROTULO_TURNO[seguinte] || '').toUpperCase()}
                </Botao>
              </>
            ) : null}
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO_MESA}>O código diz de onde veio a entrada</span>
          <span style={{ ...MONO_MESA, color: 'var(--amber)' }}>ATENÇÃO = o turno seguinte tem de saber</span>
          <span style={{ ...MONO_MESA, color: 'var(--ink-5)' }}>
            Entra sozinho de Ocorrências, Medicação, O dia e do mural
          </span>
          {porLer && (
            <span style={{ ...MONO_MESA, color: 'var(--red)', marginLeft: 'auto' }}>
              AINDA NÃO MARCOU QUE LEU
            </span>
          )}
        </BarraDeEstado>
      }
    >
      {erro && <Aviso tom="mau">{erro}</Aviso>}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(360px, 1fr) minmax(400px, 1fr)' : '1fr',
      }}>
        {/* ══ O QUE FICOU ═══════════════════════════════════════════════════
            Primeiro, e sempre visível. Um programa que ponha a escrita à
            frente acaba com passagens escritas que ninguém leu. */}
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>
                Deixado pelo turno da {(ROTULO_TURNO[anteriorRef.turno] || '').toLowerCase()}
                {anteriorRef.dia !== hoje ? ' · ontem' : ''}
              </span>
              {anterior?.autor_nome && (
                <span style={{ ...MONO_MESA, color: 'var(--ink-4)' }}>{anterior.autor_nome}</span>
              )}
              {porLer && <Codigo texto="POR LER" cor="var(--red)" />}
            </Cabecalho>
          }
          rodape={
            anterior ? (
              <>
                {leram.length > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={MONO_MESA}>Leram {leram.length}</span>
                    {leram.slice(0, 6).map(l => <Bolha key={l.id} id={l.id} nome={l.nome} compacto />)}
                    <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                      {leram.map(l => l.nome.split(' ')[0]).join(', ')}
                    </span>
                  </span>
                ) : (
                  <span style={MONO_MESA}>Ninguém marcou que leu</span>
                )}
                {!euLi && (
                  <span style={{ marginLeft: 'auto' }}>
                    <Botao feitio="principal" onClick={marcarLida}>LI A PASSAGEM</Botao>
                  </span>
                )}
              </>
            ) : null
          }
        >
          {aCarregar ? (
            <ACarregar oQue="A ler a passagem anterior…" />
          ) : !anterior ? (
            <Vazio titulo={`O turno da ${(ROTULO_TURNO[anteriorRef.turno] || '').toLowerCase()} não entregou passagem.`}
              oQueFazer="Pode ter sido um turno sem nada a assinalar, ou pode não ter sido escrita. O que foi registado continua em Ocorrências e na Medicação." />
          ) : (
            <>
              {anterior.general_notes && (
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-2)',
                }}>
                  <div style={{ ...ROTULO, marginBottom: 5 }}>O que mais ninguém sabia</div>
                  <p style={{
                    fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.6,
                    margin: 0, whiteSpace: 'pre-wrap',
                  }}>{anterior.general_notes}</p>
                </div>
              )}
              {entradasAnterior.length === 0 && !anterior.general_notes ? (
                <Vazio titulo="O turno anterior não deixou nada a assinalar." />
              ) : (
                entradasAnterior.map(e => <LinhaEntrada key={e.chave} e={e} />)
              )}
            </>
          )}
        </Painel>

        {/* ══ O QUE FICA ════════════════════════════════════════════════════ */}
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, flex: 1 }}>
                Para o turno da {(ROTULO_TURNO[seguinte] || '').toLowerCase()}
              </span>
              <span style={{ ...MONO_MESA, color: 'var(--ink-4)' }}>
                {entradas.length} AUTOMÁTICA{entradas.length === 1 ? '' : 'S'}
              </span>
              {notas.length > 0 && <Codigo texto={`${notas.length} NOTA${notas.length === 1 ? '' : 'S'}`} />}
            </Cabecalho>
          }
        >
          {/* O que entra sozinho vem ANTES da caixa de escrita, de propósito:
              quem vê que a queda já lá está não a reescreve — e percebe que o
              que falta escrever é só o resto. */}
          {aCarregar ? (
            <ACarregar oQue="A juntar o turno…" />
          ) : entradas.length === 0 ? (
            <Vazio titulo="Nada registado neste turno até agora."
              oQueFazer="As ocorrências, as tomas recusadas e o que ficar por fazer entram aqui sozinhas — não é preciso escrevê-las." />
          ) : (
            entradas.map(e => <LinhaEntrada key={e.chave} e={e} />)
          )}

          {scope.canEdit && !fechada && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-2)' }}>
              <label htmlFor="passagem-texto" style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>
                O que mais ninguém sabe
              </label>
              <textarea id="passagem-texto"
                value={texto} onChange={e => setTexto(e.target.value)} rows={4}
                placeholder="O que não está registado em mais lado nenhum. Ex.: a família de um dos residentes liga amanhã de manhã; o frigorífico da copa está a fazer barulho."
                style={{ ...CAIXA_TEXTO, width: '100%' }} />

              {/* A síntese por IA fica DEBAIXO da caixa, e não por cima: quem
                  abre a página tem de ver primeiro um sítio para escrever, e
                  só depois a hipótese de não ter de o fazer. */}
              {entradas.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {!sintese && (
                    <Botao onClick={resumirComIa} esperando={aPensar}>
                      {aPensar ? 'A RESUMIR…' : 'RESUMIR O TURNO COM IA'}
                    </Botao>
                  )}
                  {erroIa && (
                    <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 6, lineHeight: 1.5 }}>{erroIa}</p>
                  )}
                  {sintese && (
                    <div style={{
                      marginTop: 8, padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      border: '1px dashed var(--border-2)', background: 'var(--bg-2)',
                    }}>
                      <div style={{ ...ROTULO, marginBottom: 5 }}>Proposta — leia antes de usar</div>
                      <p style={{
                        fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.6,
                        margin: 0, whiteSpace: 'pre-wrap',
                      }}>{sintese}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                        <Botao feitio="principal"
                          onClick={() => { setTexto(t => (t.trim() ? t.trim() + '\n\n' : '') + sintese); setSintese('') }}>
                          USAR ISTO
                        </Botao>
                        <Botao onClick={() => setSintese('')}>DEITAR FORA</Botao>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Uma nota por pessoa, e só para quem precisa. Uma lista com
                  trinta caixas abertas é uma lista que ninguém enche. */}
              <NotasPorPessoa pessoas={pessoas} notas={notas} aoMudar={mudarNota} />

              <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 10, lineHeight: 1.5 }}>
                Enquanto for rascunho é só seu. Depois de entregue, quem entrar ao turno
                seguinte vê-a e marca que a leu.
              </p>
            </div>
          )}

          {fechada && (
            <div style={{
              padding: '12px 14px', borderTop: '1px solid var(--border-2)',
              fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55,
            }}>
              Entregue{minha?.autor_nome ? ` por ${minha.autor_nome}` : ''}. O turno
              da {(ROTULO_TURNO[seguinte] || '').toLowerCase()} vai encontrá-la ao abrir esta página.
            </div>
          )}
        </Painel>
      </div>
    </Mesa>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/* UMA ENTRADA DA PASSAGEM
   Era um cartão com borda, raio e uma barra de cor à esquerda — e a cor saía
   de `COR_ORIGEM`, seis tons surdos, um por tipo. Seis cores que ninguém
   decora, e nenhuma delas é uma das três com significado: o olho lê-as como
   estado e engana-se.

   Passa a uma linha de tabela com um CÓDIGO em mono. Quatro letras lêem-se;
   um tom de castanho-avermelhado adivinha-se. */
function LinhaEntrada({ e }: { e: Entrada }) {
  const conteudo = (
    <>
      <span style={{ width: 54, flexShrink: 0 }}>
        <Codigo texto={CODIGO_ORIGEM[e.origem]} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
          color: 'var(--ink)', lineHeight: 1.35,
        }}>{e.titulo}</span>
        <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2 }}>
          {ROTULO_ORIGEM[e.origem]}{e.detalhe ? ` · ${e.detalhe}` : ''}
        </span>
      </span>
      {e.gravidade === 'alta' && <Bandeira texto="ATENÇÃO" tom="atencao" />}
    </>
  )

  const estilo: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    borderBottom: '1px solid var(--border)', textDecoration: 'none',
    color: 'var(--ink)',
  }

  return e.href
    ? <Link href={e.href} style={estilo}>{conteudo}</Link>
    : <div style={estilo}>{conteudo}</div>
}

/* UMA NOTA SOBRE ALGUEM EM PARTICULAR
   Eram cartoes com borda e raio; passam a linhas com um filete, como tudo o
   resto. E a lista de quem acrescentar passa a ter pesquisa: num lar de
   sessenta pessoas, rolar sessenta botoes para achar um nome e pior do que
   escrever tres letras. */
function NotasPorPessoa({ pessoas, notas, aoMudar }: {
  pessoas: { id: string; name: string }[]
  notas: NotaDePessoa[]
  aoMudar: (patientId: string, nome: string, nota: string) => void
}) {
  const [aEscolher, setAEscolher] = useState(false)
  const [procura, setProcura] = useState('')
  const comNota = new Set(notas.map(n => n.patient_id))
  const disponiveis = pessoas
    .filter(p => !comNota.has(p.id))
    .filter(p => !procura.trim() || p.name.toLowerCase().includes(procura.trim().toLowerCase()))

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...ROTULO, marginBottom: 6 }}>Sobre alguém em particular</div>

      {notas.length === 0 && !aEscolher && (
        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.55, margin: '0 0 8px' }}>
          Só para quem precisar. A maior parte dos turnos não precisa de nenhuma.
        </p>
      )}

      {notas.map(n => (
        <div key={n.patient_id} style={{
          borderTop: '1px solid var(--border)', padding: '8px 0',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 10, marginBottom: 5,
          }}>
            <span style={{
              fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)',
            }}>{n.nome}</span>
            <Botao feitio="calmo" onClick={() => aoMudar(n.patient_id, n.nome, '')}>TIRAR</Botao>
          </div>
          <textarea
            value={n.nota} onChange={e => aoMudar(n.patient_id, n.nome, e.target.value)}
            rows={2} aria-label={`Nota sobre ${n.nome}`}
            placeholder="Ex.: passou a noite inquieta; comeu pouco ao jantar."
            style={{ ...CAIXA_TEXTO, width: '100%' }} />
        </div>
      ))}

      {aEscolher ? (
        <div style={{
          marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input value={procura} onChange={e => setProcura(e.target.value)} autoFocus
              placeholder="Procurar pelo nome…" aria-label="Procurar a pessoa"
              style={{ ...CAIXA, width: '100%' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {disponiveis.length === 0 && (
              <div style={{ padding: '9px 11px', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {procura.trim() ? 'Ninguém com esse nome.' : 'Já escreveu sobre toda a gente.'}
              </div>
            )}
            {disponiveis.map(p => (
              <button key={p.id} type="button" className="mesa-botao"
                onClick={() => { aoMudar(p.id, p.name, ' '); setAEscolher(false); setProcura('') }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '0 11px',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 'var(--t-dado)', color: 'var(--ink)',
                }}>{p.name}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <Botao onClick={() => setAEscolher(true)}>+ ESCREVER SOBRE ALGUÉM</Botao>
        </div>
      )}
    </div>
  )
}
