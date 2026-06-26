-- sprint90_welcome_email.sql
-- Marca se já enviámos o email de boas-vindas a esta conta (idempotência).
-- Sem isto, o email continua a funcionar, mas pode chegar mais do que uma vez.

alter table public.profiles
  add column if not exists welcome_email_sent boolean not null default false;
