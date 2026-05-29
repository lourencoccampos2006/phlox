// lib/fiscal.ts
// Motor fiscal do Phlox — replica os MECANISMOS dos softwares certificados, com as
// primitivas disponíveis no runtime (Web Crypto, compatível com Cloudflare Workers):
//   • Cadeia de integridade SHA-256 (cada documento referencia o anterior da série)
//   • ATCUD (CodigoValidacao-Sequência)
//   • QR Code no formato OFICIAL da AT (campos A:…*B:…*…)
//   • Numeração sequencial por série/ano
// NOTA LEGAL: são documentos de GESTÃO. A assinatura RSA-SHA1 com valor fiscal é
// exclusiva de software certificado; o QR/ATCUD final é emitido por esse software.
// Aqui produzimos a MESMA ESTRUTURA para talões internos e para alimentar o export.

export type DocType = 'FS' | 'FR' | 'FT' | 'NC' | 'RG'

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  FS: 'Fatura Simplificada', FR: 'Fatura-Recibo', FT: 'Fatura', NC: 'Nota de Crédito', RG: 'Recibo',
}

export interface FiscalDocInput {
  docType: DocType
  series: string
  seq: number
  year: number
  date: string            // YYYY-MM-DD
  nif?: string            // NIF do emitente (empresa)
  customerNif?: string
  netTotal: number        // base s/ IVA
  taxTotal: number        // IVA
  grossTotal: number      // total c/ IVA
  prevHash?: string | null
}

// ── SHA-256 base64 (Web Crypto; corre em Workers, Node 18+ e browser) ──────────
async function sha256b64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // base64 (btoa existe em Workers e browser; em Node há Buffer fallback)
  return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64')
}

export const docNumber = (t: DocType, series: string, year: number, seq: number) => `${t} ${series}/${year}/${seq}`

// Hash encadeado do documento — estrutura inspirada na Portaria 363/2010:
// Data;DataHoraEmissão;NumeroDocumento;GrossTotal;Hash-do-anterior
export async function chainHash(d: FiscalDocInput, nowISO: string): Promise<string> {
  const payload = [
    d.date,
    nowISO,
    docNumber(d.docType, d.series, d.year, d.seq),
    d.grossTotal.toFixed(2),
    d.prevHash || '',
  ].join(';')
  return sha256b64(payload)
}

// 4 carateres do hash (posições 1, 11, 21, 31) — como no campo do QR da AT.
export function hash4(hash: string): string {
  return [0, 10, 20, 30].map(i => hash[i] ?? '').join('')
}

// ATCUD = CodigoValidacaoSerie-NumeroSequencial. Sem código AT validado → usa 'AT'.
export function buildATCUD(atcudCode: string | null | undefined, seq: number): string {
  return `${atcudCode && atcudCode.trim() ? atcudCode.trim() : 'AT'}-${seq}`
}

// QR Code no formato OFICIAL da AT (Portaria 195/2020). Campos separados por '*'.
// Inclui só os campos essenciais (um QR real teria todas as taxas; cobrimos a taxa dominante).
export interface QRParams {
  emitterNif: string
  customerNif?: string
  country?: string
  docType: DocType
  docStatus?: string      // N normal | A anulado | R resumo
  date: string            // YYYY-MM-DD → YYYYMMDD
  docNo: string           // ex: FS A/2026/123
  atcud: string
  taxRate: number         // taxa dominante p/ I3..I8
  netByTax: number        // base na taxa dominante
  taxByTax: number        // IVA na taxa dominante
  grossTotal: number
  taxTotal: number
  hashChars4: string
  softwareCert?: string   // nº de certificado do software (0 se não certificado)
}

export function buildATQR(p: QRParams): string {
  const d = p.date.replace(/-/g, '')
  // Campo do espaço fiscal por taxa: I = espaço PT
  const taxSpace: string[] = ['I1:PT']
  const rate = p.taxRate
  if (rate >= 23) { taxSpace.push(`I7:${p.netByTax.toFixed(2)}`, `I8:${p.taxByTax.toFixed(2)}`) }
  else if (rate >= 13) { taxSpace.push(`I5:${p.netByTax.toFixed(2)}`, `I6:${p.taxByTax.toFixed(2)}`) }
  else if (rate >= 6) { taxSpace.push(`I3:${p.netByTax.toFixed(2)}`, `I4:${p.taxByTax.toFixed(2)}`) }
  else { taxSpace.push(`I2:${(p.grossTotal - p.taxTotal).toFixed(2)}`) } // isento

  const fields: string[] = [
    `A:${p.emitterNif}`,
    `B:${p.customerNif || '999999990'}`,
    `C:${p.country || 'PT'}`,
    `D:${p.docType}`,
    `E:${p.docStatus || 'N'}`,
    `F:${d}`,
    `G:${p.docNo}`,
    `H:${p.atcud}`,
    ...taxSpace,
    `N:${p.taxTotal.toFixed(2)}`,
    `O:${p.grossTotal.toFixed(2)}`,
    `Q:${p.hashChars4}`,
    `R:${p.softwareCert || '0'}`,
  ]
  return fields.join('*')
}

// URL de um QR Code renderizável a partir da string AT (sem dependências).
export function qrImageUrl(qrData: string, size = 150): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrData)}`
}

// Compõe tudo: devolve os campos fiscais prontos a guardar/imprimir.
export async function buildFiscalDoc(d: FiscalDocInput, opts: { atcudCode?: string | null; emitterNif: string; customerNif?: string; taxRate: number }) {
  const now = new Date()
  const nowISO = now.toISOString().slice(0, 19)
  const hash = await chainHash(d, nowISO)
  const h4 = hash4(hash)
  const atcud = buildATCUD(opts.atcudCode, d.seq)
  const no = docNumber(d.docType, d.series, d.year, d.seq)
  const qr = buildATQR({
    emitterNif: opts.emitterNif || '999999990', customerNif: opts.customerNif, docType: d.docType,
    docStatus: d.docType === 'NC' ? 'A' : 'N', date: d.date, docNo: no, atcud,
    taxRate: opts.taxRate, netByTax: d.netTotal, taxByTax: d.taxTotal, grossTotal: d.grossTotal, taxTotal: d.taxTotal,
    hashChars4: h4,
  })
  return { docNo: no, hash, hash4: h4, atcud, qrData: qr, finalizedAt: now.toISOString() }
}
