-- sprint103_shortage_watch.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- PRO RONDA 3 — Vigia de Ruturas. 2026-07-15.
-- Em vez de ler a página de pesquisa ao vivo do INFARMED (testado a sério —
-- é um formulário ASP.NET WebForms num iframe cross-origin, frágil para
-- automatizar com confiança) ou fazer OCR a um PDF de preços (também testado
-- — vem como imagem digitalizada, sem texto real), ingerimos a Lista de
-- Notificação Prévia (LNP) que o INFARMED já publica como Excel (.xlsx)
-- genuinamente estruturado, sem login, trimestral. Zero OCR, zero browser
-- automatizado, zero risco de erro de leitura — é uma tabela real.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists infarmed_shortage_list (
  id                uuid primary key default gen_random_uuid(),
  registration_no    text,
  medicine_name      text not null,
  dci                text,
  dosage             text,
  form               text,
  presentation       text,
  cft                text,
  source_document    text not null,     -- nome do ficheiro/publicação de onde veio
  source_url         text,
  ingested_at        timestamptz not null default now()
);
create index if not exists infarmed_shortage_list_name_idx on infarmed_shortage_list (lower(medicine_name));
create index if not exists infarmed_shortage_list_dci_idx on infarmed_shortage_list (lower(dci));

-- Leitura pública (dados de referência do INFARMED, não são dados pessoais de
-- ninguém) — só o cron (service role) escreve.
alter table infarmed_shortage_list enable row level security;
do $$ begin create policy "isl_read_all" on infarmed_shortage_list for select using (true); exception when duplicate_object then null; end $$;

-- Metadados da última ingestão — para a UI mostrar "atualizado em X" e o cron
-- saber se já correu esta semana sem ter de contar linhas.
create table if not exists infarmed_shortage_sync (
  id            int primary key default 1,
  last_synced_at timestamptz,
  source_document text,
  row_count     integer,
  status        text,          -- 'ok' | 'error'
  error_detail  text,
  check (id = 1)
);
alter table infarmed_shortage_sync enable row level security;
do $$ begin create policy "iss_read_all" on infarmed_shortage_sync for select using (true); exception when duplicate_object then null; end $$;
