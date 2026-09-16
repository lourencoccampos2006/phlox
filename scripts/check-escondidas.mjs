// scripts/check-escondidas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Ferramentas que existem, estão no catálogo, e mesmo assim ninguém as vê.
//
// Diferente do check-orfas.mjs: aquele procura páginas para as quais NINGUÉM
// aponta. Este procura o caso mais traiçoeiro — a ferramenta está declarada
// para um modo, mas o sítio onde esse modo vive (o /inicio, para as pessoais;
// o /painel e a barra lateral, para as institucionais) nunca a apresenta. Ela
// existe, é mantida, e só se encontra por busca.
//
//   node scripts/check-escondidas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs'

const ler = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

// ── O catálogo, por modo ────────────────────────────────────────────────────
const registo = ler('lib/toolRegistry.ts')
const porModo = { personal: [], caregiver: [], student: [], clinical: [] }
const RE = /\{ id: '([^']+)',\s*label: '([^']*)'[\s\S]*?modes: \[([^\]]*)\]/g
for (const m of registo.matchAll(RE)) {
  const [, id, label, modos] = m
  for (const md of modos.replace(/'/g, '').split(',').map(x => x.trim())) {
    if (porModo[md]) porModo[md].push({ id, label })
  }
}

// ── Onde cada modo apresenta as suas ────────────────────────────────────────
// Pessoal/cuidador/estudante: a lista do /inicio, a barra principal, e o /tudo.
const superficiesPessoais =
  ler('app/inicio/page.tsx') + ler('lib/primaryNav.ts') + ler('app/tudo/page.tsx') +
  ler('lib/navigation.ts') + ler('components/CommandPalette.tsx')

// Institucional: o blueprint do /painel e a barra lateral.
const superficiesClinicas =
  ler('lib/institutionBlueprint.ts') + ler('components/InstitutionShell.tsx') +
  ler('app/painel/page.tsx') + ler('app/painel/PainelCockpit.tsx') +
  ler('app/painel/PainelHoje.tsx') + ler('lib/navigation.ts') +
  ler('components/CommandPalette.tsx')

const nomes = new Map()
for (const m of registo.matchAll(RE)) nomes.set(m[1], m[2])

let total = 0
for (const [modo, lista] of Object.entries(porModo)) {
  const superficie = modo === 'clinical' ? superficiesClinicas : superficiesPessoais
  const escondidas = lista.filter(t => {
    // Uma entrada com query string (ex: /equipa?tab=cobertura) e uma ABA de
    // uma pagina que ja esta na superficie — alcanca-se abrindo a pagina e
    // carregando na aba. Conta como apresentada.
    const base = t.id.split('?')[0]
    for (const r of [t.id, base]) {
      if (superficie.includes(`'${r}'`) || superficie.includes(`"${r}"`)) return false
    }
    return true
  })
  if (!escondidas.length) continue
  console.log(`\n── ${modo} (${escondidas.length} de ${lista.length}) ──`)
  for (const t of escondidas) {
    const f = `app${t.id}/page.tsx`
    const n = existsSync(f) ? String(readFileSync(f, 'utf8').split('\n').length) : '—'
    console.log(`  ${t.id.padEnd(24)} ${n.padStart(5)} linhas   ${t.label.slice(0, 44)}`)
    total++
  }
}

console.log(total
  ? `\n${total} entrada(s) de catálogo que a superfície do próprio modo nunca mostra.\nAlcançam-se pelo /tudo e pela paleta — não estão perdidas, mas ninguém tropeça nelas.`
  : '\n✓ Todas as ferramentas do catálogo aparecem na superfície do seu modo.')
