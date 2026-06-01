// lib/preventiveCare.ts
// Recomendações de medicina preventiva baseadas em normas DGS e PNV (PT).
// Determinístico: não usa AI, fonte é a Direção-Geral da Saúde portuguesa.
// O utilizador reportou que a versão AI era "ridícula" — esta versão entrega
// só o que está em normas reais, com referência.

export type Sex = 'M' | 'F'
export type Priority = 'devido' | 'em_breve' | 'em_dia' | 'opcional'

export interface PreventiveItem {
  id: string                    // identificador estável (para registar feito)
  name: string
  category: 'rastreio' | 'vacina' | 'consulta'
  why: string                   // 1 linha curta — porquê fazer
  frequency: string             // "1x/ano", "5/5 anos", etc.
  source: string                // Norma DGS / PNV referência
  /** Faixa etária em que se aplica (inclusive). */
  ageRange?: { from: number; to?: number }
  sex?: Sex | 'both'
  /** Doenças em que esta recomendação se torna mais frequente / obrigatória */
  conditions?: string[]
  priority: Priority
}

const PNV = 'Programa Nacional de Vacinação (DGS) — atualizado 2020/2024'
const NORM = (n: string) => `Norma DGS ${n}`

// Catálogo base. As condições e frequências espelham as normas mais recentes
// conhecidas; a UI mostra sempre a referência para o utilizador poder
// verificar.
const BASE: Omit<PreventiveItem, 'priority'>[] = [
  // ── Vacinas adulto (PNV) ───────────────────────────────────────────────
  { id: 'tdap',         name: 'Tétano, difteria e tosse convulsa (Td/Tdpa)', category: 'vacina',
    why: 'Reforço obrigatório no PNV em adulto.', frequency: '10/10 anos',
    source: PNV, ageRange: { from: 18 }, sex: 'both' },

  { id: 'gripe',        name: 'Gripe sazonal',                                category: 'vacina',
    why: 'Recomendada anualmente a ≥ 60 anos e a grupos de risco.', frequency: 'Anual (outubro–novembro)',
    source: PNV, ageRange: { from: 60 }, sex: 'both' },

  { id: 'covid',        name: 'COVID-19 (reforço sazonal)',                   category: 'vacina',
    why: 'Reforço recomendado anualmente em ≥ 60 anos e doentes crónicos.', frequency: 'Anual (com gripe)',
    source: NORM('016/2023'), ageRange: { from: 60 }, sex: 'both' },

  { id: 'pneumo23',     name: 'Pneumocócica polissacárida 23-valente (PPV23)', category: 'vacina',
    why: 'Recomendada em ≥ 65 anos e doentes de risco.', frequency: '1 dose única (reforço se indicado)',
    source: PNV, ageRange: { from: 65 }, sex: 'both' },

  { id: 'herpes_zoster', name: 'Herpes zóster',                               category: 'vacina',
    why: 'Reduz zona e nevralgia pós-herpética.', frequency: '2 doses (0 e 2–6 meses)',
    source: NORM('001/2023'), ageRange: { from: 65 }, sex: 'both' },

  { id: 'hpv_catchup',  name: 'HPV (catch-up)',                                category: 'vacina',
    why: 'Catch-up em mulheres jovens não vacinadas.', frequency: '2–3 doses',
    source: PNV, ageRange: { from: 18, to: 26 }, sex: 'F' },

  // ── Rastreios ─────────────────────────────────────────────────────────
  { id: 'colo_utero',   name: 'Rastreio cancro do colo do útero (HPV-DNA / citologia)', category: 'rastreio',
    why: 'Pesquisa lesões pré-cancerosas. Em Portugal: HPV-DNA dos 25 aos 60.', frequency: '5/5 anos (HPV-DNA)',
    source: NORM('018/2012'), ageRange: { from: 25, to: 60 }, sex: 'F' },

  { id: 'mama',         name: 'Rastreio cancro da mama (mamografia)',          category: 'rastreio',
    why: 'Programa nacional para mulheres 50–69 anos.', frequency: '2/2 anos',
    source: NORM('051/2017'), ageRange: { from: 50, to: 69 }, sex: 'F' },

  { id: 'colorretal',   name: 'Rastreio cancro colorretal (PSOF)',             category: 'rastreio',
    why: 'Pesquisa sangue oculto nas fezes — programa nacional.', frequency: '2/2 anos',
    source: NORM('003/2014'), ageRange: { from: 50, to: 74 }, sex: 'both' },

  { id: 'tensao',       name: 'Medir tensão arterial',                          category: 'rastreio',
    why: 'Despiste de HTA — silenciosa, principal fator de risco CV.', frequency: 'Anual a partir de 40 anos',
    source: NORM('026/2011'), ageRange: { from: 18 }, sex: 'both' },

  { id: 'glicemia',     name: 'Medir glicemia em jejum / HbA1c',                category: 'rastreio',
    why: 'Despiste de pré-diabetes / DM2 em adultos ≥ 45 anos ou com risco.', frequency: '3/3 anos',
    source: NORM('002/2011'), ageRange: { from: 45 }, sex: 'both' },

  { id: 'colesterol',   name: 'Perfil lipídico (colesterol total, HDL, LDL)',   category: 'rastreio',
    why: 'Avaliação do risco cardiovascular.', frequency: '4/4 anos (mais frequente se risco)',
    source: NORM('019/2011'), ageRange: { from: 40 }, sex: 'both' },

  { id: 'densitometria', name: 'Densitometria óssea (DEXA)',                    category: 'rastreio',
    why: 'Despiste osteoporose em mulheres pós-menopausa.', frequency: 'A partir dos 65 (ou 60 com risco)',
    source: NORM('027/2013'), ageRange: { from: 65 }, sex: 'F' },

  { id: 'aaa',          name: 'Rastreio aneurisma da aorta abdominal',          category: 'rastreio',
    why: 'Ecografia única em homens fumadores/ex-fumadores 65–75.', frequency: '1 vez',
    source: 'USPSTF 2019', ageRange: { from: 65, to: 75 }, sex: 'M' },

  { id: 'visao',        name: 'Avaliação oftalmológica',                        category: 'consulta',
    why: 'Despiste glaucoma e cataratas; revisão refração.', frequency: '2/2 anos a partir de 40 anos',
    source: 'Boas práticas', ageRange: { from: 40 }, sex: 'both' },

  { id: 'dentista',     name: 'Consulta de medicina dentária',                  category: 'consulta',
    why: 'Higiene oral, despiste cárie e cancro oral.', frequency: 'Anual (cheque-dentista DGS)',
    source: NORM('002/2014'), ageRange: { from: 6 }, sex: 'both' },
]

