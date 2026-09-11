// lib/registo.ts
// ─────────────────────────────────────────────────────────────────────────────
// O livro de registos: quem fez o quê, sobre quem, quando.
//
// ── COMO SE USA ────────────────────────────────────────────────────────────
//   import { registar, ACOES } from '@/lib/registo'
//   registar({ supabase, scope, user }, {
//     ...ACOES.presencaChegada(utente.name),
//     subjectId: utente.id, subjectName: utente.name, entityId: utente.id,
//   })
//
// ── DUAS REGRAS ────────────────────────────────────────────────────────────
// 1. NUNCA bloqueia nem faz falhar a operação principal. Um registo que não
//    grava é uma pena; uma toma de medicação que não grava porque o registo
//    falhou é um problema a sério. Por isso é sempre disparado sem `await`, e
//    engole os próprios erros.
// 2. O texto é escrito para ser lido por uma pessoa daqui a seis meses — em
//    português, com o nome de quem fez e de quem recebeu, não códigos.
//
// ── PRIVACIDADE ────────────────────────────────────────────────────────────
// O livro pertence à instituição e só a ela (ver a RLS em
// supabase/sprint137_activity_log.sql). Nada disto vai para o /admin do Phlox.
// ─────────────────────────────────────────────────────────────────────────────

export interface CtxRegisto {
  supabase: any
  scope: { orgId: string | null; userId: string | null; stamp?: any }
  user: { id: string; name?: string | null; email?: string | null } | null
}

export interface EntradaRegisto {
  action: string
  summary: string
  entity?: string
  entityId?: string | null
  subjectId?: string | null
  subjectName?: string | null
  meta?: Record<string, any>
}

/** Grava uma entrada. Dispara e segue — nunca esperar por isto. */
export function registar(c: CtxRegisto, e: EntradaRegisto): void {
  if (!c?.supabase || !c?.user) return
  try {
    const linha = {
      org_id: c.scope?.orgId || null,
      user_id: c.user.id,
      actor_name: c.user.name || c.user.email?.split('@')[0] || 'Equipa',
      action: e.action,
      entity: e.entity || null,
      entity_id: e.entityId || null,
      subject_id: e.subjectId || null,
      subject_name: e.subjectName || null,
      summary: e.summary.slice(0, 400),
      meta: e.meta || null,
    }
    // Sem await e sem propagar: o livro nunca trava o trabalho.
    Promise.resolve(c.supabase.from('activity_log').insert(linha)).catch(() => {})
  } catch { /* ignorado de propósito */ }
}

const primeiro = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || 'a pessoa'

/**
 * As frases do livro, num sítio só. Escritas na terceira pessoa e no passado,
 * porque é assim que um registo se lê: "marcou a chegada de Maria".
 */
