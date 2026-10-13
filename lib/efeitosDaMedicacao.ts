// lib/efeitosDaMedicacao.ts
// ═══════════════════════════════════════════════════════════════════════════
// OS EFEITOS CONHECIDOS DE UM MEDICAMENTO — procurados uma vez, lidos sempre
// ═══════════════════════════════════════════════════════════════════════════
//
// Serve duas coisas:
//
//  1. A FICHA do medicamento na página do utente (abas com o que o rótulo diz).
//  2. O CRUZAMENTO com o texto de uma ocorrência: «caiu de madrugada» contra a
//     lista de efeitos da medicação que essa pessoa toma.
//
// ── A FONTE, E O QUE ELA NÃO É ─────────────────────────────────────────────
// Vem do rótulo publicado pela FDA (OpenFDA), através da /api/drug-reference
// que já existia. É texto de bula, em inglês, escrito pelo fabricante.
//
// Não é uma regra de decisão clínica, não é uma lista de diagnósticos, e não
// cobre tudo: um medicamento sem rótulo na FDA não aparece aqui, e isso NÃO
// quer dizer que não tenha efeitos. É por isso que a frase que a aplicação
// mostra ao lado é tão importante quanto o conteúdo — ver `AVISO` no fim.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { tentativasDeNome } from './dciParaIngles'
import { rotuloDe } from './rotuloFDA'

/** Quantos dias até valer a pena voltar a perguntar ao OpenFDA. */
const VALIDADE_DIAS = 180

export interface EfeitosDeMedicamento {
  nome: string
  nome_original: string | null
  efeitos: string[]
  texto_adversos: string | null
  interacoes: string | null
  avisos: string | null
  indicacoes: string | null
  fonte: string | null
  encontrado: boolean
}

/**
 * O nome pelo qual se guarda.
 *
 * «Varfine 5mg comprimidos» e «VARFINE» têm de dar na mesma linha, senão a
 * cache enche-se de variantes do mesmo medicamento e nenhuma acerta.
 */
