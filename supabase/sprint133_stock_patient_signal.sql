-- sprint133_stock_patient_signal.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — não toco no Supabase sem pedires (ver memória do projeto).
--
-- Módulo 11 (2026-08-19) — "stock de fraldas/pensos como sinal clínico".
--
-- O bloqueio era estrutural: stock_consumption regista item_id, qty e QUEM
-- registou (by_name), mas nunca PARA QUEM. Sem isso é literalmente impossível
-- saber que a Dona Maria passou de 4 para 9 fraldas por dia — a variação
-- dilui-se no total da instituição. Esta migração é o que destranca o módulo.
--
-- patient_id é NULLABLE de propósito: muito consumo não é atribuível a
-- ninguém (luvas, material de limpeza, uso geral) e a equipa nunca pode ficar
-- bloqueada a registar. O "Usar 1" continua a funcionar sem escolher pessoa.
-- ─────────────────────────────────────────────────────────────────────────────

alter table stock_consumption
  add column if not exists patient_id uuid references patients(id) on delete set null;

-- Índice para a leitura que o motor de sinais faz: consumo de um utente ao
-- longo do tempo (baseline vs. recente).
create index if not exists sc_patient_idx
  on stock_consumption (patient_id, created_at desc)
  where patient_id is not null;

notify pgrst, 'reload schema';
