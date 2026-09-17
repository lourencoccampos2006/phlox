// lib/diaDaFamilia.ts
// ─────────────────────────────────────────────────────────────────────────────
// Como se conta o dia a uma família.
//
// Isto vivia dentro de app/api/family-portal/route.ts. Saiu para aqui quando o
// mesmo resumo passou a ser preciso em dois sítios: o portal (quando a família
// abre) e o email do fim do dia (quando não abre). Duas cópias do mesmo texto
// acabariam a divergir — e a família notaria, porque é o mesmo dia contado de
// duas maneiras.
//
// Regra que não muda: DETERMINÍSTICO. Sai do que a equipa registou, sem IA e
// sem interpretação clínica. Se não houve registos, não há resumo — inventar
// um dia bom é pior do que não dizer nada.
// ─────────────────────────────────────────────────────────────────────────────

// ── "O dia da mãe" — resumo diário caloroso para a família ───────────────────
// Construído DE FORMA DETERMINÍSTICA a partir dos registos que a equipa já faz
// (care_records por turno + mar_records). NÃO inventa nada, NÃO usa IA, NÃO
// diagnostica: só conta, em linguagem simples, o que ficou registado. Isto é o
// que torna o cuidado visível à família — e o argumento de venda do lar.
export interface DaySummary { date: string; lines: string[]; mood?: number; attention: boolean; photoUrl?: string | null }
export interface AttRow { date: string; status: string; arrived_at?: string | null; left_at?: string | null }

const MEAL_WORD = (pct: number) => pct >= 75 ? 'comeu bem' : pct >= 40 ? 'comeu razoavelmente' : pct > 0 ? 'comeu pouco' : 'quase não comeu'
const MOOD_WORD = ['', 'esteve em baixo', 'esteve menos bem-disposta', 'esteve calma', 'esteve bem-disposta', 'esteve muito animada']

export function summariseDay(date: string, recs: any[], marToday: any[], firstName: string, isToday: boolean, att?: AttRow | null): DaySummary {
  const lines: string[] = []
  let attention = false

  // ── Presença ─────────────────────────────────────────────────────────────
  // É a marcação mais feita da casa e a que a família mais quer: chegou?
  // Estava a ser guardada e nunca devolvida a ninguém. Vem primeiro porque é
  // a primeira coisa que se pergunta ao fim do dia.
  if (att) {
    const hora = (t?: string | null) => {
      if (!t) return null
      const d = new Date(t); if (isNaN(d.getTime())) return null
      return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
    }
    const chegada = hora(att.arrived_at)
    const saida = hora(att.left_at)
    if (att.status === 'present') {
      lines.push(chegada ? `${firstName} chegou às ${chegada}.` : `${firstName} esteve presente.`)
    } else if (att.status === 'left') {
      lines.push(saida
        ? `${firstName} ${chegada ? `chegou às ${chegada} e ` : ''}saiu mais cedo, às ${saida}.`
        : `${firstName} saiu mais cedo.`)
    } else if (att.status === 'absent') {
      // Não é motivo de alarme — pode ser combinado. Diz-se e fica-se por aí.
      lines.push(`${firstName} não veio hoje.`)
    }
  }
  // Refeições (média do dia a partir dos turnos)
  const meals: number[] = []
  let moodLevel = 0, moodCount = 0
  const activities = new Set<string>()
  let fluid = 0
  for (const r of recs) {
    const n = r.nutrition || {}
    ;['breakfast', 'lunch', 'dinner'].forEach(m => { if (typeof n[m] === 'number') meals.push(n[m]) })
    if (typeof n.fluid_ml === 'number') fluid += n.fluid_ml
    const mo = r.mood || {}
    if (mo.level) { moodLevel += mo.level; moodCount++ }
    if (Array.isArray(mo.activities)) mo.activities.forEach((a: string) => a && activities.add(a))
    else if (typeof mo.activities === 'string' && mo.activities.trim()) activities.add(mo.activities.trim())
  }
  if (meals.length) {
    const avg = Math.round(meals.reduce((a, b) => a + b, 0) / meals.length)
    lines.push(`Às refeições, ${firstName} ${MEAL_WORD(avg)}.`)
    if (avg < 40) attention = true
  }
  if (fluid > 0) lines.push(`Bebeu cerca de ${fluid} ml de líquidos ao longo do dia.`)
  if (moodCount) {
    const m = Math.round(moodLevel / moodCount)
    lines.push(`${MOOD_WORD[m] ? MOOD_WORD[m].charAt(0).toUpperCase() + MOOD_WORD[m].slice(1) : 'Esteve estável'}.`)
    if (m <= 2) attention = true
  }
  if (activities.size) lines.push(`Participou em: ${Array.from(activities).slice(0, 4).join(', ')}.`)
  // Medicação do dia. /mar grava 'administered' (também aceitamos given/taken).
  // Antes só contava taken/given → família via "Tomou 0 de 2" tendo tomado.
  const GIVEN = new Set(['administered', 'given', 'taken'])
  const marTaken = marToday.filter(m => GIVEN.has(m.status)).length
  const marTotal = marToday.length
  if (marTotal > 0) {
    if (marTaken === marTotal) lines.push('Tomou toda a medicação prevista.')
    else if (isToday) {
      // O dia ainda decorre — mostramos progresso, sem alarme (a medicação da
      // tarde/noite pode simplesmente ainda não ter sido dada).
      lines.push(`Já tomou ${marTaken} de ${marTotal} medicamentos até agora.`)
    } else {
      lines.push(`Tomou ${marTaken} de ${marTotal} medicamentos previstos.`)
      attention = true
    }
  }
  // Notas da equipa (uma, curta, se houver)
  const note = recs.map(r => r.notes).find((x: string) => x && x.trim())
  if (note) lines.push(`Nota da equipa: ${String(note).slice(0, 160)}`)
  return { date, lines, mood: moodCount ? Math.round(moodLevel / moodCount) : undefined, attention }
}
