// scripts/check-papeis.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Papeis antigos escritos a mao no codigo.
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// Ate ao sprint152 os papeis de uma instituicao eram onze nomes tecnicos em
// ingles -- owner, admin, clinician, pharmacist, nurse, assistant, accountant,
// viewer, student, caregiver, self -- herdados de quando o Phlox servia
// farmacias e clinicas.
//
// Passaram a ser sete, em portugues, que fazem sentido num lar ou centro de
// dia. E ficou uma armadilha: um `role === 'admin'` esquecido nao da erro de
// compilacao nem rebenta -- devolve FALSO em silencio. Foi isto que podia ter
// acontecido:
//
//   • `requireOrgRole`, usado em SETENTA rotas, comparava com ['owner','admin']
//     -> as setenta devolviam 403 a toda a gente, incluindo ao dono;
//   • `canEdit` era `role !== 'viewer'` -> como 'viewer' deixou de existir,
//     os convidados GANHAVAM direito de editar.
//
// Uma comparacao de papel errada nao se ve a olho. Esta guarda ve.
//
//   node scripts/check-papeis.mjs
//
// Durante a transicao, aceitar os DOIS vocabularios e o correcto -- por isso
// uma linha que mencione um papel antigo E um novo passa.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const ANTIGOS = ['owner', 'admin', 'clinician', 'pharmacist', 'nurse',
                 'assistant', 'accountant', 'viewer', 'student', 'caregiver']
const NOVOS = ['dono', 'direcao', 'enfermagem', 'auxiliar', 'animacao',
               'administrativo', 'convidado']

// Onde os nomes antigos sao suposto aparecer: a traducao, e o SQL gerado dela.
const PERMITIDOS = new Set([
  'lib/permissoes.ts',
  'scripts/check-papeis.mjs',
  'scripts/teste-permissoes.mjs',
  'scripts/gerar-sql-permissoes.mjs',
])

function ficheiros(dir, fora = []) {
  if (!fs.existsSync(dir)) return fora
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) ficheiros(p, fora) }
    else if (/\.(ts|tsx)$/.test(e.name)) fora.push(p)
  }
  return fora
}

const achados = []

