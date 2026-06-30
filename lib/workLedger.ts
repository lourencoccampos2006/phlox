// lib/workLedger.ts
// ─────────────────────────────────────────────────────────────────────────────
// "Cofre de Valor" — o que ficou REGISTADO e ORGANIZADO este mês.
//
// Responde à objeção de venda "porque é que vale a pena trocar?": mostra, em
// números REAIS e auditáveis, o rigor que a instituição passa a ter com o Phlox.
//
// HONESTO POR DESIGN: não inventa euros nem "vidas salvas". Conta apenas o que a
// equipa documentou e o Phlox organizou. É um retrato do trabalho, não uma
// promessa clínica. (Linguagem alinhada com a prudência regulatória da Ronda 5.)
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerInput {
  monthLabel: string
  careRecordsMonth: number     // registos do dia feitos este mês
  careDaysMonth: number        // utente-dias com registo
  marGivenMonth: number        // doses registadas como dadas
  marAdherence: number | null  // % de doses registadas como dadas
  incidentsMonth: number       // ocorrências documentadas este mês
  incidentsFollowed: number    // ocorrências com seguimento/fecho
  assessmentsMonth: number     // avaliações (escalas) feitas este mês
  vigilFindings: number        // achados farmacológicos sinalizados p/ revisão
}

export interface LedgerLine { icon: string; value: string; label: string; tone: 'good' | 'neutral' }

export function buildLedger(d: LedgerInput): { title: string; lines: LedgerLine[]; note: string } {
  const lines: LedgerLine[] = []

  if (d.careRecordsMonth > 0)
    lines.push({ icon: '📝', value: String(d.careRecordsMonth), label: `registos de cuidados (${d.careDaysMonth} dias documentados)`, tone: 'good' })
  if (d.marGivenMonth > 0)
    lines.push({ icon: '💊', value: String(d.marGivenMonth), label: d.marAdherence != null ? `tomas registadas · ${d.marAdherence}% das previstas` : 'tomas de medicação registadas', tone: 'good' })
  if (d.vigilFindings > 0)
    lines.push({ icon: '🔎', value: String(d.vigilFindings), label: 'pontos farmacológicos sinalizados para revisão da equipa', tone: 'neutral' })
  if (d.incidentsMonth > 0)
    lines.push({ icon: '📋', value: `${d.incidentsFollowed}/${d.incidentsMonth}`, label: 'ocorrências documentadas com seguimento', tone: d.incidentsFollowed >= d.incidentsMonth ? 'good' : 'neutral' })
  if (d.assessmentsMonth > 0)
    lines.push({ icon: '📊', value: String(d.assessmentsMonth), label: 'avaliações (escalas) realizadas', tone: 'good' })

  const note = lines.length === 0
    ? 'Ainda sem registos este mês. À medida que a equipa regista, este resumo enche-se.'
    : 'Números reais do que a equipa registou e o Phlox organizou. Pronto a mostrar à direção, às famílias ou numa inspeção.'

  return { title: `O que ficou registado e organizado · ${d.monthLabel}`, lines, note }
}
