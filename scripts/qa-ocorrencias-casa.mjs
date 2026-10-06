// scripts/qa-ocorrencias-casa.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Dá para registar uma ocorrência da casa sem escolher um utente?
//
// Era a única coisa que impedia: o formulário tinha `if (!form.patient_id)
// throw` para TUDO, e por isso um cano rebentado não tinha onde ir.
//
//   BASE=http://localhost:3311 node scripts/qa-ocorrencias-casa.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { entrar, esperarPor, textoDe } from './qa-esperar.mjs'

const BASE = process.env.BASE || 'http://localhost:3000'
const falhas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

const b = await chromium.launch()
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })).newPage()
  const erros = []
  p.on('pageerror', e => erros.push(String(e.message).slice(0, 160)))

  diz(await entrar(p, BASE), 'a sessão pegou')
  await p.goto(`${BASE}/incidents`, { waitUntil: 'domcontentloaded' })
  await esperarPor(p, ['registar', 'ocorrência', 'nada registado'])

  const abrir = p.getByRole('button', { name: /Nova Ocorrência/i }).first()
  diz(await abrir.count() > 0, 'há o botão «Nova Ocorrência»')
  await abrir.click()
  const t = await esperarPor(p, ['tipo de ocorrência'])

  // Os dois grupos têm de estar no seletor.
  const grupos = await p.locator('optgroup').allTextContents().catch(() => [])
  diz(grupos.length >= 2, `grupos no seletor de tipo: ${grupos.length}`)

  const opcoes = await p.locator('optgroup[label*="casa" i] option').allTextContents().catch(() => [])
  diz(opcoes.some(o => /água/i.test(o)), `tipos «na casa»: ${opcoes.length}`)

  // Escolher «Água» e ver se o seletor de utente desaparece.
  const seletorTipo = p.locator('select').filter({ has: p.locator('optgroup') }).first()
  await seletorTipo.selectOption('agua')
  const t2 = await esperarPor(p, ['é da casa', 'não é preciso escolher'])
  diz(t2.includes('não é preciso escolher'),
    t2.includes('não é preciso escolher')
      ? 'ao escolher «Água», o ecrã diz que não é preciso ninguém'
      : 'o ecrã não explica que não é preciso utente')

  // E voltar a «Queda» tem de pedir a pessoa outra vez.
  await seletorTipo.selectOption('fall')
  const t3 = await esperarPor(p, ['tipo de ocorrência'])
  diz(!t3.includes('não é preciso escolher'), 'ao voltar a «Queda», volta a pedir a pessoa')

  const tecnico = /relation .* does not exist|pgrst\d|\[object object\]/.exec(await textoDe(p))
  diz(!tecnico, tecnico ? `TEXTO TÉCNICO: ${tecnico[0]}` : 'nenhum texto técnico à vista')

  await p.setViewportSize({ width: 390, height: 844 })
  await esperarPor(p, ['tipo de ocorrência'])
  const tr = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(tr <= 1, `transbordo a 390px: ${tr}px`)

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally { await b.close() }

console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ Uma ocorrência da casa regista-se sem escolher ninguém.')
process.exit(falhas.length ? 1 : 0)
