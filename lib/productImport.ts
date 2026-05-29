// lib/productImport.ts
// Importação de produtos em massa para o catálogo/stock, a partir de CSV.
// Auto-deteta colunas de exports comuns (Sifarma das farmácias, ERP genéricos, Excel),
// mapeia para o esquema stock_items, e prepara linhas para upsert por código de barras.

export interface ImportedProduct {
  name: string
  barcode?: string
  ref?: string
  price?: number
  cost?: number
  tax_rate?: number
  quantity?: number
  min_quantity?: number
  unit?: string
  category?: string
}

// ── Parser CSV tolerante (vírgula OU ponto-e-vírgula OU tab; aspas; \r\n) ───────
export function parseCSV(text: string): string[][] {
  // remove BOM
  text = text.replace(/^﻿/, '')
  // deteta o separador pela 1ª linha
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length)
  const counts = { ';': (firstLine.match(/;/g) || []).length, ',': (firstLine.match(/,/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length }
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as string
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === sep) { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* ignora */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// ── Dicionário de sinónimos de cabeçalhos → campo interno ──────────────────────
const HEADER_MAP: Record<keyof ImportedProduct, string[]> = {
  name:        ['nome', 'designacao', 'designação', 'descricao', 'descrição', 'produto', 'artigo', 'name', 'description'],
  barcode:     ['cnp', 'cnpem', 'ean', 'ean13', 'codigo de barras', 'código de barras', 'barcode', 'codigobarras', 'cod barras'],
  ref:         ['referencia', 'referência', 'ref', 'sku', 'codigo', 'código', 'cod', 'code', 'cod interno'],
  price:       ['pvp', 'preco venda', 'preço venda', 'preco', 'preço', 'price', 'pvp s/iva', 'pvp c/iva', 'valor'],
  cost:        ['custo', 'preco custo', 'preço custo', 'pcl', 'cost', 'pca'],
  tax_rate:    ['iva', 'taxa iva', 'iva%', 'vat', 'tax'],
  quantity:    ['stock', 'quantidade', 'qtd', 'qty', 'existencias', 'existências', 'unidades'],
  min_quantity:['stock minimo', 'stock mínimo', 'minimo', 'mínimo', 'min', 'ponto encomenda'],
  unit:        ['unidade', 'un', 'unit', 'embalagem'],
  category:    ['categoria', 'familia', 'família', 'grupo', 'category', 'tipo'],
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[._-]/g, ' ').trim()

// Mapeia índices de coluna para campos, a partir da linha de cabeçalho.
export function detectColumns(header: string[]): Partial<Record<keyof ImportedProduct, number>> {
  const map: Partial<Record<keyof ImportedProduct, number>> = {}
  header.forEach((h, idx) => {
    const n = norm(h)
    for (const field of Object.keys(HEADER_MAP) as (keyof ImportedProduct)[]) {
      if (map[field] !== undefined) continue
      if (HEADER_MAP[field].some(syn => n === syn || n.includes(syn))) { map[field] = idx; break }
    }
  })
  return map
}

const toNum = (v: string | undefined): number | undefined => {
  if (v == null) return undefined
  const cleaned = v.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.') // 1.234,56 → 1234.56
  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}

// Constrói os produtos a partir do CSV. Devolve linhas válidas + erros.
export function buildProducts(text: string): { products: ImportedProduct[]; headerFound: boolean; columns: Partial<Record<keyof ImportedProduct, number>>; total: number } {
  const rows = parseCSV(text)
  if (rows.length === 0) return { products: [], headerFound: false, columns: {}, total: 0 }
  const columns = detectColumns(rows[0])
  const headerFound = columns.name !== undefined || columns.barcode !== undefined
  const dataRows = headerFound ? rows.slice(1) : rows
  // sem cabeçalho reconhecido → assume col0=nome, col1=barcode, col2=pvp
  const cols = headerFound ? columns : { name: 0, barcode: 1, price: 2 }
  const products: ImportedProduct[] = []
  for (const r of dataRows) {
    const get = (k: keyof ImportedProduct) => cols[k] !== undefined ? r[cols[k]!]?.trim() : undefined
    const name = get('name') || get('barcode') || ''
    if (!name) continue
    products.push({
      name: name.slice(0, 120),
      barcode: get('barcode') || undefined,
      ref: get('ref') || undefined,
      price: toNum(get('price')),
      cost: toNum(get('cost')),
      tax_rate: toNum(get('tax_rate')),
      quantity: toNum(get('quantity')),
      min_quantity: toNum(get('min_quantity')),
      unit: get('unit') || undefined,
      category: get('category')?.toLowerCase() || undefined,
    })
  }
  return { products, headerFound, columns, total: dataRows.length }
}
