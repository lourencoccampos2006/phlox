// exames.mjs — os exames adicionais dos agentes. TODOS determinísticos: não
// gastam um único token, correm sempre, e são os que apanham as regressões que
// realmente partem o site.
//
// A camada de IA só faz sentido para o que não se consegue exprimir em regras
// ("isto parece partido a um humano?"). Tudo o resto vive aqui, de graça.

/** SEO e metadados por rota — título, descrição, og, canónico, h1, idioma. */
export async function examinarMeta(page) {
  return page.evaluate(() => {
    const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || null
    const prop = (p) => document.querySelector(`meta[property="${p}"]`)?.content?.trim() || null
    const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim())
    return {
      titulo: document.title?.trim() || null,
      descricao: meta('description'),
      canonico: document.querySelector('link[rel="canonical"]')?.href || null,
      ogTitulo: prop('og:title'),
      ogImagem: prop('og:image'),
      idioma: document.documentElement.lang || null,
      h1s,
      // Imagens sem texto alternativo — falha de acessibilidade e de SEO.
      imagensSemAlt: [...document.querySelectorAll('img')]
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => (i.getAttribute('src') || '').slice(0, 80))
        .slice(0, 5),
    }
  })
}

/** Problemas nos metadados, já traduzidos para linguagem de relatório. */
export function avaliarMeta(m, rota) {
  const p = []
  if (!m.titulo) p.push('sem <title>')
  else if (m.titulo.length > 65) p.push(`título com ${m.titulo.length} caracteres (o Google corta aos ~60)`)
  if (!m.descricao) p.push('sem meta description')
  else if (m.descricao.length > 165) p.push(`descrição com ${m.descricao.length} caracteres (corta aos ~160)`)
  if (!m.idioma) p.push('sem lang no <html>')
  if (m.h1s.length === 0) p.push('sem <h1>')
  else if (m.h1s.length > 1) p.push(`${m.h1s.length} <h1> na mesma página`)
  if (!m.ogImagem) p.push('sem og:image (mau ao partilhar)')
  if (m.imagensSemAlt.length) p.push(`${m.imagensSemAlt.length} imagem(ns) sem alt`)
  return p
}

/** Cabeçalhos de segurança — só fazem sentido contra o site publicado. */
const CABECALHOS = [
  ['strict-transport-security', 'HSTS'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['x-frame-options', 'X-Frame-Options ou CSP frame-ancestors'],
]

export function examinarCabecalhos(headers) {
  const em_falta = []
  for (const [chave, nome] of CABECALHOS) {
    const csp = headers['content-security-policy'] || ''
    if (chave === 'x-frame-options' && /frame-ancestors/.test(csp)) continue
    if (!headers[chave]) em_falta.push(nome)
  }
  return em_falta
}

/* ─── Desempenho ──────────────────────────────────────────────────────────
 * Mede as Core Web Vitals no próprio browser, sem Lighthouse. Dá o sinal que
 * interessa — a página está lenta? — sem arrastar outra ferramenta e outro
 * conjunto de dependências para o CI.
 *
 * Os limites são os do Google para "bom":
 *   LCP  (maior elemento a aparecer)  < 2,5 s
 *   CLS  (o layout a saltar)          < 0,1
 *   TTFB (resposta do servidor)       < 0,8 s
 * ──────────────────────────────────────────────────────────────────────── */
export const ORCAMENTO = { lcp: 2500, cls: 0.1, ttfb: 800, pesoKB: 2500 }

export async function examinarDesempenho(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let lcp = 0, cls = 0
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    } catch { /* browser sem estes observadores */ }

    // Dar tempo a que o LCP estabilize antes de ler.
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const recursos = performance.getEntriesByType('resource')
      const bytes = recursos.reduce((s, r) => s + (r.transferSize || 0), 0) +
                    (nav?.transferSize || 0)
      resolve({
        lcp: Math.round(lcp),
        cls: +cls.toFixed(3),
        ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
        pesoKB: Math.round(bytes / 1024),
        pedidos: recursos.length,
      })
    }, 1200)
  }))
}

export function avaliarDesempenho(d) {
  const p = []
  if (d.lcp > ORCAMENTO.lcp) p.push(`LCP ${(d.lcp / 1000).toFixed(1)}s (limite ${ORCAMENTO.lcp / 1000}s)`)
  if (d.cls > ORCAMENTO.cls) p.push(`CLS ${d.cls} — o layout salta (limite ${ORCAMENTO.cls})`)
  if (d.ttfb !== null && d.ttfb > ORCAMENTO.ttfb) p.push(`servidor demorou ${d.ttfb}ms a responder (limite ${ORCAMENTO.ttfb}ms)`)
  if (d.pesoKB > ORCAMENTO.pesoKB) p.push(`${d.pesoKB}KB descarregados em ${d.pedidos} pedidos (limite ${ORCAMENTO.pesoKB}KB)`)
  return p
}

/* ─── Português e voz de marca ────────────────────────────────────────────
 * Não substitui um corretor ortográfico, mas apanha o que mais dói: erros de
 * PT-PT recorrentes, texto de marcador de posição esquecido, e os clichés de
 * IA que a skill phlox-brand-voice manda eliminar.
 * ──────────────────────────────────────────────────────────────────────── */
