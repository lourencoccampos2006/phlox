// lib/carregarODia.ts
// ─────────────────────────────────────────────────────────────────────────────
// Montar o dia: uma vez, e servir os dois sítios que o mostram.
//
// ── PORQUE É QUE ISTO SAIU DA PÁGINA ───────────────────────────────────────
// O Fernando pediu que «a percentagem do /o-dia que estiver preenchida é o que
// deve aparecer na percentagem do /inicio».
//
// O `/inicio` tinha uma conta própria — `(doses + registos) / (pessoas × 2)` —
// inventada, e que não é a mesma coisa. Duas contas do mesmo número acabam
// sempre por discordar, e no dia em que discordam ninguém confia em nenhuma
// das duas. Por isso a montagem passou a viver aqui, e as duas páginas leem
// daqui.
//
// ── CORRE NOS DOIS LADOS ───────────────────────────────────────────────────
// Recebe o cliente Supabase de quem chama, e por isso serve tanto a página
// (com a sessão do browser) como a rota de API (com o token de quem pergunta).
// Em ambos os casos passa pela RLS — não há aqui nenhuma chave de serviço, e
// não devia haver: o dia de trabalho é exatamente o que a pessoa pode ver.
// ─────────────────────────────────────────────────────────────────────────────

import {
  tarefasDosServicos, tarefasDoPlano, tarefasDaMedicacao,
  tarefasDasAtividades, tarefasDoApoio, tarefasDosReforcos,
  type Tarefa,
} from './oDia'
import { ptDate } from './ptTime'
import { foraNoDia, type AusenciaDoUtente } from './ausenciasDoUtente'

export interface DiaMontado {
  tarefas: Tarefa[]
  /** As fontes que não responderam. Uma lista mais curta por causa de uma
   *  falha não pode passar por um dia mais leve. */
  falharam: string[]
  /**
   * Quem está fora hoje — internado, com a família, de férias.
   *
   * Vem SEPARADO das tarefas de propósito. As tarefas dessas pessoas já não
   * estão na lista (pedir a medicação de quem está no hospital ensina a
   * ignorar a lista toda), mas quem conhece a casa conta as pessoas e dá
   * menos uma. Esconder sem dizer é pior do que não esconder.
   */
  fora: AusenciaDoUtente[]
}

/**
 * O dia de uma casa, das seis fontes, num sítio só.
 *
 * @param sb      cliente Supabase já autenticado (browser ou servidor)
 * @param orgId   a casa
 * @param turno   `manha` | `tarde` | `noite`
 * @param agora   para os testes poderem fixar o dia
 */
