// scripts/check-hooks-estaveis.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Um hook que devolve um objeto NOVO a cada render e uma bomba com rastilho.
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// O `useOrgScope()` construia o seu objeto de raiz a cada render. Quem
// escrevesse o que parece obvio —
//
//     const carregar = useCallback(async () => { … }, [scope])
//     useEffect(() => { carregar() }, [carregar])
//
// — ficava com um CICLO INFINITO: o `scope` e novo, logo o `carregar` e novo,
// logo o efeito volta a correr, logo ha um `setState`, logo ha outro render.
//
// Nao da erro. Nao aparece nos testes. A pagina fica eternamente «a carregar» e
// o browser dispara consultas sem parar. Medi-o no /o-dia com um browser a
// serio: **1089 pedidos em 6 segundos**, 156 voltas do ciclo. Com o hook
// memorizado: zero. E enquanto isso acontece a aplicacao inteira fica pesada —
// o menu lateral parece avariado, os cliques parecem nao fazer nada.
//
// A cura nao pode ser «ter cuidado com as dependencias» em cinquenta
// ficheiros. Tem de ser o hook devolver sempre a mesma coisa enquanto nada
// mudar. Esta guarda garante isso.
//
//   node scripts/check-hooks-estaveis.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

function ficheiros(dir, fora = []) {
  if (!fs.existsSync(dir)) return fora
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) ficheiros(p, fora) }
    else if (/\.(ts|tsx)$/.test(e.name)) fora.push(p)
  }
  return fora
}

// Hooks que devolvem um VALOR simples (string, booleano, numero) nao tem este
// problema: um primitivo compara-se por valor, e `'abc' === 'abc'`.
const achados = []

for (const f of [...ficheiros('lib'), ...ficheiros('components')]) {
  const chave = f.replace(/\\/g, '/')
  const texto = fs.readFileSync(f, 'utf8')
  if (!/\buse(State|Effect|Memo|Context|Ref|Callback)\b/.test(texto)) continue   // nao e um hook de React

  // `export function useXxx(` ou `export const useXxx = (`
  const cabecalhos = [...texto.matchAll(/export\s+(?:function\s+(use[A-Z]\w*)\s*\(|const\s+(use[A-Z]\w*)\s*[:=])/g)]

  for (const c of cabecalhos) {
    const nome = c[1] || c[2]
    // O corpo do hook: daqui ate ao proximo `export` de topo, ou ao fim.
    const inicio = c.index
    const seguinte = texto.indexOf('\nexport ', inicio + 1)
    const corpo = texto.slice(inicio, seguinte === -1 ? texto.length : seguinte)

    // So interessa quem devolve um OBJETO literal. Um `return algumaCoisa` ou
    // um `return [a, b]` nao cabe nesta regra (o array tem o mesmo problema,
    // mas nunca apareceu aqui e um guarda que acusa o que nunca acontece perde
    // credibilidade).
    const devolveObjeto = /\n\s*return\s*\{/.test(corpo)
    if (!devolveObjeto) continue

    // Ja esta protegido?
    const protegido = /return\s+useMemo\s*\(/.test(corpo)
    if (protegido) continue

    // Um objeto SO com primitivos e menos perigoso, mas continua a ser um
    // objeto novo: se alguem o puser numa lista de dependencias, o ciclo
    // acontece na mesma. Acusa-se e escreve-se a excecao quando for o caso.
    const linha = texto.slice(0, inicio).split('\n').length
    achados.push({ f: chave, n: linha, nome })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGUNDA PASSAGEM: o VALOR de um contexto
// ─────────────────────────────────────────────────────────────────────────────
// A primeira passagem olha para o `return {` de um hook. Isso nao chega, e o
// `useToast` provou-o: o hook devolvia `useContext(Ctx)`, uma linha limpa — e
// era o PROVIDER, a envolver a aplicacao inteira, que montava o objeto de raiz
// a cada render. Resultado: `useToast()` devolvia um objeto novo a TODOS os
// consumidores, incluindo os que nunca mostram um aviso.
//
// Um valor de contexto e o caso mais grave desta familia, porque um Provider
// alto na arvore re-renderiza por tudo e por nada.
for (const f of [...ficheiros('lib'), ...ficheiros('components'), ...ficheiros('app')]) {
  const chave = f.replace(/\\/g, '/')
  const texto = fs.readFileSync(f, 'utf8')
  if (!/\.Provider\s/.test(texto)) continue

  for (const m of texto.matchAll(/<(\w+)\.Provider\s+value=\{([\s\S]{0,120}?)\}/g)) {
    const valor = m[2].trim()
    const linha = texto.slice(0, m.index).split('\n').length

    // `value={{ … }}` — objeto literal inline, o caso mais directo.
    const literalInline = valor.startsWith('{')
    // `value={api}` — vale a pena ver como o `api` foi construido.
    const nome = /^[A-Za-z_$][\w$]*$/.test(valor) ? valor : null
    let porMontar = literalInline
    if (nome) {
      const decl = new RegExp(`const\\s+${nome}\\s*(?::[^=]+)?=\\s*(useMemo|\\{)`).exec(texto)
      if (decl && decl[1] === '{') porMontar = true
    }
    if (!porMontar) continue

    achados.push({
      f: chave, n: linha, nome: `<${m[1]}.Provider value={…}>`,
      contexto: true,
    })
  }
}

// ── Exceções, com a razão escrita ───────────────────────────────────────────
// Um hook so precisa de memo se o objeto dele puder ir parar a uma lista de
// dependencias. Estes nao vao, e esta escrito porque.
const PERMITIDOS = new Map([
  ['useSpeechToText', 'Devolve funcoes de controlo que sao usadas em manipuladores de eventos, nunca em dependencias.'],
])

const reais = achados.filter(a => !PERMITIDOS.has(a.nome))

const nHooks = achados.filter(a => !a.contexto).length
const nCtx = achados.filter(a => a.contexto).length
console.log(`${nHooks} hook(s) e ${nCtx} valor(es) de contexto por memorizar, ${achados.length - reais.length} com excecao escrita.\n`)

if (!reais.length) {
  console.log('✓ Hooks e contextos devolvem o mesmo objeto enquanto nada mudar.')
  process.exit(0)
}

for (const a of reais) {
  console.log(`✗ ${a.f}:${a.n}   ${a.nome}${a.contexto ? '' : '()'}`)
  console.log(a.contexto
    ? '    o valor do contexto e um objeto NOVO a cada render do Provider.'
    : '    devolve um objeto NOVO a cada render.')
  console.log('    → `return useMemo(() => ({ … }), [primitivos])`. Se for mesmo seguro,')
  console.log('      acrescenta-o a PERMITIDOS nesta guarda, com a razao escrita.\n')
}
console.log(`✗ ${reais.length} hook(s) que podem congelar uma pagina.`)
process.exit(1)
