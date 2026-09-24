// scripts/check-contadores.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Um contador partido não dá erro nenhum — dá um número que nunca aparece.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// O distintivo cola-se a uma ferramenta pelo `href`. Se alguém mudar o endereço
// de uma ferramenta em lib/institutionBlueprint.ts e não mudar aqui, o número
// deixa de aparecer — sem erro, sem aviso, sem nada. A equipa passa a trabalhar
// sem um sinal e ninguém sabe que o perdeu.
//
// O mesmo com as colunas: um filtro sobre uma coluna que não existe faz o
// PostgREST recusar o SELECT inteiro, e a rota devolve `null`. O distintivo
// desaparece — outra vez em silêncio. É a mesma família de bugs do
// check-colunas, e merece o mesmo guarda.
//
// Corre com a chave de serviço (lê o .env.local):
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/check-contadores.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { CONTADORES } from '../lib/contadores.ts'
import { BLUEPRINTS } from '../lib/institutionBlueprint.ts'
import { AREAS } from '../lib/permissoes.ts'

const falhas = []

// ── 1. Cada contador cola-se a uma ferramenta que existe ────────────────────
// O catálogo `T` de lib/institutionBlueprint.ts não é exportado, e ainda bem:
// o que interessa não é a ferramenta existir na lista, é ela ser ALCANÇÁVEL.
// Por isso a verdade aqui são os blueprints — o menu, as pastas e os extras de
// cada tipo de casa. Um contador colado a uma ferramenta que nenhum tipo de
// casa mostra é um contador que ninguém vai ver.
const hrefsConhecidos = new Set()
for (const bp of Object.values(BLUEPRINTS ?? {})) {
  const todas = [
    ...(bp.coreTools || []),
    ...(bp.extraTools || []),
    ...(bp.toolFolders || []).flatMap(f => f.tools || []),
  ]
  for (const t of todas) if (t?.href) hrefsConhecidos.add(t.href)
}

for (const c of CONTADORES) {
  if (!hrefsConhecidos.has(c.href)) {
    falhas.push(`contador '${c.id}': href '${c.href}' nao e o de nenhuma ferramenta. O numero nunca vai aparecer.`)
  }
  if (!AREAS.some(a => a.id === c.area)) {
    falhas.push(`contador '${c.id}': area '${c.area}' nao existe em lib/permissoes.ts. Ninguem recebe o numero.`)
  }
}

// ── 2. Ids únicos ───────────────────────────────────────────────────────────
// O id é a chave primária do marcador de leitura. Dois contadores com o mesmo
// id partilhariam o marcador: abrir um apagava o aviso do outro.
const vistos = new Set()
for (const c of CONTADORES) {
  if (vistos.has(c.id)) falhas.push(`id '${c.id}' repetido. Os marcadores de leitura ficariam trocados.`)
  vistos.add(c.id)
}

// ── 3. Cada 'calculado' tem mesmo uma conta do outro lado ───────────────────
const rota = readFileSync('app/api/contadores/route.ts', 'utf8')
const bloco = rota.slice(rota.indexOf('const CALCULOS'), rota.indexOf('/** Segunda-feira'))
for (const c of CONTADORES) {
  if (c.tipo !== 'calculado') continue
  if (!new RegExp(`\\basync\\s+${c.id}\\s*\\(`).test(bloco)) {
    falhas.push(`contador '${c.id}' e 'calculado' mas nao ha \`async ${c.id}(\` em app/api/contadores/route.ts.`)
  }
  if (c.tabela) falhas.push(`contador '${c.id}' e 'calculado' e declara tabela '${c.tabela}' — a tabela e ignorada, tira-a para nao enganar quem ler.`)
}
for (const c of CONTADORES) {
  if (c.tipo === 'calculado') continue
  if (!c.tabela) falhas.push(`contador '${c.id}' nao e 'calculado' e nao tem tabela.`)
  if (c.tipo === 'novidades' && !c.coluna) {
    falhas.push(`contador '${c.id}' e 'novidades' e nao tem coluna de data — nao ha como saber o que e novo.`)
  }
}

// ── 4. As tabelas e colunas existem mesmo ───────────────────────────────────
// Sem chave de serviço, os três primeiros testes correm na mesma (são de
// ficheiros). Só este precisa da base de dados.
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

let colunasReais = null
if (URL_SB && CHAVE) {
  const spec = await fetch(`${URL_SB}/rest/v1/`, {
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
  }).then(r => r.json()).catch(() => null)
  if (spec?.definitions) {
    colunasReais = new Map(
      Object.entries(spec.definitions).map(([t, d]) => [t, new Set(Object.keys(d.properties || {}))]))
  }
}

if (!colunasReais) {
  console.log('! Sem ligacao a base de dados: saltei a verificacao de colunas.')
  console.log('  (Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.)\n')
} else {
  for (const c of CONTADORES) {
    if (!c.tabela) continue
    const cols = colunasReais.get(c.tabela)
    if (!cols) {
      // Uma tabela criada por uma migração ainda não aplicada cai aqui. É um
      // aviso legítimo: até ela correr, o contador não funciona.
      falhas.push(`contador '${c.id}': a tabela '${c.tabela}' nao existe na base de dados.`)
      continue
    }
    if (!cols.has('org_id')) {
      falhas.push(`contador '${c.id}': '${c.tabela}' nao tem org_id — a contagem por casa nao e possivel.`)
    }
    if (c.coluna && !cols.has(c.coluna)) {
      falhas.push(`contador '${c.id}': '${c.tabela}.${c.coluna}' nao existe.`)
    }
    const usadas = [
      ...Object.keys(c.filtros || {}),
      ...Object.keys(c.filtrosDeHoje?.() || {}),
    ]
    for (const col of usadas) {
      if (!cols.has(col)) {
        falhas.push(`contador '${c.id}': filtro sobre '${c.tabela}.${col}', que nao existe. O PostgREST recusa o SELECT inteiro e o numero desaparece.`)
      }
    }
  }
}

console.log(`${CONTADORES.length} contador(es) verificados.\n`)
if (!falhas.length) {
  console.log('✓ Todos colam a uma ferramenta real, a uma area real e a colunas que existem.')
  process.exit(0)
}
for (const f of falhas) console.log(`✗ ${f}`)
console.log(`\n✗ ${falhas.length} problema(s).`)
process.exit(1)
