// lib/memoriaDocumentos.ts
// ─────────────────────────────────────────────────────────────────────────────
// A impressão digital de um documento, e o que se faz com ela.
//
// ── O PROBLEMA ─────────────────────────────────────────────────────────────
// Analisar duas vezes o mesmo relatório dava dois textos diferentes. É o que um
// modelo de linguagem faz — cada chamada é nova. Mas para quem está a tentar
// perceber um exame isso mina a confiança toda: se a resposta muda, qual delas
// é verdade?
//
// A solução não é baixar a temperatura (continuaria a variar). É guardar a
// PRIMEIRA leitura com o sha-256 do conteúdo e devolvê-la quando o mesmo
// documento voltar. A resposta passa a ser estável porque é literalmente a
// mesma, não porque o modelo se portou bem.
//
// ── O QUE SE GUARDA, E QUANDO ──────────────────────────────────────────────
// Só com a memória LIGADA (profiles.memoria_documentos). Desligada, não se
// grava nada — nem a análise, nem a impressão digital — e cada leitura é nova.
// É desligada mesmo, não "escondida".
//
// ── E DE QUEM É O DOCUMENTO (sprint149) ────────────────────────────────────
// A memória é sempre de QUEM MANDOU ANALISAR — é a conta dele, é o arquivo
// dele. Mas lá dentro há uma gaveta por pessoa: analisar o relatório de
// alguém que se encontrou uma vez não pode misturar-se com o que o Phlox sabe
// sobre o próprio. Quem decide a gaveta é lib/sujeitos.ts, a partir do nome
// que vem no papel; o que cada gaveta sabe está em lib/dossier.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { chaveDoNome, escolherSujeito, juntarGrafia, nomeCurto, type SujeitoConhecido } from './sujeitos'
import { normalizarDossier, resumirParaIA, juntarFactos, guardarResposta as responderNoDossier,
         dispensarPergunta as dispensarNoDossier, contarDossier,
         type Dossier, type FactosNovos, type PerguntaPendente } from './dossier'

/** sha-256 do conteúdo, em hexadecimal.
 *
 *  Feito no browser: o ficheiro já lá está e não vale a pena mandá-lo para o
 *  servidor só para o medir. Funciona com o base64 de uma imagem/PDF ou com o
 *  texto colado — o que conta é ser o MESMO input a dar o MESMO hash. */
