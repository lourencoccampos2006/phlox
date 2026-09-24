-- supabase/sprint152_permissoes.sql
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
-- por 7 que fazem sentido num lar ou centro de dia, e liga o sistema
-- de permissoes finas que existia desde o sprint50 e nunca chegou a ser usado.
--
-- ── NINGUEM PERDE ACESSO ────────────────────────────────────────────────────
-- A conversao dos papeis antigos e generosa de proposito: em caso de duvida, o
-- papel novo da MAIS, nao menos. Tirar acesso a quem o tinha parte o trabalho
-- de uma casa a meio da manha, e isso e pior do que uma permissao a mais
-- durante uns dias.
--
-- A coluna `capabilities` (sobreposicao por pessoa) e LIMPA na conversao: quem
-- tivesse uma sobreposicao com as chaves antigas (`pos.use`, `loyalty.write`)
-- ficaria com permissoes que ja nao existem. Voltam as do papel, que e o
-- comportamento certo.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Os papeis novos ──────────────────────────────────────────────────────
-- As restricoes saem primeiro: sem isto, o update abaixo bate nelas.
--
-- Largam-se por DESCOBERTA e nao por nome. O Postgres nomeia uma restricao de
-- coluna como <tabela>_<coluna>_check, mas isso e convencao e nao garantia --
-- e se o nome nao bater certo, o `drop if exists` nao faz nada, a restricao
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
  when 'owner' then 'dono'
  when 'admin' then 'direcao'
  when 'clinician' then 'enfermagem'
  when 'nurse' then 'enfermagem'
  when 'pharmacist' then 'enfermagem'
  when 'assistant' then 'auxiliar'
  when 'caregiver' then 'auxiliar'
  when 'accountant' then 'administrativo'
  when 'student' then 'convidado'
  when 'viewer' then 'convidado'
  when 'self' then 'convidado'
  else 'convidado'   -- um papel que nao conhecemos vira convidado: ve, nao mexe
end
where role not in ('dono', 'direcao', 'enfermagem', 'auxiliar', 'animacao', 'administrativo', 'convidado');

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
  check (role in ('dono', 'direcao', 'enfermagem', 'auxiliar', 'animacao', 'administrativo', 'convidado', 'owner', 'admin', 'clinician', 'nurse', 'pharmacist', 'assistant', 'caregiver', 'accountant', 'student', 'viewer', 'self'));

-- As sobreposicoes antigas referiam chaves que deixaram de existir.
update org_members set capabilities = null;

-- A mesma conversao na tabela de convites.
update org_invites set role = case role
  when 'admin' then 'direcao'
  when 'clinician' then 'enfermagem'
  when 'nurse' then 'enfermagem'
  when 'pharmacist' then 'enfermagem'
  when 'assistant' then 'auxiliar'
  when 'caregiver' then 'auxiliar'
  when 'accountant' then 'administrativo'
  when 'student' then 'convidado'
  when 'viewer' then 'convidado'
  when 'self' then 'convidado'
  else 'convidado'
end
where role not in ('direcao', 'enfermagem', 'auxiliar', 'animacao', 'administrativo', 'convidado');
alter table org_invites add constraint org_invites_role_check
  check (role in ('direcao', 'enfermagem', 'auxiliar', 'animacao', 'administrativo', 'convidado', 'owner', 'admin', 'clinician', 'nurse', 'pharmacist', 'assistant', 'caregiver', 'accountant', 'student', 'viewer', 'self'));


-- ── 2. O catalogo ───────────────────────────────────────────────────────────
-- Substitui o do sprint50, que falava de `pos.use` e `loyalty.write` --
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
--      propria restricao: "is violated by some row". Um `add constraint` nao
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

-- As chaves antigas (`patients.read`, `pos.use`, `loyalty.write`) sao de um
-- produto que ja nao existe. Nada as referencia: `key` e chave primaria e nao
-- ha nenhuma tabela com chave estrangeira para ela (a `user_capabilities` do
-- sprint50 nunca chegou a ser criada nesta base de dados). Confirmado.
delete from capability_catalog;

