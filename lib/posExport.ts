// lib/posExport.ts
// Exportação universal de vendas para software de faturação certificado.
// O Phlox NÃO emite fiscalmente — produz ficheiros/payloads que o software
// certificado (Sage, PHC, Moloni, InvoiceXpress, Vendus, Sifarma…) importa.
// Isto poupa >80% do trabalho de lançamento manual.

export interface SaleLine { name: string; qty: number; unit_price: number; discount: number; tax_rate: number }
export interface SaleRecord {
  id: string; at: string; kind: string; person_name?: string | null; nif?: string | null
  method: string; gross: number; discount: number; tax_rate: number; doc_number?: string | null
  lines?: SaleLine[]
}

const n2 = (v: number) => (Math.round((v || 0) * 100) / 100).toFixed(2)
const net = (s: SaleRecord) => Math.max(0, (s.gross || 0) - (s.discount || 0))
// valor de IVA contido num total c/ IVA
const taxOf = (total: number, rate: number) => rate > 0 ? total - total / (1 + rate / 100) : 0

// ── CSV genérico (Excel/Sage/PHC importam) ─────────────────────────────────────
export function toCSV(sales: SaleRecord[]): string {
  const head = ['Data', 'Hora', 'Documento', 'Tipo', 'Cliente', 'NIF', 'Descricao', 'Qtd', 'PrecoUnit', 'Desconto', 'IVA%', 'ValorIVA', 'Total', 'Metodo']
  const rows: string[] = [head.join(';')]
  for (const s of sales) {
    const date = new Date(s.at)
    const d = date.toLocaleDateString('pt-PT')
    const h = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    const lines = s.lines && s.lines.length ? s.lines : [{ name: s.kind, qty: 1, unit_price: net(s), discount: 0, tax_rate: s.tax_rate || 0 }]
    for (const l of lines) {
      const lineTotal = Math.max(0, l.qty * l.unit_price - (l.discount || 0))
      rows.push([
        d, h, s.doc_number || '', s.kind, csv(s.person_name || ''), s.nif || '', csv(l.name),
        String(l.qty), n2(l.unit_price), n2(l.discount || 0), String(l.tax_rate || 0),
        n2(taxOf(lineTotal, l.tax_rate || 0)), n2(lineTotal), s.method,
      ].join(';'))
    }
  }
  return rows.join('\n')
}
function csv(v: string) { return /[;\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }

// ── SAFT-PT-like (estrutura simplificada de SalesInvoices para conferência) ─────
// NOTA: não é um SAF-T válido para submissão à AT (sem certificação/hash);
// serve para o software certificado/contabilista conferir e importar movimentos.
export function toSAFTLike(sales: SaleRecord[], company: { name?: string; nif?: string }): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const total = sales.reduce((a, s) => a + net(s), 0)
  const tax = sales.reduce((a, s) => a + taxOf(net(s), s.tax_rate || 0), 0)
  const invoices = sales.map((s, i) => {
    const lines = s.lines && s.lines.length ? s.lines : [{ name: s.kind, qty: 1, unit_price: net(s), discount: 0, tax_rate: s.tax_rate || 0 }]
    const lineXml = lines.map((l, j) => {
      const lt = Math.max(0, l.qty * l.unit_price - (l.discount || 0))
      const base = (l.tax_rate || 0) > 0 ? lt / (1 + l.tax_rate / 100) : lt
      return `        <Line>
          <LineNumber>${j + 1}</LineNumber>
          <Description>${esc(l.name)}</Description>
          <Quantity>${l.qty}</Quantity>
          <UnitPrice>${n2(l.unit_price)}</UnitPrice>
          <CreditAmount>${n2(base)}</CreditAmount>
          <Tax><TaxPercentage>${l.tax_rate || 0}</TaxPercentage></Tax>
        </Line>`
    }).join('\n')
    return `      <Invoice>
        <InvoiceNo>${esc(s.doc_number || `PHLOX/${i + 1}`)}</InvoiceNo>
        <InvoiceDate>${new Date(s.at).toISOString().slice(0, 10)}</InvoiceDate>
        <InvoiceType>${s.kind === 'consulta' || s.kind === 'ato' ? 'FR' : 'FS'}</InvoiceType>
        <CustomerName>${esc(s.person_name || 'Consumidor final')}</CustomerName>
        <CustomerTaxID>${esc(s.nif || '999999990')}</CustomerTaxID>
${lineXml}
        <DocumentTotals><NetTotal>${n2(net(s) - taxOf(net(s), s.tax_rate || 0))}</NetTotal><TaxPayable>${n2(taxOf(net(s), s.tax_rate || 0))}</TaxPayable><GrossTotal>${n2(net(s))}</GrossTotal></DocumentTotals>
      </Invoice>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Ficheiro tipo-SAFT gerado pelo Phlox para conferência/importação. NÃO é um SAF-T fiscal válido (sem certificação AT). -->
<AuditFile>
  <Header>
    <CompanyName>${esc(company.name || 'Instituição')}</CompanyName>
    <TaxRegistrationNumber>${esc(company.nif || '')}</TaxRegistrationNumber>
    <ProductCompanyTaxID>Phlox</ProductCompanyTaxID>
    <SoftwareValidationNumber>NAO_CERTIFICADO</SoftwareValidationNumber>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${sales.length}</NumberOfEntries>
      <TotalCredit>${n2(total - tax)}</TotalCredit>
${invoices}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`
}

// ── Payload Moloni (documents/insert) ──────────────────────────────────────────
export function toMoloni(s: SaleRecord) {
  const lines = s.lines && s.lines.length ? s.lines : [{ name: s.kind, qty: 1, unit_price: net(s), discount: 0, tax_rate: s.tax_rate || 0 }]
  return {
    date: new Date(s.at).toISOString().slice(0, 10),
    customer_name: s.person_name || 'Consumidor final',
    customer_vat: s.nif || '999999990',
    products: lines.map(l => ({
      name: l.name, qty: l.qty,
      price: (l.tax_rate || 0) > 0 ? l.unit_price / (1 + l.tax_rate / 100) : l.unit_price, // Moloni: preço s/ IVA
      discount: l.discount ? (l.discount / (l.qty * l.unit_price)) * 100 : 0,
      taxes: [{ value: l.tax_rate || 0 }],
    })),
  }
}

// ── Payload InvoiceXpress (invoices) ───────────────────────────────────────────
export function toInvoiceXpress(s: SaleRecord) {
  const lines = s.lines && s.lines.length ? s.lines : [{ name: s.kind, qty: 1, unit_price: net(s), discount: 0, tax_rate: s.tax_rate || 0 }]
  return {
    invoice: {
      date: new Date(s.at).toLocaleDateString('pt-PT'),
      client: { name: s.person_name || 'Consumidor final', fiscal_id: s.nif || '999999990' },
      items: lines.map(l => ({
        name: l.name, quantity: l.qty,
        unit_price: (l.tax_rate || 0) > 0 ? l.unit_price / (1 + l.tax_rate / 100) : l.unit_price,
        discount: l.discount || 0,
        tax: { name: `IVA${l.tax_rate || 0}`, value: l.tax_rate || 0 },
      })),
    },
  }
}

// ── Payload Vendus (documents) ─────────────────────────────────────────────────
export function toVendus(s: SaleRecord) {
  const lines = s.lines && s.lines.length ? s.lines : [{ name: s.kind, qty: 1, unit_price: net(s), discount: 0, tax_rate: s.tax_rate || 0 }]
  const taxId = (r: number) => r >= 23 ? 'NOR' : r >= 13 ? 'INT' : r >= 6 ? 'RED' : 'ISE'
  return {
    type: s.nif ? 'FR' : 'FS',
    register_id: 0,
    client: { name: s.person_name || 'Consumidor final', fiscal_id: s.nif || undefined },
    items: lines.map(l => ({
      title: l.name, qty: l.qty, gross_price: l.unit_price, tax_id: taxId(l.tax_rate || 0),
    })),
  }
}