// ─────────────────────────────────────────────────────────────────────────────
// PRIMEIRA PASSAGEM: o papel esta na propria linha
// ─────────────────────────────────────────────────────────────────────────────
for (const f of [...ficheiros('app'), ...ficheiros('lib'), ...ficheiros('components')]) {
  const chave = f.replace(/\\/g, '/')
  if (PERMITIDOS.has(chave)) continue

  const linhas = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  linhas.forEach((linha, i) => {
    if (/^\s*(\/\/|\*)/.test(linha)) return

    // So interessa o papel de INSTITUICAO. A palavra `role` aparece em muitos
    // sitios que nao tem nada a ver: o nivel de partilha de um perfil
    // ('viewer' | 'editor'), o cargo nas escalas em `team_members` ('nurse'),
    // a rota /admin. Uma guarda que os acuse a todos tem 65 falsos positivos e
    // deixa de ser lida em duas semanas.
    //
    // O sinal de que E papel de instituicao: a linha fala de `org_members`,
    // `org_role`, `requireOrgRole`, ou de uma variavel que veio de la.
    const falaDePapelDaCasa =
      /org_role|org_members|requireOrgRole|\b(mem|membro|membership|inv)\.role\b/.test(linha)
    if (!falaDePapelDaCasa) return

    // `profiles.org_role` e uma COPIA grosseira do papel, com o seu proprio
    // vocabulario de tres valores (owner / admin / member) que o sprint152 nao
    // toca. Escrever 'owner' ali continua certo -- nao e o papel da casa, que
    // vive em `org_members.role`. So se acusa quando a linha fala das duas.
    if (/org_role/.test(linha) && !/org_members/.test(linha)) return

    const antigosAqui = ANTIGOS.filter(r => new RegExp(`'${r}'`).test(linha))
    if (!antigosAqui.length) return

    // Aceitar os dois vocabularios durante a transicao e o comportamento certo.
    const temNovo = NOVOS.some(r => new RegExp(`'${r}'`).test(linha))
    if (temNovo) return

    achados.push({ f: chave, n: i + 1, papeis: antigosAqui, linha: linha.trim().slice(0, 110) })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGUNDA PASSAGEM: o papel chegou por uma VARIAVEL, de longe
// ─────────────────────────────────────────────────────────────────────────────
// A primeira passagem olha para a linha. Isso chega quando o papel esta ali
// (`mem.role === 'owner'`) e nao chega quando ele veio de outro sitio. Tres
// bugs reais passaram-lhe ao lado, e os tres so dariam pelo nome DEPOIS da
// migracao, em silencio -- que e a pior altura e a pior maneira:
//
//   • app/equipa: `myRole === 'owner' || myRole === 'admin'`, com o `myRole`
//     preenchido cem linhas acima por uma resposta do servidor. Depois do
//     sprint152 o papel e `dono`, isto fica FALSO para toda a gente, e a
//     pagina da equipa tranca-se ao proprio dono.
//   • app/api/org/team: `['admin','nurse','assistant','clinician','viewer']
//     .includes(body.role) ? body.role : 'assistant'`. Assim que a interface
//     manda `direcao`, a lista nao o reconhece e TODA A GENTE entra como
//     auxiliar -- sem erro, sem aviso, com a pessoa a jurar que escolheu bem.
//   • o mapa papel->escala com as chaves antigas: `TEAM_ROLE[papel]` passa a
//     dar `undefined` e toda a gente aparece na escala como "outro".
//
// A regra desta passagem usa o contexto do FICHEIRO em vez da linha: num
// ficheiro que fala de `org_members`/`org_invites`/`org_role`, uma linha com
// DOIS OU MAIS nomes de papeis antigos e quase de certeza uma lista de papeis
// de instituicao. Dois ou mais, e nao um, porque 'admin' e 'nurse' sozinhos
// aparecem em coisas sem relacao nenhuma (a rota /admin, o cargo na escala).
const ondeOsPapeisVivem = /org_members|org_invites|org_role|requireOrgRole|normalizarPapel/

for (const f of [...ficheiros('app'), ...ficheiros('lib'), ...ficheiros('components')]) {
  const chave = f.replace(/\\/g, '/')
  if (PERMITIDOS.has(chave)) continue

  const texto = fs.readFileSync(f, 'utf8')
  if (!ondeOsPapeisVivem.test(texto)) continue

  texto.split(/\r?\n/).forEach((linha, i) => {
    if (/^\s*(\/\/|\*)/.test(linha)) return
    if (achados.some(a => a.f === chave && a.n === i + 1)) return   // ja apanhada acima

    // Um tipo de TypeScript nao e uma comparacao. `experience_mode: 'clinical'
    // | 'caregiver' | 'personal' | 'student'` e o MODO da aplicacao -- que por
    // acaso partilha duas palavras com os papeis antigos e nao tem nada a ver
    // com eles. Declarar um tipo nunca devolve falso em silencio.
    if (/:\s*'[^']*'(\s*\|\s*('[^']*'|null|undefined))+/.test(linha)) return

    // A mesma excecao da primeira passagem: `profiles.org_role` tem o seu
    // proprio vocabulario de tres valores (owner/admin/member) que o sprint152
    // nao toca. Escrever 'owner' ali continua certo.
    if (/org_role/.test(linha) && !/org_members/.test(linha)) return

    const antigosAqui = ANTIGOS.filter(r => new RegExp(`'${r}'`).test(linha))
    if (antigosAqui.length < 2) return
    if (NOVOS.some(r => new RegExp(`'${r}'`).test(linha))) return

    achados.push({
      f: chave, n: i + 1, papeis: antigosAqui, linha: linha.trim().slice(0, 110),
      viaFicheiro: true,
    })
  })
}

if (!achados.length) {
  console.log('✓ Nenhum papel antigo comparado a mao fora de lib/permissoes.')
  process.exit(0)
}

console.log('Papeis antigos comparados a mao — devolvem falso em silencio depois do sprint152:\n')
for (const a of achados) {
  console.log(`✗ ${a.f}:${a.n}   (${a.papeis.join(', ')})`)
  console.log(`    ${a.linha}`)
  console.log(a.viaFicheiro
    ? '    → normalizarPapel() entende os dois vocabularios; para decidir acessos, pode(perms, area, nivel).\n'
    : '    → aceita os dois vocabularios, ou usa pode(perms, area, nivel).\n')
}
console.log(`✗ ${achados.length} comparacao(oes) por corrigir.`)
process.exit(1)
