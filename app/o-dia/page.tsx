'use client'

// app/o-dia/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// O Dia — o trabalho de agora, de cinco sítios, numa lista só.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Para saber o que havia para fazer esta manhã era preciso abrir o /mar, o
// /activities, o /apoio-servicos, o /refeicoes e a ficha de cada pessoa. Cinco
// páginas, e nenhuma sabe da existência das outras.
//
// Na prática ninguém abre cinco páginas: abre uma, e o resto do dia acontece
// de memória — o que funciona até ao dia em que falta a pessoa que tem a
// memória.
//
// ── DUAS VISTAS, PORQUE HÁ DUAS MANEIRAS DE TRABALHAR ──────────────────────
// Por pessoa é como se faz uma ronda: vai-se ter com alguém e trata-se de tudo
// de uma vez. Por tarefa é como se faz um turno: escolhe-se um trabalho e
// faz-se a toda a gente que precisa dele. As duas são reais, e um programa que
// só tenha uma obriga metade da equipa a trabalhar ao contrário do que sabe.
//
// ── NÃO HÁ AQUI UMA SEGUNDA VERDADE ────────────────────────────────────────
// Marcar aqui escreve nas mesmas tabelas de sempre. Quem marcar uma toma neste
// ecrã e abrir o /mar a seguir vê lá a marca, porque é a mesma linha.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor, type Shift } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { ptDate } from '@/lib/ptTime'
import { useLiveData } from '@/lib/useLiveData'
import RegistarNaoPrestado from '@/components/institution/NaoPrestado'
import { rotuloMotivo } from '@/lib/naoPrestado'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import {
  tarefasDoPlano, tarefasDaMedicacao, tarefasDasAtividades, tarefasDoApoio, tarefasDosReforcos,
  porPessoa, porTarefa, resumo, ROTULO_DA_FONTE,
  type Tarefa, type Grupo,
} from '@/lib/oDia'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
}
const ROTULO_TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

type Vista = 'pessoa' | 'tarefa'

