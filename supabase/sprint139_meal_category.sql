-- sprint139_meal_category.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- Uma categoria por prato — carne, peixe, vegetariano, sopa, doce, fruta. Serve
-- para a biblioteca deixar de ser uma lista alfabética de cem nomes: filtra-se
-- e procura-se por aquilo que se está mesmo a pensar ("hoje quero peixe").
--
-- A IA passa a preenchê-la nos pratos que propõe, por isso a biblioteca
-- arruma-se sozinha à medida que cresce.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table meal_dishes add column if not exists category text;
do $$ begin
  alter table meal_dishes add constraint meal_dishes_category_check
    check (category is null or category in ('carne','peixe','vegetariano','sopa','doce','fruta','outro'));
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists meal_dishes_category_idx on meal_dishes (category);

notify pgrst, 'reload schema';
