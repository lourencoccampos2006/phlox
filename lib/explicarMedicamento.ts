// lib/explicarMedicamento.ts
// ═══════════════════════════════════════════════════════════════════════════
// A BULA LIDA DE FIO A PAVIO, TRADUZIDA, E ARRUMADA PARA SE PERCEBER
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO DO FERNANDO ───────────────────────────────────────────────────
// «Na parte da descrição dos medicamentos quero que leias todo o texto com IA
//  e o traduzas e coloques de maneira que dê para entender melhor.»
//
// ── O QUE LÁ ESTAVA, E PORQUE É QUE NÃO SERVIA ─────────────────────────────
// O rótulo da FDA, cru e em inglês. Mil e duzentos caracteres de prosa
// regulatória americana por secção, escrita por advogados de um fabricante
// para outro regulador. Numa aplicação cujo utilizador é uma auxiliar de lar
// portuguesa que tem três minutos entre dois quartos, isso não é informação —
// é um bloco de texto que se salta.
//
// ── O QUE A IA FAZ, E O QUE NÃO FAZ ────────────────────────────────────────
// FAZ: lê o texto TODO que já temos guardado, traduz, e reorganiza em
// português corrente — o que é, para que serve, o que vigiar, o que não
// misturar. É trabalho de tradutor e de editor.
//
// NÃO FAZ: acrescentar o que não está no texto. Nem uma dose, nem uma
// recomendação, nem um efeito que a bula não liste. O prompt diz isso em três
// sítios, e o que volta é verificado: campos que não sejam texto são
// descartados, e a origem continua a dizer-se no ecrã.
//
// Isto é importante por uma razão concreta: a diferença entre «traduzi o que o
// fabricante escreveu» e «escrevi o que me parece sobre este medicamento» é a
// diferença entre uma ferramenta de apoio e uma que inventa indicações
// clínicas. A primeira é o que foi pedido.
//
// ── PORQUE É QUE SE GUARDA ─────────────────────────────────────────────────
// A leitura do rótulo da varfarina é a mesma em todas as casas. Guardada,
// custa UMA chamada de IA por medicamento — a primeira vez que alguém a abre,
// em qualquer instituição — e nunca mais. Sem cache, era uma chamada por
// abertura de ficha, e o tecto de orçamento das rotas de IA ia-se num dia.

