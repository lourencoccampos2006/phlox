// app/api/ocorrencia-medicacao/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// «ISTO PODE SER DA MEDICAÇÃO?» — a pergunta que ninguém tem tempo de fazer
// ═══════════════════════════════════════════════════════════════════════════
//
// Alguém escreve uma ocorrência: «caiu de madrugada a caminho da casa de
// banho», «tem estado muito sonolenta desde ontem», «queixa-se de tonturas ao
// levantar». Depois fecha e vai tratar da próxima pessoa.
//
// A pergunta que fica por fazer é se aquilo tem alguma coisa a ver com o que a
// pessoa toma. Fazê-la a sério implica abrir a ficha, ler oito medicamentos,
// e procurar a bula de cada um. Ninguém faz isso a meio de um turno.
//
// ── COMO ISTO RESPONDE, E PORQUE É EM DOIS PASSOS ──────────────────────────
//
//  1. CRUZAMENTO POR TERMOS, sem IA. A `lib/efeitosDaMedicacao` tem, para cada
//     medicamento, os termos do rótulo traduzidos para o português em que
//     alguém escreve («somnolence» → «sonolência», «sonolento»). Procura-se
//     cada um no texto da ocorrência. Isto é determinístico, é instantâneo, e
//     não inventa nada.
//
//  2. SÓ SE O PASSO 1 NÃO ENCONTRAR NADA é que a IA entra — e entra para ler o
//     texto, não para julgar. Uma ocorrência escrita como «ficou mole e sem
//     reação» descreve prostração sem usar a palavra; é exactamente aí que um
//     cruzamento por palavras falha e uma leitura ajuda.
//
//     Mesmo aí, a IA só pode escolher de entre os termos que os rótulos
//     DAQUELA pessoa listam. Não lhe é pedido um diagnóstico, nem uma
//     probabilidade, nem uma recomendação. É pedido que diga quais daqueles
//     termos o texto descreve. Tudo o resto é escrito por nós.
//
// ── O QUE NUNCA SAI DAQUI ──────────────────────────────────────────────────
// Uma afirmação de causa. Um conselho para mudar, parar ou dar medicação.
// Uma percentagem. A frase que acompanha cada resposta está em
// `lib/efeitosDaMedicacao.ts` (`AVISO`) e diz as três coisas que importam: de
// onde vem, o que não cobre, e quem decide.

import { NextRequest, NextResponse } from 'next/server'
import { makeSupabase, getToken } from '@/lib/orgAuth'
import { aiJSON } from '@/lib/ai'
import { efeitosDe, AVISO, type EfeitosDeMedicamento } from '@/lib/efeitosDaMedicacao'

export const runtime = 'nodejs'

interface Achado {
  medicamento: string
  termos: string[]
}

