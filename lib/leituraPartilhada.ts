// lib/leituraPartilhada.ts
// ─────────────────────────────────────────────────────────────────────────────
// Uma leitura, muitos leitores.
//
// ── O PROBLEMA, MEDIDO ──────────────────────────────────────────────────────
// `useOrgScope()` é chamado em 55 ficheiros. Por baixo dele está o
// `useMemberships()`, que vai à base de dados saber a que casa a pessoa
// pertence. Como é um hook e não um contexto, CADA componente que o usa faz o
// seu próprio pedido — para a mesma resposta, no mesmo instante.
//
// Contado num browser a sério, a abrir seis páginas:
//
//     org_members     69 pedidos
//     organizations   55 pedidos
//
// Cento e vinte e quatro de duzentos e cinquenta e três. **Metade de tudo o
// que a aplicação pede ao Supabase era a mesma pergunta, repetida.**
//
// Isto não se via porque é rápido e está em cache no servidor. Passou a ver-se
// quando o plano gratuito do Supabase começou a contar as linhas de registo:
// lá, o que custa não são os dados — é o NÚMERO de chamadas.
//
// ── O QUE ISTO FAZ ──────────────────────────────────────────────────────────
// Duas coisas simples, e chegam:
//
//   1. **Junta os pedidos em voo.** Dez componentes a montar ao mesmo tempo
//      pedem a mesma coisa; o primeiro faz o pedido e os outros nove esperam
//      pela mesma promessa. Dez chamadas viram uma.
//
//   2. **Guarda a resposta por um bocado.** Navegar para outra página não volta
//      a perguntar a que casa a pessoa pertence — isso não muda entre duas
//      páginas.
//
// ── PORQUE É QUE NÃO É UM CONTEXTO DE REACT ────────────────────────────────
// Um contexto resolveria o ponto 1 e obrigava a envolver a aplicação num
// Provider — e a envolver TODAS as entradas, incluindo as que ainda não
// existem. Bastava alguém esquecer-se de uma para o problema voltar, em
// silêncio, só nessa.
//
// Isto funciona onde quer que seja chamado, sem montagem nenhuma. E resolve
// também o ponto 2, que um contexto não resolve (desmontar um Provider deita
// fora o que ele tinha).
//
// ── O QUE ISTO NÃO É ────────────────────────────────────────────────────────
// Não é uma cache de dados que mudam. Serve para o que é ESTÁVEL durante uma
// sessão de trabalho: a que casa pertenço, que tipo de casa é. Uma lista de
// utentes ou as tomas de hoje NÃO devem passar por aqui — quem as lê precisa
// de as ver mudar.
// ─────────────────────────────────────────────────────────────────────────────

interface Entrada<T> {
  /** A promessa em voo, ou a que já resolveu. */
  promessa: Promise<T>
  /** Quando resolveu. 0 enquanto está em voo. */
  em: number
}

const cache = new Map<string, Entrada<any>>()

/** Cinco minutos. Quem pertence a uma casa não deixa de pertencer a meio de um
 *  turno, e há `invalidar()` para os momentos em que muda mesmo. */
const VALIDADE = 5 * 60 * 1000

/**
 * Lê uma vez e serve a toda a gente.
 *
 * @param chave   O que identifica esta leitura. TEM de incluir tudo o que a
 *                distingue — o id do utilizador, o da casa. Uma chave a menos
 *                serve a resposta de uma pessoa a outra, que é o pior erro que
 *                uma cache pode cometer.
 * @param buscar  O que fazer quando não há resposta guardada.
 * @param validade  Quanto tempo a resposta serve, em milissegundos.
 */
export function leituraPartilhada<T>(
  chave: string,
  // `PromiseLike` e nao `Promise`: o construtor de consultas do Supabase e um
  // thenable, nao uma promessa. Pedir `Promise` obrigava cada sitio a escrever
  // um `await` a mais so para satisfazer o tipo.
  buscar: () => PromiseLike<T>,
  validade = VALIDADE,
): Promise<T> {
  const agora = Date.now()
  const guardada = cache.get(chave)

  // Em voo: espera pela mesma. Já resolvida e fresca: serve.
  if (guardada && (guardada.em === 0 || agora - guardada.em < validade)) {
    return guardada.promessa
  }

  const entrada: Entrada<T> = { promessa: null as any, em: 0 }
  entrada.promessa = Promise.resolve(buscar()).then(
    v => { entrada.em = Date.now(); return v },
    e => {
      // Uma falha NÃO fica guardada. Se ficasse, um erro de rede de um segundo
      // deixava a aplicação a servir esse erro durante cinco minutos a toda a
      // gente — e a pessoa que voltasse a tentar via o mesmo.
      cache.delete(chave)
      throw e
    },
  )
  cache.set(chave, entrada)
  return entrada.promessa
}

/**
 * Esquece o que está guardado.
 *
 * Sem argumento, esquece tudo (é o que se faz ao sair da conta). Com um
 * prefixo, esquece só o que começa por ele.
 */
export function invalidar(prefixo?: string): void {
  if (!prefixo) { cache.clear(); return }
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefixo)) cache.delete(k)
  }
}
