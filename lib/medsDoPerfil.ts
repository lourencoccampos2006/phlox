// lib/medsDoPerfil.ts
// ─────────────────────────────────────────────────────────────────────────────
// A medicação de quem está selecionado. Um sítio, não sete.
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// A medicação de uma pessoa vive em três tabelas diferentes, conforme quem ela
// é: `personal_meds` (a própria conta), `family_profile_meds` (alguém que se
// acompanha) ou `patient_meds` (um utente de uma instituição). Escolher a
// tabela certa são quatro linhas — e essas quatro linhas estavam copiadas em
// sete ferramentas: /interactions, /med-review, /quickcheck, /reconciliacao,
// o gerador de protocolos, o briefing de consulta e o plano de cuidados.
//
// Já custou um bug: no /interactions, o caso do utente institucional caía no
// ramo do `family_profile_meds` e não carregava nada. Corrigiu-se lá; as
// outras seis cópias continuaram como estavam.
//
// ── E A PARTE QUE IMPORTA MAIS ─────────────────────────────────────────────
// Nas sete cópias o erro era descartado: `const { data } = await …`. Quando o
// PostgREST recusa um select — uma coluna que não existe chega para isso — o
// `data` vem **null**, que é indistinguível de "esta pessoa não toma nada".
//
// O resultado não é uma lista vazia: é uma MENTIRA. O verificador de interações
// diz "não encontrei interações" a quem toma oito medicamentos. Foi exatamente
// assim que o `personal_meds.shifts` calou as notificações de medicação durante
// semanas.
//
// Por isso esta função devolve três coisas, e não uma: a lista, se a leitura
// FALHOU, e uma frase para mostrar. Quem a chama tem de saber distinguir
// "não toma nada" de "não consegui ler".
// ─────────────────────────────────────────────────────────────────────────────
import { reportError, isSetupError } from './clientError'

export interface MedLido {
  name: string
  dose?: string | null
  frequency?: string | null
  indication?: string | null
}

export interface LeituraMeds {
  meds: MedLido[]
  /** true quando a base de dados recusou a leitura. NÃO é o mesmo que uma
   *  lista vazia — e a diferença é o que impede a ferramenta de mentir. */
  falhou: boolean
  /** Uma frase para mostrar, ou '' quando correu bem. */
  aviso: string
}

/** Quem está selecionado. O `type` vem do ProfileSelector; os perfis antigos
 *  só têm `id`, e aí 'self' identifica a própria conta. */
export interface PerfilAlvo {
  id: string
  type?: 'self' | 'family' | 'patient' | string | null
}

interface Origem { tabela: string; coluna: string; soAtivos: boolean }

/** A tabela e a coluna onde vive a medicação desta pessoa.
 *
 *  Exportada porque há chamadores que precisam de ESCREVER na mesma tabela, e
 *  se voltarem a decidir isso por si abre-se a porta à divergência outra vez. */
export function origemDosMeds(perfil: PerfilAlvo): Origem {
  if (perfil.type === 'patient') {
    // Um utente institucional. Só a medicação ativa: a suspensa não entra numa
    // verificação de interações nem num plano de cuidados.
    return { tabela: 'patient_meds', coluna: 'patient_id', soAtivos: true }
  }
  if (perfil.id === 'self' || perfil.type === 'self') {
    return { tabela: 'personal_meds', coluna: 'user_id', soAtivos: false }
  }
  return { tabela: 'family_profile_meds', coluna: 'profile_id', soAtivos: false }
}

/** Lê a medicação de quem está selecionado.
 *
 *  `userId` é preciso porque, para a própria conta, a chave é o id do
 *  utilizador e não o do perfil. */
export async function lerMedsDoPerfil(
  supabase: any,
  perfil: PerfilAlvo | null | undefined,
  userId: string | null | undefined,
  opts: { comIndicacao?: boolean; codigo?: string } = {},
): Promise<LeituraMeds> {
  const vazio: LeituraMeds = { meds: [], falhou: false, aviso: '' }
  if (!supabase || !perfil) return vazio

  const { tabela, coluna, soAtivos } = origemDosMeds(perfil)
  const chave = (perfil.id === 'self' || perfil.type === 'self') ? userId : perfil.id
  if (!chave) return vazio

  // As colunas pedidas são exatamente estas de propósito: pedir uma coluna que
  // não existe faz o PostgREST recusar o select INTEIRO. Ver scripts/check-colunas.
  const colunas = opts.comIndicacao ? 'name, dose, frequency, indication' : 'name, dose, frequency'

  try {
    let q = supabase.from(tabela).select(colunas).eq(coluna, chave)
    if (soAtivos) q = q.eq('active', true)
    const { data, error } = await q

    if (error) {
      return {
        meds: [],
        falhou: true,
        aviso: reportError(opts.codigo || `meds-${tabela}`, error,
          isSetupError(error)
            ? 'Não consegui ler a medicação desta pessoa nesta conta.'
            : 'Não consegui ler a medicação agora. Escreva-a à mão ou tente de novo — não assuma que está vazia.'),
      }
    }
    return { meds: (data || []) as MedLido[], falhou: false, aviso: '' }
  } catch (e) {
    return {
      meds: [], falhou: true,
      aviso: reportError(opts.codigo || `meds-${tabela}`, e,
        'Não consegui ler a medicação agora. Tente de novo.'),
    }
  }
}

/** A medicação escrita como a pessoa a escreveria: um por linha, com dose e
 *  frequência. É o formato que as ferramentas de texto (reconciliação,
 *  verificação rápida) esperam na caixa. */
export function medsComoTexto(meds: MedLido[]): string {
  return meds
    .map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
    .join('\n')
}
