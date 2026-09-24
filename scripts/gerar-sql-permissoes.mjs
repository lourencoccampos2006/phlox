// scripts/gerar-sql-permissoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Escreve o SQL das permissoes A PARTIR de lib/permissoes.ts.
//
// ── PORQUE E QUE ISTO E GERADO E NAO ESCRITO A MAO ─────────────────────────
// Duas listas da mesma coisa em sitios diferentes divergem sempre. Ja custou
// duas vezes neste projeto:
//
//   • `health_vault.category` tinha um `check` com sete valores em ingles e o
//     codigo escrevia quatro em portugues -> o botao "Guardar no cofre" NUNCA
//     funcionou, e o guardar automatico dos planos pagos tambem nao;
//   • `personal_meds.shifts` era pedido num select e nao existia -> o
//     PostgREST recusava a consulta inteira e as notificacoes de medicacao
//     estiveram semanas caladas.
//
// Aqui o risco seria pior: a interface diz que a auxiliar nao ve o financeiro,
// a base de dados acha que ve, e ninguem repara ate alguem ver.
//
// Por isso ha UMA fonte -- o catalogo em TypeScript -- e o SQL sai dela.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-permissoes.mjs          ve
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-permissoes.mjs --escrever   grava o ficheiro
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-permissoes.mjs --verificar  acusa se divergiu
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import { AREAS, PAPEIS, TODAS, PAPEL_ANTIGO_PARA_NOVO } from '../lib/permissoes.ts'

const DESTINO = 'supabase/sprint152_permissoes.sql'

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
const arr = (xs) => `array[${xs.map(lit).join(', ')}]::text[]`

const papeisAtribuiveis = PAPEIS.filter(p => p.atribuivel).map(p => p.id)
const todosOsPapeis = PAPEIS.map(p => p.id)

