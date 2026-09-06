// app/refeicoes/imprimirEmenta.ts
// ─────────────────────────────────────────────────────────────────────────────
// A ementa impressa. Não é um dump da grelha do ecrã: é o papel que fica
// afixado na parede da sala, que as famílias leem à porta e que a cozinha usa
// como lista de trabalho. Por isso é escrita como uma ementa e não como uma
// tabela de base de dados — serif para os pratos, mono só para as datas,
// muito espaço em branco, e o momento (sopa / prato / sobremesa) hierarquizado
// para se perceber a refeição de relance a três metros de distância.
//
// Três formatos, todos A4:
//   • dia    — uma folha grande, para afixar à porta da sala
//   • semana — uma folha por semana, sete colunas
//   • mês    — o calendário do mês, com o prato principal de cada dia
// ─────────────────────────────────────────────────────────────────────────────

export interface LinhaEmenta {
  date: string          // YYYY-MM-DD
  meal_type: string
  course: string
  nome: string
}

const REFEICOES: { id: string; label: string }[] = [
  { id: 'pequeno_almoco', label: 'Pequeno-almoço' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
]
const ORDEM_MOMENTOS = ['sopa', 'prato', 'sobremesa']
const MOMENTO_LABEL: Record<string, string> = { sopa: 'Sopa', prato: 'Prato', sobremesa: 'Sobremesa' }
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const dia = (iso: string) => new Date(iso + 'T12:00:00')

const CSS = `
  @page { size: A4; margin: 14mm 13mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #14150f; background: #fff;
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
  header { border-bottom: 1.5px solid #14150f; padding-bottom: 9px; margin-bottom: 22px;
           display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
  .casa { font-size: 9.5px; letter-spacing: .22em; text-transform: uppercase; color: #6b6d63;
          font-family: ui-monospace, Menlo, Consolas, monospace; }
  h1 { font-size: 30px; font-weight: 400; margin: 5px 0 0; letter-spacing: -.015em; }
  .periodo { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #6b6d63;
             font-family: ui-monospace, Menlo, Consolas, monospace; text-align: right; white-space: nowrap; }
  footer { margin-top: 26px; border-top: 1px solid #d9dad2; padding-top: 8px;
           font-size: 9px; color: #8b8d83; display: flex; justify-content: space-between;
           font-family: ui-monospace, Menlo, Consolas, monospace; }

  /* ── um dia ─────────────────────────────────────────────── */
  .refeicao { margin-bottom: 26px; break-inside: avoid; }
  .refeicao > .titulo { font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
    color: #6b6d63; font-family: ui-monospace, Menlo, Consolas, monospace;
    border-bottom: 1px solid #e6e7e0; padding-bottom: 5px; margin-bottom: 11px; }
  .curso { display: flex; align-items: baseline; gap: 14px; margin-bottom: 7px; }
  .curso .m { flex: 0 0 74px; font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
              color: #9a9c92; font-family: ui-monospace, Menlo, Consolas, monospace; padding-top: 3px; }
  .curso .p { font-size: 20px; line-height: 1.3; }
  .vazio { color: #b9bab1; font-style: italic; font-size: 15px; }

  /* ── semana ─────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { vertical-align: top; padding: 9px 8px; border-bottom: 1px solid #e6e7e0; }
  thead th { border-bottom: 1.5px solid #14150f; text-align: left; }
  th .d { font-size: 13px; font-weight: 600; }
  th .n { font-size: 9px; color: #8b8d83; font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 400; }
  td.rot { width: 92px; border-right: 1px solid #e6e7e0; }
  td.rot .r { font-size: 11.5px; font-weight: 600; }
  td.rot .m { font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: #9a9c92;
              font-family: ui-monospace, Menlo, Consolas, monospace; margin-top: 2px; }
  td .prato { font-size: 12px; line-height: 1.35; }
  tr.fim td { border-bottom: 1.5px solid #cfd0c8; }

  /* ── mês ────────────────────────────────────────────────── */
  .mes { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .mes th { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #6b6d63;
            font-family: ui-monospace, Menlo, Consolas, monospace; border-bottom: 1.5px solid #14150f;
            padding-bottom: 6px; text-align: left; }
  .mes td { height: 86px; border: 1px solid #e6e7e0; padding: 6px 7px; }
  .mes .num { font-size: 10px; color: #9a9c92; font-family: ui-monospace, Menlo, Consolas, monospace; }
  .mes .pr { font-size: 10.5px; line-height: 1.3; margin-top: 4px; }
  .mes .so { font-size: 9px; color: #6b6d63; margin-top: 3px; }
  .mes td.fora { background: #fafaf7; }
`

function moldura(casa: string, titulo: string, periodo: string, corpo: string) {
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">
<title>${esc(titulo)} — ${esc(periodo)}</title><style>${CSS}</style></head><body>
<header>
  <div><div class="casa">${esc(casa)}</div><h1>${esc(titulo)}</h1></div>
  <div class="periodo">${esc(periodo)}</div>
</header>
${corpo}
<footer><span>Ementa sujeita a alteração conforme disponibilidade.</span><span>Impresso a ${esc(hoje)}</span></footer>
</body></html>`
}

function abrir(html: string) {
  // Blob em vez de document.write: o documento nasce já completo, sem escrever
  // HTML numa janela viva. Todo o texto que vem de dados passa por esc() acima,
  // mas isto tira o padrão de risco do caminho todo.
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const w = window.open(url, '_blank')
  if (!w) { URL.revokeObjectURL(url); return false }
  // O print é do utilizador, não nosso: a janela abre com a ementa pronta e é
  // ele que decide imprimir.
  w.focus()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

/** Índice `dia|refeição|momento` → nome do prato. */
function indexar(linhas: LinhaEmenta[]) {
  const m = new Map<string, string>()
  linhas.forEach(l => m.set(`${l.date}|${l.meal_type}|${l.course || 'prato'}`, l.nome))
  return m
}

export function imprimirDia(casa: string, data: string, linhas: LinhaEmenta[]) {
  const ix = indexar(linhas)
  const d = dia(data)
  const corpo = REFEICOES.map(r => {
    const momentos = ORDEM_MOMENTOS
      .map(c => ({ c, nome: ix.get(`${data}|${r.id}|${c}`) }))
      .filter(x => x.nome)
    if (!momentos.length) return ''
    return `<div class="refeicao"><div class="titulo">${esc(r.label)}</div>${
      momentos.map(x => `<div class="curso"><div class="m">${esc(MOMENTO_LABEL[x.c] || '')}</div><div class="p">${esc(x.nome)}</div></div>`).join('')
    }</div>`
  }).join('')
  return abrir(moldura(casa, 'Ementa do dia',
    `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`,
    corpo || '<p class="vazio">Ainda não há pratos marcados para este dia.</p>'))
}

export function imprimirSemana(casa: string, datas: string[], linhas: LinhaEmenta[]) {
  const ix = indexar(linhas)
  const cab = datas.map(dt => {
    const d = dia(dt)
    return `<th><div class="d">${DIAS_CURTO[d.getDay()]}</div><div class="n">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</div></th>`
  }).join('')

  const linhasTabela = REFEICOES.flatMap(r => {
    const momentos = ORDEM_MOMENTOS.filter(c => datas.some(dt => ix.get(`${dt}|${r.id}|${c}`)))
    if (!momentos.length) return []
    return momentos.map((c, i) => `<tr${i === momentos.length - 1 ? ' class="fim"' : ''}>
      <td class="rot">${i === 0 ? `<div class="r">${esc(r.label)}</div>` : ''}${momentos.length > 1 ? `<div class="m">${esc(MOMENTO_LABEL[c])}</div>` : ''}</td>
      ${datas.map(dt => `<td><div class="prato">${esc(ix.get(`${dt}|${r.id}|${c}`) || '—')}</div></td>`).join('')}
    </tr>`)
  }).join('')

  const p0 = dia(datas[0]), p1 = dia(datas[datas.length - 1])
  const periodo = p0.getMonth() === p1.getMonth()
    ? `${p0.getDate()} – ${p1.getDate()} de ${MESES[p1.getMonth()]}`
    : `${p0.getDate()} de ${MESES[p0.getMonth()]} – ${p1.getDate()} de ${MESES[p1.getMonth()]}`

  return abrir(moldura(casa, 'Ementa da semana', periodo,
    linhasTabela
      ? `<table><thead><tr><th></th>${cab}</tr></thead><tbody>${linhasTabela}</tbody></table>`
      : '<p class="vazio">Ainda não há pratos marcados para esta semana.</p>'))
}

export function imprimirMes(casa: string, ano: number, mes: number, linhas: LinhaEmenta[]) {
  const ix = indexar(linhas)
  const primeiro = new Date(ano, mes, 1)
  const inicio = new Date(primeiro); inicio.setDate(1 - primeiro.getDay())   // começa ao domingo
  const semanas: Date[][] = []
  const cursor = new Date(inicio)
  while (cursor <= new Date(ano, mes + 1, 0) || cursor.getDay() !== 0) {
    const semana: Date[] = []
    for (let i = 0; i < 7; i++) { semana.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1) }
    semanas.push(semana)
    if (semanas.length > 6) break
  }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const corpo = `<table class="mes"><thead><tr>${DIAS_CURTO.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${
    semanas.map(sem => `<tr>${sem.map(d => {
      const fora = d.getMonth() !== mes
      const k = iso(d)
      const prato = ix.get(`${k}|almoco|prato`) || ix.get(`${k}|jantar|prato`) || ''
      const sopa = ix.get(`${k}|almoco|sopa`) || ''
      return `<td class="${fora ? 'fora' : ''}"><div class="num">${d.getDate()}</div>${
        fora ? '' : `${sopa ? `<div class="so">${esc(sopa)}</div>` : ''}${prato ? `<div class="pr">${esc(prato)}</div>` : ''}`
      }</td>`
    }).join('')}</tr>`).join('')
  }</tbody></table>`

  return abrir(moldura(casa, 'Ementa do mês', `${MESES[mes]} de ${ano}`, corpo))
}
