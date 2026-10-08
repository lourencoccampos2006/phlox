// lib/essencial.ts
// ─────────────────────────────────────────────────────────────────────────────
// O O essencial — a folha que se lê antes de tocar na pessoa.
//
// ── DE ONDE VEIO ───────────────────────────────────────────────────────────
// Da pesquisa ao MySenior (2026-10-01). Entre as 68 novidades deles há uma com
// um nome que nenhuma casa portuguesa precisa que lhe expliquem:
//
//     «O essencial com o MySenior em apenas um clique.»
//
// O essencial é o nome antigo do ficheiro de cartões que havia na sala de
// enfermagem: um cartão por pessoa, à mão, com o que era preciso saber para
// cuidar dela naquele turno. Quem entra a substituir alguém lê o cartão e sabe
// o que fazer. É provavelmente o documento mais usado de uma casa de idosos, e
// o Phlox não o tinha.
//
// ── NÃO É O PROCESSO INDIVIDUAL, E NÃO É O DOSSIER MENSAL ──────────────────
// Há três documentos parecidos e é fácil fundi-los por engano. Não se devem
// fundir, porque respondem a perguntas diferentes:
//
//   • lib/processoIndividual.ts  → «a pasta desta pessoa está completa?»
//     É para a inspeção. Olha para o que FALTA, e a resposta certa é uma lista
//     de buracos.
//   • o dossier mensal (/patients/[id])  → «o que aconteceu em setembro?»
//     É história. Olha para trás.
//   • o CARDEX (isto)  → «sou eu que entro agora às 15h. O que preciso de
//     saber para cuidar desta pessoa HOJE?»
//     É o presente. Não tem histórico nenhum, de propósito: um cartão com
//     três meses de registos deixa de se ler.
//
// ── A REGRA QUE MANDA EM TODO O FICHEIRO ───────────────────────────────────
// **Em branco não é «não tem».**
//
// Esta é a única coisa que importa aqui. Um O essencial que imprime um campo de
// alergias vazio diz, a quem o lê, que esta pessoa não tem alergias. Não é
// isso que diz a base de dados — a base de dados diz que ninguém escreveu
// nada. A distância entre as duas frases é uma reação anafilática.
//
// Por isso cada campo tem três estados e nunca dois:
//   • `escrito`  — alguém escreveu alguma coisa
//   • `nenhum`   — alguém escreveu que não há («sem alergias conhecidas»)
//   • `branco`   — ninguém escreveu nada, e a folha diz isso em voz alta
//
// E há um quarto caso que a tentação é tratar como `nenhum` e que é o oposto:
// «desconhecidas», «a confirmar», «sem registo». Isso não é a declaração de
// que não há — é a declaração de que não se sabe. Conta como `branco`.
//
// ── E PORQUE É QUE NÃO TEM TABELA NENHUMA ──────────────────────────────────
// Porque tudo isto já está escrito: na ficha (`patients`), na medicação
// (`patient_meds`), no plano de cuidados (`care_plans`), nas avaliações
// (`assessments`), nas feridas (`wounds`) e nos contactos
// (`resident_contacts`). Uma tabela `essencial` seria uma segunda cópia a
// envelhecer sozinha — e uma folha destas desatualizado é pior do que não haver um.
// ─────────────────────────────────────────────────────────────────────────────

import { anosDesde } from './estatisticas'
import { emPortugues } from './periodo'
import { ptDate } from './ptTime'
import { SCALES, levelOf, type ScaleType } from './assessmentScales'

/* ══════════════════════════════════════════════════════════════════════════
   OS TRÊS ESTADOS
   ══════════════════════════════════════════════════════════════════════════ */

export type EstadoDoCampo =
  /** Alguém escreveu alguma coisa. */
  | 'escrito'
  /** Alguém escreveu que não há. Só para campos onde «não há» é uma resposta. */
  | 'nenhum'
  /** Ninguém escreveu nada — ou escreveu que não sabe. */
  | 'branco'