insert into capability_catalog (key, category, label, description, level) values
  ('utentes.ver', 'cuidado', 'Ver utentes', 'As fichas das pessoas: dados, contactos, história de vida.', 'ver'),
  ('utentes.editar', 'cuidado', 'Editar utentes', 'As fichas das pessoas: dados, contactos, história de vida.', 'editar'),
  ('utentes.eliminar', 'cuidado', 'Eliminar utentes', 'As fichas das pessoas: dados, contactos, história de vida.', 'eliminar'),
  ('medicacao.ver', 'cuidado', 'Ver medicação', 'A medicação de cada pessoa, as tomas do turno e a preparação do pastilheiro.', 'ver'),
  ('medicacao.editar', 'cuidado', 'Editar medicação', 'A medicação de cada pessoa, as tomas do turno e a preparação do pastilheiro.', 'editar'),
  ('medicacao.eliminar', 'cuidado', 'Eliminar medicação', 'A medicação de cada pessoa, as tomas do turno e a preparação do pastilheiro.', 'eliminar'),
  ('registos.ver', 'cuidado', 'Ver registos do dia', 'Presenças, refeições, cuidados prestados e rondas.', 'ver'),
  ('registos.editar', 'cuidado', 'Editar registos do dia', 'Presenças, refeições, cuidados prestados e rondas.', 'editar'),
  ('registos.eliminar', 'cuidado', 'Eliminar registos do dia', 'Presenças, refeições, cuidados prestados e rondas.', 'eliminar'),
  ('ocorrencias.ver', 'cuidado', 'Ver ocorrências', 'Quedas, recusas e outros eventos, com o seu seguimento.', 'ver'),
  ('ocorrencias.editar', 'cuidado', 'Editar ocorrências', 'Quedas, recusas e outros eventos, com o seu seguimento.', 'editar'),
  ('ocorrencias.eliminar', 'cuidado', 'Eliminar ocorrências', 'Quedas, recusas e outros eventos, com o seu seguimento.', 'eliminar'),
  ('avaliacoes.ver', 'cuidado', 'Ver avaliações', 'Escalas (Barthel, Braden, Morse…) e a autonomia ao longo do tempo.', 'ver'),
  ('avaliacoes.editar', 'cuidado', 'Editar avaliações', 'Escalas (Barthel, Braden, Morse…) e a autonomia ao longo do tempo.', 'editar'),
  ('avaliacoes.eliminar', 'cuidado', 'Eliminar avaliações', 'Escalas (Barthel, Braden, Morse…) e a autonomia ao longo do tempo.', 'eliminar'),
  ('feridas.ver', 'cuidado', 'Ver feridas', 'Acompanhamento de feridas e pensos, com fotografia.', 'ver'),
  ('feridas.editar', 'cuidado', 'Editar feridas', 'Acompanhamento de feridas e pensos, com fotografia.', 'editar'),
  ('feridas.eliminar', 'cuidado', 'Eliminar feridas', 'Acompanhamento de feridas e pensos, com fotografia.', 'eliminar'),
  ('atividades.ver', 'pessoas', 'Ver atividades', 'O plano de atividades e quem participou.', 'ver'),
  ('atividades.editar', 'pessoas', 'Editar atividades', 'O plano de atividades e quem participou.', 'editar'),
  ('atividades.eliminar', 'pessoas', 'Eliminar atividades', 'O plano de atividades e quem participou.', 'eliminar'),
  ('familias.ver', 'pessoas', 'Ver famílias', 'O fio de conversa com as famílias e o que elas veem.', 'ver'),
  ('familias.editar', 'pessoas', 'Editar famílias', 'O fio de conversa com as famílias e o que elas veem.', 'editar'),
  ('equipa.ver', 'pessoas', 'Ver equipa', 'Escalas, turnos, mural de recados e carga de trabalho.', 'ver'),
  ('equipa.editar', 'pessoas', 'Editar equipa', 'Escalas, turnos, mural de recados e carga de trabalho.', 'editar'),
  ('equipa.eliminar', 'pessoas', 'Eliminar equipa', 'Escalas, turnos, mural de recados e carga de trabalho.', 'eliminar'),
  ('stock.ver', 'casa', 'Ver stock e validades', 'Existências, lotes, prazos e ruturas.', 'ver'),
  ('stock.editar', 'casa', 'Editar stock e validades', 'Existências, lotes, prazos e ruturas.', 'editar'),
  ('stock.eliminar', 'casa', 'Eliminar stock e validades', 'Existências, lotes, prazos e ruturas.', 'eliminar'),
  ('documentos.ver', 'casa', 'Ver documentos', 'O cofre de documentos da instituição.', 'ver'),
  ('documentos.editar', 'casa', 'Editar documentos', 'O cofre de documentos da instituição.', 'editar'),
  ('documentos.eliminar', 'casa', 'Eliminar documentos', 'O cofre de documentos da instituição.', 'eliminar'),
  ('qualidade.ver', 'casa', 'Ver qualidade', 'Indicadores do serviço e o que merece atenção.', 'ver'),
  ('financeiro.ver', 'gestao', 'Ver financeiro', 'Mensalidades, comparticipações, recibos e o negócio da casa.', 'ver'),
  ('financeiro.editar', 'gestao', 'Editar financeiro', 'Mensalidades, comparticipações, recibos e o negócio da casa.', 'editar'),
  ('financeiro.eliminar', 'gestao', 'Eliminar financeiro', 'Mensalidades, comparticipações, recibos e o negócio da casa.', 'eliminar'),
  ('registo_atividade.ver', 'gestao', 'Ver registo de atividade', 'Quem fez o quê, sobre quem e quando. Enche-se sozinho e é privado da instituição.', 'ver'),
  ('definicoes.editar', 'gestao', 'Editar definições da casa', 'Nome, tipo de resposta social e configuração da instituição.', 'editar'),
  ('permissoes.editar', 'gestao', 'Editar dar e tirar acessos', 'Criar contas da equipa e decidir o que cada pessoa vê e faz.', 'editar')
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
    when 'dono' then array['utentes.ver', 'utentes.editar', 'utentes.eliminar', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar', 'registos.ver', 'registos.editar', 'registos.eliminar', 'ocorrencias.ver', 'ocorrencias.editar', 'ocorrencias.eliminar', 'avaliacoes.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'feridas.ver', 'feridas.editar', 'feridas.eliminar', 'atividades.ver', 'atividades.editar', 'atividades.eliminar', 'familias.ver', 'familias.editar', 'equipa.ver', 'equipa.editar', 'equipa.eliminar', 'stock.ver', 'stock.editar', 'stock.eliminar', 'documentos.ver', 'documentos.editar', 'documentos.eliminar', 'qualidade.ver', 'financeiro.ver', 'financeiro.editar', 'financeiro.eliminar', 'registo_atividade.ver', 'definicoes.editar', 'permissoes.editar']::text[]
    when 'direcao' then array['utentes.ver', 'utentes.editar', 'utentes.eliminar', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar', 'registos.ver', 'registos.editar', 'registos.eliminar', 'ocorrencias.ver', 'ocorrencias.editar', 'ocorrencias.eliminar', 'avaliacoes.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'feridas.ver', 'feridas.editar', 'feridas.eliminar', 'atividades.ver', 'atividades.editar', 'atividades.eliminar', 'familias.ver', 'familias.editar', 'equipa.ver', 'equipa.editar', 'equipa.eliminar', 'stock.ver', 'stock.editar', 'stock.eliminar', 'documentos.ver', 'documentos.editar', 'documentos.eliminar', 'qualidade.ver', 'financeiro.ver', 'financeiro.editar', 'financeiro.eliminar', 'registo_atividade.ver', 'definicoes.editar', 'permissoes.editar']::text[]
    when 'enfermagem' then array['utentes.ver', 'utentes.editar', 'medicacao.ver', 'medicacao.editar', 'medicacao.eliminar', 'registos.ver', 'registos.editar', 'ocorrencias.ver', 'ocorrencias.editar', 'avaliacoes.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'feridas.ver', 'feridas.editar', 'feridas.eliminar', 'familias.ver', 'familias.editar', 'stock.ver', 'stock.editar', 'atividades.ver', 'equipa.ver', 'documentos.ver', 'qualidade.ver', 'registo_atividade.ver']::text[]
    when 'auxiliar' then array['utentes.ver', 'medicacao.ver', 'medicacao.editar', 'registos.ver', 'registos.editar', 'ocorrencias.ver', 'ocorrencias.editar', 'atividades.ver', 'atividades.editar', 'avaliacoes.ver', 'feridas.ver', 'familias.ver', 'equipa.ver', 'stock.ver']::text[]
    when 'animacao' then array['utentes.ver', 'atividades.ver', 'atividades.editar', 'atividades.eliminar', 'familias.ver', 'familias.editar', 'registos.ver', 'equipa.ver']::text[]
    when 'administrativo' then array['utentes.ver', 'utentes.editar', 'financeiro.ver', 'financeiro.editar', 'documentos.ver', 'documentos.editar', 'documentos.eliminar', 'stock.ver', 'stock.editar', 'equipa.ver', 'qualidade.ver']::text[]
    when 'convidado' then array['utentes.ver', 'medicacao.ver', 'registos.ver', 'ocorrencias.ver', 'avaliacoes.ver', 'feridas.ver', 'atividades.ver', 'familias.ver', 'equipa.ver', 'stock.ver', 'documentos.ver', 'qualidade.ver']::text[]
    else array[]::text[]
  end;
$$;


-- ── 4. Uma politica que ficaria a apontar para o vazio ──────────────────────
-- O sprint51 criou uma politica em `episodes` que exige `episodes.write` --
-- uma chave que o catalogo novo ja nao tem, logo ninguem a teria e a tabela
-- ficaria fechada a toda a gente.
--
-- A tabela `episodes` nao e usada por nenhum ficheiro da aplicacao (a vista
-- `current_open_episode` que a le tambem nao). Fica fechada de proposito, que
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
--    where role not in ('dono', 'direcao', 'enfermagem', 'auxiliar', 'animacao', 'administrativo', 'convidado');
--
-- E no teu computador:
--   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-permissoes.mjs
