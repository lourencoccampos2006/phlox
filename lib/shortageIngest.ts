// lib/shortageIngest.ts
// Vigia de Ruturas — descoberta + leitura da Lista de Notificação Prévia (LNP)
// do INFARMED. A LNP é um ficheiro Excel (.xlsx) genuinamente estruturado,
// público, sem login, atualizado trimestralmente — testado e confirmado
// (não é PDF digitalizado, não é um formulário ao vivo com sessão). Zero OCR,
// zero browser automatizado — só download + parsing de uma tabela real.
//
// Usado só no servidor (server-only): `exceljs` e `fetch` de Node.

import ExcelJS from 'exceljs'

export interface ShortageRow {
  registration_no: string | null
  medicine_name: string
  dci: string | null
  dosage: string | null
  form: string | null
  presentation: string | null
  cft: string | null
}

export interface LnpDiscovery { url: string; label: string }

const CANDIDATE_PAGES = [
  'https://www.infarmed.pt/web/infarmed/gestao-da-disponibilidade-do-medicamento',
  'https://www.infarmed.pt/web/infarmed/institucional/documentacao_e_informacao/publicacoes/lista-publicacoes',
]

function decodeEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
}

// ID estável da "pasta" de documentos do INFARMED onde a Lista de Notificação
// Prévia é publicada — confirmado por inspeção real: o mesmo ID aparece tanto
// na publicação de 2022/2023 ("Lista+de+notificação+prévia+-+junho23") como na
// atual de 2026 ("Lista+em+vigor+a+partir+de+5+de+julho+de+2026") — o NOME do
// ficheiro muda a cada trimestre (às vezes nem contém a palavra "notificação"),
// mas a pasta mantém-se. Mais robusto do que tentar casar o nome do ficheiro.
const LNP_FOLDER_ID = '4326055'

/**
 * Procura, nas páginas candidatas do INFARMED, o link mais recente para a
 * Lista de Notificação Prévia (LNP). Duas estratégias, da mais para a menos
 * específica: (1) qualquer link dentro da pasta estável LNP_FOLDER_ID cujo
 * texto comece por "Lista" (exclui "Infografia"/"Orientações", que vivem na
 * mesma pasta); (2) fallback — qualquer link cujo nome contenha "notificação
 * prévia", para o caso da pasta alguma vez mudar.
 */
export async function findLatestLnpUrl(): Promise<LnpDiscovery | null> {
  const linkRe = /href="(\/documents\/15786\/[^"]+)"[^>]*>([^<]*)</g

  for (const page of CANDIDATE_PAGES) {
    try {
      const res = await fetch(page, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PhloxBot/1.0)' } })
      if (!res.ok) continue
      const html = decodeEntities(await res.text())
      const allLinks = [...html.matchAll(linkRe)].map(m => ({ url: `https://www.infarmed.pt${m[1]}`, label: m[2].trim() }))

      const inFolder = allLinks.filter(m => m.url.includes(`/documents/15786/${LNP_FOLDER_ID}/`))
      const listInFolder = inFolder.filter(m => /^lista/i.test(m.label) && !/revoga/i.test(m.label))
      if (listInFolder.length > 0) return listInFolder[0]

      const fallback = allLinks.filter(m => /notifica[cç][aã]o\s*pr[ée]via/i.test(m.label))
      if (fallback.length > 0) return fallback[0]
    } catch { /* tenta a próxima página candidata */ }
  }
  return null
}

/** Lê o cabeçalho da 1ª linha e mapeia colunas por NOME (não por posição fixa —
 * o INFARMED pode reordenar colunas entre publicações). */
function buildColumnMap(headerRow: ExcelJS.Row): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.eachCell((cell, colNumber) => {
    const key = String(cell.value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    map[key] = colNumber
  })
  return map
}

// Aliases por SUBSTRING (não igualdade exata) — confirmado por inspeção real
// que os nomes das colunas mudam ligeiramente entre publicações do INFARMED
// (ex: "Nome do medicamento" em 2023 vs "Nome Comercial" em 2026; "DCI" vs
// "DCI/Substância Ativa"; "Apresentação" vs "Tamanho da embalagem").
const COLUMN_ALIASES: Record<keyof ShortageRow, string[]> = {
  registration_no: ['registo'],
  medicine_name: ['nome comercial', 'nome do medicamento', 'medicamento'],
  dci: ['dci', 'substancia ativa'],
  dosage: ['dosagem'],
  form: ['forma farmaceutica'],
  presentation: ['apresentacao', 'tamanho da embalagem', 'embalagem'],
  cft: ['cft'],
}

function findColumn(colMap: Record<string, number>, field: keyof ShortageRow): number | null {
  const keys = Object.keys(colMap)
  for (const alias of COLUMN_ALIASES[field]) {
    const hit = keys.find(k => k.includes(alias))
    if (hit) return colMap[hit]
  }
  return null
}

/** Analisa o workbook (buffer .xlsx) e devolve as linhas normalizadas.
 * Defensivo: se não encontrar a coluna "Nome do medicamento", falha alto em
 * vez de devolver dados sem sentido silenciosamente — melhor não ingerir nada
 * do que ingerir uma tabela mal alinhada. */
export async function parseLnpWorkbook(buffer: ArrayBuffer): Promise<ShortageRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)
  // O ficheiro pode ter mais do que uma folha (ex: confirmado — uma folha
  // "Ruturas" com a lista geral + folhas extra dedicadas a um fármaco em
  // destaque, tipo "Quetiapina"). Queremos sempre a lista geral.
  const sheet = wb.worksheets.find(s => /ruturas|lista/i.test(s.name)) || wb.worksheets[0]
  if (!sheet) throw new Error('Ficheiro sem folhas de cálculo')

  const headerRow = sheet.getRow(1)
  const colMap = buildColumnMap(headerRow)
  const nameCol = findColumn(colMap, 'medicine_name')
  if (nameCol == null) throw new Error('Coluna "Nome do medicamento" não encontrada — formato do ficheiro pode ter mudado')

  const regCol = findColumn(colMap, 'registration_no')
  const dciCol = findColumn(colMap, 'dci')
  const dosageCol = findColumn(colMap, 'dosage')
  const formCol = findColumn(colMap, 'form')
  const presCol = findColumn(colMap, 'presentation')
  const cftCol = findColumn(colMap, 'cft')

  const rows: ShortageRow[] = []
  const cellText = (row: ExcelJS.Row, col: number | null) => {
    if (col == null) return null
    const v = row.getCell(col).value
    if (v == null) return null
    const s = typeof v === 'object' && 'text' in (v as any) ? (v as any).text : String(v)
    const trimmed = String(s).trim()
    return trimmed || null
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // cabeçalho
    const medicine_name = cellText(row, nameCol)
    if (!medicine_name) return // linha vazia/mal formada — ignora, não inventa
    rows.push({
      registration_no: cellText(row, regCol),
      medicine_name,
      dci: cellText(row, dciCol),
      dosage: cellText(row, dosageCol),
      form: cellText(row, formCol),
      presentation: cellText(row, presCol),
      cft: cellText(row, cftCol),
    })
  })

  return rows
}

/** Normaliza um nome de medicamento para comparação (minúsculas, sem acentos,
 * sem espaços a mais). Usado tanto na ingestão como no matching do utilizador. */
export function normalizeDrugName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}
