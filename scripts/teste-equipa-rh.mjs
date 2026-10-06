// scripts/teste-equipa-rh.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A aritmética da formação e das ausências da equipa.
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES ────────────────────────────────────
// As duas falham em silêncio, e cada uma para um lado:
//
//   • Um FALSO ALARME na formação («está caducada» quando a pessoa já
//     renovou) faz a lista deixar de ser lida ao fim de uma semana — e aí
//     também não se vê a que está mesmo caducada.
//   • Um ALARME EM FALTA é uma inspeção a encontrar um certificado fora de
//     prazo que o Phlox dizia estar bem.
//
//   • Uma ausência mal calculada põe alguém na escala no dia em que está de
//     férias, ou tira-a no dia em que já voltou.
//
// Os limites — o primeiro e o último dia de uma ausência, a renovação feita no
// próprio dia em que caducava — são onde isto erra, e é sobre eles que a maior
// parte destes testes é.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-equipa-rh.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  estadoDaFormacao, formacoesEmRisco, estaFora, ausenciasNoDia,
  ausenciaEmPalavras, diasDeAusencia, diasAte, resumoDoFuncionario,
} from '../lib/equipaRh.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

const HOJE = '2026-10-01'
const f = (o = {}) => ({
  id: Math.random().toString(36).slice(2), team_member_id: 'm1',
  tema: 'Suporte básico de vida', data: '2024-01-01', horas: 8,
  formador: null, entidade: null, valida_ate: null, notas: null, ...o,
})
const a = (o = {}) => ({
  id: Math.random().toString(36).slice(2), team_member_id: 'm1',
  tipo: 'ferias', inicio: '2026-10-01', fim: '2026-10-10',
  motivo: null, notas: null, ...o,
})

// ── Dias ─────────────────────────────────────────────────────────────────────
console.log('\ndiasAte')
{
  ok('hoje é 0', diasAte(HOJE, HOJE) === 0)
  ok('amanhã é 1', diasAte('2026-10-02', HOJE) === 1)
  ok('ontem é −1', diasAte('2026-09-30', HOJE) === -1)
  ok('atravessa o fim do mês', diasAte('2026-11-01', HOJE) === 31)
  // Outubro de 2026: a hora de verão acaba a 25. Com `Date` e horas a zero,
  // um dia pode ter 23 ou 25 horas e o arredondamento tem de aguentar.
  ok('atravessa a mudança da hora sem perder um dia',
    diasAte('2026-10-26', '2026-10-24') === 2, `${diasAte('2026-10-26', '2026-10-24')}`)
}

// ── Estado de uma formação ───────────────────────────────────────────────────
console.log('\nestadoDaFormacao — os limites')
{
  ok('sem validade é «sem_validade», não «válida»',
    estadoDaFormacao(f({ valida_ate: null }), HOJE) === 'sem_validade',
    'tratar as duas como a mesma dava por conforme o que nunca foi preenchido')
  ok('ontem é caducada', estadoDaFormacao(f({ valida_ate: '2026-09-30' }), HOJE) === 'caducada')
  ok('HOJE ainda vale, mas a caducar',
    estadoDaFormacao(f({ valida_ate: HOJE }), HOJE) === 'a_caducar',
    'quem renova no próprio dia está em dia')
  ok('daqui a 60 dias é a caducar',
    estadoDaFormacao(f({ valida_ate: '2026-11-30' }), HOJE) === 'a_caducar')
  ok('daqui a 61 dias já é válida',
    estadoDaFormacao(f({ valida_ate: '2026-12-01' }), HOJE) === 'valida',
    'o limite é 60 e tem de ser exacto nos dois lados')
  ok('a janela é configurável',
    estadoDaFormacao(f({ valida_ate: '2026-12-01' }), HOJE, 90) === 'a_caducar')
}

// ── O FALSO ALARME ───────────────────────────────────────────────────────────
console.log('\nformacoesEmRisco — a renovação NÃO pode acusar a antiga')
{
  const fs = [
    f({ tema: 'Suporte básico de vida', data: '2023-01-10', valida_ate: '2026-01-10' }), // caducada
    f({ tema: 'Suporte básico de vida', data: '2026-01-05', valida_ate: '2029-01-05' }), // renovada
  ]
  const r = formacoesEmRisco(fs, HOJE)
  ok('quem renovou não aparece em risco', r.length === 0,
    `${r.length} — a de 2023 está caducada, mas a pessoa já renovou`)
}
{
  // Maiúsculas e espaços não podem fazer de duas a mesma coisa duas vezes.
  const fs = [
    f({ tema: 'Higiene Alimentar ', data: '2023-01-10', valida_ate: '2026-01-10' }),
    f({ tema: 'higiene alimentar', data: '2026-06-05', valida_ate: '2029-06-05' }),
  ]
  ok('o tema compara-se sem maiúsculas nem espaços a mais',
    formacoesEmRisco(fs, HOJE).length === 0)
}
{
  // Mas duas PESSOAS com a mesma formação são dois riscos.
  const fs = [
    f({ team_member_id: 'm1', valida_ate: '2026-01-10' }),
    f({ team_member_id: 'm2', valida_ate: '2026-01-10' }),
  ]
  ok('duas pessoas com a mesma formação caducada são dois riscos',
    formacoesEmRisco(fs, HOJE).length === 2)
}
{
  const fs = [
    f({ tema: 'A', valida_ate: '2026-11-15' }),   // a caducar
    f({ tema: 'B', valida_ate: '2026-08-01' }),   // caducada há mais tempo
    f({ tema: 'C', valida_ate: '2027-05-01' }),   // válida
    f({ tema: 'D', valida_ate: null }),           // sem validade
  ]
  const r = formacoesEmRisco(fs, HOJE)
  ok('só entram as caducadas e as a caducar', r.length === 2, r.map(x => x.formacao.tema).join(','))
  ok('e a pior vem primeiro', r[0].formacao.tema === 'B', r.map(x => x.formacao.tema).join(','))
  ok('a sem validade NÃO entra', !r.some(x => x.formacao.tema === 'D'),
    'é «ninguém disse», e não um risco de prazo')
}

