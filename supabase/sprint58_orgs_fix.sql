-- sprint58_orgs_fix.sql
-- Phlox — Correcções defensivas a `organizations`.
--
-- Causa: alguns esquemas em produção foram criados antes do sprint49 chegar
-- à versão actual. As colunas que o backend espera podem não existir e o
-- PostgREST devolve "Could not find the 'accent_color' column of
-- 'organizations' in the schema cache".
--
-- Esta migração:
--   1) Garante que todas as colunas esperadas existem (ALTER ADD IF NOT EXISTS)
--   2) Acrescenta colunas extra para acomodar o que vivia em `institution_settings`
--      (director, total_beds) — passamos a usar `organizations` como fonte única.
--   3) Pede ao PostgREST para recarregar o schema cache.
--
-- 2026-06-02.

do $$ begin
  -- Em caso de tabela inexistente apenas saímos: o sprint49 trata da criação.
  perform 1 from information_schema.tables where table_schema = 'public' and table_name = 'organizations';
  if not found then return; end if;

  -- Colunas do sprint49 — tornam o ALTER idempotente em DBs com versões antigas
  execute 'alter table organizations add column if not exists short_name    text';
  execute 'alter table organizations add column if not exists vat_number    text';
  execute 'alter table organizations add column if not exists logo_url      text';
  execute 'alter table organizations add column if not exists accent_color  text default ''#0d6e42''';
  execute 'alter table organizations add column if not exists address       text';
  execute 'alter table organizations add column if not exists postal_code   text';
  execute 'alter table organizations add column if not exists city          text';
  execute 'alter table organizations add column if not exists phone         text';
  execute 'alter table organizations add column if not exists email         text';
  execute 'alter table organizations add column if not exists metadata      jsonb default ''{}''::jsonb';
  execute 'alter table organizations add column if not exists active        boolean not null default true';
  execute 'alter table organizations add column if not exists created_at    timestamptz not null default now()';
  execute 'alter table organizations add column if not exists updated_at    timestamptz not null default now()';

  -- Colunas novas (absorvem o que era do antigo institution_settings)
  execute 'alter table organizations add column if not exists director       text';
  execute 'alter table organizations add column if not exists total_beds     int';
end $$;

-- Recarrega o cache de schema do PostgREST para que o cliente passe a ver
-- as novas colunas sem precisar de reiniciar nada manualmente.
notify pgrst, 'reload schema';