/** Texto comparável: minúsculas, sem acentos, sem pontuação. */
function simples(t: string): string {
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })
  const supabase = makeSupabase(token)

  const corpo = await req.json().catch(() => ({}))
  const patientId = String(corpo.patientId || '')
  const descricao = String(corpo.descricao || '').trim()
  if (!patientId || descricao.length < 8) {
    return NextResponse.json({ error: 'Falta a pessoa ou a descrição.' }, { status: 400 })
  }

  /* A medicação é lida com o cliente DO UTILIZADOR: o RLS da `patient_meds`
     (política `patient_meds_org_access`, sprint91) é que decide se esta pessoa
     pode ver esta ficha. Aqui não se contorna nada. */
  const { data: meds, error } = await supabase
    .from('patient_meds').select('name').eq('patient_id', patientId).eq('active', true)
  if (error) {
    console.error('[phlox:ocorrencia-medicacao]', error)
    return NextResponse.json({ error: 'Não foi possível ler a medicação.' }, { status: 503 })
  }
  const nomes = [...new Set((meds || []).map((m: any) => String(m.name || '')).filter(Boolean))]

  if (!nomes.length) {
    return NextResponse.json({
      estado: 'sem_medicacao',
      frase: 'Esta pessoa não tem medicação activa registada, por isso não há nada para cruzar.',
      aviso: AVISO,
    })
  }

  // ── Os rótulos de cada um ────────────────────────────────────────────────
  /* O NOME QUE SE DIZ É O DA CASA, não o do rótulo.
     A `medicamento_efeitos` é partilhada por todas as instituições e o
     `nome_original` que lá está guardado é o nome normalizado pela FDA — em
     inglês, porque é assim que o OpenFDA indexa. Ler daí para escrever a frase
     fazia esta rota dizer «aparece na lista de efeitos de warfarin» a quem
     escreveu «Varfarina» na ficha, e numa casa portuguesa isso é pior do que
     não dizer nada: obriga a adivinhar de que medicamento se está a falar.
     O nome da casa anda ao lado da ficha e é esse que sai. */
  const fichas = await Promise.all(nomes.slice(0, 12).map(async n => ({
    daCasa: n,
    ficha: await efeitosDe(supabase, n).catch(() => null),
  })))

  const comRotulo = fichas
    .filter((x): x is { daCasa: string; ficha: EfeitosDeMedicamento } =>
      !!x.ficha && x.ficha.encontrado && x.ficha.efeitos.length > 0)
  if (!comRotulo.length) {
    return NextResponse.json({
      estado: 'sem_rotulo',
      frase: 'Não foi possível consultar a bula de nenhum dos medicamentos desta pessoa — '
        + 'o cruzamento não foi feito. Isto não quer dizer que não haja relação; quer dizer que não sabemos.',
      aviso: AVISO,
    })
  }

  // ── Passo 1: por termos ──────────────────────────────────────────────────
  const texto = simples(descricao)
  const achados: Achado[] = []
  for (const { daCasa, ficha } of comRotulo) {
    const batem = ficha.efeitos.filter(e => texto.includes(simples(e)))
    if (batem.length) achados.push({ medicamento: daCasa, termos: [...new Set(batem)] })
  }

  // ── Passo 2: só se o 1 não encontrou ─────────────────────────────────────
  let porLeitura = false
  if (!achados.length) {
    const vocabulario = comRotulo.flatMap(({ daCasa, ficha }) => ficha.efeitos.map(e => `${e}|${daCasa}`))
    try {
      const r = await aiJSON<{ termos: string[] }>([
        {
          role: 'system',
          content:
            'És um auxiliar de leitura. Recebes o texto de uma ocorrência escrita por quem cuida de '
            + 'alguém num lar, e uma lista fechada de termos. A tua ÚNICA tarefa é dizer quais desses '
            + 'termos o texto descreve, mesmo que use outras palavras. '
            + 'NUNCA sugiras causas, diagnósticos, probabilidades ou ações. '
            + 'NUNCA devolvas um termo que não esteja na lista. '
            + 'Se o texto não descrever nenhum, devolve uma lista vazia. '
            + 'Responde só com {"termos": ["..."]}.',
        },
        {
          role: 'user',
          content: `Ocorrência:\n"""${descricao.slice(0, 900)}"""\n\n`
            + `Lista fechada de termos:\n${[...new Set(vocabulario.map(v => v.split('|')[0]))].join(', ')}`,
        },
      ], { maxTokens: 220, temperature: 0 })

      /* O que a IA devolve é VERIFICADO contra a lista: um termo que não esteja
         no vocabulário é descartado em silêncio. Sem isto, bastava uma
         alucinação para a aplicação dizer a alguém que o utente tem um sintoma
         que ninguém escreveu. */
      const validos = new Set(vocabulario.map(v => v.split('|')[0]))
      const devolvidos = (r?.termos || []).filter(t => validos.has(String(t).toLowerCase()))
      if (devolvidos.length) {
        porLeitura = true
        for (const { daCasa, ficha } of comRotulo) {
          const batem = ficha.efeitos.filter(e => devolvidos.includes(e))
          if (batem.length) achados.push({ medicamento: daCasa, termos: batem })
        }
      }
    } catch {
      /* A IA é um extra. Falhando, responde-se com o que o passo 1 deu — que
         neste ramo é «nada» — e diz-se que não se encontrou, não que não há. */
    }
  }

  if (!achados.length) {
    return NextResponse.json({
      estado: 'nada_encontrado',
      frase: `O que está descrito não consta da lista de efeitos conhecidos de nenhum dos `
        + `${comRotulo.length} medicamentos desta pessoa cuja bula foi possível consultar.`,
      medicamentosLidos: comRotulo.map(x => x.daCasa),
      aviso: AVISO,
    })
  }

  const quantos = achados.length
  return NextResponse.json({
    estado: 'encontrado',
    porLeitura,
    achados,
    frase: quantos === 1
      ? `O que está descrito aparece na lista de efeitos conhecidos de ${achados[0].medicamento}, que esta pessoa toma.`
      : `O que está descrito aparece na lista de efeitos conhecidos de ${quantos} dos medicamentos que esta pessoa toma.`,
    medicamentosLidos: comRotulo.map(x => x.daCasa),
    aviso: AVISO,
  })
}