export async function impressaoDigital(conteudo: string): Promise<string> {
  // `crypto.subtle` exige contexto seguro (https ou localhost). Sem ele, não
  // há memória — e é melhor não haver do que haver uma chave fraca a agrupar
  // documentos diferentes debaixo da mesma leitura.
  if (typeof crypto === 'undefined' || !crypto.subtle) return ''
  try {
    const bytes = new TextEncoder().encode(conteudo)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

export interface PreferenciasMemoria {
  memoria: boolean
  guardarNoCofre: boolean
  temCofre: boolean
}

/** Lê as escolhas da pessoa. Tolerante: enquanto o sprint146 não for aplicado,
 *  devolve memória LIGADA e cofre desligado — que é o comportamento de
 *  omissão — em vez de rebentar. */
export async function lerPreferencias(supabase: any, userId: string, plano: string): Promise<PreferenciasMemoria> {
  const temCofre = ['pro', 'clinic'].includes(plano)
  try {
    const { data, error } = await supabase
      .from('profiles').select('memoria_documentos, guardar_no_cofre').eq('id', userId).maybeSingle()
    if (error) return { memoria: true, guardarNoCofre: false, temCofre }
    return {
      memoria: data?.memoria_documentos !== false,
      guardarNoCofre: temCofre && data?.guardar_no_cofre === true,
      temCofre,
    }
  } catch {
    return { memoria: true, guardarNoCofre: false, temCofre }
  }
}

/** A leitura que já foi feita deste documento, se houver. */
export async function leituraAnterior(supabase: any, userId: string, hash: string): Promise<any | null> {
  if (!hash) return null
  try {
    const { data, error } = await supabase
      .from('documentos_memoria').select('analise, criado_em')
      .eq('user_id', userId).eq('hash', hash).maybeSingle()
    if (error || !data?.analise) return null
    return { ...data.analise, _lidoEm: data.criado_em, _daMemoria: true }
  } catch { return null }
}

/** Guarda a leitura. Só é chamada com a memória ligada — a decisão é de quem
 *  chama, para o sítio da decisão ser um só e não estar espalhado. */
export async function guardarLeitura(
  supabase: any,
  args: {
    userId: string; hash: string; analise: any; origem?: string
    perfilId?: string | null; noCofre?: boolean
    /** A gaveta a que o documento pertence. Ver resolverSujeito. */
    sujeitoId?: string | null
    /** O nome tal como vinha no papel — para se poder mostrar "o documento
     *  dizia X" quando a arrumacao estiver errada. */
    nomeNoDocumento?: string | null
  },
): Promise<void> {
  if (!args.hash || !args.analise) return

  const base = {
    user_id: args.userId,
    profile_id: args.perfilId || null,
    hash: args.hash,
    tipo: args.analise.kind || null,
    titulo: args.analise.title || null,
    resumo: args.analise.emDuasLinhas || null,
    analise: args.analise,
    origem: args.origem || 'scan',
    no_cofre: !!args.noCofre,
  }
  // As colunas da arrumação vêm do sprint149. Enquanto ele não for aplicado, o
  // PostgREST recusa a linha INTEIRA por causa de uma coluna que não conhece —
  // e a memória deixava de guardar seja o que fosse, sem dizer nada a ninguém.
  // Por isso tenta-se com elas e, se falhar, guarda-se o que é possível: a
  // leitura vale mais do que a arrumação.
  try {
    const { error } = await supabase.from('documentos_memoria').upsert({
      ...base,
      sujeito_id: args.sujeitoId || null,
      nome_no_documento: args.nomeNoDocumento || null,
    }, { onConflict: 'user_id,hash' })
    if (!error) return
  } catch { /* segue para a tentativa sem arrumação */ }

  try {
    await supabase.from('documentos_memoria').upsert(base, { onConflict: 'user_id,hash' })
  } catch { /* a memória nunca pode travar a leitura */ }
}

/** Uma frase honesta para mostrar quando a resposta vem da memória.
 *  Sem isto, a pessoa não percebe porque é que desta vez foi instantâneo. */
export function explicarMemoria(lidoEm?: string): string {
  if (!lidoEm) return 'Já tinha lido este documento — é a mesma leitura de antes.'
  const d = new Date(lidoEm)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
  return `Já tinha lido este documento ${quando} — para a resposta não mudar, é a mesma leitura.`
}

// ═════════════════════════════════════════════════════════════════════════════
// AS GAVETAS: uma por pessoa, dentro da memória de uma conta
// ═════════════════════════════════════════════════════════════════════════════

export interface Sujeito {
  id: string
  nome: string
  nome_chave: string
  grafias: string[]
  relacao: 'proprio' | 'perfil' | 'outro'
  profile_id: string | null
  dossier: Dossier
  documentos: number
  ultimo_em: string | null
}

function comoSujeito(linha: any): Sujeito {
  return {
    id: linha.id,
    nome: linha.nome || '',
    nome_chave: linha.nome_chave || '',
    grafias: Array.isArray(linha.grafias) ? linha.grafias : [],
    relacao: linha.relacao || 'outro',
    profile_id: linha.profile_id || null,
    dossier: normalizarDossier(linha.dossier),
    documentos: linha.documentos || 0,
    ultimo_em: linha.ultimo_em || null,
  }
}

/** Todas as gavetas desta conta, da mais usada recentemente para a mais antiga. */
export async function lerSujeitos(supabase: any, userId: string): Promise<Sujeito[]> {
  try {
    const { data, error } = await supabase
      .from('documentos_sujeitos')
      .select('id, nome, nome_chave, grafias, relacao, profile_id, dossier, documentos, ultimo_em')
      .eq('user_id', userId)
      .order('ultimo_em', { ascending: false, nullsFirst: false })
      .limit(60)
    if (error || !data) return []
    return data.map(comoSujeito)
  } catch { return [] }
}

/** Quem é o utilizador e quem são os perfis que ele acompanha.
 *
 *  Serve para reconhecer um documento logo à primeira: se o nome no papel é o
 *  do próprio ou o de um perfil que ele já tem, a gaveta nasce ligada a esse
 *  perfil em vez de ser mais uma pessoa "de fora". */
export interface Identidades {
  proprio: string
  perfis: { id: string; nome: string }[]
}

export async function lerIdentidades(supabase: any, userId: string): Promise<Identidades> {
  try {
    const [{ data: eu }, { data: perfis }] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
      supabase.from('family_profiles').select('id, name').eq('user_id', userId).limit(40),
    ])
    return {
      proprio: eu?.display_name || '',
      perfis: (perfis || []).map((p: any) => ({ id: p.id, nome: p.name || '' })).filter((p: any) => p.nome),
    }
  } catch { return { proprio: '', perfis: [] } }
}

