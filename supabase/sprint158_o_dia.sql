-- supabase/sprint158_o_dia.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint157. O sprint153 fica sempre para o fim.
--
-- ── UMA TABELA SÓ ───────────────────────────────────────────────────────────
-- «O Dia» junta num ecrã o que hoje está espalhado por seis: a medicação, as
-- atividades, os serviços de apoio, a preparação do pastilheiro, as refeições
-- e as ações do Plano Individual.
--
-- Cinco dessas seis JÁ TÊM onde guardar o que foi feito: `mar_records`,
-- `activity_participations`, `support_services`, `medication_prep_logs`,
-- `care_records`. «O Dia» escreve nessas tabelas, as mesmas de sempre — quem
-- marcar uma toma no Dia e depois abrir o /mar vê lá a marca, porque é a mesma
-- linha.
--
-- Isso é deliberado e é a parte importante: uma vista que guardasse as coisas
-- à parte seria uma segunda verdade sobre o mesmo dia, e ao fim de uma semana
-- ninguém sabia qual das duas valia.
--
-- A sexta — as ações do Plano (sprint157) — é a única que não tem onde. É esta
-- tabela.
--
-- ── PORQUE É QUE NÃO GUARDA «NÃO FEITO» ─────────────────────────────────────
-- Só se escreve aqui o que FOI feito. O que não foi, e porquê, já tem a sua
-- tabela desde o sprint154 (`cuidados_nao_prestados`), e é a mesma para o
-- produto todo — é isso que permite perguntar «o que é que esta pessoa tem
-- recusado?» e receber uma resposta que atravessa as áreas.
--
-- Duas tabelas a guardar recusas seria a mesma pergunta com duas respostas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists plano_execucoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,

  acao_id     uuid not null references plano_acoes(id) on delete cascade,
  -- Guardado também aqui, e não só através da ação, porque a pergunta mais
  -- feita é «o que se fez hoje a esta pessoa» — e essa não devia precisar de
  -- passar por três tabelas para ser respondida.
  patient_id  uuid not null references patients(id) on delete cascade,

  data        date not null default current_date,
  turno       text check (turno is null or turno in ('manha', 'tarde', 'noite')),

  feito_por   text,
  feito_em    timestamptz not null default now(),
  nota        text,

  recorded_by_id uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Uma marca por ação, por dia e por turno. Sem isto, dois toques seguidos
-- (ou duas pessoas ao mesmo tempo, que é o que acontece numa manhã) deixavam
-- duas linhas, e a contagem do dia passava a dizer que se fez a mesma coisa
-- duas vezes.
--
-- `coalesce(turno, '-')` porque em Postgres NULL nunca é igual a NULL: sem
-- isso, uma ação sem turno definido nunca colidia consigo própria e o índice
-- único não protegia nada.
create unique index if not exists plano_exec_uma_por_turno
  on plano_execucoes (acao_id, data, coalesce(turno, '-'));

create index if not exists plano_exec_pt_idx on plano_execucoes (patient_id, data desc);
create index if not exists plano_exec_org_dia_idx on plano_execucoes (org_id, data)
  where org_id is not null;


-- ── RLS: o padrão das outras tabelas da casa ────────────────────────────────
alter table plano_execucoes enable row level security;

do $$ begin
  create policy "plano_exec_proprio" on plano_execucoes for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "plano_exec_casa" on plano_execucoes for all
    using (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true))
    with check (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true));
exception when duplicate_object then null; end $$;

revoke select on plano_execucoes from anon;

do $$ begin
  alter publication supabase_realtime add table plano_execucoes;
exception when others then null; end $$;


-- ── DUAS RESTRIÇÕES QUE FALTAVAM DESDE SEMPRE ──────────────────────────────
-- Nem `activity_participations` nem `mar_records` tinham restrição única.
-- Cada uma delas é um bug latente que já existia antes deste ecrã:
--
--   • duas pessoas a marcar a mesma presença ao mesmo tempo (o que acontece
--     numa manhã) deixavam DUAS linhas para a mesma pessoa na mesma atividade;
--   • dois toques seguidos no /mar deixavam duas administrações da mesma dose,
--     e o mapa de medicação passava a dizer que se deu o dobro.
--
-- O /activities e o /mar defendem-se procurando primeiro se já existe — o que
-- resolve o toque repetido de uma pessoa e não resolve duas pessoas ao mesmo
-- tempo. A defesa a sério é a base de dados.
--
-- Contei antes de escrever isto: 14 linhas em activity_participations e 60 em
-- mar_records, ZERO repetições em ambas. Estas restrições entram sem recusar
-- nada.
--
-- E é isto que permite ao «O Dia» usar `upsert` com `on conflict`: sem uma
-- restrição única, o Postgres recusa a própria instrução (42P10).
do $$ begin
  create unique index if not exists activity_part_uma_por_pessoa
    on activity_participations (activity_id, patient_id);
exception when unique_violation then
  raise notice 'ATENCAO: ha participacoes repetidas. Limpa-as antes de correr isto outra vez.';
end $$;

do $$ begin
  create unique index if not exists mar_uma_por_toma
    on mar_records (patient_id, med_id, date, shift);
exception when unique_violation then
  raise notice 'ATENCAO: ha administracoes repetidas. Limpa-as antes de correr isto outra vez.';
end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select count(*) from plano_execucoes;   -- 0, sem erro
--
-- E que as duas restricoes novas entraram mesmo:
-- select indexname from pg_indexes
--  where indexname in ('activity_part_uma_por_pessoa', 'mar_uma_por_toma');  -- 2 linhas
--
-- E no teu computador:
--   node scripts/check-migracoes.mjs