export default function ODia() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const bp = blueprintFor(institution)
  const cor = bp.accent
  const hoje = ptDate()

  const [vista, setVista] = useState<Vista>('pessoa')
  const [turno, setTurno] = useState<Shift>(currentShiftFor(institution))
  const [turnoTocado, setTurnoTocado] = useState(false)
  // O useClinicPrefs arranca em 'nursing_home' e só lê o tipo real depois do
  // primeiro render — sem isto, um centro de dia abria no turno da noite.
  useEffect(() => { if (!turnoTocado) setTurno(currentShiftFor(institution)) }, [institution, turnoTocado])

  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [indisponivel, setIndisponivel] = useState(false)
  const [aMarcar, setAMarcar] = useState<Set<string>>(new Set())
  const [aExplicar, setAExplicar] = useState<Tarefa | null>(null)

  // ── Carregar ──────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!user) return
    setCarregando(true)

    const q = (t: string, cols: string) => scope.filter(supabase.from(t).select(cols))

    // Tudo ao mesmo tempo. São seis consultas independentes; em série seriam
    // seis idas e voltas antes de a primeira linha aparecer no ecrã.
    const [pes, meds, mar, ativs, apoios, reforcos] = await Promise.all([
      q('patients', 'id,name').eq('active', true).order('name'),
      q('patient_meds', 'id,patient_id,name,dose,shifts,take_location').eq('active', true),
      q('mar_records', 'med_id,patient_id,status').eq('date', hoje).eq('shift', turno),
      q('activities', 'id,title,start_time,status').eq('date', hoje),
      q('support_services', 'id,patient_id,kind,status,notes').eq('date', hoje),
      q('dietary_reinforcements', 'id,patient_id,shift,given,notes').eq('date', hoje),
    ])

    if (pes.error) {
      // Sem a lista de pessoas não há dia nenhum para montar. É a única falha
      // que não se pode contornar — as outras só tiram uma fonte da lista.
      setIndisponivel(true); setCarregando(false)
      return
    }
    setIndisponivel(false)

    const pessoas = pes.data || []
    const idsPessoas = pessoas.map((p: any) => p.id)

    // As inscrições SÓ das atividades de hoje. Carregar a tabela inteira
    // funciona na primeira semana e deixa de funcionar ao fim de um ano.
    const idsAtiv = ativs.error ? [] : (ativs.data || []).map((a: any) => a.id)
    const inscricoes = idsAtiv.length
      ? await supabase.from('activity_participations')
          .select('activity_id,patient_id,attended,motivo').in('activity_id', idsAtiv)
      : { data: [] as any[], error: null }

    // ── O Plano (sprint157/158) ────────────────────────────────────────────
    // Em três consultas porque as ações não têm `patient_id` — pertencem a um
    // objetivo, que pertence a um plano, que pertence a uma pessoa. Guardar o
    // `patient_id` na ação seria mais rápido e ficava errado no dia em que um
    // plano mudasse de pessoa.
    let doPlano: Tarefa[] = []
    if (idsPessoas.length) {
      const planos = await scope.filter(
        supabase.from('planos').select('id,patient_id').eq('estado', 'ativo'))
      if (!planos.error && (planos.data || []).length) {
        const planoDe = new Map((planos.data || []).map((p: any) => [p.id, p.patient_id]))
        const objs = await supabase.from('plano_objetivos')
          .select('id,plano_id,area,titulo,estado,ordem')
          .in('plano_id', [...planoDe.keys()]).eq('estado', 'aberto')
        if (!objs.error && (objs.data || []).length) {
          const objetivos = (objs.data || []).map((o: any) => ({ ...o, patient_id: planoDe.get(o.plano_id) }))
          const [acs, execs] = await Promise.all([
            supabase.from('plano_acoes').select('*').in('objetivo_id', objetivos.map((o: any) => o.id)).eq('ativa', true),
            scope.filter(supabase.from('plano_execucoes').select('acao_id,turno')).eq('data', hoje),
          ])
          if (!acs.error) {
            doPlano = tarefasDoPlano(
              pessoas, objetivos as any, acs.data || [],
              execs.error ? [] : (execs.data || []), new Date())
          }
        }
      }
    }

    const lista: Tarefa[] = [
      ...doPlano,
      ...(meds.error ? [] : tarefasDaMedicacao(pessoas, meds.data || [], mar.error ? [] : (mar.data || []), turno)),
      ...(ativs.error ? [] : tarefasDasAtividades(
        pessoas, ativs.data || [], inscricoes.error ? [] : (inscricoes.data || []))),
      ...(apoios.error ? [] : tarefasDoApoio(pessoas, apoios.data || [])),
      ...(reforcos.error ? [] : tarefasDosReforcos(pessoas, reforcos.data || [], turno)),
    ]

    // O que já foi assinalado como não prestado hoje. Uma coisa recusada não
    // pode continuar a aparecer como trabalho por fazer — seria pedir à equipa
    // que voltasse a tentar o que já tentou e já registou.
    const naoPrestados = await scope.filter(
      supabase.from('cuidados_nao_prestados').select('patient_id,o_que,motivo,nota')).eq('data', hoje)
    if (!naoPrestados.error) {
      for (const n of naoPrestados.data || []) {
        const alvo = lista.find(t =>
          t.patientId === n.patient_id &&
          t.oQue.trim().toLowerCase() === String(n.o_que).trim().toLowerCase())
        if (alvo && !alvo.naoPrestado) alvo.naoPrestado = { motivo: n.motivo, nota: n.nota }
      }
    }

    // Quem não vê a área não recebe a tarefa. A RLS já não devolveria as
    // linhas, mas as atividades são montadas aqui a partir da lista de
    // pessoas — e essa vem sempre.
    setTarefas(lista.filter(t => scope.ve(t.area)))
    setCarregando(false)
  }, [user, supabase, scope, hoje, turno])

  useEffect(() => { carregar() }, [carregar])

  useLiveData({
    supabase, userId: user?.id,
    table: ['mar_records', 'activity_participations', 'support_services',
            'dietary_reinforcements', 'plano_execucoes', 'cuidados_nao_prestados'],
    filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue,
    onChange: carregar,
  })

  // ── Marcar ────────────────────────────────────────────────────────────────
  async function marcar(t: Tarefa) {
    if (!user || aMarcar.has(t.chave)) return
    setAMarcar(p => new Set(p).add(t.chave))

    // O ecrã responde já. Quem toca num botão numa manhã cheia não espera meio
    // segundo a olhar para ele — toca outra vez, e ficam duas marcas.
    const antes = tarefas
    setTarefas(p => p.map(x => x.chave === t.chave ? { ...x, feito: !x.feito } : x))

    const falhou = await escrever(t, !t.feito)

    setAMarcar(p => { const n = new Set(p); n.delete(t.chave); return n })
    if (falhou) {
      // Devolve-se o ecrã ao que estava. Uma marca que parece feita e não está
      // é a pior das duas hipóteses: quem a pôs vai-se embora descansado.
      setTarefas(antes)
      setErro(falhou)
    } else setErro('')
  }

  /** Escreve na tabela que é dona desta coisa. Devolve a mensagem de erro, ou ''. */
  async function escrever(t: Tarefa, feito: boolean): Promise<string> {
    const quem = (user as any)?.name || user?.email || ''

    if (t.fonte === 'plano') {
      if (!feito) {
        const { error } = await supabase.from('plano_execucoes')
          .delete().eq('acao_id', t.ref.acao_id).eq('data', hoje)
        return error ? reportError('o-dia-plano-desmarcar', error, MSG.save) : ''
      }
      const { error } = await supabase.from('plano_execucoes').insert(scope.stamp({
        user_id: user.id, acao_id: t.ref.acao_id, patient_id: t.patientId,
        data: hoje, turno: t.ref.turno || null, feito_por: quem,
      }))
      // Dois toques ao mesmo tempo dão violação de chave única — e isso quer
      // dizer que já ficou marcado, que é o resultado que se queria.
      if (error && !/duplicate key/i.test(error.message)) {
        return reportError('o-dia-plano', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'medicacao') {
      if (!feito) {
        const { error } = await supabase.from('mar_records').delete()
          .eq('patient_id', t.patientId).eq('med_id', t.ref.med_id)
          .eq('date', hoje).eq('shift', t.ref.turno)
        return error ? reportError('o-dia-mar-desmarcar', error, MSG.save) : ''
      }
      const { error } = await supabase.from('mar_records').insert(scope.stamp({
        user_id: user.id, patient_id: t.patientId, med_id: t.ref.med_id,
        date: hoje, shift: t.ref.turno, status: 'administered',
        recorded_by: quem, recorded_at: new Date().toISOString(),
      }))
      if (error && !/duplicate key/i.test(error.message)) {
        return reportError('o-dia-mar', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'atividade') {
      const { error } = await supabase.from('activity_participations').upsert(scope.stamp({
        user_id: user.id, activity_id: t.ref.activity_id, patient_id: t.patientId,
        attended: feito, motivo: feito ? null : undefined,
      }), { onConflict: 'activity_id,patient_id' })
      if (error) {
        // 42P10 = «não há restrição única que case com o ON CONFLICT». Acontece
        // enquanto o índice do sprint158 não existir, e para quem está a usar a
        // aplicação é exatamente o mesmo que «ainda não está disponível».
        const porMontar = isSetupError(error) || String((error as any).code) === '42P10'
        return reportError('o-dia-atividade', error, porMontar ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'apoio') {
      const { error } = await supabase.from('support_services').update({
        status: feito ? 'concluido' : 'pedido',
        completed_by_id: feito ? user.id : null,
        completed_at: feito ? new Date().toISOString() : null,
      }).eq('id', t.ref.servico_id)
      if (error) {
        return reportError('o-dia-apoio', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    if (t.fonte === 'reforco') {
      const { error } = await supabase.from('dietary_reinforcements')
        .update({ given: feito }).eq('id', t.ref.reforco_id)
      if (error) {
        return reportError('o-dia-reforco', error, isSetupError(error) ? MSG.unavailable : MSG.save)
      }
      return ''
    }

    return ''
  }

  // ── O que se mostra ───────────────────────────────────────────────────────
  const grupos: Grupo[] = useMemo(
    () => (vista === 'pessoa' ? porPessoa(tarefas) : porTarefa(tarefas)),
    [vista, tarefas])
  const linhaResumo = useMemo(() => resumo(tarefas), [tarefas])
  const turnos = shiftsFor(institution)

  if (indisponivel) {
    return (
      <div style={{ padding: 'var(--space-14)', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
          Ainda não consigo montar o dia
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
          Não consegui ler a lista de {cfg.personNounPlural.toLowerCase()}. Volte a entrar e tente outra vez.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--space-11) clamp(16px,3vw,32px) var(--space-18)', maxWidth: 880, margin: '0 auto' }}>

      <div style={{ marginBottom: 'var(--space-9)' }}>
        <span style={{ ...MONO, color: cor }}>O dia</span>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 500,
          color: 'var(--ink)', letterSpacing: '-0.025em', margin: 'var(--space-4) 0 0', lineHeight: 1.1,
        }}>{ROTULO_TURNO[turno] || 'Agora'}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-4)', margin: 'var(--space-5) 0 0', lineHeight: 1.55 }}>
          {carregando ? 'A juntar o que há para fazer…' : linhaResumo}
        </p>
      </div>

      {erro && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 'var(--r-md)',
          background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
          fontSize: 13, fontWeight: 600,
        }}>{erro}</div>
      )}

      {/* ── Turno e vista ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap',
        justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-9)',
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
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

        {/* O botão que o Fernando pediu: a mesma lista, das duas maneiras. */}
        <div style={{
          display: 'flex', borderRadius: 'var(--r-md)', overflow: 'hidden',
          border: '1.5px solid var(--border-2)',
        }}>
          {([['pessoa', `Por ${cfg.personNoun.toLowerCase()}`], ['tarefa', 'Por tarefa']] as [Vista, string][]).map(([v, rot]) => {
            const on = vista === v
            return (
              <button key={v} onClick={() => setVista(v)} style={{
                minHeight: 40, padding: '0 15px', border: 'none', cursor: 'pointer',
                background: on ? 'var(--ink)' : 'transparent', color: on ? '#fff' : 'var(--ink-3)',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              }}>{rot}</button>
            )
          })}
        </div>
      </div>

      {/* ── A lista ──────────────────────────────────────────────────────── */}
      {carregando ? (
        <div style={{ padding: 'var(--space-12) 0', color: 'var(--ink-4)', fontSize: 14 }}>A carregar…</div>
      ) : grupos.length === 0 ? (
        <div style={{
          padding: 'var(--space-14)', borderRadius: 'var(--r-xl)',
          border: '1px dashed var(--border-2)', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 8 }}>
            Nada marcado para {(ROTULO_TURNO[turno] || '').toLowerCase()}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            O dia enche-se sozinho a partir da medicação, das atividades, dos pedidos de apoio
            e das ações do plano de cada pessoa. Se está vazio, é porque ainda não há nada
            escrito em nenhum desses sítios para agora.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          {grupos.map(g => (
            <CartaoGrupo
              key={g.chave} g={g} cor={cor} vista={vista}
              aMarcar={aMarcar}
              marcar={marcar}
              explicar={t => setAExplicar(t)}
            />
          ))}
        </div>
      )}

      {/* Porque é que não foi feito. A mesma folha do registo do dia e das
          atividades — é o que permite perguntar depois «o que é que esta
          pessoa tem recusado» e receber uma resposta que atravessa as áreas. */}
      {aExplicar && (
        <RegistarNaoPrestado
          patientId={aExplicar.patientId}
          nome={aExplicar.nome}
          area={aExplicar.area}
          oQue={aExplicar.oQue}
          origem="o-dia"
          turno={aExplicar.turno}
          aoFechar={() => setAExplicar(null)}
          aoGravar={(_frase, motivo) => {
            const chave = aExplicar.chave
            setTarefas(p => p.map(x => x.chave === chave ? { ...x, naoPrestado: { motivo, nota: null } } : x))
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CartaoGrupo({ g, cor, vista, aMarcar, marcar, explicar }: {
  g: Grupo; cor: string; vista: Vista
  aMarcar: Set<string>
  marcar: (t: Tarefa) => void
  explicar: (t: Tarefa) => void
}) {
  const tudoFeito = g.porFazer === 0

  return (
    <section style={{
      borderRadius: 'var(--r-xl)', border: '1px solid var(--border)',
      background: 'var(--bg)', overflow: 'hidden', opacity: tudoFeito ? 0.72 : 1,
    }}>
      <header style={{
        padding: 'var(--space-7) var(--space-8)',
        borderBottom: '1px solid var(--border)',
        background: tudoFeito ? 'var(--bg-2)' : 'transparent',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', lineHeight: 1.3,
        }}>{g.titulo}</span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: tudoFeito ? 'var(--badge-green-fg)' : cor,
        }}>{g.subtitulo}</span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {g.tarefas.map(t => (
          <LinhaTarefa
            key={t.chave} t={t} cor={cor} vista={vista}
            ocupada={aMarcar.has(t.chave)}
            marcar={() => marcar(t)}
            explicar={() => explicar(t)}
          />
        ))}
      </div>
    </section>
  )
}

function LinhaTarefa({ t, cor, vista, ocupada, marcar, explicar }: {
  t: Tarefa; cor: string; vista: Vista; ocupada: boolean
  marcar: () => void; explicar: () => void
}) {
  const tratada = t.feito || !!t.naoPrestado
  // Na vista por tarefa o título do grupo já diz o que é — aqui o que falta
  // saber é de quem. Na vista por pessoa é ao contrário.
  const principal = vista === 'pessoa' ? t.oQue : t.nome
  const secundario = vista === 'pessoa'
    ? [ROTULO_DA_FONTE[t.fonte], t.detalhe].filter(Boolean).join(' · ')
    : [t.detalhe].filter(Boolean).join(' · ')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
      padding: 'var(--space-6) var(--space-8)',
      borderTop: '1px solid var(--bg-3)',
      background: t.naoPrestado ? 'var(--bg-2)' : 'transparent',
    }}>
      <button
        onClick={marcar}
        disabled={ocupada || !!t.naoPrestado}
        aria-label={t.feito ? `Desmarcar ${t.oQue}` : `Marcar ${t.oQue} como feito`}
        style={{
          width: 30, height: 30, flexShrink: 0, borderRadius: 9, cursor: t.naoPrestado ? 'default' : 'pointer',
          border: `1.5px solid ${t.feito ? cor : t.naoPrestado ? 'var(--border-2)' : 'var(--border-2)'}`,
          background: t.feito ? cor : 'transparent',
          color: '#fff', fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: ocupada ? 0.5 : 1,
        }}>{t.feito ? '✓' : ''}</button>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35,
          textDecoration: tratada ? 'line-through' : 'none',
          textDecorationColor: 'var(--ink-5)',
        }}>{principal}</div>
        {(secundario || t.naoPrestado) && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3 }}>
            {t.naoPrestado ? rotuloMotivo(t.naoPrestado.motivo) : secundario}
          </div>
        )}
      </div>

      {/* «Não foi feito» aparece só enquanto houver alguma coisa a explicar.
          Depois de marcado, a pergunta já não se põe. */}
      {!t.feito && !t.naoPrestado && (
        <button onClick={explicar} style={{
          flexShrink: 0, minHeight: 32, padding: '0 10px', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border-2)', background: 'transparent',
          fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer',
        }}>Não foi feito</button>
      )}
    </div>
  )
}
