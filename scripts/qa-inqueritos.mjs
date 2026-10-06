// scripts/qa-inqueritos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O inquérito faz o percurso todo: criar → lançar respostas → ler o resultado?
//
// ── O QUE ISTO MEDE, E O QUE NÃO MEDE ──────────────────────────────────────
// As contas estão provadas em scripts/teste-inqueritos.mjs, e a folha impressa
// também — essa verifica-se no HTML, sem browser, porque clicar em «Imprimir»
// abre o diálogo do sistema e tranca a passagem.
//
// O que SÓ se vê aqui é o percurso: o botão existe, a resposta grava, o
// resultado aparece com o `n` à frente, e o número que o ecrã mostra é o mesmo
// que sai de uma consulta direta à base de dados.
//
// ── ENQUANTO A MIGRAÇÃO NÃO CORRER ─────────────────────────────────────────
// O sprint178 cria as duas tabelas. Sem ele, esta passagem não pode medir nada
// — e DIZ isso, em vez de acusar a página de estar partida. Um teste que falha
// por uma razão que não é um defeito é um teste que se passa a ignorar.
//
//   BASE=http://localhost:3311 node scripts/qa-inqueritos.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { assentar, textoDe, esperarPor, entrar } from './qa-esperar.mjs'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = 'tmp-qa-inqueritos'
mkdirSync(OUT, { recursive: true })

const falhas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

async function bd(caminho) {
  const r = await fetch(`${U}/rest/v1/${caminho}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  if (!r.ok) return { erro: `${r.status}`, linhas: [] }
  return { erro: null, linhas: await r.json() }
}

// A tabela existe? É a diferença entre «não está pronto» e «está partido».
const sonda = await bd('inqueritos?select=id&limit=1')
const prontas = sonda.erro === null

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', e => erros.push(String(e.message || e)))

  const dentro = await entrar(page, BASE)
  diz(dentro, dentro ? 'sessão de QA de pé' : 'o login falhou — nada do que vem abaixo mede a página')
  if (!dentro) throw new Error('sem sessão')

  await page.goto(`${BASE}/inqueritos`, { waitUntil: 'domcontentloaded' })
  await esperarPor(page, ['inquéritos de satisfação'])
  const t = await textoDe(page)

  diz(/segurança social pede/.test(t),
    'a página diz porque é que isto existe, e não só o que faz')

  if (!prontas) {
    diz(/ainda não estão disponíveis/.test(t),
      'sem a migração, a página explica-se em vez de rebentar')
    diz(!/could not find|schema cache|relation|sprint/i.test(t),
      'e não mostra uma linha de cozinha a quem está a usar a aplicação')
    await page.screenshot({ path: `${OUT}/sem-migracao.png` })

    await page.setViewportSize({ width: 390, height: 844 })
    await assentar(page)
    const transborda = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
    await page.screenshot({ path: `${OUT}/sem-migracao-telemovel.png` })

    diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')

    console.log('\n⏸  O sprint178 ainda não correu: o percurso completo (criar → responder →')
    console.log('   ler o resultado) fica POR VERIFICAR. Corre a migração e volta a correr isto.')
    console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ O que se podia medir sem a migração está certo.')
    process.exit(falhas.length ? 1 : 0)
  }

  /* ── O percurso completo ─────────────────────────────────────────────── */
  diz(!/ainda não estão disponíveis/.test(t), 'as tabelas existem e a página abriu a sério')

  // 1. Criar
  await page.getByRole('button', { name: 'Novo inquérito' }).click()
  await assentar(page)
  await page.getByRole('button', { name: 'Famílias' }).click()
  await page.locator('input[inputmode="numeric"]').fill('20')
  await page.getByRole('button', { name: 'Criar' }).click()
  const t2 = await esperarPor(page, ['lançar uma resposta em papel'])
  diz(/lançar uma resposta em papel/.test(t2), 'o inquérito foi criado e abriu')
  diz(/ainda não há respostas/.test(t2), 'e diz que ainda não há respostas')

  const { linhas: criados } = await bd('inqueritos?select=id,titulo,publico,convidados,perguntas&order=created_at.desc&limit=1')
  const novo = criados[0]
  diz(!!novo && novo.publico === 'familias', `na base de dados: ${novo?.titulo} (${novo?.publico})`)
  diz(Array.isArray(novo?.perguntas) && novo.perguntas.length > 10,
    `as perguntas ficaram GRAVADAS no inquérito: ${novo?.perguntas?.length}`)
  diz(novo?.convidados === 20, `convidados: ${novo?.convidados}`)

  // 2. Lançar duas respostas
  for (const nota of ['mais notícias durante a semana', 'o jardim está muito bem tratado']) {
    await page.getByRole('button', { name: 'Lançar uma resposta em papel' }).click().catch(() => {})
    await assentar(page)
    // Uma escolha em cada pergunta de escala: a primeira opção visível de cada
    // linha chega para o percurso.
    const botoes = page.getByRole('button', { name: 'Bom', exact: true })
    const quantos = await botoes.count()
    for (let i = 0; i < quantos; i++) await botoes.nth(i).click()
    const caixas = page.locator('textarea')
    if (await caixas.count()) await caixas.first().fill(nota)
    await page.getByRole('button', { name: /Gravar e abrir/ }).click()
    await assentar(page)
  }

  const { linhas: respostas } = await bd(`inqueritos_respostas?inquerito_id=eq.${novo.id}&select=*`)
  diz(respostas.length === 2, `${respostas.length} resposta(s) na base de dados`)

  // 3. A COISA MAIS IMPORTANTE: não ficou lá nada que diga quem respondeu.
  const colunas = Object.keys(respostas[0] || {})
  const proibidas = colunas.filter(c =>
    /^(user_id|patient_id|recorded_by_id|team_member_id|ip|respondente)/.test(c))
  diz(proibidas.length === 0,
    proibidas.length === 0
      ? `a resposta não guarda ninguém — colunas: ${colunas.join(', ')}`
      : `A RESPOSTA GUARDA QUEM RESPONDEU: ${proibidas.join(', ')} — é o módulo inteiro por terra`)

  // 4. O resultado
  await page.getByRole('button', { name: 'Terminar' }).click().catch(() => {})
  const t3 = await esperarPor(page, ['no geral', 'por dimensão'])
  diz(/no geral/.test(t3), 'o resultado apareceu')
  diz(/2 respostas de 20 convidados \(10%\)/.test(t3),
    'com o `n` e a taxa de resposta à frente do número')
  diz(/só \d+ pessoas? respond/.test(t3),
    'e com o aviso de que são poucas respostas para tirar conclusões')
  diz(t3.includes('mais notícias durante a semana'),
    'o que foi escrito aparece na íntegra')
  diz(!/4,00|índice/.test(t3) || /é a resposta à pergunta/.test(t3),
    'o número global diz de que pergunta saiu')

  await page.screenshot({ path: `${OUT}/resultado.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await assentar(page)
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
  await page.screenshot({ path: `${OUT}/resultado-telemovel.png` })

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally {
  await browser.close()
}

console.log(falhas.length
  ? `\n✗ ${falhas.length} falha(s).`
  : '\n✓ O percurso fecha, e a resposta não guarda quem respondeu.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
