-- sprint137_activity_log.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- O livro de registos de cada instituição: quem fez o quê, sobre quem, quando.
--
-- ── A FRONTEIRA, QUE É O MAIS IMPORTANTE DESTE FICHEIRO ────────────────────
-- Este livro é PRIVADO DA INSTITUIÇÃO. A RLS abaixo só deixa ler quem é membro
-- ativo da organização a que o registo pertence. Nem o dono do Phlox tem nada
-- que ver aqui: são dados de cuidado de pessoas concretas, e o Phlox é o
-- fornecedor do software, não uma parte no cuidado delas.
--
-- A chave de serviço contorna sempre a RLS — é assim que o Postgres funciona.
-- Por isso a garantia é também de arquitetura: NENHUMA rota de /api/admin
-- consulta esta tabela, e nenhuma alguma vez deve. Se um dia alguém precisar
-- de números para faturação ou suporte, o que se tira daqui é uma CONTAGEM
-- agregada por organização, nunca uma linha. Está escrito assim de propósito,
-- para o próximo que passar por aqui não desfazer isto sem perceber.
--
-- `subject_name` e `actor_name` ficam desnormalizados de propósito: um livro de
-- registos tem de continuar legível depois de a pessoa ou o funcionário serem
-- apagados. É o que o torna um registo e não um relatório.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists activity_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,   -- quem fez
  actor_name   text,                                                 -- nome à data do registo
  action       text not null,        -- 'presenca.chegada', 'roupa.tratada', 'tarefa.concluida'…
  entity       text,                 -- 'patient' | 'task' | 'service' | 'meal' | 'med'…
  entity_id    uuid,
  subject_id   uuid,                 -- sobre quem (normalmente um patient)
  subject_name text,                 -- nome à data do registo
  summary      text not null,        -- a frase que se lê no histórico, em português
  meta         jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_org_idx     on activity_log (org_id, created_at desc);
create index if not exists activity_log_subject_idx on activity_log (subject_id, created_at desc);
create index if not exists activity_log_user_idx    on activity_log (user_id, created_at desc);
create index if not exists activity_log_action_idx  on activity_log (org_id, action, created_at desc);

alter table activity_log enable row level security;

-- Conta individual (sem organização): vê o seu próprio livro.
do $$ begin
  create policy "activity_log_own" on activity_log for all
    using (org_id is null and user_id = auth.uid())
    with check (org_id is null and user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Instituição: qualquer membro ativo lê o livro da SUA casa, e só dela.
do $$ begin
  create policy "activity_log_org_read" on activity_log for select
    using (org_id is not null and org_id in (
      select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "activity_log_org_write" on activity_log for insert
    with check (org_id is not null and org_id in (
      select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

-- Um livro de registos que se pode editar não é um livro de registos.
-- Sem política de UPDATE nem de DELETE: ninguém reescreve o passado.

notify pgrst, 'reload schema';
