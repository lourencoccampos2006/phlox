// lib/horarioToma.ts
// ─────────────────────────────────────────────────────────────────────────────
// "2x por dia" → 09:00 e 21:00.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// As notificações de medicação nunca funcionaram no modo pessoal, e não era
// por causa do envio: é que NÃO HAVIA HORAS. Ao adicionar um medicamento, o
// /mymeds gravava `name`, `dose`, `frequency` e `indication` — e mais nada. O
// `reminder_times` ficava a null, e o cron filtra precisamente por
// `.not('reminder_times', 'is', null)`. Nenhum medicamento adicionado pela
// aplicação podia, alguma vez, dar um lembrete.
//
// A hora existia num painel à parte que era preciso ir procurar. Ninguém vai.
//
// A pessoa já escreve a frequência — "2x por dia", "de 8 em 8 horas", "ao
// deitar". Isso chega para propor as horas. E é uma PROPOSTA: fica à vista
// logo a seguir a adicionar, e muda-se com um toque. Não é inventar dados; é
// não obrigar alguém a dizer duas vezes a mesma coisa.
//
// O "em SOS" devolve zero horas de propósito: um medicamento que se toma
// quando é preciso não tem hora, e um lembrete às nove para um comprimido de
// dor é a maneira mais rápida de ensinar alguém a ignorar o Phlox.
// ─────────────────────────────────────────────────────────────────────────────

export interface HorarioProposto {
  /** "HH:MM", já ordenadas. Vazio quando não faz sentido lembrar. */
  horas: string[]
  /** o que na frequência levou a isto, para se poder mostrar à pessoa */
  origem: string
  /** alta = a frequência diz mesmo isto; baixa = é um palpite razoável */
  confianca: 'alta' | 'media' | 'baixa'
}

/** As horas por omissão para N tomas ao dia. Escolhidas para caírem nas
 *  refeições, que é quando as pessoas se lembram. */
const POR_VEZES: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '13:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:00', '14:00', '17:00', '21:00'],
  6: ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'],
}

const NUMEROS: Record<string, number> = {
  'uma': 1, 'um': 1, 'duas': 2, 'dois': 3 - 1, 'tres': 3, 'três': 3,
  'quatro': 4, 'cinco': 5, 'seis': 6,
}

/** Sem acentos e em minúsculas, para "manhã" e "manha" darem no mesmo. */
function simples(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function horasDaFrequencia(frequencia?: string | null): HorarioProposto {
  // O "pequeno-almoço" contém "almoço": sem isto, "ao pequeno-almoço" dava
  // 08:00 E 13:00. Troca-se por uma palavra que só a regra da manhã apanha.
  const f = simples(String(frequencia || '').trim())
    .replace(/pequeno[-\s]?almoco/g, ' matinal ')

  // ── Em SOS: sem hora, e é a resposta certa ────────────────────────────────
  if (!f || /\bsos\b|se necessario|em caso de|quando (precisar|necessario)|apenas se|so se\b/.test(f)) {
    return f
      ? { horas: [], origem: 'toma em SOS', confianca: 'alta' }
      // Sem frequência nenhuma escrita: propõe-se uma toma de manhã, que é o
      // caso mais comum, e diz-se claramente que é um palpite.
      : { horas: ['09:00'], origem: 'sem frequência indicada', confianca: 'baixa' }
  }

  // ── Cadências que não são diárias ─────────────────────────────────────────
  // Um lembrete diário para um comprimido semanal é pior do que nenhum.
  if (/semanal|por semana|\bsemana\b|quinzenal|mensal|por mes|de mes em mes/.test(f)) {
    return { horas: [], origem: 'não é uma toma diária', confianca: 'alta' }
  }

  // ── "de 8 em 8 horas", "a cada 12 horas", "8/8h" ─────────────────────────
  const intervalo =
    f.match(/de\s*(\d{1,2})\s*em\s*(\d{1,2})\s*h/) ||
    f.match(/(?:a\s*)?cada\s*(\d{1,2})\s*h/) ||
    f.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\s*h/)
  if (intervalo) {
    const h = Number(intervalo[1])
    if (h > 0 && h <= 24) {
      const vezes = Math.max(1, Math.min(6, Math.round(24 / h)))
      // De 8 em 8 quer mesmo dizer de 8 em 8, incluindo de madrugada.
      const horas = h >= 6 && 24 % h === 0
        ? Array.from({ length: 24 / h }, (_, i) => `${String((8 + i * h) % 24).padStart(2, '0')}:00`).sort()
        : POR_VEZES[vezes] || POR_VEZES[1]
      return { horas, origem: `de ${h} em ${h} horas`, confianca: 'alta' }
    }
  }

  // ── Momentos do dia ───────────────────────────────────────────────────────
  const momentos: [RegExp, string, string][] = [
    [/jejum|antes do pequeno|pequeno-almoco|pequeno almoco|de manha|manha|matinal/, '08:00', 'de manhã'],
    [/ao almoco|almoco|meio-dia|meio dia/, '13:00', 'ao almoço'],
    [/ao lanche|lanche/, '16:30', 'ao lanche'],
    [/ao jantar|jantar/, '20:00', 'ao jantar'],
    [/ao deitar|deitar|antes de dormir|noite/, '22:00', 'ao deitar'],
  ]
  const encontrados = momentos.filter(([re]) => re.test(f))
  if (encontrados.length) {
    return {
      horas: [...new Set(encontrados.map(([, h]) => h))].sort(),
      origem: encontrados.map(([, , r]) => r).join(' e '),
      confianca: 'alta',
    }
  }

  // ── "2x por dia", "3 vezes ao dia", "duas vezes" ─────────────────────────
  const vezes =
    f.match(/(\d{1,2})\s*[x×]/) ||
    f.match(/(\d{1,2})\s*vezes?/) ||
    f.match(/\b(uma|duas|tres|quatro|cinco|seis)\s*vezes?/)
  if (vezes) {
    const n = /^\d{1,2}$/.test(vezes[1]) ? Number(vezes[1]) : (NUMEROS[vezes[1]] || 1)
    const limitado = Math.max(1, Math.min(6, n))
    return {
      horas: POR_VEZES[limitado] || POR_VEZES[1],
      origem: `${limitado}× por dia`,
      confianca: 'alta',
    }
  }

  // ── "diário", "todos os dias", "1 comprimido ao dia" ─────────────────────
  if (/diari|todos os dias|ao dia|por dia|dia sim/.test(f)) {
    return { horas: POR_VEZES[1], origem: 'uma vez por dia', confianca: 'media' }
  }

  // ── Não se percebeu ───────────────────────────────────────────────────────
  // Propõe-se de manhã, mas assumido como palpite: a interface diz-lhe isso e
  // a pessoa corrige num toque.
  return { horas: POR_VEZES[1], origem: 'não percebi a frequência', confianca: 'baixa' }
}

/** Uma frase curta para mostrar a quem acabou de adicionar o medicamento.
 *  A proposta tem de estar À VISTA — uma hora que aparece sozinha e ninguém vê
 *  é pior do que hora nenhuma. */
export function explicarHorario(h: HorarioProposto): string {
  if (!h.horas.length) return `Sem lembrete — ${h.origem}.`
  const lista = h.horas.join(' e ')
  return h.confianca === 'baixa'
    ? `Lembrete às ${lista}. Foi um palpite (${h.origem}) — muda se não for isso.`
    : `Lembrete às ${lista}, ${h.origem}.`
}