export interface ResolucaoSujeito {
  sujeito: Sujeito | null
  /** 'certa' quando o nome bate, 'provavel' quando é parecido, 'nenhuma'
   *  quando foi o perfil ativo a decidir (porque o papel não trazia nome). */
  confianca: 'certa' | 'provavel' | 'nenhuma'
  /** Mostrar à pessoa e deixá-la corrigir? Uma arrumação errada feita em
   *  silêncio é pior do que uma pergunta. */
  confirmar: boolean
  porque: string
  novo: boolean
}

/** A que gaveta pertence este documento.
 *
 *  A ordem é de propósito: o NOME no papel manda. Só quando não há nome é que
 *  o perfil ativo decide — e o perfil ativo não é um palpite, é uma escolha
 *  que a pessoa fez no seletor antes de mandar o documento. */
export async function resolverSujeito(
  supabase: any,
  userId: string,
  args: {
    nomeNoDocumento?: string
    sujeitos: Sujeito[]
    identidades: Identidades
    /** O perfil escolhido no seletor: 'self' ou o id de um family_profile. */
    perfilAtivoId?: string | null
  },
): Promise<ResolucaoSujeito> {
  const nome = String(args.nomeNoDocumento || '').trim()

  // ── 1. O papel traz nome ────────────────────────────────────────────────
  if (nome) {
    const conhecidos: SujeitoConhecido[] = args.sujeitos.map(s => ({ id: s.id, nome: s.nome, grafias: s.grafias }))
    const escolha = escolherSujeito(nome, conhecidos)

    if (escolha.sujeito) {
      const s = args.sujeitos.find(x => x.id === escolha.sujeito!.id)!
      // Uma grafia nova aprende-se, para não se voltar a duvidar do mesmo.
      if (escolha.confianca === 'certa' && chaveDoNome(nome) !== s.nome_chave) {
        const grafias = juntarGrafia(s.grafias, nome)
        supabase.from('documentos_sujeitos').update({ grafias }).eq('id', s.id).then(() => {}, () => {})
      }
      return {
        sujeito: s,
        confianca: escolha.confianca,
        confirmar: escolha.confianca !== 'certa',
        porque: escolha.porque,
        novo: false,
      }
    }

    // Ninguém conhecido. Será o próprio, ou um perfil que ele já acompanha?
    if (args.identidades.proprio) {
      const contraProprio = escolherSujeito(nome, [{ id: 'self', nome: args.identidades.proprio }])
      if (contraProprio.sujeito && contraProprio.confianca === 'certa') {
        const s = await criarSujeito(supabase, userId, nome, 'proprio', null)
        return { sujeito: s, confianca: 'certa', confirmar: false, porque: 'é o seu nome', novo: true }
      }
    }

    const contraPerfis = escolherSujeito(nome, args.identidades.perfis.map(p => ({ id: p.id, nome: p.nome })))
    if (contraPerfis.sujeito && contraPerfis.confianca === 'certa') {
      const s = await criarSujeito(supabase, userId, nome, 'perfil', contraPerfis.sujeito.id)
      return { sujeito: s, confianca: 'certa', confirmar: false, porque: 'é um perfil que acompanha', novo: true }
    }

    // É alguém de fora. Ganha gaveta própria — e é isso que impede que os
    // documentos dele se misturem com os do utilizador.
    const s = await criarSujeito(supabase, userId, nome, 'outro', null)
    return {
      sujeito: s,
      confianca: 'certa',
      confirmar: true,   // vale a pena dizer: é a primeira vez que aparece
      porque: escolha.ambiguo ? 'há mais do que uma pessoa parecida' : 'é a primeira vez que este nome aparece',
      novo: true,
    }
  }

  // ── 2. O papel não traz nome (uma caixa de comprimidos, por exemplo) ─────
  // Usa-se o perfil ativo. Não é adivinhar: foi a pessoa que o escolheu.
  const perfilId = args.perfilAtivoId && args.perfilAtivoId !== 'self' ? args.perfilAtivoId : null
  const nomeAlvo = perfilId
    ? (args.identidades.perfis.find(p => p.id === perfilId)?.nome || '')
    : args.identidades.proprio

  if (!nomeAlvo) {
    // Sem nome no papel e sem nome na conta não há gaveta possível. Fica
    // guardado sem dono — é honesto, e não estraga a memória de ninguém.
    return { sujeito: null, confianca: 'nenhuma', confirmar: false, porque: 'o documento não traz nome', novo: false }
  }

  const ja = args.sujeitos.find(s => s.nome_chave === chaveDoNome(nomeAlvo))
  const porque = 'o documento não traz nome — foi para o perfil ativo'
  if (ja) return { sujeito: ja, confianca: 'nenhuma', confirmar: true, porque, novo: false }

  const s = await criarSujeito(supabase, userId, nomeAlvo, perfilId ? 'perfil' : 'proprio', perfilId)
  return { sujeito: s, confianca: 'nenhuma', confirmar: true, porque, novo: true }
}

