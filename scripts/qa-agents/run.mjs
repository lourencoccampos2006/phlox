#!/usr/bin/env node
// run.mjs — a camada determinística da equipa de QA.
//
// Corre os agentes que NÃO precisam de IA: Sentinela (estados HTTP, erros de
// consola, exceções, pedidos falhados), Scroll, Transbordo horizontal, e
// Acessibilidade. Guarda capturas para o Olho Móvel (a camada de IA) analisar
// depois, em report.mjs.
//
// DUAS REGRAS QUE VÊM DE BUGS REAIS DESTE PROJETO — não as mudar sem pensar:
//
//  1. O scroll testa-se com `mouse.wheel`, NUNCA com `scrollTo`. O bug de
//     2026-08-23 (overflow-x:hidden no .lp) passava incólume por qualquer teste
//     com scrollTo, porque scrollTo atua direto no scrollingElement. Só a roda
//     a sério falhava.
//  2. As capturas são no VIEWPORT REAL, nunca fullPage. Uma captura fullPage
//     estica a página e esconde exatamente o desalinhamento mobile que se quer
//     apanhar — já deu um "QA 17/18 OK" com o telemóvel desformatado.
//
// Uso:
//   node scripts/qa-agents/run.mjs --base-url https://phloxclinical.com --mode publico
//   node scripts/qa-agents/run.mjs --base-url http://localhost:3000 --mode completo

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PUBLICAS, PRIVADAS, RUIDO_CONSOLA } from './routes.mjs'
import {
  examinarMeta, avaliarMeta, examinarCabecalhos,
  colherLinks, cacarLinksPartidos, compararComReferencia,
} from './exames.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]])
    return acc
  }, [])
)

const BASE = (args['base-url'] || process.env.PHLOX_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MODO = args.mode || 'publico'          // 'publico' (só leitura) | 'completo' (com sessão)
const SAIDA = args.out || 'qa-out'
const ETIQUETA = args.label || MODO

// Conta de QA dedicada — as mesmas credenciais de tests/e2e/helpers/auth.ts,
// que é a fonte de verdade. São de uma conta de teste sem dados reais.
const QA_EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const QA_PASSWORD = process.env.QA_PASSWORD || 'QaPhlox2026!'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

// As referências visuais vivem no repositório (versionadas de propósito: uma
// mudança de aspeto passa a ser visível no diff, como qualquer outra alteração).
const BASELINES = join('tests', 'baselines')

mkdirSync(join(SAIDA, 'shots'), { recursive: true })

const ruidoso = (txt) => RUIDO_CONSOLA.some(n => txt.includes(n))

/** Scroll REAL com a roda. Devolve se a página se mexeu como deve. */
async function testarScroll(page) {
  const alt = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
  }))
  // Páginas curtas não têm scroll para testar — não é falha.
  if (alt.scrollH <= alt.clientH + 80) return { aplicavel: false }

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  const vp = page.viewportSize()
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(450)
  const y = await page.evaluate(() => window.scrollY)
  return { aplicavel: true, ok: y > 100, scrollY: y, alturaPagina: alt.scrollH }
}

