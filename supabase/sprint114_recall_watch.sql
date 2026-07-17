-- sprint114_recall_watch.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- MELHORIAS 2026-07-17 (item B11) — Vigia de Recalls (recolhas de lote e
-- alertas de segurança do INFARMED). Investigado a fundo antes de construir:
-- ao contrário da Lista de Notificação Prévia (um único ficheiro Excel
-- trimestral), o INFARMED publica recalls como uma listagem HTML paginada em
-- infarmed.pt/web/infarmed/alertas-de-qualidade (+ alertas-de-seguranca), sem
-- ficheiro em bulk. Confirmado com download real + regex testada contra HTML
-- real (8 notícias extraídas corretamente) que É possível ingerir de forma
-- fiável — mas só título+data+link (não os campos de lote/validade dentro de
-- cada notícia, que NÃO têm estrutura consistente entre notícias — algumas
-- são tabela, outras só texto). Por isso: dizemos "este alerta MENCIONA um
-- medicamento teu" e ligamos à notícia oficial, nunca inventamos o nº de lote.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists infarmed_recall_notices (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  title         text not null,
  notice_date   text,                    -- tal como publicado (DD/MM/AAAA) — não forçamos parsing
  source_page   text not null check (source_page in ('qualidade','seguranca')),
  first_seen_at timestamptz not null default now()
);
create index if not exists infarmed_recall_notices_idx on infarmed_recall_notices (first_seen_at desc);

alter table infarmed_recall_notices enable row level security;
-- Leitura pública (dados de referência oficiais, sem informação pessoal de ninguém).
-- Só o service-role (cron) escreve — sem policy de insert/update/delete.
do $$ begin create policy "recall_notices_public_read" on infarmed_recall_notices for select using (true); exception when duplicate_object then null; end $$;
