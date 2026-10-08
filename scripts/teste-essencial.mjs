// scripts/teste-essencial.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O essencial: em branco não é «não tem».
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES ────────────────────────────────────
// Porque o erro que esta folha pode cometer não dá erro nenhum. Imprime-se
// bonita, com o campo das alergias vazio, e quem a lê conclui — com toda a
// razão, olhando para a folha — que esta pessoa não tem alergias.
//
// Há três enganos possíveis e os três têm de ser apanhados aqui:
//
//   1. BRANCO LIDO COMO «NÃO TEM». O pior. Um campo vazio tem de GRITAR.
//   2. «DESCONHECIDAS» LIDO COMO «NÃO TEM». Mais calado e igualmente grave:
//      é a frase mais honesta que alguém pode escrever, e tratada como uma
//      negação passa a ser a mais perigosa.
//   3. INFORMAÇÃO VERDADEIRA LIDA COMO BRANCO. «Não anda sozinha» na
//      mobilidade começa por «não» — uma expressão larga demais apagava-a, e
//      a folha dizia que a mobilidade não estava registada quando estava.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-essencial.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  campo, medicacaoDaFolha, avaliacoesDaFolha, feridasDaFolha,
  contactosDaFolha, alertasDaFolha, montarFolha, resumoDaFolha,
} from '../lib/essencial.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

