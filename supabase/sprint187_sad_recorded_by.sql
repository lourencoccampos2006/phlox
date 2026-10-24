-- sprint187_sad_recorded_by.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- AS TRÊS TABELAS DO APOIO DOMICILIÁRIO FICARAM SEM `recorded_by_id`.
--
-- ── O QUE ACONTECE SEM ISTO ────────────────────────────────────────────────
-- O `scope.stamp()` acrescenta SEMPRE `recorded_by_id` às escritas de uma
-- conta com organização. Sem a coluna, o PostgREST recusa o pedido inteiro:
--
--     400  PGRST204
--     Could not find the 'recorded_by_id' column of 'sad_planos'
--
-- Ou seja: o módulo inteiro do apoio domiciliário não grava NADA. Nem um
-- plano, nem um serviço, nem uma visita. E falha só para contas
-- institucionais — que são as únicas que o usam.
--
-- ── PORQUE É QUE A GUARDA NÃO APANHOU ──────────────────────────────────────
-- Esta é a terceira vez que este bug aparece (sprint124, depois o
-- `medication_prep_logs`), e existe um guarda — o `scripts/check-stamp.mjs` —
-- escrito exactamente para o impedir. Ele passou a verde.
--
-- A razão: o sprint169 acrescentou `recorded_by_id` a TODAS as tabelas que
-- tinham `org_id`, por um ciclo que não nomeia nenhuma. Nenhuma expressão
-- regular vê isso, e por isso o guarda passou a aceitar esse ciclo como prova
-- para qualquer tabela com `org_id`.
--
-- Só que o sprint169 **já correu**. Um ciclo em massa que correu no passado é
-- uma FOTOGRAFIA, não uma regra: não toca nas tabelas criadas depois dele. O
-- `sad_planos` nasceu no sprint183, catorze migrações mais tarde.
--
-- O guarda foi corrigido na mesma sessão: uma tabela criada numa migração com
-- número MAIOR do que o do ciclo tem de declarar a coluna ela própria.
--
-- ── E PORQUE É QUE O sprint186 NÃO TEM O MESMO PROBLEMA ────────────────────
-- Porque nesse escrevi a coluna à mão nas três tabelas. A inconsistência era
-- minha, de uma migração para a outra, e é precisamente o que um guarda existe
-- para apanhar.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

alter table public.sad_planos
  add column if not exists recorded_by_id uuid references auth.users(id) on delete set null;

alter table public.sad_servicos
  add column if not exists recorded_by_id uuid references auth.users(id) on delete set null;

alter table public.sad_visitas
  add column if not exists recorded_by_id uuid references auth.users(id) on delete set null;

-- ── Verificar ───────────────────────────────────────────────────────────────
-- Deve devolver três linhas:
--   select table_name from information_schema.columns
--    where table_schema = 'public' and column_name = 'recorded_by_id'
--      and table_name like 'sad_%';

notify pgrst, 'reload schema';
