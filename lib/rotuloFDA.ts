// lib/rotuloFDA.ts
// ═══════════════════════════════════════════════════════════════════════════
// O RÓTULO PUBLICADO DE UM MEDICAMENTO — RxNorm (NIH) + OpenFDA
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE ISTO SAIU DA ROTA PARA UMA BIBLIOTECA ─────────────────────
// Estava só dentro de `/api/drug-reference`. Quando a ficha do medicamento e o
// cruzamento com as ocorrências precisaram dos mesmos dados, a `lib/
// efeitosDaMedicacao` chamou essa rota POR HTTP, e para isso precisava de um
// endereço de base. Escrevi:
//
//     const base = new URL(req.url).origin
//
// e isso é um buraco a sério. O `req.url` do Next é construído a partir do
// cabeçalho `Host`. Quem o controlasse fazia o servidor ir buscar JSON a um
// sítio dele — e esse JSON é escrito, COM A CHAVE DE SERVIÇO, na tabela
// `medicamento_efeitos`, que todas as casas leem. Não é só SSRF: é envenenar
// a bula que aparece na ficha de todos os utentes de todas as instituições.
//
// A correção não é uma variável de ambiente com o endereço certo. É não ir
// pela rede: o código está aqui ao lado, chama-se como função, e deixa de
// haver endereço nenhum para falsificar.
//
// ── O QUE ISTO É, E O QUE NÃO É ────────────────────────────────────────────
// É o rótulo que o fabricante publicou junto da FDA, em inglês. Não é a bula
// portuguesa, não cobre tudo, e um medicamento que não esteja nesse registo
// devolve `found: false` — o que NÃO quer dizer que não tenha efeitos.

const TIMEOUT = 7000

export interface RotuloFDA {
  found: boolean
  normalized: string
  rxcui: string | null
  generic_name: string | null
  brand_names: string[]
  manufacturer: string | null
  boxed_warning: string | null
  indications: string | null
  dosage: string | null
  warnings: string | null
  interactions: string | null
  adverse_reactions: string | null
  contraindications: string | null
  source: string
  message?: string
}

async function lerJSON(url: string): Promise<any | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Um campo do rótulo: vem como array de um elemento, por vezes enorme. */
function texto(arr: unknown, max = 1200): string | null {
  if (!Array.isArray(arr) || !arr.length) return null
  const t = String(arr[0]).replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max).replace(/\s\S*$/, '') + '…' : t
}

const FONTE = 'OpenFDA (rótulo FDA) · RxNorm (NIH) — em inglês'

/**
 * Procura o rótulo. Nunca lança: a rede falhar devolve `found: false`, e quem
 * chama decide o que dizer. Numa página de cuidados, uma procura falhada não
 * pode partir nada.
 */
export async function rotuloDe(nome: string): Promise<RotuloFDA> {
  const q = String(nome || '').trim()

  // 1) Normalizar pelo RxNorm, quando der.
  let normalized = q
  const rx = await lerJSON(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(q)}&search=2`)
  const rxcui = rx?.idGroup?.rxnormId?.[0] || null
  if (rxcui) {
    const props = await lerJSON(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`)
    const n = props?.propConceptGroup?.propConcept?.[0]?.propValue
    if (n) normalized = n
  }

  // 2) O rótulo do OpenFDA.
  const termo = encodeURIComponent(`"${q}"`)
  const fda = await lerJSON(
    `https://api.fda.gov/drug/label.json?search=(openfda.generic_name:${termo}+OR+openfda.brand_name:${termo})&limit=1`)
  const res = fda?.results?.[0]

  if (!res) {
    return {
      found: false, normalized, rxcui,
      generic_name: null, brand_names: [], manufacturer: null,
      boxed_warning: null, indications: null, dosage: null, warnings: null,
      interactions: null, adverse_reactions: null, contraindications: null,
      source: FONTE,
      message: 'Sem ficha de referência FDA para este termo.',
    }
  }

  const of = res.openfda || {}
  return {
    found: true,
    normalized,
    rxcui,
    generic_name: of.generic_name?.[0] || null,
    brand_names: (of.brand_name || []).slice(0, 5),
    manufacturer: of.manufacturer_name?.[0] || null,
    boxed_warning: texto(res.boxed_warning, 800),
    indications: texto(res.indications_and_usage, 900),
    dosage: texto(res.dosage_and_administration, 900),
    warnings: texto(res.warnings || res.warnings_and_cautions, 900),
    interactions: texto(res.drug_interactions, 1100),
    adverse_reactions: texto(res.adverse_reactions, 900),
    contraindications: texto(res.contraindications, 700),
    source: FONTE,
  }
}