/* ══════════════════════════════════════════════════════════════════════════
   1. OS TRÊS ESTADOS
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\ncampo() — escrito, nenhum, branco')
{
  const vazio = campo('Alergias', null, { negavel: true, critico: true })
  ok('nada escrito é «branco»', vazio.estado === 'branco')
  ok('e a folha diz que não está registado',
    /n[ãa]o est[áa] registado|N[ÃA]O EST[ÁA] REGISTADO/i.test(vazio.valor), vazio.valor)
  ok('só espaços também é branco', campo('x', '   ').estado === 'branco')

  const escrito = campo('Alergias', 'Penicilina', { negavel: true })
  ok('um valor é «escrito»', escrito.estado === 'escrito')
  ok('e sai tal como foi escrito', escrito.valor === 'Penicilina')

  const nenhum = campo('Alergias', 'sem alergias conhecidas', {
    negavel: true, seNenhum: 'Sem alergias conhecidas',
  })
  ok('«sem alergias conhecidas» é «nenhum»', nenhum.estado === 'nenhum')
  ok('e sai sempre com a mesma frase', nenhum.valor === 'Sem alergias conhecidas')
}
{
  // O MESMO texto num campo que não aceita negação: lê-se tal como está.
  const m = campo('Mobilidade', 'nenhuma')
  ok('num campo não-negável, «nenhuma» fica escrito tal e qual',
    m.estado === 'escrito' && m.valor === 'nenhuma',
    'só as alergias e as restrições é que podem «não ter»')
}

console.log('\nas três maneiras de dizer que não há')
{
  for (const v of ['nenhuma', 'não tem', 'n/a', 's/ alergias', '—', 'Sem alergias.', 'NENHUMA']) {
    const c = campo('Alergias', v, { negavel: true, seNenhum: 'Sem alergias conhecidas' })
    ok(`«${v}» → nenhum`, c.estado === 'nenhum', c.valor)
  }
}

console.log('\n«não se sabe» NÃO é «não há» — o engano calado')
{
  for (const v of ['desconhecidas', 'a confirmar', 'sem registo', 'por apurar', '?'] ) {
    const c = campo('Alergias', v, { negavel: true, critico: true })
    ok(`«${v}» conta como em falta`, c.estado === 'branco', c.valor)
  }
  const c = campo('Alergias', 'desconhecidas', { negavel: true })
  ok('e a folha mostra o que foi escrito, com o aviso',
    /Desconhecidas/.test(c.valor) && /confirmar/i.test(c.valor), c.valor)
}

console.log('\ninformação verdadeira que começa por «não»')
{
  const frases = [
    'Não anda sozinha — transferência com duas pessoas',
    'Não deglute líquidos finos',
    'Não quer ser levantada antes das 9h',
  ]
  for (const f of frases) {
    const c = campo('Mobilidade', f, { negavel: true })
    ok(`«${f.slice(0, 28)}…» fica escrito`, c.estado === 'escrito',
      c.estado !== 'escrito' ? `foi para «${c.estado}»` : '')
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   2. A MEDICAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nmedicacaoDaFolha — por turno, e o SOS à parte')
const MEDS = [
  { id: 'm1', name: 'Brilique', dose: '90 mg', route: 'oral', shifts: ['manha', 'noite'],
    horas: { manha: '08:00', noite: '22:00' }, active: true },
  { id: 'm2', name: 'Insulina', dose: '12 U', route: 'subcutânea', shifts: ['manha'],
    horas: { manha: '07:30' }, active: true },
  { id: 'm3', name: 'Paracetamol', dose: '1 g', sos: true, sos_para: 'dor',
    sos_max_dia: 3, sos_intervalo_horas: 6, active: true },
  { id: 'm4', name: 'Vitamina D', dose: '1 gota', shifts: [], active: true },
  { id: 'm5', name: 'Omeprazol', dose: '20 mg', shifts: ['manha'], take_location: 'casa', active: true },
  { id: 'm6', name: 'Furosemida', dose: '40 mg', shifts: ['manha'], active: false },
]
{
  const r = medicacaoDaFolha(MEDS, ['manha', 'tarde', 'noite'])
  const manha = r.porTurno.find(t => t.turno === 'manha')
  const noite = r.porTurno.find(t => t.turno === 'noite')
  const tarde = r.porTurno.find(t => t.turno === 'tarde')

  ok('a manhã tem a insulina e o brilique', manha.linhas.length === 3,
    `${manha.linhas.length} linhas: ${manha.linhas.join(' | ')}`)
  ok('a hora vem à frente', manha.linhas.some(l => l.startsWith('07:30 — Insulina')),
    manha.linhas.join(' | '))
  ok('e a lista segue o relógio', manha.linhas[0].startsWith('07:30'), manha.linhas[0])
  ok('a noite tem o brilique com a hora da noite',
    noite.linhas.length === 2 && noite.linhas.some(l => l.startsWith('22:00 — Brilique')),
    noite.linhas.join(' | '))
  ok('`shifts` vazio quer dizer todos os turnos',
    tarde && tarde.linhas.length === 1 && /Vitamina D/.test(tarde.linhas[0]),
    'é a compatibilidade com a medicação criada antes de haver turnos')

  ok('o SOS não está em nenhum turno',
    !r.porTurno.some(t => t.linhas.some(l => /Paracetamol/.test(l))),
    'posto entre as tomas da manhã, lê-se como uma coisa a dar — e dá-se')
  ok('e está na lista dele', r.sos.length === 1)
  ok('com o para quê e os limites',
    /se dor/.test(r.sos[0]) && /3×\/dia/.test(r.sos[0]) && /6h/.test(r.sos[0]), r.sos[0])

  ok('a medicação de casa vai à parte', r.emCasa.length === 1 && /Omeprazol/.test(r.emCasa[0]))
  ok('e não aparece nos turnos da casa',
    !r.porTurno.some(t => t.linhas.some(l => /Omeprazol/.test(l))),
    'a casa não a administra — mas quem lê o essencial tem de saber que ela existe')
  ok('um medicamento parado não aparece em sítio nenhum',
    !JSON.stringify(r).includes('Furosemida'))
}
{
  // Um centro de dia está fechado à noite.
  const r = medicacaoDaFolha(MEDS, ['manha', 'tarde'])
  ok('num centro de dia não há turno da noite',
    !r.porTurno.some(t => t.turno === 'noite'))
  ok('e a dose da noite não aparece lá',
    !r.porTurno.some(t => t.linhas.some(l => l.startsWith('22:00'))),
    'o brifen das 22h não é trabalho de um centro que fecha às 18h')
}
{
  const r = medicacaoDaFolha([], ['manha', 'tarde', 'noite'])
  ok('sem medicação, não há turnos vazios a encher a folha', r.porTurno.length === 0)
}

/* ══════════════════════════════════════════════════════════════════════════
   3. AS AVALIAÇÕES
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\navaliacoesDaFolha — só a mais recente, sempre com a idade')
{
  const r = avaliacoesDaFolha([
    { scale: 'barthel', score: 20, date: '2026-01-10' },
    { scale: 'barthel', score: 35, date: '2026-09-15' },
    { scale: 'braden', score: 11, date: '2026-02-01' },
    { scale: 'semdata', score: 5, date: null, created_at: null },
  ], '2026-10-02')

  ok('uma linha por escala, não uma por avaliação', r.linhas.length === 2,
    r.linhas.join(' | '))
  const barthel = r.linhas.find(l => /Barthel/.test(l))
  ok('e é a mais recente', /35\/100/.test(barthel), barthel)
  ok('com o nível por palavras', /Depend[êe]ncia Grave/.test(barthel), barthel)
  ok('a data aparece em português', /15\/09\/2026/.test(barthel), barthel)
  ok('e a idade da avaliação', /\((h[áa] \d+|este m[êe]s)/.test(barthel), barthel)
  ok('uma avaliação sem data nenhuma fica de fora',
    !r.linhas.some(l => /semdata/.test(l)),
    'um número sem data engana mais do que não haver número')

  ok('a de fevereiro está desatualizada', r.desatualizadas.length === 1
    && /Braden/.test(r.desatualizadas[0]), r.desatualizadas.join(' | '))
  ok('e a de setembro não', !r.desatualizadas.some(d => /Barthel/.test(d)))
}
{
  const r = avaliacoesDaFolha([{ scale: 'barthel', score: 40, date: '2024-03-01' }], '2026-10-02')
  ok('dois anos leem-se em anos', /h[áa] 2 anos/.test(r.linhas[0]), r.linhas[0])
}
{
  const r = avaliacoesDaFolha([{ scale: 'barthel', score: 40, date: '2026-07-20' }], '2026-10-02')
  ok('dois meses e meio leem-se em meses', /h[áa] 2 meses/.test(r.linhas[0]), r.linhas[0])
}
{
  const r = avaliacoesDaFolha([{ scale: 'barthel', score: 40, date: '2026-10-01' }], '2026-10-02')
  ok('ontem lê-se «este mês»', /este m[êe]s/.test(r.linhas[0]), r.linhas[0])
}

/* ══════════════════════════════════════════════════════════════════════════
   4. AS FERIDAS
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nferidasDaFolha')
{
  const r = feridasDaFolha([
    { location: 'Sacro', stage: 'II', dressing: 'Hidrocolóide', status: 'open', onset_date: '2026-09-20' },
    { location: 'Calcâneo direito', status: 'open' },
    { location: 'Trocânter', status: 'healed', dressing: 'x' },
  ])
  ok('as ativas aparecem', r.length === 2, r.join(' | '))
  ok('uma cicatrizada não', !r.some(l => /Trocânter/.test(l)),
    'uma folha destas é o presente, não o histórico')
  ok('com o penso', /Hidrocol[óo]ide/.test(r[0]), r[0])
  ok('e a que não tem penso diz que não tem',
    /sem tratamento registado/.test(r[1]), r[1])
}

/* ══════════════════════════════════════════════════════════════════════════
   5. OS CONTACTOS
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\ncontactosDaFolha — quem se telefona primeiro')
{
  const r = contactosDaFolha([
    { name: 'Vizinha', relationship: 'vizinha', phone: '912 000 000' },
    { name: 'Filha', relationship: 'filha', phone: '913 111 111', is_emergency: true, is_legal_guardian: true },
  ])
  ok('a emergência vem primeiro', /Filha/.test(r[0]), r.join(' | '))
  ok('e está marcada', /EMERG[ÊE]NCIA/.test(r[0]), r[0])
  ok('o representante legal também',
    /representante legal/.test(r[0]),
    'às três da manhã ninguém tem tempo para descobrir qual dos cinco números é o dele')
}
{
  const r = contactosDaFolha(
    [{ name: 'Filha', phone: '913 111 111', is_emergency: true }],
    { nome: 'Filha', telefone: '913111111' })
  ok('o telefone da ficha não se repete quando já está na lista', r.length === 1,
    r.join(' | '))
}
{
  const r = contactosDaFolha([], { nome: 'Sobrinho', telefone: '914 222 222' })
  ok('mas entra quando a lista não o tem', r.length === 1 && /Sobrinho/.test(r[0]), r.join(' | '))
}
{
  const r = contactosDaFolha([{ name: 'Filho', relationship: 'filho' }])
  ok('um contacto sem telefone diz que não tem telefone',
    /sem telefone/.test(r[0]), r[0])
}

/* ══════════════════════════════════════════════════════════════════════════
   6. AS INCOERÊNCIAS
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nalertasDaFolha — o que não bate certo entre dois campos cheios')
{
  const a = alertasDaFolha(
    { pressure_risk: 'Risco alto', fall_risk: 'Elevado', mobility: null },
    { positioning_schedule: null, pressure_ulcer_prevention: null },
    [{ id: 's', name: 'Paracetamol', sos: true, active: true }],
    [{ location: 'Sacro', status: 'open' }],
  )
  ok('risco de úlcera alto sem posicionamento', a.some(x => /posicionamento/.test(x)), a.join(' | '))
  ok('risco de queda alto com a mobilidade em branco', a.some(x => /mobilidade/.test(x)))
  ok('ferida ativa sem tratamento', a.some(x => /penso/.test(x)))
  ok('SOS sem máximo por dia', a.some(x => /SOS/.test(x)))
  ok('são quatro e não mais', a.length === 4, `${a.length}: ${a.join(' | ')}`)
}
{
  // O teste que importa mais: com tudo preenchido, CALA-SE.
  const a = alertasDaFolha(
    { pressure_risk: 'Risco alto', fall_risk: 'Elevado', mobility: 'Cadeira de rodas, transferência a dois' },
    { positioning_schedule: 'De 3 em 3 horas', pressure_ulcer_prevention: 'Colchão de pressão alterna' },
    [{ id: 's', name: 'Paracetamol', sos: true, sos_max_dia: 3, active: true }],
    [{ location: 'Sacro', status: 'open', dressing: 'Hidrocolóide' }],
  )
  ok('com tudo preenchido não há aviso nenhum', a.length === 0, a.join(' | '))
}
{
  const a = alertasDaFolha({ pressure_risk: 'Baixo', fall_risk: 'Baixo' }, null, [], [])
  ok('risco baixo e plano vazio não geram avisos', a.length === 0, a.join(' | '))
}

/* ══════════════════════════════════════════════════════════════════════════
   7. A FOLHA INTEIRA
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nmontarFolha — uma ficha vazia')
{
  const c = montarFolha({
    utente: { name: 'Pessoa Sem Nada' },
    meds: [], avaliacoes: [], turnos: ['manha', 'tarde', 'noite'], temQuartos: true,
    hoje: '2026-10-02',
  })
  const criticos = c.emFaltaCritico.map(x => x.rotulo)
  ok('os seis essenciais aparecem em falta', criticos.length === 6,
    criticos.join(', '))
  for (const r of ['Alergias', 'Médico assistente', 'Dieta', 'Textura',
    'Mobilidade e transferências', 'Quem avisar']) {
    ok(`  «${r}» está na lista`, criticos.some(x => x.startsWith(r.split(' e ')[0])), criticos.join(', '))
  }
  ok('as alergias gritam', /N[ÃA]O EST[ÁA] REGISTADO/.test(
    c.secoes.find(s => s.id === 'alergias').campos[0].valor))
  ok('e dizem que isso não quer dizer que não tenha',
    /n[ãa]o quer dizer que n[ãa]o tenha/i.test(
      c.secoes.find(s => s.id === 'alergias').campos[0].valor))
  ok('o resumo diz o que falta', /Falta o essencial/.test(resumoDaFolha(c)), resumoDaFolha(c))
  ok('sem contactos, a secção avisa',
    /NINGU[ÉE]M REGISTADO/.test(c.secoes.find(s => s.id === 'contactos').vazia))
}

console.log('\nmontarFolha — uma ficha tratada')
{
  const c = montarFolha({
    utente: {
      name: 'Pessoa Com Ficha', room_number: '12', sex: 'F',
      date_of_birth: '1940-05-03', admission_date: '2023-02-01', sns_number: '123456789',
      allergies: 'Penicilina', diagnosis: 'Insuficiência cardíaca',
      conditions: 'Hipertensão, diabetes tipo 2', cognitive_status: 'Orientada',
      doctor: 'Dr.ª Matos', fall_risk: 'Moderado', pressure_risk: 'Baixo',
      emergency_contact: 'Filha', emergency_phone: '913 111 111',
    },
    meds: MEDS, avaliacoes: [{ scale: 'barthel', score: 65, date: '2026-09-01' }],
    plano: {
      diet_type: 'Diabética', diet_texture: 'Normal', mobility: 'Anda com andarilho',
      positioning_schedule: null, fluid_restriction: false,
    },
    feridas: [], contactos: [{ name: 'Filha', phone: '913 111 111', is_emergency: true }],
    turnos: ['manha', 'tarde', 'noite'], temQuartos: true, hoje: '2026-10-02',
  })
  ok('nenhum essencial em falta', c.emFaltaCritico.length === 0,
    c.emFaltaCritico.map(x => x.rotulo).join(', '))
  ok('o resumo diz isso', /essencial est[áa] preenchido|completa/i.test(resumoDaFolha(c)),
    resumoDaFolha(c))
  ok('a idade sai da data de nascimento',
    c.cabecalho.find(x => x.rotulo === 'Idade').valor === '86 anos',
    c.cabecalho.find(x => x.rotulo === 'Idade').valor)
  ok('o quarto está no cabeçalho', c.cabecalho.some(x => x.rotulo === 'Quarto'))
  ok('a medicação está lá', c.secoes.find(s => s.id === 'medicacao').linhas.length > 0)
  ok('o SOS tem secção própria', !!c.secoes.find(s => s.id === 'sos'))
  ok('e a medicação de casa também', !!c.secoes.find(s => s.id === 'medEmCasa'))
  ok('o SOS com limites não gera aviso', !c.alertas.some(a => /SOS/.test(a)), c.alertas.join(' | '))
  ok('ainda há campos menos urgentes em falta', c.emFalta > 0,
    'não se finge que uma ficha está completa só porque o essencial está')
}

console.log('\nmontarFolha — o centro de dia não é um lar')
{
  const base = {
    utente: { name: 'Pessoa' }, meds: [], avaliacoes: [],
    turnos: ['manha', 'tarde'], hoje: '2026-10-02',
  }
  const cd = montarFolha({ ...base, temQuartos: false })
  const lar = montarFolha({ ...base, temQuartos: true, turnos: ['manha', 'tarde', 'noite'] })

  ok('num centro de dia não há quarto no cabeçalho',
    !cd.cabecalho.some(x => x.rotulo === 'Quarto'))
  ok('num lar há', lar.cabecalho.some(x => x.rotulo === 'Quarto'))

  const vaziaCD = cd.secoes.find(s => s.id === 'medicacao').vazia
  const vaziaLar = lar.secoes.find(s => s.id === 'medicacao').vazia
  ok('sem medicação, o centro de dia não grita', !/⚠/.test(vaziaCD), vaziaCD)
  ok('mas o lar grita', /⚠/.test(vaziaLar), vaziaLar)
}
{
  // `temFeridas` é `cfg.hasWounds`: um centro de dia não tem a ferramenta das
  // feridas, e a secção não existe. Sem isto, lia-se «Nenhuma ferida ativa
  // registada» numa casa que nunca registou feridas nenhumas.
  const semFerramenta = montarFolha({
    utente: { name: 'Pessoa' }, meds: [], avaliacoes: [],
    feridas: [{ location: 'Sacro', status: 'open' }],
    turnos: ['manha'], temQuartos: false, temFeridas: false, hoje: '2026-10-02',
  })
  const comFerramenta = montarFolha({
    utente: { name: 'Pessoa' }, meds: [], avaliacoes: [],
    feridas: [{ location: 'Sacro', status: 'open' }],
    turnos: ['manha'], temQuartos: true, temFeridas: true, hoje: '2026-10-02',
  })
  ok('sem a ferramenta das feridas, não há secção das feridas',
    !semFerramenta.secoes.some(s => s.id === 'feridas'))
  ok('com a ferramenta, há', comFerramenta.secoes.some(s => s.id === 'feridas'))
  ok('por omissão, há — quem não disser nada fica com a folha completa',
    montarFolha({
      utente: { name: 'P' }, meds: [], avaliacoes: [],
      turnos: ['manha'], temQuartos: true, hoje: '2026-10-02',
    }).secoes.some(s => s.id === 'feridas'))
}

console.log('\nmontarFolha — o que foi escrito como «não há» não conta como falta')
{
  const c = montarFolha({
    utente: { name: 'Pessoa', allergies: 'Sem alergias conhecidas', doctor: 'Dr. Silva',
      mobility: 'Autónoma', emergency_phone: '913 111 111' },
    meds: [], avaliacoes: [],
    plano: { diet_type: 'Geral', diet_texture: 'normal' },
    turnos: ['manha', 'tarde'], temQuartos: false, hoje: '2026-10-02',
  })
  ok('alergias declaradas como nenhumas não estão em falta',
    !c.emFaltaCritico.some(x => x.rotulo === 'Alergias'),
    c.emFaltaCritico.map(x => x.rotulo).join(', '))
  const al = c.secoes.find(s => s.id === 'alergias').campos[0]
  ok('e a folha diz «Sem alergias conhecidas»', al.valor === 'Sem alergias conhecidas', al.valor)
  ok('o estado é «nenhum» e não «escrito»', al.estado === 'nenhum', al.estado)
}

console.log('\nmontarFolha — «desconhecidas» na ficha')
{
  const c = montarFolha({
    utente: { name: 'Pessoa', allergies: 'desconhecidas' },
    meds: [], avaliacoes: [], turnos: ['manha'], temQuartos: false, hoje: '2026-10-02',
  })
  ok('continua a contar como essencial em falta',
    c.emFaltaCritico.some(x => x.rotulo === 'Alergias'),
    'é o engano mais calado dos três, e o que esta folha existe para não cometer')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ Em branco grita, «desconhecidas» também, e «não anda sozinha» fica escrito.')
process.exit(falhas ? 1 : 0)