// ── Ausências ────────────────────────────────────────────────────────────────
console.log('\nestaFora — os dois limites do intervalo')
{
  const au = a({ inicio: '2026-10-05', fim: '2026-10-10' })
  ok('véspera: está cá', !estaFora(au, '2026-10-04'))
  ok('PRIMEIRO dia: está fora', estaFora(au, '2026-10-05'), 'o início conta')
  ok('meio: está fora', estaFora(au, '2026-10-07'))
  ok('ÚLTIMO dia: está fora', estaFora(au, '2026-10-10'), 'o fim também conta')
  ok('dia seguinte: está cá', !estaFora(au, '2026-10-11'),
    'e volta sozinha, sem ninguém desligar nada')
}
{
  const au = a({ inicio: '2026-09-20', fim: null })
  ok('sem data de fim, continua fora', estaFora(au, '2027-03-01'),
    'uma baixa sem alta não acaba por si')
  ok('mas antes do início está cá', !estaFora(au, '2026-09-19'))
  ok('e diz-se assim', ausenciaEmPalavras(au) === 'De baixa, sem data de regresso'
    || ausenciaEmPalavras({ ...au, tipo: 'baixa' }) === 'De baixa, sem data de regresso',
    ausenciaEmPalavras({ ...au, tipo: 'baixa' }))
}
{
  const todas = [
    a({ team_member_id: 'm1', inicio: '2026-10-01', fim: '2026-10-03' }),
    a({ team_member_id: 'm2', inicio: '2026-11-01', fim: '2026-11-03' }),
  ]
  ok('só quem está fora HOJE', ausenciasNoDia(todas, HOJE).length === 1)
  ok('e em novembro é a outra', ausenciasNoDia(todas, '2026-11-02').length === 1)
  ok('num dia sem ninguém fora, lista vazia', ausenciasNoDia(todas, '2026-10-20').length === 0)
}

console.log('\ndiasDeAusencia — contagem inclusiva')
{
  const au = a({ inicio: '2026-10-05', fim: '2026-10-07' })
  ok('três dias são três, não dois',
    diasDeAusencia(au, '2026-10-01', '2026-10-31') === 3,
    `${diasDeAusencia(au, '2026-10-01', '2026-10-31')} — o primeiro e o último contam`)
  ok('um dia só é 1', diasDeAusencia(a({ inicio: '2026-10-05', fim: '2026-10-05' }), '2026-10-01', '2026-10-31') === 1)
  ok('só a parte que cai dentro do intervalo',
    diasDeAusencia(a({ inicio: '2026-09-28', fim: '2026-10-02' }), '2026-10-01', '2026-10-31') === 2,
    'os dias de setembro não contam para outubro')
  ok('fora do intervalo dá zero',
    diasDeAusencia(a({ inicio: '2026-12-01', fim: '2026-12-05' }), '2026-10-01', '2026-10-31') === 0)
  ok('sem fim, conta até ao fim do intervalo',
    diasDeAusencia(a({ inicio: '2026-10-30', fim: null }), '2026-10-01', '2026-10-31') === 2)
}

// ── O resumo ─────────────────────────────────────────────────────────────────
console.log('\nresumoDoFuncionario')
{
  ok('sem nada', resumoDoFuncionario([], [], HOJE) === 'Sem formação registada.')
  ok('tudo em dia',
    resumoDoFuncionario([f({ valida_ate: '2029-01-01' })], [], HOJE) === '1 formação registada, tudo em dia.',
    resumoDoFuncionario([f({ valida_ate: '2029-01-01' })], [], HOJE))
  const r = resumoDoFuncionario([f({ valida_ate: '2026-01-01' })], [a({ tipo: 'ferias' })], HOJE)
  ok('de férias e com formação caducada diz as duas',
    /férias/i.test(r) && /caducada/i.test(r), r)
  ok('começa por maiúscula', /^[A-ZÀ-Ú]/.test(r), r)
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ Quem renovou não é acusado, e quem volta de férias volta sozinho.')
process.exit(falhas ? 1 : 0)
