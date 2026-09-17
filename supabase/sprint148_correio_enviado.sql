-- sprint148_correio_enviado.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR).
--
-- ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
-- O `familyDailyEmail` — "Como correu o dia" — estava escrito em lib/email.ts
-- desde sempre e nunca foi ligado a nada. Passa a ser enviado ao fim do dia
-- pelo /api/cron/resumo-familia.
--
-- Para isso falta uma coisa: saber o que já foi enviado. Um cron que corre uma
-- vez por dia parece chegar, mas um `workflow_dispatch` à mão, uma repetição do
-- GitHub ou um novo agendamento mandam o mesmo email duas vezes — e quem o
-- recebe não perdoa: é o dia do pai ou da mãe, não é uma newsletter.
--
-- Guarda-se então uma linha por (assunto, dia). O `unique` é a trava: o segundo
-- envio bate no índice e não acontece. Não é uma contagem para estatísticas —
-- é uma fechadura.
--
-- Serve para todo o correio automático, não só este. O próximo que se ligar usa
-- a mesma tabela e ganha a mesma proteção de graça.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists correio_enviado (
  id        uuid primary key default gen_random_uuid(),
  -- Ex.: 'resumo-familia:<id da ligação>'. Identifica o destinatário e o
  -- assunto, não a pessoa — não há dados de saúde nesta tabela.
  chave     text not null,
  dia       date not null default (now() at time zone 'Europe/Lisbon')::date,
  criado_em timestamptz not null default now()
);

do $$ begin
  create unique index correio_enviado_chave_dia_uidx on correio_enviado (chave, dia);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists correio_enviado_dia_idx on correio_enviado (dia desc);

-- Só o servidor escreve e lê isto (service role). Com RLS ligada e sem
-- políticas, nenhuma conta de utilizador lhe toca — que é o que se quer.
alter table correio_enviado enable row level security;

comment on table correio_enviado is
  'Trava de duplicados do correio automático. Uma linha por (assunto, dia); o unique impede o segundo envio.';
