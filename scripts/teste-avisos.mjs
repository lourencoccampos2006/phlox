// scripts/teste-avisos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O motor de avisos, com uma base de dados de mentira.
//
// A versão anterior deste cálculo (dentro do /api/push/cron) procurava os
// utentes por `user_id` dos coordenadores em vez de `org_id` da casa, contava
// todos os medicamentos ativos em vez de só os do turno, e filtrava os
// profiles por `plan = 'clinic'` — que só o dono tem. Nada disto dava erro:
// dava simplesmente zero avisos, sempre. Estes testes existem para que volte a
// dar zero só quando é mesmo zero.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-avisos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { avisosDaInstituicao, avisosPessoais, turnoAgora } from '../lib/avisos.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, obtido) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}\n        obtido: ${JSON.stringify(obtido)}`) }
}

/** Um supabase de mentira: devolve o que lhe pusermos por tabela, e ignora
 *  todos os filtros — o que interessa testar é a LÓGICA que vem depois. */
function baseFalsa(tabelas) {
  const encadeia = (dados) => {
    const alvo = { data: dados, error: null }
    const p = new Proxy(alvo, {
      get(t, k) {
        if (k === 'then') return (res, rej) => Promise.resolve(alvo).then(res, rej)
        if (k in t) return t[k]
        return () => p
      },
    })
    return p
  }
  return { from: (t) => encadeia(tabelas[t] || []) }
}

const HOJE = '2026-09-12'

// ── Turnos ───────────────────────────────────────────────────────────────────
console.log('\nTurnos')
verificar('08:00 e manha', turnoAgora('08:00') === 'manha', turnoAgora('08:00'))
verificar('15:00 e tarde', turnoAgora('15:00') === 'tarde', turnoAgora('15:00'))
verificar('23:00 e noite', turnoAgora('23:00') === 'noite', turnoAgora('23:00'))
verificar('03:00 e noite', turnoAgora('03:00') === 'noite', turnoAgora('03:00'))

// ── Doses por registar ───────────────────────────────────────────────────────
console.log('\nDoses por registar, perto do fim do turno')
const utentes = [{ id: 'p1', name: 'Ana Silva' }, { id: 'p2', name: 'Joao Costa' }]
const meds = [
  { id: 'm1', patient_id: 'p1', name: 'Paracetamol', shifts: ['manha'] },
  { id: 'm2', patient_id: 'p1', name: 'Metformina', shifts: ['tarde'] },
  { id: 'm3', patient_id: 'p2', name: 'Omeprazol', shifts: ['manha'] },
]
{
  const sb = baseFalsa({ patients: utentes, patient_meds: meds, mar_records: [] })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '13:45', hoje: HOJE })
  const doses = a.find(x => x.tipo === 'doses')
  verificar('conta so as do turno da manha (2, nao 3)', /^2 doses/.test(doses?.titulo || ''), doses?.titulo)
  verificar('e para empurrar', doses?.empurrar === true, doses)
}
{
  // A meio da manha ainda ninguem esta atrasado — nao se impoe ritmo.
  const sb = baseFalsa({ patients: utentes, patient_meds: meds, mar_records: [] })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '09:00', hoje: HOJE })
  verificar('a meio da manha nao ha aviso de doses', !a.some(x => x.tipo === 'doses'), a.map(x => x.tipo))
}
{
  const sb = baseFalsa({
    patients: utentes, patient_meds: meds,
    mar_records: [
      { id: 'r1', patient_id: 'p1', med_id: 'm1', shift: 'manha', status: 'administered', date: HOJE },
      { id: 'r2', patient_id: 'p2', med_id: 'm3', shift: 'manha', status: 'administered', date: HOJE },
    ],
  })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '13:45', hoje: HOJE })
  verificar('turno todo registado -> sem aviso', !a.some(x => x.tipo === 'doses'), a.map(x => x.tipo))
}

// ── Recusas ──────────────────────────────────────────────────────────────────
console.log('\nRecusas e suspensoes')
{
  const sb = baseFalsa({
    patients: utentes,
    mar_records: [{ id: 'r9', patient_id: 'p1', med_id: 'm1', shift: 'manha', status: 'refused', date: HOJE }],
  })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '10:00', hoje: HOJE })
  const rec = a.find(x => x.tipo === 'medicacao')
  verificar('recusa vira aviso com o nome da pessoa', /Ana Silva/.test(rec?.titulo || ''), rec?.titulo)
  verificar('e urgencia alta', rec?.urgencia === 'alta', rec)
}

// ── Famílias ─────────────────────────────────────────────────────────────────
console.log('\nFamilias a espera')
{
  const agora = new Date().toISOString()
  const antes = new Date(Date.now() - 3600000).toISOString()
  const sb = baseFalsa({
    patients: utentes,
    family_thread_messages: [
      { id: 'f1', patient_id: 'p1', body: 'Como esta a minha mae?', created_at: antes, author_side: 'family' },
      { id: 'f2', patient_id: 'p1', body: 'Esta bem, obrigada.', created_at: agora, author_side: 'staff' },
      { id: 'f3', patient_id: 'p2', body: 'Posso visitar amanha?', created_at: antes, author_side: 'family' },
    ],
  })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '10:00', hoje: HOJE })
  const fams = a.filter(x => x.tipo === 'familia')
  verificar('so a que ficou sem resposta', fams.length === 1, fams.map(f => f.titulo))
  verificar('e a do Joao', /Joao/.test(fams[0]?.titulo || ''), fams[0]?.titulo)
}

