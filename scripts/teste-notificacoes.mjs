// scripts/teste-notificacoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O catálogo de notificações e as escolhas de cada pessoa.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-notificacoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { TIPOS_NOTIFICACAO, querReceber, tiposPara } from '../lib/notificacoes.ts'
import { avisosDaInstituicao, avisosPessoais } from '../lib/avisos.ts'

let passou = 0, falhou = 0
const verificar = (n, c, o) => {
  if (c) { passou++; console.log(`  ok   ${n}`) }
  else { falhou++; console.log(`  FALHA ${n}\n        obtido: ${JSON.stringify(o)}`) }
}

console.log('\nO catalogo')
verificar('tem tipos dos tres ambitos',
  new Set(TIPOS_NOTIFICACAO.map(t => t.ambito)).size === 3,
  [...new Set(TIPOS_NOTIFICACAO.map(t => t.ambito))])
verificar('nenhum id repetido',
  new Set(TIPOS_NOTIFICACAO.map(t => t.id)).size === TIPOS_NOTIFICACAO.length,
  TIPOS_NOTIFICACAO.length)
verificar('todos tem label e descricao',
  TIPOS_NOTIFICACAO.every(t => t.label && t.descricao),
  TIPOS_NOTIFICACAO.filter(t => !t.label || !t.descricao).map(t => t.id))

console.log('\nAs escolhas')
verificar('sem escolhas, usa a omissao (ligado)', querReceber(null, 'toma') === true)
verificar('sem escolhas, o que vem desligado fica desligado', querReceber({}, 'avaliacoes') === false)
verificar('uma escolha explicita manda', querReceber({ toma: false }, 'toma') === false)
verificar('ligar o que vinha desligado', querReceber({ avaliacoes: true }, 'avaliacoes') === true)
verificar('uma escolha nao afeta as outras', querReceber({ toma: false }, 'caixa') === true)
verificar('tipo desconhecido chega na mesma (melhor a mais do que a menos)',
  querReceber({}, 'coisa-nova-que-alguem-se-esqueceu') === true)

console.log('\nQuem ve o que')
{
  const pessoal = tiposPara({ temOrg: false })
  verificar('sem instituicao nao ha interruptores da casa',
    !pessoal.some(t => t.ambito === 'instituicao'), pessoal.filter(t => t.ambito === 'instituicao').map(t => t.id))
  verificar('mas continua a ver os seus', pessoal.some(t => t.ambito === 'pessoal'))

  const lar = tiposPara({ temOrg: true, tipoInstituicao: 'nursing_home' })
  verificar('um lar nao ve o de presencas (e de centro de dia)',
    !lar.some(t => t.id === 'presenca'), lar.map(t => t.id))
  const cd = tiposPara({ temOrg: true, tipoInstituicao: 'day_care' })
  verificar('um centro de dia ve', cd.some(t => t.id === 'presenca'))
}

console.log('\nCada aviso tem um interruptor (e vice-versa)')
{
  // Se um aviso puder ser empurrado sem ter entrada no catalogo, ninguem o
  // consegue desligar — e a definicao de incomodo.
  const baseFalsa = (tabelas) => ({
    from: (t) => {
      const alvo = tabelas[t] !== undefined ? { data: tabelas[t], error: null } : { data: [], error: null }
      const p = new Proxy(alvo, {
        get(o, k) {
          if (k === 'then') return (res, rej) => Promise.resolve(alvo).then(res, rej)
          if (k in o) return o[k]
          return () => p
        },
      })
      return p
    },
  })
  const HOJE = '2026-09-14'
  const ids = new Set(TIPOS_NOTIFICACAO.map(t => t.id))
  const vistos = new Set()

  // Uma casa com tudo a acontecer, a varias horas, para tocar em todos os ramos.
  const utentes = [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Joao' }]
  const casa = {
    patients: utentes,
    incidents: [{ id: 'i1', date: HOJE, type: 'fall', patient_id: 'p1' }],
    family_thread_messages: [{ id: 'f1', patient_id: 'p1', content: 'ola', created_at: new Date().toISOString(), author_side: 'family' }],
    mar_records: [{ id: 'r1', patient_id: 'p1', med_id: 'm1', shift: 'manha', status: 'refused', date: HOJE }],
    team_messages: [{ id: 't1', channel: 'Geral', body: 'x', author_name: 'R', author_id: 'u9', priority: 'urgente', created_at: new Date().toISOString() }],
    stock_items: [{ id: 's1', name: 'Luvas', quantity: 1, min_quantity: 9, unit: 'cx', expiry_date: '2026-09-20' }],
    attendance: [{ patient_id: 'p1', status: 'present' }],
    patient_meds: [{ id: 'm1', patient_id: 'p1', name: 'X', shifts: ['manha'] }],
    medication_prep_logs: [{ patient_id: 'p1', week_start: '2026-09-13', weekday: 1, packed: true }],
    assessments: [{ patient_id: 'p1', date: '2026-01-01' }],
  }
  for (const hora of ['09:30', '11:00', '13:45', '18:00', '21:00']) {
    const a = await avisosDaInstituicao(baseFalsa(casa), 'org1', { agora: hora, hoje: HOJE, tipoInstituicao: 'day_care' })
    a.forEach(x => vistos.add(x.tipo))
  }
  const pessoa = {
    personal_meds: [{ id: 'x1', name: 'Losartan', reminder_times: ['08:00'], units_left: 2, units_per_dose: 1 }],
    med_logs: [],
    cal_events: [{ id: 'c1', title: 'Consulta', starts_at: '2026-09-15T10:00:00', location: 'Centro' }],
  }
  for (const hora of ['12:00', '18:00', '21:00']) {
    const a = await avisosPessoais(baseFalsa(pessoa), 'u1', { agora: hora, hoje: HOJE })
    a.forEach(x => vistos.add(x.tipo))
  }

  const semInterruptor = [...vistos].filter(t => !ids.has(t))
  verificar('nenhum aviso sem interruptor', semInterruptor.length === 0, semInterruptor)
  console.log(`       (tipos de aviso produzidos: ${[...vistos].sort().join(', ')})`)

  // Os novos existem mesmo?
  for (const t of ['validades', 'preparacao', 'avaliacoes', 'resumo_dia', 'consulta']) {
    verificar(`o tipo novo "${t}" e mesmo produzido`, vistos.has(t), [...vistos])
  }
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