export function nomeNormalizado(nome: string): string {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    // dose e forma farmacêutica: o que vem a seguir ao nome não o identifica
    .replace(/\b\d+[.,]?\d*\s*(mg|mcg|µg|g|ml|ui|u\.?i\.?|%)\b.*$/i, '')
    .replace(/\b(comprimidos?|capsulas?|xarope|solucao|gotas|ampolas?|saquetas?|adesivos?|pomada|creme|gel|supositorios?|inalador|seringa)\b.*$/i, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A lista de efeitos, em palavras soltas comparáveis.
 *
 * O rótulo da FDA vem num parágrafo corrido («The most common adverse
 * reactions were nausea, dizziness, somnolence…»). Para cruzar com o texto de
 * uma ocorrência é preciso ter os termos separados — e em português, porque é
 * em português que alguém escreve «teve tonturas».
 *
 * A tradução dos termos frequentes está aqui à mão de propósito: é uma lista
 * curta, fechada e verificável. Mandar um parágrafo de bula à IA para extrair
 * sintomas a cada ocorrência custava dinheiro e introduzia uma invenção
 * possível num sítio onde ela não pode entrar.
 */
const TERMOS: Record<string, string[]> = {
  'dizziness': ['tontura', 'tonturas', 'desequilibrio', 'zonzo'],
  'somnolence': ['sonolencia', 'sonolento', 'sonolenta', 'muito a dormir'],
  'drowsiness': ['sonolencia', 'sonolento', 'sonolenta'],
  'sedation': ['prostracao', 'muito parado', 'apatia'],
  'confusion': ['confusao', 'confuso', 'confusa', 'desorientado', 'desorientada'],
  'falls': ['queda', 'quedas', 'caiu'],
  'hypotension': ['tensao baixa', 'hipotensao'],
  'orthostatic hypotension': ['tensao baixa ao levantar', 'hipotensao ortostatica'],
  'syncope': ['desmaio', 'desmaiou', 'sincope'],
  'nausea': ['nausea', 'nauseas', 'enjoo'],
  'vomiting': ['vomito', 'vomitos', 'vomitou'],
  'diarrhea': ['diarreia'],
  'diarrhoea': ['diarreia'],
  'constipation': ['obstipacao', 'prisao de ventre'],
  'headache': ['dor de cabeca', 'cefaleia'],
  'rash': ['erupcao', 'manchas na pele', 'borbulhas'],
  'pruritus': ['comichao', 'prurido'],
  'bleeding': ['hemorragia', 'sangrou', 'sangramento'],
  'bruising': ['hematoma', 'nodoa negra', 'nodoas negras'],
  'edema': ['inchaco', 'edema', 'pernas inchadas'],
  'oedema': ['inchaco', 'edema'],
  'tremor': ['tremor', 'tremores'],
  'insomnia': ['insonia', 'nao dormiu'],
  'agitation': ['agitacao', 'agitado', 'agitada'],
  'anxiety': ['ansiedade', 'ansioso', 'ansiosa'],
  'hallucinations': ['alucinacoes', 'a ver coisas'],
  'dry mouth': ['boca seca'],
  'blurred vision': ['visao turva', 've mal'],
  'urinary retention': ['retencao urinaria', 'nao urina'],
  'hypoglycemia': ['hipoglicemia', 'acucar baixo'],
  'hypoglycaemia': ['hipoglicemia', 'acucar baixo'],
  'weight gain': ['aumento de peso'],
  'weight loss': ['perda de peso', 'emagreceu'],
  'cough': ['tosse'],
  'fatigue': ['cansaco', 'fraqueza', 'muito cansado', 'muito cansada'],
  'asthenia': ['fraqueza', 'sem forcas'],
  'muscle pain': ['dores musculares', 'dores nos musculos'],
  'myalgia': ['dores musculares'],
  'arrhythmia': ['arritmia', 'coracao acelerado'],

  /* ── OS QUE FALTAVAM, ACHADOS A MEDIR ─────────────────────────────────────
     A varfarina devolvia 898 caracteres de texto e ZERO efeitos: o rótulo
     dela diz «hemorrhage» e a tabela só tinha «bleeding». Um medicamento com
     texto e sem termos extraídos é pior do que um sem texto — o cruzamento
     passa por ele em silêncio e ninguém percebe que passou.

     Daí esta segunda leva, tirada dos rótulos dos medicamentos que uma casa
     portuguesa dá todos os dias. */
  'hemorrhage': ['hemorragia', 'sangrou', 'sangramento', 'sangue'],
  'haemorrhage': ['hemorragia', 'sangrou', 'sangramento'],
  'hematoma': ['hematoma', 'nodoa negra'],
  'epistaxis': ['sangrou do nariz', 'hemorragia nasal'],
  'necrosis': ['necrose', 'tecido morto'],
  'gangrene': ['gangrena'],
  'kidney injury': ['insuficiencia renal', 'rins'],
  'renal impairment': ['insuficiencia renal'],
  'hyperkalemia': ['potassio alto', 'hipercaliemia'],
  'hypokalemia': ['potassio baixo', 'hipocaliemia'],
  'hyponatremia': ['sodio baixo', 'hiponatremia'],
  'dehydration': ['desidratacao', 'desidratado', 'desidratada'],
  'anorexia': ['perda de apetite', 'nao come', 'sem apetite'],
  'appetite': ['apetite', 'nao come'],
  'abdominal pain': ['dor de barriga', 'dor abdominal'],
  'dyspepsia': ['indigestao', 'azia'],
  'gastrointestinal bleeding': ['sangue nas fezes', 'hemorragia digestiva'],
  'melena': ['fezes pretas', 'melenas'],
  'dysphagia': ['dificuldade em engolir', 'engasga'],
  'dyspnea': ['falta de ar', 'dificuldade em respirar'],
  'dyspnoea': ['falta de ar', 'dificuldade em respirar'],
  'palpitations': ['palpitacoes', 'coracao acelerado'],
  'chest pain': ['dor no peito'],
  'extrapyramidal': ['rigidez', 'movimentos involuntarios'],
  'akathisia': ['inquietacao', 'nao para quieto', 'nao para quieta'],
  'parkinsonism': ['rigidez', 'marcha arrastada'],
  'dyskinesia': ['movimentos involuntarios'],
  'seizure': ['convulsao', 'convulsoes'],
  'convulsion': ['convulsao', 'convulsoes'],
  'delirium': ['delirio', 'muito confuso', 'muito confusa'],
  'depression': ['tristeza', 'apatico', 'apatica', 'depressao'],
  'irritability': ['irritado', 'irritada', 'irritabilidade'],
  'aggression': ['agressivo', 'agressiva', 'agressividade'],
  'vertigo': ['vertigem', 'vertigens'],
  'tinnitus': ['zumbidos', 'ouvidos a apitar'],
  'incontinence': ['incontinencia', 'perdeu urina'],
  'urinary tract infection': ['infecao urinaria'],
  'photosensitivity': ['sensibilidade ao sol', 'queimou ao sol'],
  'alopecia': ['queda de cabelo'],
  'anemia': ['anemia', 'muito palido', 'muito palida'],
  'anaemia': ['anemia'],
  'thrombocytopenia': ['plaquetas baixas'],
  'neutropenia': ['defesas baixas'],
  'hepatotoxicity': ['figado', 'hepatotoxicidade'],
  'jaundice': ['ictericia', 'amarelo', 'amarelado'],
  'angioedema': ['inchaco da cara', 'angioedema'],
  'anaphylaxis': ['reacao alergica grave', 'anafilaxia'],
  'hypersensitivity': ['reacao alergica', 'alergia'],
  'fever': ['febre'],
  'pyrexia': ['febre'],
  'infection': ['infecao'],
  'sweating': ['suores', 'transpiracao'],
  'flushing': ['rubor', 'cara vermelha'],
  'bradycardia': ['pulso lento', 'bradicardia'],
  'tachycardia': ['coracao acelerado', 'taquicardia'],
}

export function termosDoRotulo(texto: string | null | undefined): string[] {
  if (!texto) return []
  const t = texto.toLowerCase()
  const fora = new Set<string>()
  for (const [ingles, portugueses] of Object.entries(TERMOS)) {
    if (t.includes(ingles)) portugueses.forEach(p => fora.add(p))
  }
  return [...fora]
}

/**
 * Os termos, recalculados a partir do TEXTO guardado.
 *
 * ── PORQUE É QUE NÃO SE CONFIA NO QUE ESTÁ GRAVADO ─────────────────────────
 * A coluna `efeitos` é extraída do texto do rótulo pelo dicionário em `TERMOS`.
 * Esse dicionário vai crescer: hoje acrescentei-lhe cinquenta entradas porque
 * a varfarina devolvia 898 caracteres de texto e ZERO termos — o rótulo dela
 * diz «hemorrhage» e a tabela só tinha «bleeding».
 *
 * Mas as linhas já gravadas ficaram com a extração velha, e só voltariam a
 * ser calculadas daqui a seis meses. Medi: a varfarina respondia em 92ms (da
 * cache, com zero termos) enquanto um medicamento novo demorava 1883ms e vinha
 * completo. A melhoria do dicionário não chegava a quem já lá estava.
 *
 * O caro de obter é o TEXTO. A extração é gratuita. Por isso guarda-se o texto
 * e recalcula-se sempre — e cada melhoria do dicionário vale imediatamente
 * para tudo o que já foi consultado, sem migração e sem voltar a pedir nada.
 */
function comTermosFrescos(f: EfeitosDeMedicamento): EfeitosDeMedicamento {
  if (!f.texto_adversos) return f
  return { ...f, efeitos: termosDoRotulo(f.texto_adversos) }
}

/** O cliente de serviço — só quem escreve precisa dele. */
function servico(): SupabaseClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })
}

