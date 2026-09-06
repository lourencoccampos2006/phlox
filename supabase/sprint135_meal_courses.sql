-- sprint135_meal_courses.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO NO SUPABASE (SQL EDITOR).
--
-- Uma refeição de verdade tem mais do que um prato: sopa de entrada, prato
-- principal, sobremesa. O sprint127 guardava UM prato por (dia × refeição) —
-- por isso não havia forma de pôr "sopa de legumes" e "bacalhau com natas" no
-- mesmo almoço, que é como as ementas reais são escritas.
--
-- Acrescenta a coluna `course` (o momento dentro da refeição) e passa a chave
-- única a incluí-la. O valor por omissão é 'prato', por isso tudo o que já lá
-- está continua a ser o prato principal e nada se perde.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table meal_plan_entries add column if not exists course text not null default 'prato';
do $$ begin
  alter table meal_plan_entries add constraint meal_plan_entries_course_check
    check (course in ('sopa', 'prato', 'sobremesa'));
exception when duplicate_object or duplicate_table then null; end $$;

-- A chave única antiga (sem o momento) impedia dois pratos no mesmo almoço.
do $$ begin
  alter table meal_plan_entries drop constraint meal_plan_entries_org_id_user_id_date_meal_type_key;
exception when undefined_object then null; end $$;
do $$ begin
  alter table meal_plan_entries add constraint meal_plan_entries_slot_unique
    unique (org_id, user_id, date, meal_type, course);
exception when duplicate_object or duplicate_table then null; end $$;

-- Um prato da biblioteca também sabe em que momento costuma entrar, para a IA
-- e a equipa não terem de adivinhar se "Caldo verde" é sopa ou prato.
alter table meal_dishes add column if not exists course text;
do $$ begin
  alter table meal_dishes add constraint meal_dishes_course_check
    check (course is null or course in ('sopa', 'prato', 'sobremesa'));
exception when duplicate_object or duplicate_table then null; end $$;

notify pgrst, 'reload schema';
