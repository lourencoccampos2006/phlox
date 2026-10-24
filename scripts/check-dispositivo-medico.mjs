#!/usr/bin/env node
// scripts/check-dispositivo-medico.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O PHLOX VOLTOU A DAR APOIO À DECISÃO CLÍNICA?
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// A Regra 11 do Regulamento (UE) 2017/745 diz que software destinado a dar
// informação usada para tomar decisões com fins de diagnóstico ou terapêuticos
// é DISPOSITIVO MÉDICO, classe IIa no mínimo — e, para software de segurança da
// medicação, a leitura corrente aponta para classe III. Classe IIa já obriga a
// organismo notificado, ISO 13485, avaliação clínica e vigilância pós-mercado.
//
// A 23 de outubro de 2026 saiu do Phlox tudo o que caía aí: um motor de 31
// regras clínicas, STOPP/START, verificação de interações com gravidade e
// recomendação, calculadoras de dose, interpretação de análises e de sinais
// vitais, níveis de risco por pessoa, e um copiloto que assinava «ferramenta de
// apoio à decisão».
//
// ── PORQUE É QUE UMA GUARDA, E NÃO SÓ A LIMPEZA ────────────────────────────
// Porque isto volta sozinho. Nenhuma destas coisas foi escrita de má-fé: cada
// uma apareceu porque era útil, e nenhuma delas faz a aplicação falhar. O
// Phlox funciona na perfeição a dar apoio à decisão terapêutica — a única
// coisa que não faz é ser legal.
//
// Uma linha dita a uma IA («És um médico», «gravidade: crítica», «recomenda»)
// não parte nenhum teste e passa em qualquer revisão de código que não esteja
// à procura dela. É isso que esta guarda procura.
//
// ── A LINHA ─────────────────────────────────────────────────────────────────
// PODE: registar, guardar, mostrar, procurar, comunicar, e dizer o que uma
//       fonte diz (um rótulo, uma bula, um intervalo de referência impresso).
// NÃO PODE: interpretar os dados de uma pessoa concreta, classificar o estado
//       dela, pontuar risco, recomendar, ou calcular uma dose.
//
//   node scripts/check-dispositivo-medico.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

/* Ficheiros onde a palavra é legítima: a documentação desta decisão, e esta
   própria guarda. */
const ISENTOS = new Set([
  'scripts/check-dispositivo-medico.mjs',
  'lib/complianceChecklists.ts',
  'lib/rgpd.ts',
  /* O changelog é o registo do que aconteceu, incluindo o que existiu e saiu.
     Reescrevê-lo para a guarda passar seria apagar a história — e é a história
     que explica, a quem vier a seguir, porque é que estas coisas não voltam. */
  'app/changelog/page.tsx',
])

