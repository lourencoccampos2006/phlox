-- sprint93_org_public.sql
-- Página pública por instituição (/c/<slug>) — prova social + SEO + angariação.
-- O slug é o endereço amigável; public=true autoriza a mostrar a página.

alter table organizations
  add column if not exists slug text unique,
  add column if not exists public boolean not null default false,
  add column if not exists tagline text,
  add column if not exists about text,
  -- gestão de negócio (painel do dono)
  add column if not exists capacity int,           -- lotação máxima de utentes
  add column if not exists monthly_fee numeric;    -- mensalidade por utente (estimativa de receita)

create index if not exists organizations_slug_idx on organizations (slug) where slug is not null;

-- Leitura pública das organizações marcadas public (só colunas não sensíveis são
-- lidas pela página, via service-role no servidor; esta policy permite anon SELECT
-- caso se queira ler do cliente).
do $$ begin
  create policy "orgs_public_read" on organizations for select
    using (public = true);
exception when duplicate_object then null; end $$;