export interface CampoDaFolha {
  rotulo: string
  /** O que se imprime. Nunca vazio: um campo branco diz que está branco. */
  valor: string
  estado: EstadoDoCampo
  /**
   * Um campo onde o branco é perigoso, e não apenas incompleto.
   *
   * São seis: alergias, médico assistente, dieta, textura, mobilidade e quem
   * avisar. Nestes, quem lê a folha toma uma decisão mesmo que não haja nada
   * escrito — dá o comprimido, dá o copo de água, levanta a pessoa sozinho,
   * não telefona a ninguém. Nos outros, uma lacuna é uma lacuna.
   *
   * A lista é curta porque tem de ser: se metade dos campos fosse crítica, a
   * linha de cima dizia sempre que falta o essencial, e deixava de se ler.
   */
  critico?: boolean
  /** Onde se preenche, para quem quiser resolver. */
  onde?: string
}

export interface SecaoDaFolha {
  id: string
  titulo: string
  campos?: CampoDaFolha[]
  /** Para as secções que são listas: medicação, feridas, contactos. */
  linhas?: string[]
  /** O que a secção diz quando a lista está vazia. Nunca fica em silêncio. */
  vazia?: string
}

export interface Folha {
  nome: string
  /** A linha de cima: quarto, idade, entrada. */
  cabecalho: CampoDaFolha[]
  secoes: SecaoDaFolha[]
  /** Campos críticos em branco. A lista que importa. Zero é o objetivo. */
  emFaltaCritico: CampoDaFolha[]
  /** Todos os campos em branco, críticos ou não. */
  emFalta: number
  /** Quantos campos a folha tem ao todo. */
  total: number
  /** Incoerências entre campos — ver `alertasDaFolha`. */
  alertas: string[]
  /** O dia a que esta folha se refere. Ela é sempre de um momento. */
  em: string
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE É «NÃO HÁ» E O QUE É «NÃO SE SABE»
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Sem acentos, sem pontuação, minúsculas — para comparar o que foi escrito.
 *
 * O traço e o travessão NÃO contam como pontuação a descartar: um campo onde
 * está escrito só «—» é a declaração de que não há, e não um campo vazio.
 */
function nu(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[/\\_]+/g, ' ')      // «n/a» e «s/ alergias» leem-se com espaço
    .replace(/[.,;:!?]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * «Não há» — alguém conferiu e não há.
 *
 * ── PORQUE É QUE É UMA LISTA FECHADA E NÃO UMA EXPRESSÃO ───────────────────
 * Uma expressão larga do género `/^n[ãa]o/` apanharia «não anda sozinha» na
 * mobilidade e transformava informação verdadeira num campo vazio.
 *
 * ── E PORQUE É QUE ESTAR INCOMPLETA NÃO FAZ MAL ────────────────────────────
 * Esta lista nunca vai cobrir todas as maneiras de escrever «não há», e não
 * precisa. O que não estiver aqui conta como `escrito` e aparece na folha tal
 * como foi escrito — «nenhuma conhecida» lê-se perfeitamente bem assim. A
 * lista só serve para dizer a mesma coisa sempre da mesma maneira.
 *
 * O erro que ela não pode cometer é o contrário — e esse depende do
 * `NAO_SE_SABE` em baixo, não deste.
 */
const NAO_HA = new Set([
  'nenhuma', 'nenhum', 'nenhumas', 'nenhuns', 'nada', 'nao', 'nao tem',
  'nao ha', 'nao aplicavel', 'n a', 'n d', 'sem', 'sem alergias',
  's alergias', 'sem alergias conhecidas', 'sem alergias medicamentosas',
  'sem restricoes', 'sem restricao', 'sem feridas', 'sem problemas',
  'nega', 'nega alergias', '0',
  // O «—» sozinho é decidido em `campo()`, antes da limpeza da pontuação.
])

/**
 * «Não se sabe» — que NÃO é «não há».
 *
 * Esta é a armadilha. «Alergias: desconhecidas» é a frase mais honesta que
 * alguém pode escrever e, tratada como «não tem», passa a ser a mais
 * perigosa. Conta como branco, e a folha mostra o que foi escrito.
 */
const NAO_SE_SABE = new Set([
  'desconhecidas', 'desconhecido', 'desconhecida', 'desconhecidos',
  'a confirmar', 'por confirmar', 'sem registo', 'sem informacao',
  'nao sei', 'se desconhece', 'se desconhecem', 'ignora se', 'por apurar',
  // O «?» sozinho é decidido em `campo()`, antes da limpeza da pontuação.
])

interface OpcoesDoCampo {
  critico?: boolean
  onde?: string
  /** «Não há» é uma resposta válida aqui? Sim nas alergias, não na mobilidade. */
  negavel?: boolean
  /** O que imprimir quando está em branco. */
  seBranco?: string
  /** O que imprimir quando é «não há». */
  seNenhum?: string
}

/**
 * Um campo da folha, com o estado certo.
 *
 * Isto é a função mais importante do ficheiro. Toda a honestidade do essencial
 * passa por aqui.
 */
export function campo(
  rotulo: string, valor: string | null | undefined, o: OpcoesDoCampo = {},
): CampoDaFolha {
  const bruto = (valor == null ? '' : String(valor)).trim()

  // Dois campos de um só carácter, curtos e opostos, que a limpeza da
  // pontuação apagaria antes de os distinguir:
  //   «?» é a declaração de que NÃO SE SABE
  //   «—» é a declaração de que NÃO HÁ
  // Por isso são decididos aqui, antes de passarem pelo `nu()`.
  if (/^\?+$/.test(bruto)) {
    return {
      rotulo, valor: o.seBranco || 'Não está registado', estado: 'branco',
      critico: o.critico, onde: o.onde,
    }
  }
  if (o.negavel && /^[-–—]+$/.test(bruto)) {
    return {
      rotulo, valor: o.seNenhum || 'Não tem', estado: 'nenhum',
      critico: o.critico, onde: o.onde,
    }
  }

  const n = nu(bruto)

  if (!bruto || NAO_SE_SABE.has(n)) {
    return {
      rotulo,
      // Quando alguém escreveu «desconhecidas», isso aparece — e aparece
      // marcado como em falta, que é o que é.
      valor: bruto
        ? `${bruto[0].toUpperCase()}${bruto.slice(1)} — por confirmar`
        : (o.seBranco || 'Não está registado'),
      estado: 'branco',
      critico: o.critico,
      onde: o.onde,
    }
  }

  if (o.negavel && NAO_HA.has(n)) {
    return {
      rotulo, valor: o.seNenhum || 'Não tem', estado: 'nenhum',
      critico: o.critico, onde: o.onde,
    }
  }

  return { rotulo, valor: bruto, estado: 'escrito', critico: o.critico, onde: o.onde }
}

/* ══════════════════════════════════════════════════════════════════════════
   A MEDICAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */

export interface MedDaFolha {
  id: string
  name: string
  dose?: string | null
  frequency?: string | null
  indication?: string | null
  route?: string | null
  shifts?: string[] | null
  /** `{"manha":"08:00","noite":"22:00"}` — por turno, nunca uma lista paralela. */
  horas?: Record<string, string> | null
  take_location?: string | null
  sos?: boolean | null
  sos_para?: string | null
  sos_max_dia?: number | null
  sos_intervalo_horas?: number | null
  active?: boolean | null
}

const ROTULO_DO_TURNO: Record<string, string> = {
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite',
}

/** `Brilique 90 mg · oral · para a tensão` — sem os pedaços que não existem. */
function linhaDoMed(m: MedDaFolha): string {
  return [m.name, m.dose, m.route, m.indication ? `para ${m.indication}` : null]
    .filter(Boolean).join(' · ')
}

/**
 * A medicação arrumada por turno, e o SOS à parte.
 *
 * ── PORQUE É QUE O SOS NÃO ENTRA NA LISTA DOS TURNOS ───────────────────────
 * Porque um SOS não é uma dose agendada. Posto entre as tomas da manhã, lê-se
 * como uma coisa a dar — e dá-se. O /o-dia já o separa pela mesma razão
 * (`lib/oDia.ts`, `tarefasDaMedicacao`), e esta folha não inventa aqui uma
 * segunda maneira de pensar no assunto.
 *
 * ── E A MEDICAÇÃO DE CASA ──────────────────────────────────────────────────
 * Num centro de dia há medicação que a família dá em casa. A casa não a
 * administra — mas quem lê o essencial TEM de a conhecer, senão não sabe o que já
 * entrou naquele corpo hoje. Vai numa lista própria, dita pelo que é.
 */
export function medicacaoDaFolha(
  meds: MedDaFolha[], turnos: string[],
): { porTurno: { turno: string; rotulo: string; linhas: string[] }[]; sos: string[]; emCasa: string[] } {
  const ativos = meds.filter(m => m.active !== false)
  const daCasa = ativos.filter(m => m.take_location !== 'casa')

  const porTurno = turnos.map(turno => {
    const linhas = daCasa
      .filter(m => !m.sos)
      // `shifts` vazio quer dizer «todos os turnos» — é a compatibilidade com
      // a medicação criada antes de haver turnos, e o /mar lê-o assim.
      .filter(m => !m.shifts || m.shifts.length === 0 || m.shifts.includes(turno))
      .map(m => {
        const h = m.horas?.[turno]
        return `${h ? `${h} — ` : ''}${linhaDoMed(m)}`
      })
      // Com hora primeiro, por hora; sem hora, por nome. Quem dá a medicação
      // segue o relógio, e não a ordem por que foram escritos na ficha.
      .sort((a, b) => a.localeCompare(b, 'pt'))
    return { turno, rotulo: ROTULO_DO_TURNO[turno] || turno, linhas }
  }).filter(t => t.linhas.length > 0)

  const sos = daCasa.filter(m => m.sos).map(m => {
    const limites = [
      m.sos_max_dia ? `até ${m.sos_max_dia}×/dia` : null,
      m.sos_intervalo_horas ? `mínimo ${m.sos_intervalo_horas}h entre tomas` : null,
    ].filter(Boolean)
    return [
      linhaDoMed({ ...m, indication: null }),
      m.sos_para ? `se ${m.sos_para}` : (m.indication ? `se ${m.indication}` : null),
      limites.length ? limites.join(', ') : 'sem limite escrito',
    ].filter(Boolean).join(' · ')
  }).sort((a, b) => a.localeCompare(b, 'pt'))

  const emCasa = ativos.filter(m => m.take_location === 'casa')
    .map(linhaDoMed).sort((a, b) => a.localeCompare(b, 'pt'))

  return { porTurno, sos, emCasa }
}

/* ══════════════════════════════════════════════════════════════════════════
   AS AVALIAÇÕES
   ══════════════════════════════════════════════════════════════════════════ */

export interface AvaliacaoDaFolha {
  scale: string
  score: number
  date?: string | null
  created_at?: string | null
}

/** Meses desde um dia, sem passar pelo fuso horário. */
function mesesDesde(iso: string, hoje: string): number {
  const [ay, am, ad] = iso.slice(0, 10).split('-').map(Number)
  const [by, bm, bd] = hoje.slice(0, 10).split('-').map(Number)
  if (!ay || !by) return 0
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0)
}

/**
 * A avaliação mais recente de cada escala.
 *
 * Só a mais recente. Um O essencial com o histórico do Barthel deixa de ser um
 * O essencial — e quem precisa da evolução abre o separador das avaliações, que já
 * a mostra em gráfico.
 *
 * A idade da avaliação aparece sempre. Um Barthel de há dois anos não descreve
 * esta pessoa, e um número sem data engana mais do que não haver número.
 */
export function avaliacoesDaFolha(
  avaliacoes: AvaliacaoDaFolha[], hoje = ptDate(),
): { linhas: string[]; desatualizadas: string[] } {
  const maisRecente = new Map<string, AvaliacaoDaFolha>()
  for (const a of avaliacoes) {
    const d = (a.date || a.created_at || '').slice(0, 10)
    if (!d) continue
    const atual = maisRecente.get(a.scale)
    const dAtual = (atual?.date || atual?.created_at || '').slice(0, 10)
    if (!atual || d > dAtual) maisRecente.set(a.scale, { ...a, date: d })
  }

  const linhas: string[] = []
  const desatualizadas: string[] = []
  for (const [escala, a] of [...maisRecente].sort((x, y) => x[0].localeCompare(y[0]))) {
    const cfg = SCALES[escala as ScaleType]
    const nome = cfg?.label || escala
    const nivel = cfg ? levelOf(escala as ScaleType, a.score).label : null
    const meses = mesesDesde(a.date!, hoje)
    const idade = meses >= 12
      ? `há ${Math.floor(meses / 12)} ano${Math.floor(meses / 12) > 1 ? 's' : ''}`
      : meses >= 1 ? `há ${meses} ${meses > 1 ? 'meses' : 'mês'}` : 'este mês'
    linhas.push([
      `${nome}: ${a.score}${cfg ? `/${cfg.max}` : ''}`,
      nivel, `${emPortugues(a.date)} (${idade})`,
    ].filter(Boolean).join(' · '))
    // Seis meses é o intervalo que a Segurança Social usa para a revisão do
    // plano individual, e é o mesmo que o /conformidade já aplica.
    if (meses >= 6) desatualizadas.push(`${nome} — ${emPortugues(a.date)}`)
  }
  return { linhas, desatualizadas }
}

/* ══════════════════════════════════════════════════════════════════════════
   AS FERIDAS E OS CONTACTOS
   ══════════════════════════════════════════════════════════════════════════ */

export interface FeridaDaFolha {
  location?: string | null
  type?: string | null
  stage?: string | null
  status?: string | null
  dressing?: string | null
  treatment?: string | null
  onset_date?: string | null
}

export function feridasDaFolha(feridas: FeridaDaFolha[]): string[] {
  return feridas
    .filter(f => f.status !== 'healed' && f.status !== 'cicatrizada')
    .map(f => [
      f.location || 'local não registado',
      f.stage ? `grau ${f.stage}` : null,
      f.dressing || f.treatment || '⚠ sem tratamento registado',
      f.onset_date ? `desde ${emPortugues(f.onset_date)}` : null,
    ].filter(Boolean).join(' · '))
}

export interface ContactoDaFolha {
  name?: string | null
  relationship?: string | null
  phone?: string | null
  is_emergency?: boolean | null
  is_legal_guardian?: boolean | null
}

/**
 * Quem se telefona, por ordem de quem se telefona primeiro.
 *
 * O contacto de emergência vem antes de todos, e o representante legal aparece
 * marcado: há decisões que só ele pode tomar, e às três da manhã ninguém tem
 * tempo para descobrir qual dos cinco números é o dele.
 */
export function contactosDaFolha(
  contactos: ContactoDaFolha[], emergenciaNaFicha?: { nome?: string | null; telefone?: string | null },
): string[] {
  const linhas = [...contactos]
    .sort((a, b) => Number(!!b.is_emergency) - Number(!!a.is_emergency))
    .filter(c => c.name || c.phone)
    .map(c => [
      c.name || 'sem nome',
      c.relationship,
      c.phone || '⚠ sem telefone',
      c.is_emergency ? 'EMERGÊNCIA' : null,
      c.is_legal_guardian ? 'representante legal' : null,
    ].filter(Boolean).join(' · '))

  // O telefone de emergência da própria ficha. Só entra se não houver nenhum
  // contacto na lista com esse número — senão a folha diz duas vezes a mesma
  // pessoa, e uma folha que se repete lê-se pior.
  const tel = (emergenciaNaFicha?.telefone || '').replace(/\s+/g, '')
  if (tel && !contactos.some(c => (c.phone || '').replace(/\s+/g, '') === tel)) {
    linhas.unshift([
      emergenciaNaFicha?.nome || 'Contacto de emergência da ficha',
      tel, 'EMERGÊNCIA',
    ].filter(Boolean).join(' · '))
  }
  return linhas
}

/* ══════════════════════════════════════════════════════════════════════════
   AS INCOERÊNCIAS
   ══════════════════════════════════════════════════════════════════════════ */

const RISCO_ALTO = /\b(alto|elevad|muito alto|grave|severo|high)\w*/i

export interface PlanoDaFolha {
  mobility?: string | null
  hygiene?: string | null
  nutrition_plan?: string | null
  skin_care?: string | null
  fall_prevention?: string | null
  pressure_ulcer_prevention?: string | null
  positioning_schedule?: string | null
  diet_type?: string | null
  diet_texture?: string | null
  fluid_restriction?: boolean | null
  fluid_restriction_ml?: number | null
  medication_notes?: string | null
  behavioral_notes?: string | null
}

/**
 * O que não bate certo entre dois campos que, cada um por si, está preenchido.
 *
 * ── PORQUE É QUE ISTO VALE A PENA ──────────────────────────────────────────
 * Uma folha que só avisa dos campos vazios avisa de coisas óbvias. O que
 * ninguém vê são as contradições: risco de úlcera elevado e nenhum esquema de
 * posicionamento escrito — os dois campos estão «preenchidos», e no entanto
 * falta ali exatamente aquilo que o primeiro campo pede.
 *
 * São quatro, e só quatro. Uma lista longa de avisos destes é uma lista que se
 * fecha sem ler.
 */
export function alertasDaFolha(
  utente: { fall_risk?: string | null; pressure_risk?: string | null; mobility?: string | null },
  plano: PlanoDaFolha | null | undefined,
  meds: MedDaFolha[],
  feridas: FeridaDaFolha[],
): string[] {
  const a: string[] = []
  const posicionamento = (plano?.positioning_schedule || '').trim()
  const prevencao = (plano?.pressure_ulcer_prevention || '').trim()

  if (RISCO_ALTO.test(utente.pressure_risk || '') && !posicionamento && !prevencao) {
    a.push('Risco de úlcera de pressão elevado, e não há esquema de posicionamento escrito. '
      + 'Quem entrar de novo não sabe de quantas em quantas horas se muda a pessoa de posição.')
  }
  if (RISCO_ALTO.test(utente.fall_risk || '') && !(plano?.mobility || utente.mobility || '').trim()) {
    a.push('Risco de queda elevado, e a mobilidade não está descrita. '
      + 'Não se sabe se esta pessoa se levanta sozinha.')
  }
  const semTratamento = feridas.filter(f =>
    f.status !== 'healed' && f.status !== 'cicatrizada' && !(f.dressing || f.treatment || '').trim())
  if (semTratamento.length) {
    a.push(`${semTratamento.length === 1 ? 'Há uma ferida ativa sem' : `Há ${semTratamento.length} feridas ativas sem`} `
      + 'tratamento registado. Quem fizer o penso não sabe o que aplicar.')
  }
  const sosSemLimite = meds.filter(m => m.active !== false && m.sos && !m.sos_max_dia)
  if (sosSemLimite.length) {
    a.push(`${sosSemLimite.length === 1 ? 'Um medicamento SOS' : `${sosSemLimite.length} medicamentos SOS`} `
      + 'sem máximo por dia. Em três turnos diferentes, pode ser dado três vezes sem ninguém saber.')
  }
  return a
}

/* ══════════════════════════════════════════════════════════════════════════
   A FOLHA
   ══════════════════════════════════════════════════════════════════════════ */

export interface DadosDaFolha {
  /** A linha de `patients`. */
  utente: Record<string, any>
  meds: MedDaFolha[]
  avaliacoes: AvaliacaoDaFolha[]
  plano?: PlanoDaFolha | null
  feridas?: FeridaDaFolha[]
  contactos?: ContactoDaFolha[]
  /** Os turnos que ESTA casa tem. Um centro de dia não tem noite. */
  turnos: string[]
  /**
   * `cfg.hasBeds`. Decide duas coisas.
   *
   * A primeira é óbvia: o quarto só aparece no cabeçalho de quem tem quartos.
   *
   * A segunda não é. Quando não há NENHUM medicamento registado, numa casa
   * onde a pessoa vive isso é quase sempre um buraco nos dados — e quem ler a
   * folha não dá nada. Num centro de dia é o normal: a família dá a medicação
   * em casa. A mesma linha não pode dizer as duas coisas, e um aviso que grita
   * em falso num centro de dia passa a ser ignorado também no lar.
   */
  temQuartos: boolean
  /**
   * A casa trata feridas? (`cfg.hasWounds`.)
   *
   * Um centro de dia não tem a ferramenta das feridas, e por isso a secção não
   * aparece. «Nenhuma ferida ativa registada», numa casa que nunca registou
   * feridas nenhumas, não é informação — é uma linha a mais numa folha que tem
   * de caber numa página.
   */
  temFeridas?: boolean
  /** Como esta casa chama as pessoas: «residente», «utente», «cliente». */
  comoSeChama?: string
  hoje?: string
}

export function montarFolha(d: DadosDaFolha): Folha {
  const u = d.utente || {}
  const hoje = d.hoje || ptDate()
  const plano = d.plano || null
  const feridas = d.feridas || []
  const pessoa = d.comoSeChama || 'utente'

  /* ── Cabeçalho ─────────────────────────────────────────────────────────── */
  const idade = anosDesde(u.date_of_birth || u.birth_date) ?? (u.age || null)
  const cabecalho: CampoDaFolha[] = [
    ...(d.temQuartos
      ? [campo('Quarto', u.room_number, { onde: 'ficha', seBranco: 'Sem quarto atribuído' })]
      : []),
    campo('Idade', idade == null ? null : `${idade} anos`, { onde: 'ficha' }),
    campo('Sexo', u.sex, { onde: 'ficha' }),
    campo('Entrada', u.admission_date ? emPortugues(u.admission_date) : null, { onde: 'ficha' }),
    campo('Nº utente (SNS)', u.sns_number, { onde: 'ficha' }),
  ]

  /* ── Alergias: a razão de ser desta folha ──────────────────────────────── */
  const alergias = campo('Alergias', u.allergies, {
    critico: true, negavel: true, onde: 'ficha',
    seBranco: '⚠ NÃO ESTÁ REGISTADO — não quer dizer que não tenha',
    seNenhum: 'Sem alergias conhecidas',
  })

  /* ── Saúde ─────────────────────────────────────────────────────────────── */
  const saude: CampoDaFolha[] = [
    campo('Diagnóstico', u.diagnosis, { onde: 'ficha' }),
    campo('Problemas de saúde', u.conditions, { onde: 'ficha' }),
    campo('Estado cognitivo', u.cognitive_status, { onde: 'ficha' }),
    campo('Médico assistente', u.doctor, {
      critico: true, onde: 'ficha',
      seBranco: '⚠ Não está registado — ninguém a quem ligar sobre a medicação',
    }),
  ]

  /* ── Alimentação ───────────────────────────────────────────────────────── */
  // A textura é o campo que engasga. Uma pessoa com disfagia a quem se dá um
  // copo de água porque a folha não dizia nada é a ocorrência `choking` que o
  // lib/ocorrencias.ts já conhece.
  const alimentacao: CampoDaFolha[] = [
    campo('Dieta', plano?.diet_type || u.diet, {
      critico: true, negavel: true, onde: 'plano',
      seBranco: '⚠ NÃO ESTÁ REGISTADA', seNenhum: 'Dieta geral, sem restrições',
    }),
    campo('Textura', plano?.diet_texture, {
      critico: true, negavel: true, onde: 'plano',
      seBranco: '⚠ NÃO ESTÁ REGISTADA — confirmar antes de dar líquidos',
      seNenhum: 'Normal',
    }),
    campo('Restrição de líquidos',
      plano?.fluid_restriction
        ? (plano.fluid_restriction_ml ? `Sim — ${plano.fluid_restriction_ml} ml/dia` : 'Sim')
        : (plano?.fluid_restriction === false ? 'sem' : null),
      { negavel: true, onde: 'plano', seNenhum: 'Não', seBranco: 'Não está registada' }),
    campo('Plano alimentar', plano?.nutrition_plan, { onde: 'plano' }),
  ]

  /* ── Mobilidade ────────────────────────────────────────────────────────── */
  const mobilidade: CampoDaFolha[] = [
    campo('Mobilidade e transferências', plano?.mobility || u.mobility, {
      critico: true, onde: 'plano',
      seBranco: '⚠ NÃO ESTÁ REGISTADA — confirmar antes de levantar',
    }),
    campo('Risco de queda', u.fall_risk, { onde: 'ficha' }),
    campo('Risco de úlcera', u.pressure_risk, { onde: 'ficha' }),
    campo('Posicionamento', plano?.positioning_schedule, { onde: 'plano' }),
    campo('Cuidados à pele', plano?.skin_care, { onde: 'plano' }),
    campo('Higiene', plano?.hygiene, { onde: 'plano' }),
  ]

  /* ── Medicação ─────────────────────────────────────────────────────────── */
  const med = medicacaoDaFolha(d.meds || [], d.turnos)
  const secoesDeMed: SecaoDaFolha[] = []
  const linhasDeMed = med.porTurno.flatMap(t => [`${t.rotulo}:`, ...t.linhas.map(l => `   ${l}`)])
  secoesDeMed.push({
    id: 'medicacao', titulo: 'Medicação', linhas: linhasDeMed,
    vazia: d.temQuartos
      ? `⚠ Nenhum medicamento registado. Se este ${pessoa} toma medicação, ela não está no Phlox.`
      : 'Nenhum medicamento dado na casa.',
  })
  if (med.sos.length) secoesDeMed.push({ id: 'sos', titulo: 'SOS — só se for preciso', linhas: med.sos })
  if (med.emCasa.length) {
    secoesDeMed.push({
      id: 'medEmCasa', titulo: 'Toma em casa — a casa não administra', linhas: med.emCasa,
    })
  }

  /* ── Avaliações, feridas, contactos ────────────────────────────────────── */
  const av = avaliacoesDaFolha(d.avaliacoes || [], hoje)
  const linhasDeFeridas = feridasDaFolha(feridas)
  const linhasDeContactos = contactosDaFolha(d.contactos || [], {
    nome: u.emergency_contact, telefone: u.emergency_phone,
  })

  const secoes: SecaoDaFolha[] = [
    { id: 'alergias', titulo: 'Alergias', campos: [alergias] },
    { id: 'saude', titulo: 'Saúde', campos: saude },
    ...secoesDeMed,
    { id: 'alimentacao', titulo: 'Alimentação', campos: alimentacao },
    { id: 'mobilidade', titulo: 'Mobilidade e pele', campos: mobilidade },
    {
      id: 'avaliacoes', titulo: 'Avaliações', linhas: av.linhas,
      vazia: 'Nenhuma avaliação feita.',
    },
    ...(d.temFeridas === false ? [] : [{
      id: 'feridas', titulo: 'Feridas ativas', linhas: linhasDeFeridas,
      vazia: 'Nenhuma ferida ativa registada.',
    }]),
    {
      id: 'contactos', titulo: 'Quem avisar', linhas: linhasDeContactos,
      vazia: '⚠ NINGUÉM REGISTADO — uma queda às três da manhã não tem a quem telefonar.',
    },
    {
      id: 'comportamento', titulo: 'A ter em conta',
      campos: [
        campo('Comportamento', plano?.behavioral_notes, { onde: 'plano' }),
        campo('Notas da medicação', plano?.medication_notes, { onde: 'plano' }),
        campo('Observações da ficha', u.notes, { onde: 'ficha' }),
      ],
    },
  ]

  /* ── A conta ───────────────────────────────────────────────────────────── */
  const todos = [...cabecalho, ...secoes.flatMap(s => s.campos || [])]
  const emFaltaCritico = todos.filter(c => c.critico && c.estado === 'branco')
  // «Quem avisar» não é um campo, é uma lista — mas uma folha destas sem ninguém para
  // telefonar falha pela mesma razão, e tem de contar na mesma lista.
  if (!linhasDeContactos.length) {
    emFaltaCritico.push({
      rotulo: 'Quem avisar', valor: '⚠ Ninguém registado', estado: 'branco',
      critico: true, onde: 'ficha',
    })
  }

  const alertas = [
    ...alertasDaFolha(u, plano, d.meds || [], feridas),
    ...av.desatualizadas.map(x => `Avaliação com mais de seis meses: ${x}.`),
  ]

  return {
    nome: u.name || 'Sem nome',
    cabecalho, secoes,
    emFaltaCritico,
    emFalta: todos.filter(c => c.estado === 'branco').length,
    total: todos.length,
    alertas,
    em: hoje,
  }
}

/**
 * A frase de cima, para quem olha para a folha antes de a ler.
 *
 * Não é uma percentagem. «O essencial 72% completo» não diz nada a ninguém e
 * convida a tratar o resto como arredondamento. O que interessa é se falta
 * alguma das coisas que fazem decidir — ver `critico` em `CampoDaFolha`.
 */
export function resumoDaFolha(c: Folha): string {
  if (c.emFaltaCritico.length) {
    return `Falta o essencial: ${c.emFaltaCritico.map(x => x.rotulo.toLowerCase()).join(', ')}.`
  }
  if (c.emFalta) return `O essencial está preenchido. Faltam ${c.emFalta} campos menos urgentes.`
  return 'Folha completa.'
}