async function criarSujeito(
  supabase: any, userId: string, nome: string,
  relacao: 'proprio' | 'perfil' | 'outro', profileId: string | null,
): Promise<Sujeito | null> {
  const chave = chaveDoNome(nome)
  if (!chave) return null
  try {
    // `upsert` e não `insert`: duas leituras ao mesmo tempo da mesma pessoa
    // colidiriam no unique e uma delas perdia o documento.
    const { data, error } = await supabase.from('documentos_sujeitos').upsert({
      user_id: userId, nome: nome.trim(), nome_chave: chave,
      grafias: [nome.trim()], relacao, profile_id: profileId,
      ultimo_em: new Date().toISOString(),
    }, { onConflict: 'user_id,nome_chave' }).select().maybeSingle()
    if (error || !data) return null
    return comoSujeito(data)
  } catch { return null }
}

/** Guarda o que esta leitura acrescentou ao que já se sabia sobre a pessoa.
 *
 *  A junção é feita em lib/dossier, com regras fixas, e não pela IA: se fosse o
 *  modelo a reescrever o dossier de cada vez, cada leitura era uma
 *  oportunidade de perder ou inventar uma condição, e ao fim de dez leituras o
 *  dossier era ficção. */
export async function atualizarDossier(
  supabase: any,
  sujeito: Sujeito,
  args: { factos?: FactosNovos | null; perguntas?: PerguntaPendente[]; fonte?: string; data?: string },
): Promise<Dossier> {
  const seguinte = juntarFactos(sujeito.dossier, args.factos, {
    fonte: args.fonte, data: args.data, perguntas: args.perguntas,
  })
  try {
    await supabase.from('documentos_sujeitos').update({
      dossier: seguinte,
      documentos: (sujeito.documentos || 0) + 1,
      ultimo_em: new Date().toISOString(),
    }).eq('id', sujeito.id)
  } catch { /* a memória nunca pode travar a leitura */ }
  return seguinte
}

/** A pessoa respondeu a uma das perguntas. Vale mais do que um papel: foi ela
 *  que o disse, e é mais atual. */