const semTabela = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')

/**
 * Os efeitos de um medicamento, da cache ou do OpenFDA.
 *
 * Nunca lança. Se a tabela ainda não existe, se a rede falha, se o
 * medicamento não está no rótulo da FDA — devolve `null` ou um registo com
 * `encontrado: false`, e quem chama decide o que dizer. Numa página de
 * cuidados, uma procura falhada não pode partir nada.
 */
export async function efeitosDe(
  supabase: SupabaseClient,
  nome: string,
): Promise<EfeitosDeMedicamento | null> {
  const chave = nomeNormalizado(nome)
  if (!chave || chave.length < 3) return null

  /* A CACHE É UM ATALHO, NÃO UMA CONDIÇÃO.
     A primeira versão disto fazia `if (semTabela(error)) return null` — e com
     isso a funcionalidade inteira ficava morta até alguém correr a migração,
     quando podia funcionar na mesma, só mais devagar. Testei e era isso que
     se passava: seis medicamentos, seis «não encontrado», sem uma única
     chamada ao OpenFDA.

     Sem tabela, vai-se buscar e não se guarda. Com tabela, guarda-se. */
  const { data: guardado, error } = await supabase
    .from('medicamento_efeitos').select('*').eq('nome', chave).maybeSingle()
  const semCache = semTabela(error)
  if (error && !semCache) {
    console.error('[phlox:efeitos-ler]', error)
    // Erro de leitura não é ausência: tenta na mesma, sem contar com a cache.
  }

  const fresco = !semCache && guardado
    && (Date.now() - new Date(guardado.atualizado_em).getTime()) < VALIDADE_DIAS * 86400000
  if (fresco) return comTermosFrescos(guardado as EfeitosDeMedicamento)

  // Não está, ou está velho: vai buscar. Se não conseguir, devolve o velho —
  // uma bula de há sete meses vale mais do que nenhuma.
  const novo = await procurarEGuardar(chave, nome)
  return novo || (guardado ? comTermosFrescos(guardado as EfeitosDeMedicamento) : null)
}

