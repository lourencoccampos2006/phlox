// scripts/qa-lembretes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A prova de que as notificações de medicação pessoal passaram a ser possíveis.
//
// O bug: ao adicionar um medicamento, o /mymeds gravava nome, dose, frequência
// e indicação — e o `reminder_times` ficava a null. O cron filtra por
// `.not('reminder_times','is',null)`. Nenhum medicamento adicionado pela
// aplicação podia, alguma vez, dar um lembrete.
//
// Este teste adiciona um medicamento como uma pessoa faria e verifica que a
// hora fica lá. Depois limpa o que criou.
//
//   node scripts/qa-lembretes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3100'
const NOME = `TesteLembrete${Date.now().toString().slice(-6)}`

const b = await chromium.launch()
let falhas = 0
const verificar = (n, c, o) => {
  if (c) console.log(`  ok   ${n}`)
  else { falhas++; console.log(`  FALHA ${n}${o !== undefined ? `\n        obtido: ${JSON.stringify(o)}` : ''}`) }
}

try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 950 } })).newPage()
  const erros = []
  p.on('pageerror', e => erros.push(e.message))

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(5000)

  await p.goto(BASE + '/mymeds', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)

  // ── Adicionar como uma pessoa faria ───────────────────────────────────────
  // Ha um banner "Propor horas" para os medicamentos antigos: confirma-se que
  // ele existe antes de o usar, porque e' metade da correcao.
  const temPropor = await p.locator('button', { hasText: /Propor horas/i }).count()
  verificar('propoe horas para os medicamentos antigos sem hora', temPropor > 0, temPropor)

  await p.locator('button', { hasText: /\+ ADICIONAR/i }).first().click()
  await p.waitForTimeout(1500)

  await p.fill('input[placeholder*="Nome do medicamento" i]', NOME)
  await p.fill('input[placeholder*="Frequência" i]', '2x por dia')
  await p.waitForTimeout(400)
  await p.locator('button', { hasText: /^Adicionar medicamento$/i }).click()
  await p.waitForTimeout(4500)

  // ── A hora ficou gravada? ─────────────────────────────────────────────────
  const texto = await p.evaluate(() => document.body.innerText)
  verificar('o medicamento foi criado', texto.includes(NOME), texto.slice(0, 200))
  verificar('a aplicacao diz que hora propos', /Lembrete às 09:00 e 21:00/.test(texto),
    (texto.match(/Lembrete[^\n]{0,80}/) || ['(nada)'])[0])
  verificar('a hora aparece no cartao do medicamento', /09:00\s*·\s*21:00/.test(texto),
    (texto.match(/\d{2}:\d{2}[^\n]{0,20}/) || ['(nada)'])[0])
  verificar('sem crashes', erros.length === 0, erros)

  // ── Limpar ────────────────────────────────────────────────────────────────
  const linha = p.locator(`text=${NOME}`).first()
  if (await linha.count()) {
    const cartao = linha.locator('xpath=ancestor::*[self::div][1]')
    const apagar = cartao.locator('button', { hasText: /remover|apagar|×/i }).first()
    p.on('dialog', d => d.accept())
    if (await apagar.count()) { await apagar.click(); await p.waitForTimeout(2000) }
  }
  console.log('  (limpeza tentada)')
} finally { await b.close() }

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nSem falhas.\n')
process.exitCode = falhas ? 1 : 0
