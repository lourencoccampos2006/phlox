// lib/passagemDeTurno.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que o turno que sai tem de dizer ao turno que entra.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa aos programas que as casas portuguesas e inglesas já usam. Os
// três ingleses têm todos esta peça, e nenhum dos portugueses a tem:
//
//   «Flag any care log for handover to keep the next carer updated»
//   «incident logs are automatically added to the handover report»
//   «Carers access handovers at the start of their shift, marking them as read»
//
// É a peça que faz a informação atravessar a porta quando a equipa muda. Sem
// ela cada turno começa do zero — ou começa com o que alguém se lembrar de
// dizer no corredor, que é pior, porque parece que começou informado.
//
// ── A REGRA QUE DECIDE TUDO O RESTO: NÃO SE ESCREVE O QUE JÁ ESTÁ ESCRITO ──
// A tentação é uma folha em branco com «escreva aqui a passagem do turno».
// Ninguém a preenche. Quem sai de um turno de oito horas não vai reescrever a
// queda que já registou nas ocorrências, a recusa que já marcou no /mar e as
// três coisas que já explicou em «não foi feito».
//
// Por isso a passagem monta-se sozinha a partir do que JÁ foi registado
// durante o turno, e o que a pessoa escreve é só o que mais nenhum sítio sabe
// — «a Dona Maria passou a noite inquieta», «o filho do Sr. António liga
// amanhã».
//
// ── E O QUE É CALCULADO NÃO SE GRAVA ───────────────────────────────────────
// As ocorrências, as recusas e o que ficou por fazer NÃO vão para dentro da
// linha da passagem: são lidos de cada vez que alguém a abre.
//
// Gravados, ficavam desatualizados no instante em que alguém corrigisse o
// registo de origem — e a casa passava a ter duas versões da mesma noite, uma
// na ocorrência e outra na passagem. Ao fim de um mês ninguém sabia qual valia.
//
// Só o que é ORIGINAL da passagem se grava: as notas por pessoa e o texto
// livre. Esses não existem em mais lado nenhum.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'
import { rotuloTipo, sobreQuem } from './ocorrencias'
import { rotuloMotivo } from './naoPrestado'

export type Gravidade = 'alta' | 'normal'

export interface Entrada {
  /** Estável — para o React e para não repetir a mesma coisa duas vezes. */
  chave: string
  /** De onde veio. É o que dá o ícone e a cor. */
  origem: 'ocorrencia' | 'recusa' | 'nao_prestado' | 'por_fazer' | 'recado' | 'nota'
  titulo: string
  detalhe?: string | null
  /** Para agrupar por pessoa. Null = é da casa toda. */
  patientId?: string | null
  nome?: string | null
  gravidade: Gravidade
  /** Onde se vê por inteiro. */
  href?: string
}

export const ROTULO_ORIGEM: Record<Entrada['origem'], string> = {
  ocorrencia: 'Ocorrência',
  recusa: 'Toma não dada',
  nao_prestado: 'Não foi feito',
  por_fazer: 'Ficou por fazer',
  recado: 'Recado',
  nota: 'Nota do turno',
}

/** A mesma paleta surda do /o-dia: dizem «de que tipo», não «é grave». */
export const COR_ORIGEM: Record<Entrada['origem'], string> = {
  ocorrencia: '#a1544c',
  recusa: '#5a6d7c',
  nao_prestado: '#7a5f70',
  por_fazer: '#7c6f5a',
  recado: '#6b6a80',
  nota: '#5f7161',
}

export interface NotaDePessoa {
  patient_id: string
  nome: string
  nota: string
}

export interface Passagem {
  id?: string
  org_id?: string
  date: string
  shift: string
  general_notes: string | null
  patients_summary: NotaDePessoa[]
  completed: boolean
  autor_nome?: string | null
  from_user_id?: string | null
  fechada_em?: string | null
  created_at?: string
}

/** Uma consulta que nunca deita a página abaixo. Igual à de lib/avisos. */
async function tol<T = any>(fazer: () => any): Promise<T[]> {
  try { const r = await fazer(); return (r?.error ? [] : (r?.data || [])) as T[] } catch { return [] }
}


/**
 * Tudo o que aconteceu neste turno e que o turno seguinte tem de saber.
 *
 * @param naoFeitas  As tarefas do /o-dia que ficaram por fazer. Vêm de fora
 *                   (`carregarODia`) e não são lidas aqui outra vez: a página
 *                   que mostra a passagem já as tem, e montar o dia duas vezes
 *                   seriam mais treze consultas para chegar ao mesmo sítio.
 */