/** Transbordo horizontal — a assinatura clássica de layout mobile partido. */
async function testarTransbordo(page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const transborda = de.scrollWidth > de.clientWidth + 1
    if (!transborda) return { ok: true }
    // Encontrar o culpado ajuda a corrigir em vez de só assinalar.
    const culpados = [...document.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().right > de.clientWidth + 1)
      .slice(0, 3)
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`)
    return { ok: false, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, culpados }
  })
}

/** axe-core, se estiver instalado. Degrada em silêncio se não estiver. */
async function testarAcessibilidade(page) {
  try {
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    return {
      disponivel: true,
      violacoes: r.violations
        .filter(v => v.impact === 'serious' || v.impact === 'critical')
        .map(v => ({ id: v.id, impacto: v.impact, descricao: v.description, nos: v.nodes.length })),
    }
  } catch {
    return { disponivel: false }
  }
}

async function visitar(page, rota, viewport, etiquetaVp) {
  const erros = []
  const excecoes = []
  const pedidosFalhados = []

  const onConsole = (m) => { if (m.type() === 'error' && !ruidoso(m.text())) erros.push(m.text().slice(0, 300)) }
  // As exceções passam pelo mesmo filtro de ruído que a consola — senão a
  // instrumentação interna do React entra como "exceção crítica".
  const onPageError = (e) => { const t = String(e); if (!ruidoso(t)) excecoes.push(t.slice(0, 300)) }
  const onResponse = (r) => {
    if (r.status() >= 400 && !ruidoso(r.url())) {
      pedidosFalhados.push({ url: r.url().replace(BASE, '').slice(0, 160), estado: r.status() })
    }
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('response', onResponse)

  let estado = null, erroNavegacao = null, cabecalhos = {}
  try {
    const resp = await page.goto(BASE + rota.path, { waitUntil: 'networkidle', timeout: 30_000 })
    estado = resp?.status() ?? null
    cabecalhos = resp ? resp.headers() : {}
  } catch (e) {
    erroNavegacao = String(e).slice(0, 200)
  }
  await page.waitForTimeout(900) // deixar hidratar e assentar

  const resultado = { estado, erroNavegacao, erros, excecoes, pedidosFalhados }

  if (!erroNavegacao) {
    resultado.transbordo = await testarTransbordo(page)
    resultado.scroll = await testarScroll(page)
    resultado.links = await colherLinks(page, BASE)

    if (etiquetaVp === 'mobile') {
      resultado.a11y = await testarAcessibilidade(page)

      // SEO e metadados — só uma vez por rota, não faz diferença o viewport.
      const meta = await examinarMeta(page)
      resultado.meta = meta
      resultado.problemasMeta = avaliarMeta(meta, rota)

      // Cabeçalhos de segurança: só interessam contra o site publicado; num
      // build local não estão lá porque quem os põe é a plataforma.
      if (/^https:/.test(BASE)) {
        resultado.cabecalhosEmFalta = examinarCabecalhos(cabecalhos)
      }

      const nome = `${ETIQUETA}${rota.path.replace(/\//g, '_') || '_home'}.png`
      // VIEWPORT REAL — nunca fullPage. Ver o cabeçalho deste ficheiro.
      const buf = await page.screenshot({ path: join(SAIDA, 'shots', nome) })
      resultado.captura = nome

      // ── Regressão visual ────────────────────────────────────────────────
      // Compara com a referência guardada no repositório. É o exame mais
      // valioso de todos e não custa um único token: qualquer coisa que mude
      // no aspeto da página aparece aqui, mesmo que nenhuma regra a preveja.
      const refe = join(BASELINES, nome)
      if (!existsSync(refe)) {
        mkdirSync(BASELINES, { recursive: true })
        writeFileSync(refe, buf)
        resultado.visual = { referenciaCriada: true }
      } else {
        resultado.visual = await compararComReferencia(
          page, buf.toString('base64'), readFileSync(refe).toString('base64')
        )
      }
    }
  }

  page.off('console', onConsole)
  page.off('pageerror', onPageError)
  page.off('response', onResponse)
  return resultado
}

async function entrar(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', QA_EMAIL)
  await page.fill('input[type="password"]', QA_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 25_000 }).catch(() => {})
  return /\/inicio|\/painel/.test(page.url())
}

const navegador = await chromium.launch()
const relatorio = {
  alvo: BASE, modo: MODO, etiqueta: ETIQUETA,
  quando: new Date().toISOString(),
  rotas: [], sessaoIniciada: null,
}

try {
  for (const [etiquetaVp, viewport] of [['mobile', MOBILE], ['desktop', DESKTOP]]) {
    const ctx = await navegador.newContext({ viewport, ignoreHTTPSErrors: true })
    const page = await ctx.newPage()

    for (const rota of PUBLICAS) {
      const r = await visitar(page, rota, viewport, etiquetaVp)
      relatorio.rotas.push({ ...rota, viewport: etiquetaVp, publica: true, ...r })
      process.stdout.write(`  ${etiquetaVp} ${rota.path} → ${r.estado ?? 'ERRO'}\n`)
    }

    if (MODO === 'completo') {
      const dentro = await entrar(page)
      relatorio.sessaoIniciada = dentro
      if (dentro) {
        for (const rota of PRIVADAS) {
          const r = await visitar(page, rota, viewport, etiquetaVp)
          relatorio.rotas.push({ ...rota, viewport: etiquetaVp, publica: false, ...r })
          process.stdout.write(`  ${etiquetaVp} ${rota.path} → ${r.estado ?? 'ERRO'}\n`)
        }
      } else {
        process.stdout.write('  ! login da conta QA falhou — rotas privadas saltadas\n')
      }
    }
    await ctx.close()
  }

  // ── Caçador de links partidos ──────────────────────────────────────────
  // Junta todos os links internos que apareceram em qualquer página e visita-os.
  // Apanha o menu que aponta para uma rota apagada — a falha mais comum e mais
  // embaraçosa, porque é o próprio site a mandar o utilizador contra uma parede.
  const todosLinks = relatorio.rotas.flatMap((r) => r.links || [])
  const ctxLinks = await navegador.newContext({ ignoreHTTPSErrors: true })
  relatorio.linksPartidos = await cacarLinksPartidos(ctxLinks, BASE, todosLinks)
  relatorio.linksVerificados = new Set(todosLinks).size
  await ctxLinks.close()
  process.stdout.write(`  ${relatorio.linksVerificados} links internos · ${relatorio.linksPartidos.length} partido(s)\n`)
} finally {
  await navegador.close()
}

writeFileSync(join(SAIDA, `bruto-${ETIQUETA}.json`), JSON.stringify(relatorio, null, 2))
console.log(`\n✓ ${relatorio.rotas.length} visitas guardadas em ${SAIDA}/bruto-${ETIQUETA}.json`)
