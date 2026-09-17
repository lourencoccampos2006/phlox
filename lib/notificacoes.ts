// lib/notificacoes.ts
// ─────────────────────────────────────────────────────────────────────────────
// O catálogo de notificações, e o que cada pessoa escolheu receber.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Até aqui uma notificação ou existia para toda a gente ou não existia. Isso
// funciona enquanto houver três; com dezassete, a diferença entre uma
// ferramenta e um incómodo é poder desligar as que não interessam.
//
// E há uma razão mais dura: quem desliga tudo numa aplicação fá-lo no sistema
// operativo, e aí desliga TUDO — incluindo a dose das nove. Mais vale deixar
// desligar uma a uma aqui.
//
// ── AS REGRAS ──────────────────────────────────────────────────────────────
// 1. A omissão é ligado, exceto onde está escrito o contrário. Uma notificação
//    que só chega a quem a for procurar nas definições não chega a ninguém.
// 2. As de instituição só aparecem a quem tem conta de instituição. Um
//    interruptor para "stock abaixo do mínimo" numa conta pessoal é ruído.
// 3. O `id` é a mesma palavra que o tipo do aviso (lib/avisos.ts). Sem isso,
//    a preferência e o aviso podem divergir sem ninguém dar por ela.
// ─────────────────────────────────────────────────────────────────────────────

export type AmbitoNotificacao = 'pessoal' | 'cuidador' | 'instituicao'

export interface TipoNotificacao {
  id: string
  label: string
  descricao: string
  ambito: AmbitoNotificacao
  /** ligado por omissão */
  omissao: boolean
  /** só faz sentido neste tipo de casa (vazio = em todas) */
  soEm?: string[]
}

export const TIPOS_NOTIFICACAO: TipoNotificacao[] = [
  // ── A minha saúde ────────────────────────────────────────────────────────
  { id: 'toma', ambito: 'pessoal', omissao: true,
    label: 'Hora de tomar',
    descricao: 'À hora de cada medicamento com lembrete definido.' },
  { id: 'caixa', ambito: 'pessoal', omissao: true,
    label: 'Medicamento a acabar',
    descricao: 'Uma semana antes de a caixa acabar, uma vez por medicamento.' },
  { id: 'resumo_dia', ambito: 'pessoal', omissao: true,
    label: 'O que ficou por marcar',
    descricao: 'Ao fim do dia, se ficaram tomas por confirmar. Só quando há.' },
  { id: 'consulta', ambito: 'pessoal', omissao: true,
    label: 'Consulta amanhã',
    descricao: 'Na véspera de uma consulta ou exame marcado.' },

  // ── Quem eu cuido ────────────────────────────────────────────────────────
  { id: 'toma_familiar', ambito: 'cuidador', omissao: true,
    label: 'Hora de dar a medicação',
    descricao: 'À hora da medicação de quem cuidas.' },
  { id: 'partilhado', ambito: 'cuidador', omissao: true,
    label: 'Novidades num perfil partilhado',
    descricao: 'Quando alguém regista medicação, medições ou queixas num perfil partilhado contigo.' },
  { id: 'resumo_centro', ambito: 'cuidador', omissao: true,
    label: 'Como correu o dia no centro',
    descricao: 'Por email, ao fim da tarde, quando quem cuida no centro registou o dia. Se não houve registos, não recebes nada.' },
  { id: 'sinais_familiar', ambito: 'cuidador', omissao: true,
    label: 'Quando algo sai do padrão',
    descricao: 'Adesão a cair, silêncio prolongado, queixas a aumentar, peso a descer.' },

  // ── A casa ───────────────────────────────────────────────────────────────
  { id: 'doses', ambito: 'instituicao', omissao: true,
    label: 'Doses do turno por registar',
    descricao: 'Perto do fim de cada turno, se houver medicação sem registo.' },
  { id: 'medicacao', ambito: 'instituicao', omissao: true,
    label: 'Toma recusada ou suspensa',
    descricao: 'Assim que alguém marca uma recusa ou uma suspensão.' },
  { id: 'incidente', ambito: 'instituicao', omissao: true,
    label: 'Ocorrência por seguir',
    descricao: 'Quedas, erros de medicação e outras ocorrências com seguimento por fazer.' },
  { id: 'familia', ambito: 'instituicao', omissao: true,
    label: 'Família à espera de resposta',
    descricao: 'Quando uma família escreve e ninguém da equipa respondeu ainda.' },
  { id: 'mural', ambito: 'instituicao', omissao: true,
    label: 'Recado urgente no mural',
    descricao: 'Só os marcados como urgentes. Os importantes ficam no sino.' },
  { id: 'stock', ambito: 'instituicao', omissao: true,
    label: 'Stock abaixo do mínimo',
    descricao: 'Uma vez por dia, de manhã. Não é uma emergência: é uma ida à farmácia.' },
  { id: 'validades', ambito: 'instituicao', omissao: true,
    label: 'Validades a expirar',
    descricao: 'Medicamentos e material a menos de 30 dias do fim do prazo.' },
  { id: 'presenca', ambito: 'instituicao', omissao: true, soEm: ['day_care'],
    label: 'Presenças por marcar',
    descricao: 'A meio da manhã, se a casa começou a marcar presenças e ficaram pessoas por marcar.' },
  { id: 'preparacao', ambito: 'instituicao', omissao: true,
    label: 'Pastilheiro por preparar',
    descricao: 'Ao fim da tarde, se a medicação de amanhã ainda não está preparada.' },
  { id: 'avaliacoes', ambito: 'instituicao', omissao: false,
    label: 'Avaliações desatualizadas',
    descricao: 'Barthel, Braden, Morse e outras com mais de 90 dias. Desligado por omissão — é um lembrete de fundo, não uma urgência.' },
]

const PORTIPO = new Map(TIPOS_NOTIFICACAO.map(t => [t.id, t]))

export type PreferenciasNotificacao = Record<string, boolean> | null | undefined

/** Esta pessoa quer receber este aviso?
 *
 *  Um tipo desconhecido devolve `true` de propósito: se amanhã se acrescentar
 *  um aviso novo e alguém se esquecer de o pôr no catálogo, é melhor que ele
 *  chegue a mais gente do que desapareça sem ninguém reparar. */
export function querReceber(prefs: PreferenciasNotificacao, id: string): boolean {
  const escolhido = prefs?.[id]
  if (typeof escolhido === 'boolean') return escolhido
  return PORTIPO.get(id)?.omissao ?? true
}

/** Os tipos que fazem sentido mostrar a esta pessoa.
 *  Quem não tem instituição não vê os interruptores da casa. */
export function tiposPara(opcoes: { temOrg: boolean; tipoInstituicao?: string | null; modo?: string | null }): TipoNotificacao[] {
  return TIPOS_NOTIFICACAO.filter(t => {
    if (t.ambito === 'instituicao') {
      if (!opcoes.temOrg) return false
      if (t.soEm?.length && opcoes.tipoInstituicao && !t.soEm.includes(opcoes.tipoInstituicao)) return false
    }
    return true
  })
}

export const ROTULO_AMBITO: Record<AmbitoNotificacao, { titulo: string; nota: string }> = {
  pessoal: { titulo: 'A minha saúde', nota: 'Sobre a tua própria medicação e consultas.' },
  cuidador: { titulo: 'Quem eu cuido', nota: 'Sobre os perfis de familiares que acompanhas.' },
  instituicao: { titulo: 'A casa', nota: 'Sobre o trabalho do dia na instituição. Só aparecem aqui porque tens conta de instituição.' },
}