// Itens extra que só aparecem se o utilizador indicar condição:
const CONDITION_DRIVEN: Omit<PreventiveItem, 'priority'>[] = [
  { id: 'fundo_olho_dm', name: 'Fundo de olho (retinopatia diabética)', category: 'rastreio',
    why: 'Anual em diabetes diagnosticada.', frequency: 'Anual',
    source: NORM('001/2018'), conditions: ['diabetes'], sex: 'both' },
  { id: 'pe_diabetico',  name: 'Avaliação do pé diabético',             category: 'rastreio',
    why: 'Anual em diabetes — previne ulcerações.', frequency: 'Anual',
    source: NORM('008/2011'), conditions: ['diabetes'], sex: 'both' },
  { id: 'mcv_pdpoc',     name: 'Espirometria',                          category: 'rastreio',
    why: 'Monitorização em DPOC / asma.', frequency: 'Anual',
    source: NORM('028/2011'), conditions: ['dpoc', 'asma'], sex: 'both' },
]

export interface PreventiveRecommendation {
  due: PreventiveItem[]
  soon: PreventiveItem[]
  upToDate: PreventiveItem[]
  notApplicable: PreventiveItem[]
}

interface Input {
  age: number
  sex: Sex
  conditions?: string[]
  /** Map id → última data feita (ISO yyyy-mm-dd) */
  done?: Record<string, string>
}

/**
 * Calcula recomendações para um utilizador. Itens devolvidos:
 * - due       — recomendações em atraso (nunca feitas OU intervalo expirou)
 * - soon      — feitas dentro do intervalo mas a < 90 dias do próximo ciclo
 * - upToDate  — feitas e dentro do prazo
 * - notApplicable — fora do range etário/sexo (escondidas por default)
 */
export function recommendPreventive(input: Input): PreventiveRecommendation {
  const conditions = (input.conditions || []).map(c => c.toLowerCase())
  const allItems = [...BASE, ...CONDITION_DRIVEN]

  const due: PreventiveItem[] = []
  const soon: PreventiveItem[] = []
  const upToDate: PreventiveItem[] = []
  const notApplicable: PreventiveItem[] = []

  for (const it of allItems) {
    // Filtra por sexo
    if (it.sex && it.sex !== 'both' && it.sex !== input.sex) { notApplicable.push({ ...it, priority: 'opcional' }); continue }
    // Filtra por idade
    if (it.ageRange) {
      if (input.age < it.ageRange.from) { notApplicable.push({ ...it, priority: 'opcional' }); continue }
      if (it.ageRange.to && input.age > it.ageRange.to) { notApplicable.push({ ...it, priority: 'opcional' }); continue }
    }
    // Filtra condições (CONDITION_DRIVEN só aparece se utilizador tem)
    if (it.conditions && it.conditions.length > 0) {
      const matches = it.conditions.some(c => conditions.some(uc => uc.includes(c)))
      if (!matches) { notApplicable.push({ ...it, priority: 'opcional' }); continue }
    }

    // Verifica se já foi feito
    const lastDoneIso = input.done?.[it.id]
    if (!lastDoneIso) {
      due.push({ ...it, priority: 'devido' })
      continue
    }
    // Calcula próximo
    const intervalDays = parseFrequencyToDays(it.frequency)
    if (intervalDays == null) {
      // "1 vez" / "1 dose única" — feito = up to date para sempre
      upToDate.push({ ...it, priority: 'em_dia' })
      continue
    }
    const last = new Date(lastDoneIso)
    const now = Date.now()
    const dueDate = last.getTime() + intervalDays * 86400 * 1000
    const daysToNext = (dueDate - now) / (86400 * 1000)
    if (daysToNext < 0) due.push({ ...it, priority: 'devido' })
    else if (daysToNext < 90) soon.push({ ...it, priority: 'em_breve' })
    else upToDate.push({ ...it, priority: 'em_dia' })
  }

  // Ordena por urgência (ageRange.from desc) para mostrar primeiro os mais críticos
  return { due, soon, upToDate, notApplicable }
}

function parseFrequencyToDays(freq: string): number | null {
  const f = freq.toLowerCase()
  if (/uma\s*vez|1\s*vez|única|unica/.test(f)) return null
  if (/anual/.test(f)) return 365
  // "10/10 anos" ou "10 / 10 anos"
  const m = f.match(/(\d+)\s*\/\s*\1\s*anos/) || f.match(/(\d+)\s*anos/)
  if (m) return parseInt(m[1], 10) * 365
  if (/2\s*\/\s*2\s*anos/.test(f)) return 730
  return null
}