export const ACOES = {
  // ── Presenças ────────────────────────────────────────────────────────────
  presencaChegada: (nome: string) => ({ action: 'presenca.chegada', entity: 'patient', summary: `Marcou a chegada de ${nome}.` }),
  presencaSaida:   (nome: string) => ({ action: 'presenca.saida',   entity: 'patient', summary: `Marcou a saída de ${nome}.` }),
  presencaFalta:   (nome: string) => ({ action: 'presenca.falta',   entity: 'patient', summary: `Marcou ${nome} como ausente.` }),
  presencaRetirada:(nome: string) => ({ action: 'presenca.retirada',entity: 'patient', summary: `Retirou a marca de presença de ${nome}.` }),

  // ── Serviços de apoio ────────────────────────────────────────────────────
  transporteFeito: (nome: string, o: string) => ({ action: 'transporte.feito',   entity: 'service', summary: `Fez o transporte de ${nome} (${o}).` }),
  transporteAberto:(nome: string, o: string) => ({ action: 'transporte.desfeito',entity: 'service', summary: `Desmarcou o transporte de ${nome} (${o}).` }),
  roupaTratada:    (nome: string, o: string) => ({ action: 'roupa.tratada',      entity: 'service', summary: `Tratou da roupa de ${nome} (${o}).` }),
  servicoFeito:    (nome: string, o: string) => ({ action: 'servico.feito',      entity: 'service', summary: `Fez "${o}" para ${nome}.` }),
  servicoEstado:   (nome: string | null, o: string, est: string) => ({
    action: 'servico.estado', entity: 'service',
    summary: `Pôs o pedido "${o}"${nome ? ` de ${nome}` : ''} em ${est}.`,
  }),

  // ── Tarefas ──────────────────────────────────────────────────────────────
  tarefaCriada:    (t: string) => ({ action: 'tarefa.criada',    entity: 'task', summary: `Criou a tarefa "${t}".` }),
  tarefaAssumida:  (t: string, q: string) => ({ action: 'tarefa.assumida', entity: 'task', summary: `${q} assumiu a tarefa "${t}".` }),
  tarefaConcluida: (t: string) => ({ action: 'tarefa.concluida', entity: 'task', summary: `Concluiu a tarefa "${t}".` }),
  tarefaReaberta:  (t: string) => ({ action: 'tarefa.reaberta',  entity: 'task', summary: `Reabriu a tarefa "${t}".` }),
  tarefaRepetida:  (t: string, d: string) => ({ action: 'tarefa.repetida', entity: 'task', summary: `A tarefa "${t}" repetiu-se para ${d}.` }),
  tarefaApagada:   (t: string) => ({ action: 'tarefa.apagada',   entity: 'task', summary: `Apagou a tarefa "${t}".` }),

  // ── Medicação ────────────────────────────────────────────────────────────
  pastilheiroPreparado: (nome: string, dia: string, turno: string) => ({
    action: 'medicacao.preparada', entity: 'patient',
    summary: `Preparou o pastilheiro de ${nome} — ${dia}, ${turno}.`,
  }),
  pastilheiroDesfeito: (nome: string, dia: string, turno: string) => ({
    action: 'medicacao.preparacao_desfeita', entity: 'patient',
    summary: `Desmarcou a preparação de ${nome} — ${dia}, ${turno}.`,
  }),

  // ── Administração ────────────────────────────────────────────────────────
  // Uma entrada por TURNO e por pessoa, não por dose. Numa casa de trinta
  // pessoas, dose a dose davam 150 a 250 linhas por dia e o livro deixava de
  // se conseguir ler — as ocorrências e as presenças desapareciam no meio.
  //
  // As exceções são o contrário: cada recusa e cada suspensão tem linha
  // própria, porque é exatamente isso que se procura numa inspeção ou quando
  // se quer perceber o que correu mal. O dose a dose continua todo em
  // mar_records, e vê-se na ficha da pessoa.
  medicacaoTurno: (nome: string, turno: string, dadas: number, total: number) => ({
    action: 'medicacao.turno', entity: 'patient',
    summary: total === dadas
      ? `Deu a medicação da ${turno.toLowerCase()} a ${nome} — ${dadas} de ${total}.`
      : `Fechou a medicação da ${turno.toLowerCase()} de ${nome} — ${dadas} de ${total} administradas.`,
  }),
  medicacaoRecusada: (nome: string, med: string, motivo?: string | null) => ({
    action: 'medicacao.recusada', entity: 'patient',
    summary: `${nome} recusou ${med}.${motivo ? ` ${motivo}` : ''}`,
  }),
  medicacaoSuspensa: (nome: string, med: string, motivo?: string | null) => ({
    action: 'medicacao.suspensa', entity: 'patient',
    summary: `Suspendeu ${med} a ${nome}.${motivo ? ` ${motivo}` : ''}`,
  }),
  medicacaoRetirada: (nome: string, med: string) => ({
    action: 'medicacao.retirada', entity: 'patient',
    summary: `Retirou o registo de ${med} de ${nome}.`,
  }),

  // ── Cuidado do dia ───────────────────────────────────────────────────────
  registoDoDia:     (nome: string, turno: string) => ({ action: 'cuidado.registo', entity: 'patient', summary: `Registou o dia de ${nome} (${turno}).` }),
  registoIgual:     (nome: string) => ({ action: 'cuidado.registo_igual', entity: 'patient', summary: `Registou o dia de ${nome} como igual ao anterior.` }),
  ocorrencia:       (nome: string, tipo: string) => ({ action: 'ocorrencia.registada', entity: 'patient', summary: `Registou uma ocorrência de ${nome}: ${tipo}.` }),

  // ── Famílias ─────────────────────────────────────────────────────────────
  recadoFamilia:    (nome: string) => ({ action: 'familia.recado', entity: 'patient', summary: `Enviou um recado à família de ${primeiro(nome)}.` }),

  // ── Refeições ────────────────────────────────────────────────────────────
  ementaAplicada:   (n: number) => ({ action: 'ementa.aplicada', entity: 'meal', summary: `Aplicou a ementa da semana (${n} pratos).` }),
  pratoCriado:      (p: string) => ({ action: 'ementa.prato_novo', entity: 'meal', summary: `Acrescentou "${p}" à biblioteca de pratos.` }),
} as const

/** Um rótulo curto por família de ação, para agrupar o histórico. */
export function familiaDaAcao(action: string): string {
  const raiz = action.split('.')[0]
  return ({
    presenca: 'Presenças', transporte: 'Transportes', roupa: 'Roupa',
    servico: 'Serviços', tarefa: 'Tarefas', medicacao: 'Medicação',
    cuidado: 'Cuidado do dia', ocorrencia: 'Ocorrências',
    familia: 'Famílias', ementa: 'Refeições',
  } as Record<string, string>)[raiz] || 'Outros'
}