// NOTA sobre estas expressões: são deliberadamente ESTREITAS. Uma regra larga
// acusa texto correto e mata a confiança no relatório — já aconteceu aqui duas
// vezes: /\btime\b/ acusava "Point-in-time recovery", e uma regra para
// "arquivo" acusaria "arquivar utente", que é português correto e é vocabulário
// do próprio produto. Na dúvida, deixar passar.
const ARMADILHAS = [
  // Português do Brasil onde tem de ser de Portugal
  [/\bvocê\b/i, '"você" — em PT-PT é "o utilizador" ou tratamento por "si"'],
  [/\bcadastr(o|ar|ada|ado)\b/i, '"cadastro/cadastrar" — em PT-PT é "registo/registar"'],
  [/\b(o|nosso|do|ao|meu|seu)\s+time\b/i, '"time" — em PT-PT é "equipa"'],
  [/\bcelular(es)?\b/i, '"celular" — em PT-PT é "telemóvel"'],
  [/\b(na|da|a)\s+tela\b/i, '"tela" — em PT-PT é "ecrã"'],
  [/\bgerenciar\b/i, '"gerenciar" — em PT-PT é "gerir"'],
  // Marcadores de posição esquecidos
  [/lorem ipsum/i, 'texto de marcador de posição "lorem ipsum"'],
  [/\bTODO\b|\bFIXME\b/, 'marcador TODO/FIXME visível ao utilizador'],
  [/\bundefined\b|\bNaN\b|\[object Object\]/, 'valor por preencher a aparecer no ecrã'],
  // Clichés de IA — ver a skill phlox-brand-voice
  [/revolucion(a|á)/i, '"revolucionar" — promessa grande sem prova'],
  [/\bsimplificamos\b/i, '"simplificamos" — cliché sem prova ao lado'],
  [/transform(e|ar) a sua jornada/i, 'metáfora de "jornada"'],
  [/rápido, simples e/i, 'três adjetivos em fila'],
]

export async function examinarTexto(page) {
  const texto = await page.evaluate(() => document.body?.innerText || '')
  const achados = []
  for (const [re, queixa] of ARMADILHAS) {
    const m = texto.match(re)
    if (m) achados.push(queixa)
  }
  return achados
}

/** Todos os links internos da página, para o caçador de links partidos. */
export async function colherLinks(page, base) {
  return page.evaluate((b) => {
    const vistos = new Set()
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue
      try {
        const u = new URL(href, location.href)
        if (u.origin !== location.origin) continue          // externos ficam de fora
        vistos.add(u.pathname + u.search)
      } catch { /* href inválido — ignora */ }
    }
    return [...vistos]
  }, base)
}

/** Visita cada link recolhido e devolve os que não respondem 2xx/3xx. */
export async function cacarLinksPartidos(contexto, base, caminhos) {
  const partidos = []
  // Lotes pequenos e em série: um servidor Next a renderizar rotas que ainda
  // não estavam em cache responde devagar, e um lote grande faz-nos culpar
  // páginas que estão boas — só estavam a demorar.
  const lote = 3
  const lista = [...new Set(caminhos)]
  for (let i = 0; i < lista.length; i += lote) {
    const grupo = lista.slice(i, i + lote)
    const resultados = await Promise.all(grupo.map(async (c) => {
      // Uma segunda tentativa antes de acusar: acusar uma página boa é pior
      // que deixar passar uma má, porque destrói a confiança no relatório.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const r = await contexto.request.get(base + c, { maxRedirects: 5, timeout: 30_000 })
          return r.status() >= 400 ? { caminho: c, estado: r.status() } : null
        } catch (e) {
          if (tentativa === 1) {
            return { caminho: c, estado: 'sem resposta', porque: String(e.message).split('\n')[0].slice(0, 90) }
          }
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    }))
    partidos.push(...resultados.filter(Boolean))
  }
  return partidos
}

/** Compara a captura com a de referência. Devolve a percentagem de píxeis
 *  diferentes — sem dependências: a comparação é feita no próprio browser. */
export async function compararComReferencia(page, atualB64, referenciaB64) {
  return page.evaluate(async ([a, b]) => {
    const carregar = (d) => new Promise((res) => {
      const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + d
    })
    const [ia, ib] = await Promise.all([carregar(a), carregar(b)])
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { dimensaoMudou: true, antes: `${ib.width}×${ib.height}`, agora: `${ia.width}×${ia.height}` }
    }
    const desenhar = (img) => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.getContext('2d').getImageData(0, 0, img.width, img.height).data
    }
    const da = desenhar(ia), db = desenhar(ib)
    let diferentes = 0
    // Tolerância por canal: ignora ruído de compressão e antialiasing.
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 12 || Math.abs(da[i+1] - db[i+1]) > 12 || Math.abs(da[i+2] - db[i+2]) > 12) {
        diferentes++
      }
    }
    const total = da.length / 4
    return { percentagem: +(diferentes / total * 100).toFixed(2) }
  }, [atualB64, referenciaB64])
}
