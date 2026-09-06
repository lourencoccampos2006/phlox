-- sprint140_admin_flags.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- Duas marcas para as ações do /admin: uma conta bloqueada e uma instituição
-- suspensa. O bloqueio de sessão em si é feito no Supabase Auth (ban); estas
-- colunas são o espelho disso do lado da aplicação, para se poder ver o estado
-- numa lista sem interrogar a API de autenticação a cada linha.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles      add column if not exists blocked   boolean not null default false;
alter table organizations add column if not exists suspended boolean not null default false;

create index if not exists profiles_blocked_idx on profiles (blocked) where blocked;

notify pgrst, 'reload schema';
