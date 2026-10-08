// scripts/mapear-palete.mjs
// ─────────────────────────────────────────────────────────────────────────────
// As 281 cores escritas à mão passam a ser tokens.
//
// ── PORQUE É QUE ISTO É UM GUIÃO E NÃO TRABALHO À MÃO ──────────────────────
// São 386 ficheiros de ecrã e 14 133 objetos de estilo. Fazê-lo página a
// página levava semanas e garantia que as últimas ficavam diferentes das
// primeiras — que é exatamente como se chega a 281 cores.
//
// O mapa aqui em baixo é a tradução do palete antigo (a escala do Tailwind,
// que foi entrando por cópia e colagem) para as variáveis que o desenho
// aprovado usa. Cada linha é uma decisão, não uma aproximação automática.
//
// ── O QUE ELE NÃO TOCA, E PORQUÊ ───────────────────────────────────────────
//   • `lib/` inteiro — lá vivem paletes DELIBERADOS: as seis cores das fontes
//     do /o-dia, as cores estáveis das pessoas, e o CSS dos documentos
//     impressos, que tem de continuar a sair a preto no branco.
//   • `components/ui/` e `components/o-dia/Desenho*` — são o desenho novo.
//   • Qualquer cor que não esteja no mapa. Uma cor que eu não reconheça pode
//     ser um gráfico, uma marca ou um logótipo, e adivinhar aí é estragar.
//
//   node scripts/mapear-palete.mjs --ver      (não escreve nada)
//   node scripts/mapear-palete.mjs --escrever
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const ESCREVER = process.argv.includes('--escrever')

/* ── O mapa ───────────────────────────────────────────────────────────────
   Da esquerda, o que está escrito nas páginas. Da direita, o que passa a ser.
   As chaves estão todas em minúsculas; a comparação também. */
const MAPA = {
  // ── Tinta ───────────────────────────────────────────────────────────────
  '#0f172a': 'var(--ink)', '#111827': 'var(--ink)', '#0b1120': 'var(--ink)',
  '#020617': 'var(--ink)', '#0c111d': 'var(--ink)',
  '#1e293b': 'var(--ink-2)', '#1f2937': 'var(--ink-2)', '#18212f': 'var(--ink-2)',
  '#334155': 'var(--ink-3)', '#374151': 'var(--ink-3)', '#475569': 'var(--ink-3)',
  '#4b5563': 'var(--ink-3)',
  '#64748b': 'var(--ink-4)', '#6b7280': 'var(--ink-4)', '#708090': 'var(--ink-4)',
  '#94a3b8': 'var(--ink-5)', '#9ca3af': 'var(--ink-5)',

  // ── Fundos ──────────────────────────────────────────────────────────────
  '#f8fafc': 'var(--bg-2)', '#f9fafb': 'var(--bg-2)', '#fafafa': 'var(--bg-2)',
  '#f1f5f9': 'var(--bg-3)', '#f3f4f6': 'var(--bg-3)',
  '#e2e8f0': 'var(--border)', '#e5e7eb': 'var(--border)',
  '#cbd5e1': 'var(--border-2)', '#d1d5db': 'var(--border-2)',

  // ── Vermelho: mau, em atraso, perigo ────────────────────────────────────
  '#dc2626': 'var(--red)', '#b91c1c': 'var(--red)', '#991b1b': 'var(--red)',
  '#ef4444': 'var(--red)', '#c53030': 'var(--red)', '#a82828': 'var(--red)',
  '#7f1d1d': 'var(--red)',
  '#fee2e2': 'var(--badge-red-bg)', '#fef2f2': 'var(--badge-red-bg)',
  '#fff5f5': 'var(--badge-red-bg)', '#fbeeec': 'var(--badge-red-bg)',
  '#fca5a5': 'var(--badge-red-border)', '#fecaca': 'var(--badge-red-border)',
  '#fed7d7': 'var(--badge-red-border)',

  // ── Âmbar: a precisar de confirmação ────────────────────────────────────
  '#b45309': 'var(--amber)', '#92400e': 'var(--amber)', '#d97706': 'var(--amber)',
  '#8a5a16': 'var(--amber)', '#78350f': 'var(--amber)', '#a16207': 'var(--amber)',
  '#fffbeb': 'var(--badge-amber-bg)', '#fef3c7': 'var(--badge-amber-bg)',
  '#fdf3e3': 'var(--badge-amber-bg)', '#fefce8': 'var(--badge-amber-bg)',
  '#fde68a': 'var(--badge-amber-border)', '#fcd34d': 'var(--badge-amber-border)',

  // ── Verde: feito ────────────────────────────────────────────────────────
  '#16a34a': 'var(--green)', '#059669': 'var(--green)', '#15803d': 'var(--green)',
  '#067647': 'var(--green)', '#065f46': 'var(--green)', '#047857': 'var(--green)',
  '#dcfce7': 'var(--badge-green-bg)', '#f0fdf4': 'var(--badge-green-bg)',
  '#d1fae5': 'var(--badge-green-bg)', '#ecfdf5': 'var(--badge-green-bg)',
  '#a7f3d0': 'var(--badge-green-border)', '#86efac': 'var(--badge-green-border)',

  // ── Azul ────────────────────────────────────────────────────────────────
  // ── PORQUE É QUE O AZUL NÃO VIRA VERDE ─────────────────────────────────
  // Era a tentação: o azul é o acento secundário destas páginas, e mapeá-lo
  // para o verde da casa punha tudo da mesma cor. Mas o sistema diz que a cor
  // tem três significados, e nenhum deles é «isto é uma ligação».
  //
  // Por isso o azul fica NEUTRO — tinta e linha. O que for mesmo a ação
  // principal de um ecrã ganha o verde à mão, uma por ecrã, quando essa página
  // for refeita. Um ecrã com seis botões coloridos não tem nenhum principal.
  '#2563eb': 'var(--ink-2)', '#1d4ed8': 'var(--ink-2)', '#3b82f6': 'var(--ink-3)',
  '#1e40af': 'var(--ink-2)', '#1f4a8a': 'var(--ink-2)',
  '#eff6ff': 'var(--bg-2)', '#dbeafe': 'var(--bg-3)', '#f0f3f8': 'var(--bg-2)',
  '#bfdbfe': 'var(--border)', '#93c5fd': 'var(--border-2)',
}

