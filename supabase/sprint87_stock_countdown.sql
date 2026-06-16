-- sprint87_stock_countdown.sql
-- Stock de medicamentos que CONTA os dias a passar.
-- Bug reportado: o badge "📦 Nd" ficava sempre no mesmo número — não descontava
-- os dias decorridos. Passa a guardar QUANDO o stock foi posto (stock_updated_at)
-- para o frontend projetar os comprimidos restantes ao longo do tempo.
-- A app já degrada com elegância se esta coluna faltar (tenta gravar sem ela),
-- mas correr isto deixa o controlo de stock 100% funcional.

do $$ begin
  alter table personal_meds add column if not exists stock_updated_at timestamptz;
exception when undefined_table then null; end $$;

do $$ begin
  alter table family_profile_meds add column if not exists stock_updated_at timestamptz;
exception when undefined_table then null; end $$;

-- Para o stock já existente, assume que foi posto na criação do registo
-- (melhor aproximação retroativa do que deixar a null).
do $$ begin
  update personal_meds set stock_updated_at = created_at
    where pills_remaining is not null and stock_updated_at is null;
exception when undefined_table or undefined_column then null; end $$;

do $$ begin
  update family_profile_meds set stock_updated_at = created_at
    where pills_remaining is not null and stock_updated_at is null;
exception when undefined_table or undefined_column then null; end $$;