const PADROES = [
  {
    nome: 'papel clínico dado a uma IA',
    rx: /És\s+(um|uma)\s+(médic|farmacêutic|enfermeir|clínic)[^`'"]{0,40}/gi,
    porque: 'um prompt que põe a IA a ser clínica produz texto clínico: avaliações, '
      + 'recomendações e doses. Troca por um papel que explique («tradutor de linguagem médica»).',
  },
  {
    nome: 'apoio à decisão, dito por extenso',
    rx: /apoio\s+à\s+decisão\s+(clínic|terapêutic)/gi,
    porque: 'é a expressão exata da Regra 11. Se o produto o diz de si próprio, está dito.',
  },
  {
    nome: 'critérios de prescrição inadequada',
    rx: /\bSTOPP\b|\bSTART\b(?!\w)|critérios de Beers|\bBeers\b/g,
    porque: 'aplicar STOPP/START ou Beers à medicação de um doente é revisão '
      + 'farmacoterapêutica — decisão terapêutica sobre uma pessoa identificada.',
  },
  {
    nome: 'cálculo de dose',
    rx: /calcul\w*\s+(a\s+)?dose|dose\s+calculad|mg\/kg|posologia\s+calculad/gi,
    porque: 'o cálculo de doses é apontado para classe III. Não há versão segura disto.',
  },
  {
    nome: 'classificação de um valor medido',
    rx: /"status":\s*"normal\|baixo\|alto"|severity.*?'critical'.*?vital|interpreta\s+cada\s+valor/gi,
    porque: 'dizer que a análise de alguém está «alta» é interpretar uma medição dessa pessoa. '
      + 'Escreve-se o valor e o intervalo de referência como vêm no papel; comparar é de quem lê.',
  },
  {
    nome: 'nível de risco atribuído a uma pessoa',
    rx: /overall_risk|risk_?[Ss]core|riskScore|nível de risco d[eoa]\s+(utente|doente|residente|pessoa)/g,
    porque: 'pontuar o risco de um doente é a saída típica de um sistema de apoio à decisão.',
  },
  {
    nome: 'verificação de interações com juízo',
    rx: /checkInteractions|interactionsEngine|gravidade da interação/g,
    porque: 'devolver gravidade, recomendação e alternativas para os fármacos de alguém '
      + 'é decisão terapêutica. Mostrar o que o rótulo diz, não.',
  },
]

const EXTENSOES = new Set(['.ts', '.tsx', '.mjs'])
const IGNORAR = new Set(['node_modules', '.next', '.git', '.fotos', 'public'])

function* ficheiros(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* ficheiros(p)
    else if (EXTENSOES.has(path.extname(e.name))) yield p
  }
}

const achados = []
for (const raiz of ['app', 'lib', 'components', 'scripts']) {
  if (!fs.existsSync(raiz)) continue
  for (const f of ficheiros(raiz)) {
    const rel = f.split(path.sep).join('/')
    if (ISENTOS.has(rel)) continue
    const texto = fs.readFileSync(f, 'utf8')
    const linhas = texto.split(/\r?\n/)
    /* Um comentário que EXPLICA porque é que a coisa saiu não é a coisa. Sem
       isto, a guarda ficava vermelha com as próprias notas que a limpeza
       deixou para trás a dizer o que foi removido e porquê — e uma guarda que
       acusa a sua própria documentação deixa de ser lida.

       O estado conta-se linha a linha porque quase todas estas notas são
       blocos de dez linhas, e só a primeira começa por barra-asterisco. */
    const emComentario = new Array(linhas.length).fill(false)
    let dentro = false
    linhas.forEach((l, i) => {
      const abre = l.lastIndexOf('/*'), fecha = l.lastIndexOf('*/')
      emComentario[i] = dentro || /^\s*(\/\/|\*|\/\*)/.test(l)
      if (abre > fecha) dentro = true
      else if (fecha > abre) dentro = false
    })
    for (const p of PADROES) {
      p.rx.lastIndex = 0
      linhas.forEach((l, i) => {
        if (emComentario[i]) return
        const m = l.match(p.rx)
        if (m) achados.push({ f: rel, linha: i + 1, padrao: p, trecho: l.trim().slice(0, 100) })
      })
    }
  }
}

if (achados.length) {
  console.error(`\n✗ ${achados.length} sítio(s) aproximam o Phlox de ser dispositivo médico:\n`)
  const porPadrao = new Map()
  for (const a of achados) {
    if (!porPadrao.has(a.padrao.nome)) porPadrao.set(a.padrao.nome, { porque: a.padrao.porque, itens: [] })
    porPadrao.get(a.padrao.nome).itens.push(a)
  }
  for (const [nome, { porque, itens }] of porPadrao) {
    console.error(`  ── ${nome} (${itens.length})`)
    console.error(`     ${porque}\n`)
    for (const i of itens.slice(0, 8)) console.error(`     ${i.f}:${i.linha}  ${i.trecho}`)
    if (itens.length > 8) console.error(`     … e mais ${itens.length - 8}`)
    console.error('')
  }
  process.exit(1)
}
console.log(`✓ check-dispositivo-medico: ${PADROES.length} padrões, nenhum presente.`)