/* ── O segundo mapa: só nas páginas institucionais ────────────────────
   ── PORQUE É QUE O ROXO NÃO SAI DE TODO O LADO ─────────────────────────────
   O `#7c3aed` aparece 81 vezes, e à primeira vista é mais um acento a mais.
   Mas é a cor do MODO PESSOAL — a aplicação que uma pessoa usa para a sua
   própria saúde — e lá é identidade, não decoração.

   Numa página de lar é só ruído: um quinto sistema de cor a competir com os
   três estados. Por isso este mapa aplica-se SÓ onde a casa trabalha. */
const SO_INSTITUCIONAL = {
  '#7c3aed': 'var(--ink-3)', '#6d28d9': 'var(--ink-2)', '#5b21b6': 'var(--ink-2)',
  '#8b5cf6': 'var(--ink-4)', '#4f46e5': 'var(--ink-3)',
  '#faf5ff': 'var(--bg-2)', '#f5f3ff': 'var(--bg-2)', '#ede9fe': 'var(--bg-3)',
  '#ddd6fe': 'var(--border)', '#e9d5ff': 'var(--border)',
  '#bbf7d0': 'var(--badge-green-border)', '#0d6e42': 'var(--green)',
}

/** Onde e que a casa trabalha. Fora disto, o roxo fica. */
const INSTITUCIONAL = [
  'painel', 'o-dia', 'passagem', 'casa', 'patients', 'mar', 'care-log',
  'incidents', 'family', 'radar', 'equipa', 'painel-dono', 'estatisticas',
  'inscricoes', 'calendario-do-ano', 'documentos', 'ronda-guiada', 'activities',
  'assessments', 'feridas', 'agenda', 'stock', 'refeicoes', 'apoio-servicos',
  'tendencias', 'guardiao', 'carga', 'autonomia', 'preparacao-medicacao',
  'apoio-psicossocial', 'historico', 'faturacao', 'vigia', 'inqueritos',
  'conformidade', 'residentes', 'quality', 'census',
].map(x => path.join('app', x))
const ehInstitucional = (f) =>
  INSTITUCIONAL.some(x => f.startsWith(x)) || f.includes(path.join('components', 'institution'))

