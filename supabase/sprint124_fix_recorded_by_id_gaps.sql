-- sprint124_fix_recorded_by_id_gaps.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: PRECISAS DE CORRER ISTO TU MESMO NO SUPABASE (SQL EDITOR).
-- Não apliquei — a partir de 2026-08-06 não toco no Supabase sem pedires.
--
-- CAUSA RAIZ dos 3 erros "Não foi possível guardar agora" que reportaste
-- (Atividades recorrentes, marcar Cuidados como feito, pedidos em
-- Apoio-serviços) — TODOS o MESMO bug, não três bugs diferentes:
--
-- lib/orgScope.ts `scope.stamp()` acrescenta SEMPRE `recorded_by_id` a
-- qualquer escrita, mas SÓ quando a conta pertence a uma organização
-- (`if (orgId) { ... out.recorded_by_id = userId }`). A tua conta tem
-- organização (és owner); as minhas contas de teste esta noite não tinham
-- (testei em modo individual) — por isso nunca vi este erro, só apareceu
-- contigo.
--
-- Auditei TODOS os 48 sítios do site que usam scope.stamp() (28 ficheiros)
-- contra o esquema ao vivo. Destes, só 3 tabelas não têm a coluna
-- `recorded_by_id` que o código tenta sempre escrever — PostgREST rejeita o
-- pedido inteiro (coluna não existe no cache do esquema), por isso a
-- gravação falha SEMPRE para qualquer conta com organização, mesmo com todos
-- os campos certos preenchidos.
--
-- IMPORTANTE: `recurring_activities` é de 2026-07-15 (sprint108), NÃO desta
-- sessão — as atividades recorrentes provavelmente NUNCA funcionaram para
-- nenhuma conta institucional real até agora, só parecia funcionar em testes
-- sem organização.
-- ─────────────────────────────────────────────────────────────────────────────

alter table recurring_activities add column if not exists recorded_by_id uuid references auth.users(id);
alter table care_checklist_logs add column if not exists recorded_by_id uuid references auth.users(id);
alter table support_services add column if not exists recorded_by_id uuid references auth.users(id);

notify pgrst, 'reload schema';
