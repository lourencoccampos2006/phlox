-- sprint145_preferencias_notificacoes.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR).
--
-- Uma coluna só: o que cada pessoa escolheu receber.
--
-- Guarda-se como jsonb com as chaves do catálogo (lib/notificacoes.ts), e só as
-- que a pessoa MEXEU:
--
--     { "stock": false, "avaliacoes": true }
--
-- O que não está lá usa a omissão do catálogo. Isso é de propósito: quando se
-- acrescenta um tipo novo, quem nunca mexeu nas definições passa a recebê-lo
-- sem ter de ir lá ligar — e quem desligou uma coisa continua com ela
-- desligada. Guardar o mapa inteiro congelava as escolhas no dia em que foram
-- feitas.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column profiles.notification_prefs is
  'Só as escolhas explícitas. Chave em falta = usar a omissão de lib/notificacoes.ts.';

-- Nota sobre segurança: a coluna vive em `profiles`, que já tem RLS com
-- granularidade de coluna desde a ronda de 2026-07-28 (qualquer conta podia
-- auto-atribuir `plan`/`org_id` por chamada direta). Confirmar que a política
-- de UPDATE do próprio perfil inclui esta coluna nova — sem isso, o interruptor
-- roda no ecrã e não grava nada.
do $$
begin
  if exists (select 1 from pg_policies where tablename = 'profiles' and cmd = 'UPDATE') then
    raise notice 'profiles já tem política de UPDATE — confirma que notification_prefs é gravável pelo próprio.';
  end if;
end $$;
