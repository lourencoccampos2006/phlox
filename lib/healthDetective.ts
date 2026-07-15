// lib/healthDetective.ts
// Detetive de Saúde — correlação temporal causa→efeito, determinística (sem
// custo de IA, sem inventar). Cruza a data de início de cada medicamento com
// o aparecimento de sintomas NOVOS logo a seguir — algo que ninguém liga
// manualmente. Diferente do /medico-bolso "olhar ao momento presente": aqui
// olhamos à LINHA DO TEMPO. Usado por /api/companion (o motor do Médico de
// Bolso ganha esta 3ª lente, a par de interações e tendências de vitais).

export interface TemporalMed { name: string; started_at: string | null }
export interface TemporalSymptom { at: string; symptoms: string[] | null }

export interface TemporalHypothesis {
  medication: string
  started_at: string
  symptom: string
  days_after_start: number
  occurrences: number
}

const WINDOW_DAYS = 21     // janela após início do fármaco em que um sintoma novo é suspeito
const MIN_OCCURRENCES = 2  // exige recorrência, não um episódio isolado (evita "ruído")

/**
 * Para cada medicamento com data de início conhecida, procura sintomas que:
 * (a) nunca tinham sido registados ANTES do medicamento começar, e
 * (b) aparecem ≥2 vezes DEPOIS do início, dentro da janela de suspeita.
 * Não afirma causalidade — só assinala uma coincidência temporal que vale a
 * pena mencionar ao médico/farmacêutico.
 */
export function findTemporalCorrelations(meds: TemporalMed[], symptoms: TemporalSymptom[]): TemporalHypothesis[] {
  const out: TemporalHypothesis[] = []
  const withDates = meds.filter(m => m.started_at)

  for (const med of withDates) {
    const startMs = new Date(med.started_at!).getTime()
    if (isNaN(startMs)) continue
    const windowEndMs = startMs + WINDOW_DAYS * 86400000

    // Sintomas mencionados ANTES do início (para excluir os que já existiam).
    const priorSymptoms = new Set<string>()
    symptoms.forEach(s => {
      const t = new Date(s.at).getTime()
      if (t < startMs) (s.symptoms || []).forEach(sym => priorSymptoms.add(sym.toLowerCase().trim()))
    })

    // Contagem de sintomas NOVOS dentro da janela pós-início.
    const counts = new Map<string, number>()
    symptoms.forEach(s => {
      const t = new Date(s.at).getTime()
      if (t < startMs || t > windowEndMs) return
      ;(s.symptoms || []).forEach(sym => {
        const key = sym.toLowerCase().trim()
        if (!key || priorSymptoms.has(key)) return
        counts.set(key, (counts.get(key) || 0) + 1)
      })
    })

    for (const [symptom, occurrences] of counts) {
      if (occurrences < MIN_OCCURRENCES) continue
      // Data do 1º registo deste sintoma, para calcular "quantos dias depois".
      const first = symptoms
        .filter(s => (s.symptoms || []).some(sy => sy.toLowerCase().trim() === symptom) && new Date(s.at).getTime() >= startMs)
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())[0]
      if (!first) continue
      const daysAfter = Math.round((new Date(first.at).getTime() - startMs) / 86400000)
      out.push({ medication: med.name, started_at: med.started_at!, symptom, days_after_start: daysAfter, occurrences })
    }
  }

  return out.sort((a, b) => b.occurrences - a.occurrences).slice(0, 3)
}
