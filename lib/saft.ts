// lib/saft.ts
// Exportador SAF-T (PT) com a ESTRUTURA oficial da AT (Standard Audit File for Tax).
// Header + MasterFiles (Customers, Products, TaxTable) + SourceDocuments/SalesInvoices.
// NOTA: o SAF-T fiscalmente válido é gerado por software certificado (inclui hash
// RSA-SHA1 e nº de certificação). Este ficheiro segue a mesma estrutura para
// CONFERÊNCIA e IMPORTAÇÃO pelo contabilista/ERP — TaxRegistrationNumber do produtor
// fica marcado como não certificado.

export interface SaftSaleLine { name: string; qty: number; unitPriceNet: number; taxRate: number; discount?: number; productCode?: string }
export interface SaftSale {
  docNo: string; docType: string; date: string; status?: string
  customerName?: string; customerNif?: string
  hash?: string; atcud?: string
  netTotal: number; taxTotal: number; grossTotal: number
  lines: SaftSaleLine[]
}
export interface SaftCompany { name?: string; nif?: string; address?: string }

const esc = (s: string | number | undefined | null) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = (v: number) => (Math.round((v || 0) * 100) / 100).toFixed(2)
const taxType = (rate: number) => rate <= 0 ? 'ISE' : rate < 6 ? 'RED' : rate < 13 ? 'RED' : rate < 23 ? 'INT' : 'NOR'

export function buildSAFT(company: SaftCompany, sales: SaftSale[], period: { from: string; to: string }): string {
  const customers = new Map<string, { name: string; nif: string }>()
  const products = new Map<string, { code: string; name: string }>()
  const taxRates = new Set<number>()

  sales.forEach(s => {
    const nif = s.customerNif || '999999990'
    if (!customers.has(nif)) customers.set(nif, { name: s.customerName || 'Consumidor final', nif })
    s.lines.forEach(l => {
      const code = l.productCode || l.name.slice(0, 40)
      if (!products.has(code)) products.set(code, { code, name: l.name })
      taxRates.add(l.taxRate || 0)
    })
  })

  const totalCredit = sales.reduce((a, s) => a + s.netTotal, 0)
  const totalTax = sales.reduce((a, s) => a + s.taxTotal, 0)

  const customerXml = [...customers.values()].map((c, i) => `      <Customer>
        <CustomerID>C${i + 1}</CustomerID>
        <AccountID>Desconhecido</AccountID>
        <CustomerTaxID>${esc(c.nif)}</CustomerTaxID>
        <CompanyName>${esc(c.name)}</CompanyName>
        <BillingAddress><AddressDetail>Desconhecido</AddressDetail><City>Desconhecido</City><PostalCode>0000-000</PostalCode><Country>PT</Country></BillingAddress>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`).join('\n')

  const productXml = [...products.values()].map((p, i) => `      <Product>
        <ProductType>P</ProductType>
        <ProductCode>${esc(p.code)}</ProductCode>
        <ProductDescription>${esc(p.name)}</ProductDescription>
        <ProductNumberCode>${esc(p.code)}</ProductNumberCode>
      </Product>`).join('\n')

  const taxXml = [...taxRates].map(r => `      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>PT</TaxCountryRegion>
        <TaxCode>${taxType(r)}</TaxCode>
        <Description>IVA ${r}%</Description>
        <TaxPercentage>${n2(r)}</TaxPercentage>
      </TaxTableEntry>`).join('\n')

  const custIdByNif = new Map<string, string>()
  ;[...customers.values()].forEach((c, i) => custIdByNif.set(c.nif, `C${i + 1}`))

  const invoiceXml = sales.map(s => {
    const lines = s.lines.map((l, j) => {
      const lineNet = l.qty * l.unitPriceNet - (l.discount || 0)
      return `        <Line>
          <LineNumber>${j + 1}</LineNumber>
          <ProductCode>${esc(l.productCode || l.name.slice(0, 40))}</ProductCode>
          <ProductDescription>${esc(l.name)}</ProductDescription>
          <Quantity>${l.qty}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${n2(l.unitPriceNet)}</UnitPrice>
          <TaxPointDate>${s.date}</TaxPointDate>
          <Description>${esc(l.name)}</Description>
          <CreditAmount>${n2(lineNet)}</CreditAmount>
          <Tax><TaxType>IVA</TaxType><TaxCountryRegion>PT</TaxCountryRegion><TaxCode>${taxType(l.taxRate)}</TaxCode><TaxPercentage>${n2(l.taxRate)}</TaxPercentage></Tax>
        </Line>`
    }).join('\n')
    return `      <Invoice>
        <InvoiceNo>${esc(s.docNo)}</InvoiceNo>
        <ATCUD>${esc(s.atcud || '0')}</ATCUD>
        <DocumentStatus><InvoiceStatus>${s.status === 'anulado' ? 'A' : 'N'}</InvoiceStatus><InvoiceStatusDate>${s.date}T00:00:00</InvoiceStatusDate><SourceID>Phlox</SourceID><SourceBilling>P</SourceBilling></DocumentStatus>
        <Hash>${esc(s.hash || '0')}</Hash>
        <HashControl>1</HashControl>
        <Period>${parseInt(s.date.slice(5, 7))}</Period>
        <InvoiceDate>${s.date}</InvoiceDate>
        <InvoiceType>${esc(s.docType)}</InvoiceType>
        <SpecialRegimes><SelfBillingIndicator>0</SelfBillingIndicator><CashVATSchemeIndicator>0</CashVATSchemeIndicator><ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator></SpecialRegimes>
        <SourceID>Phlox</SourceID>
        <SystemEntryDate>${s.date}T00:00:00</SystemEntryDate>
        <CustomerID>${custIdByNif.get(s.customerNif || '999999990') || 'C1'}</CustomerID>
${lines}
        <DocumentTotals><TaxPayable>${n2(s.taxTotal)}</TaxPayable><NetTotal>${n2(s.netTotal)}</NetTotal><GrossTotal>${n2(s.grossTotal)}</GrossTotal></DocumentTotals>
      </Invoice>`
  }).join('\n')

  return `<?xml version="1.0" encoding="windows-1252"?>
<!-- SAF-T (PT) gerado pelo Phlox. ESTRUTURA conforme esquema AT, para conferência/importação.
     A versão fiscalmente válida (com hash RSA-SHA1 e nº de certificação) é gerada pelo software certificado. -->
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${esc(company.nif || '')}</CompanyID>
    <TaxRegistrationNumber>${esc(company.nif || '')}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${esc(company.name || 'Instituição')}</CompanyName>
    <CompanyAddress><AddressDetail>${esc(company.address || 'Desconhecido')}</AddressDetail><City>Desconhecido</City><PostalCode>0000-000</PostalCode><Country>PT</Country></CompanyAddress>
    <FiscalYear>${period.from.slice(0, 4)}</FiscalYear>
    <StartDate>${period.from}</StartDate>
    <EndDate>${period.to}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${new Date().toISOString().slice(0, 10)}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>NAO_CERTIFICADO</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>Phlox/Phlox</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
${customerXml}
${productXml}
    <TaxTable>
${taxXml}
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${sales.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${n2(totalCredit)}</TotalCredit>
${invoiceXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`
}
