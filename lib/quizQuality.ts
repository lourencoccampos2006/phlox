// lib/quizQuality.ts
// Regras anti-erro partilhadas para todos os geradores de perguntas/quizzes do
// Phlox (Arena, Casos, Exam, Flashcards). O utilizador reportou que muitos
// quizzes estavam errados — a AI generativa tende a:
//   • inventar referências
//   • dar como "única correta" uma opção quando há duas tecnicamente certas
//   • baralhar PT-PT com PT-BR (ex: "checagem", "trombolizar", "comprimido")
//   • usar nomes comerciais portugueses errados
//   • atribuir indicações fora-de-rótulo como se fossem de primeira linha
//
// Este módulo centraliza as regras para que cada endpoint não tenha de as
// repetir. Quando uma regra se atualiza, vai a TODOS os quizzes ao mesmo tempo.

export const QUIZ_RULES_PT = `REGRAS OBRIGATÓRIAS PARA TODAS AS PERGUNTAS (lê com atenção — o utilizador reportou que muitas perguntas estavam erradas):

1. LÍNGUA: Português europeu (PT-PT). NUNCA usar PT-BR. Termos corretos: "comprimido" (não "comprimido revestido por película" salvo quando relevante), "frasco" não "frasco-ampola"; "trombólise" não "trombolização"; "monitorização" não "monitoramento"; "doente" ou "utente" (não "paciente" em contextos de cuidados, embora "paciente" seja aceitável); "actualmente" (versão tradicional) ou "atualmente" — escolhe uma e mantém.

2. UMA SÓ CORRETA: A pergunta DEVE ter exatamente UMA opção tecnicamente correta no contexto dado. Se duas opções forem aceitáveis na prática clínica, REESCREVE a pergunta para forçar uma única melhor escolha (ex: adiciona contexto, comorbilidade, contraindicação).

3. PLAUSIBILIDADE DAS ERRADAS: As 3 opções erradas devem ser PLAUSÍVEIS — não absurdas. O distractor de qualidade é o que um estudante poderia escolher por confundir mecanismos ou por aplicar uma guideline antiga. Não criar opções tipo "Beber chá quente" ou "Nenhuma das anteriores".

4. FUNDAMENTAÇÃO: A "explanation" tem de incluir (a) por que a correta é a correta com mecanismo, (b) por que cada errada é errada — não só "está errada".

5. REFERÊNCIA REAL: O campo "reference" só pode citar fontes que existem e que conheces bem (ex: "ESC 2023 Heart Failure Guidelines", "Norma DGS 010/2013 sépsis", "Surviving Sepsis Campaign 2021", "GINA 2024", "UpToDate (acedido)", "BMJ Best Practice"). NÃO inventes números de normas DGS — se não tens a certeza, escreve "DGS — Norma sobre [tema]".

6. NOMES DE FÁRMACOS: Usa DCI (denominação comum internacional) em português (ex: "ácido acetilsalicílico", "varfarina", "furosemida", "amoxicilina + ácido clavulânico"). Para nomes comerciais portugueses, só os que conheces com certeza absoluta (ex: Aspirina®, Lasix®, Zithromax®). Em caso de dúvida, usa só DCI.

7. DOSES: Quando dás doses, têm de estar dentro dos intervalos terapêuticos correntes em adultos saudáveis (ou explicitamente em pediatria/idoso/insuficiência renal). Nunca uses doses "memoráveis mas erradas".

8. EVITA TEMAS POLÉMICOS COM RESPOSTA INCERTA: Se a literatura está dividida (ex: "qual o melhor inibidor SGLT2 em IC?"), reformula para uma pergunta com resposta consensual.

9. DIFERENÇA CLARA: O distractor não pode ser uma reformulação da correta. Se duas opções são sinónimos, são a mesma opção — escolhe outra.

10. PORTUGAL: O contexto é cuidados de saúde em Portugal. Doses, normas, e protocolos seguem prática portuguesa quando aplicável (ex: rastreios DGS, Norma sobre sépsis, abordagem de via aérea SPCI).`

/**
 * Verifica rapidamente se uma resposta do gerador tem padrões obviamente
 * suspeitos. Não impede de servir — só sinaliza para a UI mostrar um aviso
 * "verifica esta pergunta" e para a equipa rever no /api/quiz-feedback.
 */
export interface QualityFlags {
  ok: boolean
  flags: string[]
}

export function inspectQuestion(q: {
  question?: string
  options?: { label: string; is_correct?: boolean }[] | string[]
  correct?: number
  explanation?: string
  reference?: string
}): QualityFlags {
  const flags: string[] = []

  if (!q.question || q.question.length < 20) flags.push('Pergunta demasiado curta')

  // Opções podem vir como string[] (exam) ou {label,is_correct}[] (arena/cases)
  const opts = Array.isArray(q.options) ? q.options : []
  if (opts.length !== 4) flags.push(`Devia ter 4 opções, tem ${opts.length}`)

  let corrects = 0
  if (typeof q.correct === 'number') {
    corrects = 1
    if (q.correct < 0 || q.correct >= opts.length) flags.push('Índice "correct" fora do intervalo')
  } else {
    corrects = (opts as { is_correct?: boolean }[]).filter(o => o?.is_correct).length
  }
  if (corrects !== 1) flags.push(`Tem ${corrects} respostas corretas, deve ter exatamente 1`)

  // PT-BR óbvio
  const text = JSON.stringify(q).toLowerCase()
  const ptBr = ['checagem', 'trombolização', 'monitoramento', 'comprimido revestido', 'cirurgião dentista']
  ptBr.forEach(t => { if (text.includes(t)) flags.push(`Possível PT-BR: "${t}"`) })

  // Duplicates between options
  const labels = (opts as any[]).map(o => (typeof o === 'string' ? o : o?.label) || '').map(s => s.trim().toLowerCase())
  const uniq = new Set(labels)
  if (uniq.size < labels.length) flags.push('Há opções duplicadas')

  // Explicação minimamente útil
  if (q.explanation && q.explanation.length < 40) flags.push('Explicação demasiado curta')

  // Inventou número de norma DGS suspeito (ex: 999/2099)
  if (q.reference && /Norma DGS \d{3,}\/\d{4}/.test(q.reference)) {
    const m = q.reference.match(/(\d{4})/)
    const year = m ? parseInt(m[1], 10) : 0
    if (year > new Date().getUTCFullYear()) flags.push('Norma DGS com ano no futuro')
  }

  return { ok: flags.length === 0, flags }
}