/**
 * Pergunta ao OpenFDA e guarda. Usa a chave de serviço: a tabela é de leitura
 * aberta e escrita só do servidor.
 */
export async function procurarEGuardar(
  chave: string, original: string,
): Promise<EfeitosDeMedicamento | null> {
  const sv = servico()

  /* ── O NOME TEM DE IR EM INGLÊS ─────────────────────────────────────────
     O OpenFDA indexa pelo INN inglês. Numa casa portuguesa todos os nomes
     escritos são portugueses, e a diferença é total: `warfarin` devolve a
     ficha completa, `varfarina` devolve «sem ficha». Sem esta tradução, a
     funcionalidade inteira respondia «não encontrado» a toda a gente — e
     parecia a funcionar, porque «não encontrado» é uma resposta válida.
     Ver lib/dciParaIngles.ts.

     ── E PORQUE É QUE ISTO NÃO FAZ UM `fetch` A SI PRÓPRIO ─────────────────
     Fazia: chamava a `/api/drug-reference` com um endereço de base vindo de
     `new URL(req.url).origin`. Esse endereço é construído a partir do
     cabeçalho `Host`, e quem o controlasse fazia o servidor ir buscar JSON a
     um sítio dele — JSON que depois era escrito, com a chave de serviço, na
     `medicamento_efeitos`, que todas as casas leem. Envenenar a bula que
     aparece na ficha de todos os utentes de todas as instituições.

     A função está aqui ao lado. Chamando-a directamente, não há endereço
     nenhum para falsificar. */
  let dados: Awaited<ReturnType<typeof rotuloDe>> | null = null
  let redeEmBaixo = false
  for (const tentativa of tentativasDeNome(chave)) {
    try {
      const j = await rotuloDe(tentativa)
      if (j.found) { dados = j; break }
      dados = dados || j      // guarda o «não encontrado» caso nenhuma acerte
    } catch {
      redeEmBaixo = true
    }
  }
  // Rede em baixo e nada lido: não se guarda um «não encontrado» falso, que
  // depois ficava em cache seis meses.
  if (redeEmBaixo && !dados) return null

  const linha = {
    nome: chave,
    nome_original: original.slice(0, 120),
    encontrado: !!dados?.found,
    efeitos: termosDoRotulo(dados?.adverse_reactions),
    texto_adversos: dados?.adverse_reactions ?? null,
    interacoes: dados?.interactions ?? null,
    avisos: dados?.boxed_warning || dados?.warnings || null,
    indicacoes: dados?.indications ?? null,
    fonte: dados?.source ?? null,
    atualizado_em: new Date().toISOString(),
  }

  /* Sem a tabela, a procura vale na mesma — só não fica guardada. É por isso
     que o resultado se devolve ANTES de olhar para o erro da escrita. */
  if (sv) {
    const { error } = await sv.from('medicamento_efeitos').upsert(linha, { onConflict: 'nome' })
    if (error && !semTabela(error)) console.error('[phlox:efeitos-guardar]', error)
  }
  return linha as EfeitosDeMedicamento
}

/**
 * A frase que acompanha qualquer aviso destes.
 *
 * O Fernando pediu-a «melhor escrita» do que o costume, e tem razão: a fórmula
 * habitual («isto não substitui aconselhamento médico») é tão repetida que já
 * ninguém a lê. Esta diz três coisas concretas — de onde vem, o que não
 * cobre, e quem decide — porque é isso que alguém precisa de saber para a usar
 * bem.
 */
export const AVISO =
  'Isto é o que a bula do medicamento descreve, não um diagnóstico. '
  + 'A coincidência entre um sintoma e a lista de um rótulo não prova causa, '
  + 'e a ausência não a exclui — há efeitos que nenhuma bula lista. '
  + 'Serve para levantar a pergunta a quem prescreve, nunca para responder por ele.'
