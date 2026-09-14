-- sprint144_relogio.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR). Substitui as DUAS marcas
-- <<<COLA_AQUI_O_CRON_SECRET>>> pelo valor real antes de correr.
--
-- ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
-- O relógio das notificações era o GitHub Actions, agendado de 15 em 15
-- minutos. O workflow estava ativo e todas as execuções verdes — mas o GitHub
-- ATRASA e DESCARTA execuções agendadas quando os runners estão com carga.
-- Está documentado por eles, e via-se nos números do Phlox: a 12 e 13 de
-- setembro de 2026 correu OITO vezes em vinte horas, em vez de oitenta.
--
--   05:02 · 00:22 · 22:43 · 20:56 · 18:31 · 16:16 · 13:07 · 09:35
--
-- Um lembrete das 09:00 precisa de uma passagem perto das 09:00. Com passagens
-- de duas em duas horas, quase nenhuma janela é apanhada — e foi por isso que
-- as notificações de medicação nunca chegaram, sem nada nunca dar erro.
--
-- O código já foi endurecido para aguentar atrasos (um lembrete até 3 horas
-- atrasado sai à mesma, e diz que vem atrasado). Mas a solução verdadeira é ter
-- um relógio que não falta: o pg_cron corre dentro da base de dados, não
-- depende de runners partilhados, e é gratuito no Supabase.
--
-- O GitHub Actions FICA como está, de reserva. Os dois a bater na mesma rota
-- não fazem mal nenhum: cada aviso tem uma etiqueta e só sai uma vez.
--
-- ── DEPOIS DE CORRER ────────────────────────────────────────────────────────
--   select * from cron.job;                    -- ver o que está agendado
--   select * from cron.job_run_details          -- ver as últimas passagens
--     order by start_time desc limit 20;
--   select cron.unschedule('phlox-push');       -- desligar, se for preciso
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. As extensões ─────────────────────────────────────────────────────────
-- pg_cron agenda; pg_net faz o pedido HTTP. Ambas vêm com o Supabase.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 2. As tarefas ───────────────────────────────────────────────────────────
-- Os horários são em UTC, como na Vercel e no GitHub — as expressões são as
-- mesmas que já estavam nos workflows, para nada mudar de hora.

-- Se já existirem de uma execução anterior, tira-se primeiro: o cron.schedule
-- com o mesmo nome substitui, mas assim o ficheiro corre limpo as vezes que for.
do $$
declare t text;
begin
  foreach t in array array['phlox-push','phlox-diario','phlox-caso-do-dia',
                           'phlox-vigilancia','phlox-ruturas','phlox-recolhas']
  loop
    begin perform cron.unschedule(t); exception when others then null; end;
  end loop;
end $$;

-- De 5 em 5 minutos: os lembretes de medicação. É a única que precisa mesmo de
-- ser frequente — as outras são uma vez por dia e o atraso não se nota.
select cron.schedule('phlox-push', '*/5 * * * *', $job$
  select net.http_get(
    url := 'https://phloxclinical.com/api/push/cron',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- As diárias e semanais, com os mesmos horários dos workflows.
select cron.schedule('phlox-vigilancia', '0 5 * * *', $job$
  select net.http_get(url := 'https://phloxclinical.com/api/vigilancia/cron',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000);
$job$);

select cron.schedule('phlox-ruturas', '0 6 * * 1', $job$
  select net.http_get(url := 'https://phloxclinical.com/api/cron/ingest-shortages',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000);
$job$);

select cron.schedule('phlox-recolhas', '0 7 * * 1', $job$
  select net.http_get(url := 'https://phloxclinical.com/api/cron/ingest-recalls',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000);
$job$);

select cron.schedule('phlox-diario', '30 7 * * *', $job$
  select net.http_get(url := 'https://phloxclinical.com/api/cron/diario',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000);
$job$);

select cron.schedule('phlox-caso-do-dia', '0 8 * * 1-5', $job$
  select net.http_get(url := 'https://phloxclinical.com/api/cron/caso-do-dia',
    headers := '{"x-cron-secret": "<<<COLA_AQUI_O_CRON_SECRET>>>"}'::jsonb,
    timeout_milliseconds := 55000);
$job$);

-- ── 3. Confirmar ────────────────────────────────────────────────────────────
select jobname, schedule, active from cron.job order by jobname;