export async function montarPassagem(
  sb: any,
  orgId: string,
  turno: string,
  opts: {
    hoje?: string
    naoFeitas?: { chave: string; nome: string; oQue: string; patientId: string }[]
  } = {},
): Promise<Entrada[]> {
  const hoje = opts.hoje ?? ptDate()

  const [utentes, ocorrencias, tomas, naoPrestados, recados, meds] = await Promise.all([
    tol(() => sb.from('patients').select('id, name').eq('org_id', orgId).eq('active', true)),
    tol(() => sb.from('incidents')
      .select('id, patient_id, type, severity, description, time, follow_up_required')
      .eq('org_id', orgId).eq('date', hoje)),
    tol(() => sb.from('mar_records').select('id, patient_id, med_id, status, shift')
      .eq('org_id', orgId).eq('date', hoje).eq('shift', turno).in('status', ['refused', 'held'])),
    tol(() => sb.from('cuidados_nao_prestados').select('id, patient_id, o_que, motivo, nota, turno')
      .eq('org_id', orgId).eq('data', hoje).eq('turno', turno)),
    tol(() => sb.from('team_messages').select('id, body, author_name, priority, channel, created_at')
      .eq('org_id', orgId).eq('resolved', false).in('priority', ['importante', 'urgente'])
      .gte('created_at', `${hoje}T00:00:00`)),
    // Só para dar nome aos medicamentos das recusas. «Toma recusada» sem dizer
    // qual não serve para nada a quem entra ao turno.
    tol(() => sb.from('patient_meds').select('id, name, dose').eq('org_id', orgId)),
  ])

  const nomes = new Map<string, string>(utentes.map((p: any) => [p.id, p.name]))
  const quem = (id: string | null) => (id && nomes.get(id)) || 'Utente'
  const nomeMed = new Map<string, string>(meds.map((m: any) => [m.id, m.name]))

  const fora: Entrada[] = []

  // ── 1. Ocorrências ────────────────────────────────────────────────────────
  // Entram sempre, e são as primeiras. É o que os ingleses fazem
  // automaticamente, e por uma razão prática: uma queda é exactamente a coisa
  // que quem sai está mais cansado para se lembrar de contar.
  for (const i of ocorrencias) {
    fora.push({
      chave: `oc-${i.id}`, origem: 'ocorrencia',
      // Uma ocorrência da casa — uma falha de energia, um cano — não tem
      // utente. Dizer «Utente» era inventar uma pessoa que não existe.
      titulo: `${rotuloTipo(i.type)} · ${sobreQuem(i.type, i.patient_id ? quem(i.patient_id) : null)}`,
      detalhe: [i.time, i.description].filter(Boolean).join(' · ') || null,
      patientId: i.patient_id || null,
      nome: i.patient_id ? quem(i.patient_id) : null,
      // Grave se foi marcada como grave OU se ficou seguimento por fazer — um
      // seguimento por fazer é, por definição, trabalho que passa para o turno
      // seguinte.
      gravidade: (i.severity === 'high' || i.severity === 'grave' || i.follow_up_required) ? 'alta' : 'normal',
      href: '/incidents',
    })
  }

  // ── 2. Tomas recusadas ou suspensas ──────────────────────────────────────
  for (const t of tomas) {
    fora.push({
      chave: `mar-${t.id}`, origem: 'recusa',
      titulo: `${nomeMed.get(t.med_id) || 'Medicamento'} · ${quem(t.patient_id)}`,
      detalhe: t.status === 'refused' ? 'Recusou' : 'Suspensa por decisão clínica',
      patientId: t.patient_id, nome: quem(t.patient_id),
      gravidade: 'alta', href: '/mar',
    })
  }

  // ── 3. Cuidados assinalados como não prestados ───────────────────────────
  for (const n of naoPrestados) {
    fora.push({
      chave: `np-${n.id}`, origem: 'nao_prestado',
      titulo: `${n.o_que} · ${quem(n.patient_id)}`,
      detalhe: [rotuloMotivo(n.motivo), n.nota].filter(Boolean).join(' · ') || null,
      patientId: n.patient_id, nome: quem(n.patient_id),
      gravidade: 'normal', href: '/o-dia',
    })
  }

  // ── 4. O que ficou por fazer ─────────────────────────────────────────────
  // Sem motivo escrito — ao contrário do de cima. É a diferença entre «não se
  // fez, e foi por isto» e «não se fez». A segunda é a que o turno seguinte
  // tem de apanhar.
  //
  // ── E ACIMA DE QUATRO, JUNTAM-SE NUMA LINHA SÓ ────────────────────────────
  // Um turno pode deixar quarenta coisas por fazer — a meio de uma manhã é
  // completamente normal. Quarenta linhas iguais a dizer «ficou por fazer»
  // não são uma passagem: são um muro, e um muro enterra a queda que está lá
  // no meio.
  //
  // Juntas, dizem a mesma coisa numa linha e deixam o resto da passagem
  // respirar. Quem quiser a lista toda tem-na no /o-dia, que é onde ela vive.
  const porFazer = opts.naoFeitas || []
  if (porFazer.length > 4) {
    const pessoas = new Set(porFazer.map(t => t.patientId)).size
    fora.push({
      chave: 'pf-resumo', origem: 'por_fazer',
      titulo: `${porFazer.length} coisas ficaram por fazer`,
      detalhe: `${pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`} · `
        + porFazer.slice(0, 3).map(t => t.oQue).join(', ')
        + (porFazer.length > 3 ? '…' : ''),
      gravidade: 'normal', href: '/o-dia',
    })
  } else {
    for (const t of porFazer) {
      fora.push({
        chave: `pf-${t.chave}`, origem: 'por_fazer',
        titulo: `${t.oQue} · ${t.nome}`,
        patientId: t.patientId, nome: t.nome,
        gravidade: 'normal', href: '/o-dia',
      })
    }
  }

  // ── 5. Recados por resolver ──────────────────────────────────────────────
  for (const m of recados) {
    fora.push({
      chave: `rc-${m.id}`, origem: 'recado',
      titulo: `${m.channel || 'Mural'} · ${m.author_name || 'Equipa'}`,
      detalhe: String(m.body || '').slice(0, 140),
      gravidade: m.priority === 'urgente' ? 'alta' : 'normal',
      href: '/equipa?tab=mural',
    })
  }

  return ordenar(fora)
}

/** Junta o que foi escrito à mão ao que foi calculado. */
export function comNotas(calculadas: Entrada[], p: Passagem | null): Entrada[] {
  if (!p) return calculadas
  const notas: Entrada[] = (p.patients_summary || [])
    .filter(n => n.nota?.trim())
    .map(n => ({
      chave: `nota-${n.patient_id}`, origem: 'nota' as const,
      titulo: n.nome, detalhe: n.nota,
      patientId: n.patient_id, nome: n.nome,
      gravidade: 'normal' as const, href: `/patients/${n.patient_id}`,
    }))
  return ordenar([...calculadas, ...notas])
}

/**
 * O grave primeiro, e a seguir pela origem.
 *
 * Quem lê uma passagem lê-a de pé, a vestir a bata. As duas primeiras linhas
 * são as únicas garantidas — por isso são elas que têm de trazer a queda.
 */
function ordenar(l: Entrada[]): Entrada[] {
  const peso: Record<Entrada['origem'], number> = {
    ocorrencia: 0, recusa: 1, nota: 2, nao_prestado: 3, por_fazer: 4, recado: 5,
  }
  return [...l].sort((a, b) => {
    if (a.gravidade !== b.gravidade) return a.gravidade === 'alta' ? -1 : 1
    return peso[a.origem] - peso[b.origem] || (a.nome || '').localeCompare(b.nome || '', 'pt')
  })
}

/** A linha de uma frase, para o topo e para a notificação. */
export function resumoDaPassagem(entradas: Entrada[]): string {
  if (!entradas.length) return 'Turno sem nada a assinalar.'
  const graves = entradas.filter(e => e.gravidade === 'alta').length
  const n = entradas.length
  const total = `${n} ${n === 1 ? 'coisa' : 'coisas'} a passar`
  return graves
    ? `${total}, ${graves} ${graves === 1 ? 'a merecer atenção' : 'a merecer atenção'}.`
    : `${total}.`
}

/** Qual é o turno que vem a seguir a este? */
export function turnoSeguinte(turno: string, temNoite: boolean): string {
  if (!temNoite) return turno === 'manha' ? 'tarde' : 'manha'
  return turno === 'manha' ? 'tarde' : turno === 'tarde' ? 'noite' : 'manha'
}