/* ── Os ficheiros ─────────────────────────────────────────────────────────── */
const FORA = [
  path.join('components', 'ui'),
  path.join('components', 'o-dia'),
]
const ficheiros = []
;(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { andar(p); continue }
    if (!/\.tsx$/.test(e.name)) continue
    if (FORA.some(f => p.includes(f))) continue
    ficheiros.push(p)
  }
})('app')
;(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { andar(p); continue }
    if (!/\.tsx$/.test(e.name)) continue
    if (FORA.some(f => p.includes(f))) continue
    ficheiros.push(p)
  }
})('components')

/* ══════════════════════════════════════════════════════════════════════════
   OS CANTOS
   ══════════════════════════════════════════════════════════════════════════
   58 raios diferentes, com o 8, o 10 e o 12 a dominar. Foi a mudança que mais
   fez o desenho aprovado parecer um instrumento: 8-12px diz «cartão de
   aplicação de telemóvel», 3-4px diz «tabela».

   ── O QUE FICA DE FORA, E PORQUÊ ───────────────────────────────────────────
   O `'50%'`, o 99 e o 999 não são cantos: são círculos e cápsulas. Uma
   fotografia de perfil arredondada a 4px deixa de ser uma cara.
   ══════════════════════════════════════════════════════════════════════════ */
const RAIOS = {
  2: 'var(--r-sm)', 3: 'var(--r-sm)',
  4: 'var(--r)', 5: 'var(--r)', 6: 'var(--r)',
  7: 'var(--r-md)', 8: 'var(--r-md)',
  9: 'var(--r-lg)', 10: 'var(--r-lg)',
  11: 'var(--r-xl)', 12: 'var(--r-xl)', 13: 'var(--r-xl)',
  14: 'var(--r-xl)', 16: 'var(--r-xl)', 18: 'var(--r-xl)', 20: 'var(--r-xl)',
}

/* ── Trocar ───────────────────────────────────────────────────────────────── */
let trocas = 0
const porFicheiro = []
const porCor = new Map()

for (const f of ficheiros) {
  const antes = fs.readFileSync(f, 'utf8')
  let s = antes
  let n = 0
  const mapa = ehInstitucional(f) ? { ...MAPA, ...SO_INSTITUCIONAL } : MAPA
  for (const [velho, novo] of Object.entries(mapa)) {
    // Só quando a cor está sozinha entre aspas ou a seguir a `: ` — para não
    // apanhar um `#0f172a1a` (a mesma cor com transparência), que tem de
    // continuar a ser literal.
    const re = new RegExp(`${velho}(?![0-9a-fA-F])`, 'gi')
    const quantas = (s.match(re) || []).length
    if (!quantas) continue
    s = s.replace(re, novo)
    n += quantas
    porCor.set(velho, (porCor.get(velho) || 0) + quantas)
  }
  // Os cantos, no mesmo passo.
  s = s.replace(/borderRadius:\s*(\d+)(?![.\d])/g, (todo, v) => {
    const novo = RAIOS[Number(v)]
    if (!novo) return todo
    n++
    return `borderRadius: '${novo}'`
  })

  if (n) {
    trocas += n
    porFicheiro.push([f, n])
    if (ESCREVER) fs.writeFileSync(f, s)
  }
}

porFicheiro.sort((a, b) => b[1] - a[1])
console.log(`${ficheiros.length} ficheiros de ecrã olhados.`)
console.log(`${trocas} cor(es) escritas à mão traduzidas em ${porFicheiro.length} ficheiros.\n`)
console.log('Onde havia mais:')
for (const [f, n] of porFicheiro.slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${f}`)
console.log('\nAs mais comuns:')
for (const [c, n] of [...porCor].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${String(n).padStart(4)}  ${c} → ${MAPA[c] || SO_INSTITUCIONAL[c]}`)
}
console.log(ESCREVER ? '\n✓ Escrito.' : '\n(Nada foi escrito. Corre com --escrever.)')
