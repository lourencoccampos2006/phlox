-- sprint142_med_stock.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- Quantas unidades restam de cada medicamento, para avisar ANTES de acabar.
--
-- É a queixa mais comum de quem toma medicação crónica: dar por si ao domingo
-- à noite com a caixa vazia e a farmácia fechada. O Phlox já sabe quantas
-- doses são precisas por dia — só lhe faltava saber quantas restam.
--
-- `units_left` desce sozinho a cada toma marcada; `units_per_dose` é quase
-- sempre 1 (um comprimido), mas há quem tome meio ou dois.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table personal_meds add column if not exists units_left      numeric;
alter table personal_meds add column if not exists units_per_dose  numeric not null default 1;
alter table personal_meds add column if not exists low_notified_at date;

notify pgrst, 'reload schema';