const sql = `-- ${DESTINO}
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR).
--
-- ⚠ ESTE FICHEIRO E GERADO. Nao o edites a mao.
--   Muda lib/permissoes.ts e corre:
--     node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-sql-permissoes.mjs --escrever
--
-- ── O QUE ISTO FAZ ──────────────────────────────────────────────────────────
-- Substitui os onze papeis tecnicos em ingles (owner, admin, clinician,
-- pharmacist, nurse, assistant, accountant, viewer, student, caregiver, self)
-- por ${papeisAtribuiveis.length + 1} que fazem sentido num lar ou centro de dia, e liga o sistema
-- de permissoes finas que existia desde o sprint50 e nunca chegou a ser usado.
--
-- ── NINGUEM PERDE ACESSO ────────────────────────────────────────────────────
-- A conversao dos papeis antigos e generosa de proposito: em caso de duvida, o
-- papel novo da MAIS, nao menos. Tirar acesso a quem o tinha parte o trabalho
-- de uma casa a meio da manha, e isso e pior do que uma permissao a mais
-- durante uns dias.
--
-- A coluna \`capabilities\` (sobreposicao por pessoa) e LIMPA na conversao: quem
-- tivesse uma sobreposicao com as chaves antigas (\`pos.use\`, \`loyalty.write\`)
-- ficaria com permissoes que ja nao existem. Voltam as do papel, que e o
-- comportamento certo.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Os papeis novos ──────────────────────────────────────────────────────
-- As restricoes saem primeiro: sem isto, o update abaixo bate nelas.
--
-- Largam-se por DESCOBERTA e nao por nome. O Postgres nomeia uma restricao de
-- coluna como <tabela>_<coluna>_check, mas isso e convencao e nao garantia --
-- e se o nome nao bater certo, o \`drop if exists\` nao faz nada, a restricao
-- antiga fica, e as insercoes com os papeis novos passam a ser recusadas.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text as tabela, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in ('org_members'::regclass, 'org_invites'::regclass)
       and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table %s drop constraint %I', c.tabela, c.conname);
    raise notice '  restricao largada: %.%', c.tabela, c.conname;
  end loop;
end $$;

update org_members set role = case role
${Object.entries(PAPEL_ANTIGO_PARA_NOVO).map(([antigo, novo]) =>
  `  when ${lit(antigo)} then ${lit(novo)}`).join('\n')}
  else ${lit('convidado')}   -- um papel que nao conhecemos vira convidado: ve, nao mexe
end
where role not in (${todosOsPapeis.map(lit).join(', ')});

-- A restricao aceita os DOIS vocabularios de proposito, e e temporario.
--
-- Sem isto havia uma ordem obrigatoria entre publicar o codigo e correr esta
-- migracao, e a ordem errada partia a criacao de instituicoes: o codigo novo
-- escreve 'dono', uma restricao so com os nomes novos recusa 'owner', e uma so
-- com os antigos recusa 'dono'. Aceitando ambos, qualquer ordem serve.
--
-- Nada volta a escrever os nomes antigos depois desta migracao (ver a guarda
-- scripts/check-papeis.mjs). Quando estiver tudo assente, um sprint seguinte
-- aperta isto para so os sete.
alter table org_members add constraint org_members_role_check
  check (role in (${[...todosOsPapeis, ...Object.keys(PAPEL_ANTIGO_PARA_NOVO)].map(lit).join(', ')}));

-- As sobreposicoes antigas referiam chaves que deixaram de existir.
update org_members set capabilities = null;

-- A mesma conversao na tabela de convites.
update org_invites set role = case role
${Object.entries(PAPEL_ANTIGO_PARA_NOVO).filter(([a]) => a !== 'owner').map(([antigo, novo]) =>
  `  when ${lit(antigo)} then ${lit(novo)}`).join('\n')}
  else ${lit('convidado')}
end
where role not in (${papeisAtribuiveis.map(lit).join(', ')});
alter table org_invites add constraint org_invites_role_check
  check (role in (${[...papeisAtribuiveis, ...Object.keys(PAPEL_ANTIGO_PARA_NOVO)].map(lit).join(', ')}));


-- ── 2. O catalogo ───────────────────────────────────────────────────────────
-- Substitui o do sprint50, que falava de \`pos.use\` e \`loyalty.write\` --
-- farmacia, que saiu do produto.
--
-- ── A ORDEM AQUI NAO E ARBITRARIA ──────────────────────────────────────────
-- Largar a restricao -> APAGAR as linhas velhas -> inserir as novas -> so
-- entao voltar a restringir.
--
-- Qualquer outra ordem rebenta, e rebentou duas vezes:
--   1. Sem largar a restricao, o insert de 'ver' e recusado pela lista antiga
--      ('read'/'write'/'admin').
--   2. Largando a restricao mas criando a nova ANTES de apagar, o Postgres
--      valida-a contra as 47 linhas antigas que ainda la estao e recusa a
--      propria restricao: "is violated by some row". Um \`add constraint\` nao
--      olha so para o futuro -- confere o que ja esta na tabela.
--
-- A restricao entra em ultimo, quando a tabela so tem linhas que a cumprem.
-- Assim nao ha nenhum instante em que a tabela e a regra discordem.

-- A restricao sai por DESCOBERTA e nao por nome: o Postgres nomeia
-- <tabela>_<coluna>_check por convencao, nao por garantia.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where contype = 'c' and conrelid = 'capability_catalog'::regclass
       and pg_get_constraintdef(oid) ilike '%level%'
  loop
    execute format('alter table capability_catalog drop constraint %I', c.conname);
    raise notice '  restricao largada: capability_catalog.%', c.conname;
  end loop;
end $$;

-- As chaves antigas (\`patients.read\`, \`pos.use\`, \`loyalty.write\`) sao de um
-- produto que ja nao existe. Nada as referencia: \`key\` e chave primaria e nao
-- ha nenhuma tabela com chave estrangeira para ela (a \`user_capabilities\` do
-- sprint50 nunca chegou a ser criada nesta base de dados). Confirmado.
delete from capability_catalog;

insert into capability_catalog (key, category, label, description, level) values
${AREAS.flatMap(a => a.niveis.map(n => {
  const verbo = n === 'ver' ? 'Ver' : n === 'editar' ? 'Editar' : 'Eliminar'
  return `  (${lit(a.id + '.' + n)}, ${lit(a.grupo)}, ${lit(verbo + ' ' + a.label.toLowerCase())}, ${lit(a.descricao)}, ${lit(n)})`
})).join(',\n')}
on conflict (key) do update set
  category = excluded.category, label = excluded.label,
  description = excluded.description, level = excluded.level;

-- Agora sim: a tabela so tem os niveis novos, e a regra pode entrar.
alter table capability_catalog add constraint capability_catalog_level_check
  check (level in ('ver', 'editar', 'eliminar'));


-- ── 3. As permissoes de cada papel ──────────────────────────────────────────
-- O Dono e um caso a parte: tem tudo, sempre, mesmo que alguem lhe escreva
-- outra coisa na coluna. E a unica garantia de que ninguem fica fechado fora
-- da sua propria casa.
create or replace function default_capabilities(role text) returns text[]
language sql immutable as $$
  select case role
${PAPEIS.map(p => `    when ${lit(p.id)} then ${arr(p.id === 'dono' ? TODAS : p.omissao)}`).join('\n')}
    else array[]::text[]
  end;
$$;


-- ── 4. Uma politica que ficaria a apontar para o vazio ──────────────────────
-- O sprint51 criou uma politica em \`episodes\` que exige \`episodes.write\` --
-- uma chave que o catalogo novo ja nao tem, logo ninguem a teria e a tabela
-- ficaria fechada a toda a gente.
--
-- A tabela \`episodes\` nao e usada por nenhum ficheiro da aplicacao (a vista
-- \`current_open_episode\` que a le tambem nao). Fica fechada de proposito, que
-- e o lado seguro, e a politica passa a dizer porque -- para quem a encontrar
-- daqui a um ano nao pensar que e um bug.
comment on table episodes is
  'Sem uso na aplicacao desde 2026-09. A politica RLS exige a capacidade episodes.write, que saiu do catalogo no sprint152: na pratica a tabela esta fechada. Se voltar a ser precisa, dar-lhe uma area em lib/permissoes.ts.';


-- ── 5. Verificar antes de sair ──────────────────────────────────────────────
-- Corre isto a seguir. A primeira consulta diz quantas pessoas ficaram em cada
-- papel; a segunda deve devolver ZERO linhas (ninguem com um papel invalido).
--
--   select role, count(*) from org_members where active group by role order by 2 desc;
--
--   select id, user_id, role from org_members
--    where role not in (${todosOsPapeis.map(lit).join(', ')});
--
-- E no teu computador:
--   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-permissoes.mjs
`

if (process.argv.includes('--escrever')) {
  fs.writeFileSync(DESTINO, sql)
  console.log(`Escrito: ${DESTINO} (${sql.split('\n').length} linhas)`)
} else if (process.argv.includes('--verificar')) {
  let atual = ''
  try { atual = fs.readFileSync(DESTINO, 'utf8') } catch {
    console.log(`✗ ${DESTINO} nao existe. Corre com --escrever.`)
    process.exit(1)
  }
  if (atual.trim() === sql.trim()) {
    console.log('✓ O SQL das permissoes esta em sincronia com lib/permissoes.ts.')
    process.exit(0)
  }
  console.log(`✗ ${DESTINO} diverge de lib/permissoes.ts.`)
  console.log('  A interface e a base de dados discordam sobre quem ve o que.')
  console.log('  Corre com --escrever e aplica a migracao.')
  process.exit(1)
} else {
  console.log(sql)
}