import type { SupabaseClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { efeitosDe, semTabela, servico } from '@/lib/efeitosDaMedicacao'

export interface Explicacao {
  /** Uma ou duas frases: o que é, em português de quem não é farmacêutico. */
  resumo: string
  /** Para que serve, por extenso. */
  serve: string | null
  /** O que vigiar em quem o toma — o que a bula lista, em palavras de cá. */
  vigiar: string[]
  /** Os cuidados ao dar: horários, com ou sem comida, o que não fazer. */
  cuidados: string[]
  /** O que não misturar, e porquê. */
  interacoes: string[]
}

/** Quanto do rótulo vai para a leitura. O suficiente para a bula inteira. */
const TECTO = 5200

/**
 * Uma impressão digital do texto lido.
 *
 * Serve para não voltar a pagar uma leitura quando o rótulo não mudou. É um
 * hash fraco e de propósito: não protege nada, só distingue dois textos — e um
 * hash criptográfico aqui obrigaria a `crypto` assíncrono por nada.
 */
function marca(t: string): string {
  let h = 0
  for (let i = 0; i < t.length; i++) { h = ((h << 5) - h + t.charCodeAt(i)) | 0 }
  return `${t.length}:${(h >>> 0).toString(36)}`
}

/** Só texto, e só o que é texto. Um número ou um objeto aqui é lixo. */
const linha = (v: any): string | null => {
  const t = typeof v === 'string' ? v.trim() : ''
  return t ? t.slice(0, 900) : null
}
const lista = (v: any): string[] =>
  (Array.isArray(v) ? v : []).map(linha).filter((x): x is string => !!x).slice(0, 8)

const MODELO = 'leitura-v1'

/**
 * A explicação de um medicamento, da cache ou lida agora.
 *
 * Devolve `null` quando não há rótulo nenhum para ler — que é diferente de
 * «falhou». Quem chama tem de poder dizer as duas coisas.
 */
export async function explicarMedicamento(
  supabase: SupabaseClient, nome: string,
): Promise<{ explicacao: Explicacao | null; deCache: boolean }> {
  const ficha = await efeitosDe(supabase, nome)
  if (!ficha || !ficha.encontrado) return { explicacao: null, deCache: false }

  /* O TEXTO TODO, e não só os efeitos adversos. Ele pediu «todo o texto»: o
     que o medicamento é, para que serve, o que pode causar, os avisos e as
     interações. Ler só uma secção dava uma explicação que parecia completa e
     não era. */
  const bruto = [
    ficha.indicacoes && `INDICATIONS AND USAGE:\n${ficha.indicacoes}`,
    ficha.texto_adversos && `ADVERSE REACTIONS:\n${ficha.texto_adversos}`,
    ficha.avisos && `WARNINGS:\n${ficha.avisos}`,
    ficha.interacoes && `DRUG INTERACTIONS:\n${ficha.interacoes}`,
  ].filter(Boolean).join('\n\n').slice(0, TECTO)

  if (!bruto.trim()) return { explicacao: null, deCache: false }

  const chave = marca(bruto)

  // ── Já está lida? ────────────────────────────────────────────────────────
  const { data: guardado, error } = await supabase
    .from('medicamento_efeitos')
    .select('explicacao, explicacao_de, explicado_por')
    .eq('nome', ficha.nome).maybeSingle()

  /* A cache é um ATALHO e não uma condição — a mesma regra do `efeitosDe`.
     Sem as colunas (migração por correr), lê-se na mesma; só não se guarda. */
  const semColuna = semTabela(error) || /explicacao/i.test(String(error?.message || ''))
  if (error && !semColuna) console.error('[phlox:explicar:ler]', error)

  if (!semColuna && guardado?.explicacao
      && guardado.explicacao_de === chave
      && guardado.explicado_por === MODELO) {
    return { explicacao: guardado.explicacao as Explicacao, deCache: true }
  }

  // ── Ler ──────────────────────────────────────────────────────────────────
  let bruta: any
  try {
    bruta = await aiJSON<any>([
      {
        role: 'system',
        content:
          'És tradutor e editor de bulas de medicamentos. Recebes o texto do rótulo publicado '
          + 'pelo fabricante, em inglês, e devolve-lo em PORTUGUÊS DE PORTUGAL, reorganizado '
          + 'para ser lido por quem cuida de pessoas idosas num lar — não por um médico.\n\n'
          + 'REGRAS, por esta ordem de importância:\n'
          + '1. NÃO ACRESCENTES NADA que não esteja no texto. Nem doses, nem indicações, nem '
          + 'efeitos, nem conselhos. És tradutor, não autor. Se o texto não disser, o campo '
          + 'fica vazio.\n'
          + '2. NÃO DÊS RECOMENDAÇÕES. Nunca escrevas "deve", "é aconselhável", "procure um '
          + 'médico se". Descreve o que o rótulo diz, não o que fazer com isso.\n'
          + '3. Português de Portugal, corrente, frases curtas. Troca o termo técnico pela '
          + 'palavra de todos os dias quando existir uma exacta: "hemorragia" e não '
          + '"haemorrhage", "tonturas" e não "vertigem postural". Quando não existir, usa o '
          + 'termo técnico e explica-o entre parêntesis uma vez.\n'
          + '4. Sem percentagens de ensaios clínicos, sem nomes de estudos, sem frases de '
          + 'responsabilidade legal do fabricante. Isso é ruído para quem vai dar um comprimido.\n\n'
          + 'Responde SÓ com este JSON:\n'
          + '{"resumo":"uma ou duas frases: o que é e para que serve",'
          + '"serve":"para que serve, por extenso, ou null",'
          + '"vigiar":["o que pode causar — uma coisa por linha, em palavras simples"],'
          + '"cuidados":["o que o rótulo avisa ao dar — horários, com comida, quem não deve tomar"],'
          + '"interacoes":["o que não se mistura, e porquê"]}',
      },
      { role: 'user', content: `Medicamento: ${ficha.nome_original || ficha.nome}\n\n${bruto}` },
    ], { maxTokens: 1400, temperature: 0.1 })
  } catch (e) {
    console.error('[phlox:explicar:ia]', e)
    return { explicacao: null, deCache: false }
  }

  /* O que volta é VERIFICADO campo a campo. Um modelo que devolva um número
     onde se pediu texto, ou um objeto onde se pediu uma lista, não pode pôr
     isso no ecrã de uma ficha de medicação. */
  const explicacao: Explicacao = {
    resumo: linha(bruta?.resumo) || '',
    serve: linha(bruta?.serve),
    vigiar: lista(bruta?.vigiar),
    cuidados: lista(bruta?.cuidados),
    interacoes: lista(bruta?.interacoes),
  }

  // Sem resumo não há leitura: devolver uma ficha só com listas soltas é pior
  // do que devolver o texto original, que pelo menos é do fabricante.
  if (!explicacao.resumo) return { explicacao: null, deCache: false }

  // ── Guardar, com a chave de serviço (a tabela é de escrita só do servidor) ──
  if (!semColuna) {
    const sv = servico()
    if (sv) {
      const { error: eGravar } = await sv.from('medicamento_efeitos')
        .update({
          explicacao, explicacao_de: chave,
          explicado_em: new Date().toISOString(), explicado_por: MODELO,
        })
        .eq('nome', ficha.nome)
      if (eGravar) console.error('[phlox:explicar:guardar]', eGravar)
    }
  }

  return { explicacao, deCache: false }
}

/** A frase que acompanha a leitura. Diz de onde vem e o que não é. */
export const ORIGEM_DA_LEITURA =
  'Isto é o texto do fabricante traduzido e reorganizado — não é a bula portuguesa '
  + 'nem uma indicação clínica. Nada aqui foi acrescentado ao que o rótulo diz. '
  + 'A bula da embalagem e quem prescreveu continuam a ser a fonte.'
