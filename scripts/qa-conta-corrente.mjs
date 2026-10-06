// scripts/qa-conta-corrente.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A conta-corrente de cada utente, num browser a sério.
//
// ── PORQUE É QUE ISTO SÓ EXISTE AGORA ──────────────────────────────────────
// Durante duas sessões dei esta página por não-verificável: a conta de QA
// mostrava «Só o dono ou administrador» e eu concluí que estava bloqueada por
// papel.
//
// Não estava. A conta tem papel `direcao`, e `direcao` tem todas as permissões
// por omissão (lib/permissoes). O que eu vi foi um RELÂMPAGO: `isManager`
// arranca falso porque as permissões chegam da base de dados uns
// milissegundos depois do primeiro render, e o meu teste lia aos 250 ms.
//
// Duas lições, e as duas já me custaram tempo nesta série:
//   • esperar pela PRESENÇA de um fim, nunca medir num instante fixo;
//   • quando um teste diz «não tenho acesso», confirmar no código quem tem —
//     e não acreditar no ecrã.
//
//   node scripts/qa-conta-corrente.mjs
//   BASE=http://localhost:3311 node scripts/qa-conta-corrente.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
// As esperas vivem em `qa-esperar.mjs`, partilhadas. Escritas à mão, enganei-me
// seis vezes seguidas — e das seis o teste culpou o código do meu erro.
import { entrar, esperarPor, textoDe } from './qa-esperar.mjs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const OUT = 'tmp-qa-conta'
mkdirSync(OUT, { recursive: true })

const falhas = []
const notas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', e => erros.push(String(e.message || e)))

  diz(await entrar(page, BASE, { email: EMAIL, pass: PASS }), 'a sessão pegou')

  await page.goto(`${BASE}/faturacao`, { waitUntil: 'domcontentloaded' })
  // Presença de um estado final, e só depois deixar o DOM assentar.
  const texto = await esperarPor(page, ['conta de cada um', 'só o dono', 'por ativar'])

  // ── 1. O relâmpago de «não tem acesso» não pode voltar ────────────────────
  diz(!texto.includes('só o dono'),
    texto.includes('só o dono')
      ? 'A PÁGINA DIZ «só o dono» a quem TEM acesso — a guarda `scope.pronto` caiu'
      : 'não diz «só o dono» a quem tem acesso')

  const abriu = texto.includes('conta de cada um')
  diz(abriu, abriu ? 'o separador «Conta de cada um» está lá' : 'não encontrei o separador')

  if (abriu) {
    await page.getByRole('button', { name: /Conta de cada um/i }).click()
    const t2 = await esperarPor(page, ['em dia', 'devem', 'deve', 'ainda não está montada'])
    const porMontar = t2.includes('ainda não está montada')

    if (porMontar) {
      // O sprint174 ainda não correu: a página tem de o dizer em português, e
      // não mostrar código do Postgres a ninguém.
      diz(true, 'diz, em português, que falta configurar (sprint174 por correr)')
      notas.push('a tabela `conta_do_utente` ainda não existe — depois de correr o sprint174, '
        + 'volta a correr isto para medir os saldos a sério.')
    } else {
      // ── 2. Os saldos aparecem, e são dinheiro bem escrito ─────────────────
      diz(/em dia|deve/.test(t2), 'mostra o estado das contas')

      // Dinheiro à portuguesa: vírgula decimal e símbolo. «1234.5€» seria
      // formatação inglesa a escapar.
      const maus = (await page.evaluate(() => document.body.innerText))
        .match(/\d+\.\d{1,2}\s*€/g)
      diz(!maus, maus ? `dinheiro com PONTO decimal: ${maus.slice(0, 3).join(', ')}` : 'o dinheiro está à portuguesa')

      const semNumero = /nan|undefined|null/.test(t2)
      diz(!semNumero, semNumero ? 'há NaN/undefined no ecrã' : 'nenhum número sai como NaN')
    }

    await page.screenshot({ path: `${OUT}/conta.png` })
  }

  // ── 3. Nada técnico à vista ──────────────────────────────────────────────
  const tecnico = /relation .* does not exist|pgrst\d|column .* does not exist|\[object object\]/.exec(texto)
  diz(!tecnico, tecnico ? `TEXTO TÉCNICO NO ECRÃ: «${tecnico[0]}»` : 'nenhum texto técnico à vista')

  // ── 4. Telemóvel ─────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  await esperarPor(page, ['conta de cada um', 'só o dono', 'por ativar'])
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
  await page.screenshot({ path: `${OUT}/telemovel.png` })

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally {
  await browser.close()
}

console.log('')
for (const n of notas) console.log(`· ${n}`)
console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ A conta-corrente abre a quem tem acesso.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
