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
