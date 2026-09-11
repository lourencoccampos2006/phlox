// scripts/loader-ts.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Deixa os testes em node importar os módulos do projeto tal como eles se
// escrevem para o Next: sem extensão (`./morada`) e com o atalho `@/lib/...`.
//
// O node, sozinho, exige o caminho exato — e não vale a pena estragar os
// imports da aplicação só para os testes correrem.
//
// Usar assim:
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs o-teste.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const raiz = path.resolve(import.meta.dirname, '..')

export async function resolve(especificador, contexto, seguinte) {
  // O atalho do tsconfig: "@/lib/morada" → <raiz>/lib/morada.ts
  if (especificador.startsWith('@/')) {
    return seguinte(pathToFileURL(path.join(raiz, especificador.slice(2) + '.ts')).href, contexto)
  }
  try {
    return await seguinte(especificador, contexto)
  } catch (e) {
    // Relativo e sem extensão: tenta .ts e depois .tsx.
    if (especificador.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try { return await seguinte(especificador + ext, contexto) } catch { /* segue */ }
      }
    }
    throw e
  }
}