export async function carregarODia(
  sb: any, orgId: string, turno: string, agora: Date = new Date(),
): Promise<DiaMontado> {
  const hoje = ptDate(agora)
  const falharam: string[] = []
  const q = (t: string, cols = '*') => sb.from(t).select(cols).eq('org_id', orgId)

  // ── TUDO O QUE NÃO DEPENDE DE NADA, DE UMA VEZ ──────────────────────────
  // Onze consultas em paralelo, e não cinco fases em fila. A primeira versão
  // disto fazia patients → cuidados → plano → inscrições → não-prestados, uma
  // a seguir à outra: cinco idas e voltas à base de dados antes de a primeira
  // linha aparecer. Num telemóvel de turno isso é a diferença entre abrir e
  // parecer que não abriu.
  const [
    pes, meds, mar, ativs, apoios, reforcos,
    atribuicoes, catalogo, feitos, planos, naoPrestados, ausencias,
  ] = await Promise.all([
    q('patients', 'id,name').eq('active', true).order('name'),
    q('patient_meds').eq('active', true),
    q('mar_records', 'med_id,patient_id,status').eq('date', hoje).eq('shift', turno),
    // Estas três levam `*` de propósito, e não a lista de colunas que tinham.
    //
    // O PostgREST recusa o SELECT INTEIRO quando lhe pedem uma coluna que não
    // existe — devolve erro, não a linha sem aquele campo. Enquanto o
    // sprint170 não estiver aplicado, pedir `responsavel_id` aqui apagava as
    // atividades, o apoio e os reforços do dia todo de uma vez.
    //
    // No plano gratuito do Supabase o que conta é o NÚMERO de chamadas, não os
    // bytes (ver scripts/qa-volume-supabase.mjs), e são linhas de um dia só.
    // Pedir tudo não custa praticamente nada e não há aqui nada por que
    // esperar.
    q('activities').eq('date', hoje),
    q('support_services').eq('date', hoje),
    q('dietary_reinforcements').eq('date', hoje),
    q('servicos_do_utente').eq('ativo', true),
    q('catalogo_servicos').eq('ativo', true),
    q('servicos_execucoes', 'servico_utente_id,turno').eq('data', hoje),
    q('planos', 'id,patient_id').eq('estado', 'ativo'),
    q('cuidados_nao_prestados', 'patient_id,o_que,motivo,nota').eq('data', hoje),
    // Quem está fora. Só as que podem estar a decorrer hoje: as que já
    // acabaram antes de hoje não interessam, e ao fim de um ano são a
    // esmagadora maioria da tabela.
    q('ausencias_do_utente').lte('inicio', hoje).or(`fim.is.null,fim.gte.${hoje}`),
  ])

  // Sem a lista de pessoas não há dia nenhum para montar. É a única falha que
  // não se contorna — as outras só tiram uma fonte da lista.
  if (pes.error) return { tarefas: [], falharam: ['utentes'], fora: [] }
  const pessoas = pes.data || []
  if (!pessoas.length) return { tarefas: [], falharam: [], fora: [] }

  // ── O QUE DEPENDE DO QUE VEIO ACIMA ─────────────────────────────────────
  // Só duas coisas: as ações do plano (que pendem dos objetivos, que pendem
  // dos planos) e as inscrições nas atividades de hoje. Vão juntas, na mesma
  // volta.
  const idsPlanos = planos.error ? [] : (planos.data || []).map((p: any) => p.id)
  const idsAtiv = ativs.error ? [] : (ativs.data || []).map((a: any) => a.id)

  const [objs, inscricoes] = await Promise.all([
    idsPlanos.length
      ? sb.from('plano_objetivos')
          .select('id,plano_id,area,titulo,estado,ordem')
          .in('plano_id', idsPlanos).eq('estado', 'aberto')
      : Promise.resolve({ data: [] as any[], error: null }),
    idsAtiv.length
      ? sb.from('activity_participations')
          .select('activity_id,patient_id,attended,motivo').in('activity_id', idsAtiv)
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const objetivos = (objs.error ? [] : (objs.data || [])).map((o: any) => ({
    ...o,
    patient_id: (planos.data || []).find((p: any) => p.id === o.plano_id)?.patient_id,
  }))

  const [acs, execs] = objetivos.length
    ? await Promise.all([
        sb.from('plano_acoes').select('*').in('objetivo_id', objetivos.map((o: any) => o.id)).eq('ativa', true),
        q('plano_execucoes', 'acao_id,turno').eq('data', hoje),
      ])
    : [{ data: [] as any[], error: null }, { data: [] as any[], error: null }]

  // ── As seis fontes, traduzidas para a mesma forma ───────────────────────
  if (atribuicoes.error || catalogo.error) falharam.push('cuidados')
  if (meds.error) falharam.push('medicação')
  if (ativs.error) falharam.push('atividades')
  if (apoios.error) falharam.push('apoio')
  if (reforcos.error) falharam.push('reforços')
  if (acs.error) falharam.push('plano')

  const tarefas: Tarefa[] = [
    ...((atribuicoes.error || catalogo.error) ? [] : tarefasDosServicos(
      pessoas, atribuicoes.data || [], catalogo.data || [],
      feitos.error ? [] : (feitos.data || []), agora)),
    ...(acs.error ? [] : tarefasDoPlano(
      pessoas, objetivos, acs.data || [], execs.error ? [] : (execs.data || []), agora)),
    ...(meds.error ? [] : tarefasDaMedicacao(pessoas, meds.data || [], mar.error ? [] : (mar.data || []), turno)),
    ...(ativs.error ? [] : tarefasDasAtividades(pessoas, ativs.data || [], inscricoes.error ? [] : (inscricoes.data || []))),
    ...(apoios.error ? [] : tarefasDoApoio(pessoas, apoios.data || [])),
    ...(reforcos.error ? [] : tarefasDosReforcos(pessoas, reforcos.data || [], turno)),
  ]

  // O que já foi assinalado como não prestado hoje. Uma coisa recusada não
  // pode continuar a aparecer como trabalho por fazer — seria pedir à equipa
  // que voltasse a tentar o que já tentou e já registou.
  if (!naoPrestados.error) {
    for (const n of naoPrestados.data || []) {
      const alvo = tarefas.find(t =>
        t.patientId === n.patient_id &&
        t.oQue.trim().toLowerCase() === String(n.o_que).trim().toLowerCase())
      if (alvo && !alvo.naoPrestado) alvo.naoPrestado = { motivo: n.motivo, nota: n.nota }
    }
  }

  // ── Quem está fora não gera trabalho ────────────────────────────────────
  // A tabela pode ainda não existir (sprint176 por correr). Nesse caso não há
  // ausências nenhumas e o dia fica exactamente como estava — a funcionalidade
  // nova não pode partir a que já funciona.
  const fora: AusenciaDoUtente[] = ausencias.error ? [] : (ausencias.data || [])
  const idsFora = foraNoDia(fora, hoje)

  return {
    // Filtra-se no FIM, e não em cada fonte: assim é uma regra só, num sítio
    // só, e nenhuma fonte nova se pode esquecer dela.
    tarefas: idsFora.size ? tarefas.filter(t => !idsFora.has(t.patientId)) : tarefas,
    falharam,
    fora: fora.filter(a => idsFora.has(a.patient_id)),
  }
}

/**
 * Quanto do dia está tratado.
 *
 * ── O QUE CONTA COMO TRATADO ────────────────────────────────────────────────
 * O que foi feito, E o que foi assinalado como não prestado. Alguém foi lá,
 * tentou, e escreveu porquê — não contar isso seria dizer a essa pessoa que o
 * trabalho dela não conta, e é a forma mais rápida de ninguém voltar a
 * assinalar nada.
 *
 * Sem nada para fazer devolve `null`, e não 100%. Um dia vazio não é um dia
 * cumprido, e mostrar «100%» a quem ainda não abriu a casa é mentira.
 */
export function progressoDoDia(tarefas: Tarefa[]): { pct: number; feitos: number; total: number } | null {
  if (!tarefas.length) return null
  const feitos = tarefas.filter(t => t.feito || t.naoPrestado).length
  return { pct: Math.round((feitos / tarefas.length) * 100), feitos, total: tarefas.length }
}