// ── Stock ────────────────────────────────────────────────────────────────────
console.log('\nStock')
{
  const stock = [
    { id: 's1', name: 'Luvas', quantity: 2, min_quantity: 10, unit: 'cx' },
    { id: 's2', name: 'Compressas', quantity: 50, min_quantity: 10, unit: 'un' },
    { id: 's3', name: 'Alcool', quantity: 0, min_quantity: 0, unit: 'l' },   // sem minimo definido
  ]
  const sb = baseFalsa({ patients: utentes, stock_items: stock })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '09:30', hoje: HOJE })
  const st = a.find(x => x.tipo === 'stock')
  verificar('so o que esta mesmo abaixo do minimo', /^1 artigo/.test(st?.titulo || ''), st?.titulo)
  verificar('as 9h30 empurra', st?.empurrar === true, st)

  const b = await avisosDaInstituicao(baseFalsa({ patients: utentes, stock_items: stock }), 'org1', { agora: '16:00', hoje: HOJE })
  verificar('as 16h ainda aparece no sino mas nao empurra',
    b.find(x => x.tipo === 'stock')?.empurrar === false, b.find(x => x.tipo === 'stock'))
}

// ── Presenças ────────────────────────────────────────────────────────────────
console.log('\nPresencas (so centro de dia, so quando a casa ja marcou)')
{
  const semNenhuma = baseFalsa({ patients: utentes, attendance: [] })
  const a = await avisosDaInstituicao(semNenhuma, 'org1', { agora: '11:00', hoje: HOJE, tipoInstituicao: 'day_care' })
  verificar('casa que nao usa presencas nunca e incomodada', !a.some(x => x.tipo === 'presenca'), a.map(x => x.tipo))

  const meio = baseFalsa({ patients: utentes, attendance: [{ patient_id: 'p1', status: 'present' }] })
  const c = await avisosDaInstituicao(meio, 'org1', { agora: '11:00', hoje: HOJE, tipoInstituicao: 'day_care' })
  verificar('a meio, avisa dos que faltam', /1 sem marca/.test(c.find(x => x.tipo === 'presenca')?.titulo || ''),
    c.find(x => x.tipo === 'presenca')?.titulo)

  const lar = baseFalsa({ patients: utentes, attendance: [{ patient_id: 'p1', status: 'present' }] })
  const d = await avisosDaInstituicao(lar, 'org1', { agora: '11:00', hoje: HOJE, tipoInstituicao: 'nursing_home' })
  verificar('num lar nao faz sentido nenhum', !d.some(x => x.tipo === 'presenca'), d.map(x => x.tipo))
}

// ── Mural ────────────────────────────────────────────────────────────────────
console.log('\nMural')
{
  const agora = new Date().toISOString()
  const sb = baseFalsa({
    patients: utentes,
    team_messages: [
      { id: 't1', channel: 'Geral', body: 'Reuniao amanha', author_name: 'Rita', author_id: 'u9', priority: 'importante', created_at: agora },
      { id: 't2', channel: 'Geral', body: 'Falta de agua', author_name: 'Rita', author_id: 'u9', priority: 'urgente', created_at: agora },
    ],
  })
  const a = await avisosDaInstituicao(sb, 'org1', { agora: '10:00', hoje: HOJE })
  const mur = a.filter(x => x.tipo === 'mural')
  verificar('os dois aparecem no sino', mur.length === 2, mur.length)
  verificar('so o urgente interrompe', mur.filter(x => x.empurrar).length === 1, mur.map(x => [x.titulo, x.empurrar]))

  const b = await avisosDaInstituicao(sb, 'org1', { agora: '10:00', hoje: HOJE, excluirAutor: 'u9' })
  verificar('nao me avisa do que fui eu que escrevi', !b.some(x => x.tipo === 'mural'), b.map(x => x.tipo))
}

// ── Robustez ─────────────────────────────────────────────────────────────────
console.log('\nRobustez')
{
  const partida = { from: () => { throw new Error('tabela nao existe') } }
  const a = await avisosDaInstituicao(partida, 'org1', { agora: '10:00', hoje: HOJE })
  verificar('base de dados a arder -> lista vazia, sem rebentar', Array.isArray(a) && a.length === 0, a)
}

// ── Modo pessoal ─────────────────────────────────────────────────────────────
console.log('\nModo pessoal')
{
  const sb = baseFalsa({
    personal_meds: [
      { id: 'x1', name: 'Losartan', dose: '50mg', reminder_times: ['08:00', '20:00'], units_left: 60, units_per_dose: 1, shifts: ['manha', 'noite'] },
      { id: 'x2', name: 'Vitamina D', dose: null, reminder_times: [], units_left: 3, units_per_dose: 1, shifts: ['manha'] },
    ],
    med_logs: [],
  })
  const a = await avisosPessoais(sb, 'u1', { agora: '12:00', hoje: HOJE })
  const toma = a.find(x => x.tipo === 'toma')
  verificar('a toma das 8h passou e nao ficou marcada', /Losartan/.test(toma?.titulo || ''), toma?.titulo)
  verificar('so a hora que ja passou (8h, nao 20h)', /08:00/.test(toma?.corpo || ''), toma?.corpo)
  const caixa = a.find(x => x.tipo === 'caixa')
  verificar('a vitamina esta a acabar', /Vitamina D/.test(caixa?.titulo || ''), caixa?.titulo)
  verificar('o sino nao empurra sozinho (isso e do cron)', a.every(x => !x.empurrar), a.map(x => x.empurrar))

  const marcado = baseFalsa({
    personal_meds: [{ id: 'x1', name: 'Losartan', reminder_times: ['08:00'], units_left: 60, units_per_dose: 1, shifts: ['manha'] }],
    med_logs: [{ med_id: 'x1', status: 'taken' }],
  })
  const b = await avisosPessoais(marcado, 'u1', { agora: '12:00', hoje: HOJE })
  verificar('ja marcado -> sem aviso', !b.some(x => x.tipo === 'toma'), b.map(x => x.tipo))
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