export async function responderPergunta(
  supabase: any, sujeito: Sujeito, pergunta: string, resposta: string,
): Promise<Dossier> {
  const seguinte = responderNoDossier(sujeito.dossier, pergunta, resposta)
  try { await supabase.from('documentos_sujeitos').update({ dossier: seguinte }).eq('id', sujeito.id) } catch {}
  return seguinte
}

export async function dispensarPergunta(supabase: any, sujeito: Sujeito, pergunta: string): Promise<Dossier> {
  const seguinte = dispensarNoDossier(sujeito.dossier, pergunta)
  try { await supabase.from('documentos_sujeitos').update({ dossier: seguinte }).eq('id', sujeito.id) } catch {}
  return seguinte
}

const LIMITE_CONTEXTO = 6000

/** O que vai com o documento no pedido à IA.
 *
 *  Duas partes, e as duas fazem falta:
 *    • o ÍNDICE de todas as pessoas conhecidas, para o modelo perceber que
 *      este documento pode não ser do utilizador;
 *    • o DOSSIER completo das mais prováveis, para a leitura sair informada em
 *      vez de sair do zero pela décima vez.
 *
 *  Quem decide a gaveta no fim é lib/sujeitos.ts, a partir do nome. O que o
 *  modelo diz é uma pista, não a decisão — senão a arrumação mudava de opinião
 *  entre chamadas. */
export function contextoParaIA(
  sujeitos: Sujeito[],
  opts: { perfilAtivoId?: string | null } = {},
): string {
  if (!sujeitos.length) return ''
  const partes: string[] = []

  partes.push(
    'PESSOAS DE QUEM JÁ LESTE DOCUMENTOS NESTA CONTA:\n' +
    sujeitos.slice(0, 25).map(s => {
      const quem = s.relacao === 'proprio' ? 'o próprio utilizador'
        : s.relacao === 'perfil' ? 'alguém de quem o utilizador cuida'
        : 'outra pessoa'
      return `- ${s.nome} (${quem}, ${s.documentos} ${s.documentos === 1 ? 'documento' : 'documentos'})`
    }).join('\n'),
  )

  // Os dossiers completos: o do perfil ativo primeiro, depois os mais
  // recentes. Três chegam — mais do que isso ocupa o pedido todo e quem sofre
  // é a leitura do documento.
  const ativo = opts.perfilAtivoId && opts.perfilAtivoId !== 'self'
    ? sujeitos.find(s => s.profile_id === opts.perfilAtivoId)
    : sujeitos.find(s => s.relacao === 'proprio')
  const ordenados = [ativo, ...sujeitos.filter(s => s.id !== ativo?.id)].filter(Boolean) as Sujeito[]

  for (const s of ordenados.slice(0, 3)) {
    const resumo = resumirParaIA(s.dossier, s.nome, { documentos: s.documentos })
    if (resumo) partes.push(resumo)
  }

  const texto = partes.join('\n\n')
  return texto.length > LIMITE_CONTEXTO ? texto.slice(0, LIMITE_CONTEXTO) + '…' : texto
}

/** Uma frase para a interface: onde é que isto foi arrumado, e porquê. */
export function explicarArrumacao(r: ResolucaoSujeito): string {
  if (!r.sujeito) return 'Guardado sem dono — o documento não trazia nome.'
  const quem = nomeCurto(r.sujeito.nome)
  const sabe = contarDossier(r.sujeito.dossier)
  if (r.novo && r.sujeito.relacao === 'outro') {
    return `Primeiro documento de ${quem}. Fica à parte, sem se misturar com o resto.`
  }
  if (r.confianca === 'provavel') return `Parece ser de ${quem} — confirme, para não se misturar com outra pessoa.`
  if (r.confianca === 'nenhuma') return `Guardado em ${quem}, porque era o perfil ativo. O documento não trazia nome.`
  if (sabe > 0) {
    return `Guardado em ${quem}, que o Phlox já conhece de ${r.sujeito.documentos} ${r.sujeito.documentos === 1 ? 'documento' : 'documentos'}.`
  }
  return `Guardado em ${quem}.`
}
