-- sprint35_fiscal.sql
-- Motor fiscal "como os certificados fazem", com os mecanismos disponíveis no runtime
-- (Cloudflare Workers / Web Crypto): numeração sequencial por série, cadeia de hash
-- SHA-256 (inviolabilidade interna), ATCUD e QR Code no formato oficial da AT, e
-- documentos de anulação (notas de crédito / estornos).
-- IMPORTANTE: documentos de GESTÃO. A validação fiscal sai do software certificado.
-- RLS user_id = auth.uid() em tudo.

-- ── Séries de documentos (numeração sequencial por tipo/série/ano) ──────────────
create table if not exists doc_series (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_type    text not null default 'FS',   -- FS (fatura simplificada) | FR (fatura-recibo) | FT (fatura) | NC (nota crédito) | RG (recibo)
  series      text not null default 'A',     -- código da série (ex: A, 2026A)
  year        int not null,
  next_seq    int not null default 1,        -- próximo número sequencial
  atcud_code  text,                          -- código de validação da série na AT (preenchido pela instituição)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, doc_type, series, year)
);
alter table doc_series enable row level security;
do $$ begin create policy "doc_series_own" on doc_series for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── Campos fiscais na venda (cadeia + ATCUD + QR + estado) ─────────────────────
alter table sales add column if not exists doc_type    text default 'FS';
alter table sales add column if not exists series      text;
alter table sales add column if not exists seq         int;
alter table sales add column if not exists doc_no      text;     -- ex: FS A/2026/123
alter table sales add column if not exists doc_hash    text;     -- SHA-256 deste documento (cadeia)
alter table sales add column if not exists prev_hash   text;     -- hash do documento anterior da série
alter table sales add column if not exists hash4       text;     -- 4 carateres do hash p/ QR (posições 1,11,21,31)
alter table sales add column if not exists atcud       text;     -- CodigoValidacao-Sequência
alter table sales add column if not exists qr_data     text;     -- string completa do QR Code AT
alter table sales add column if not exists doc_status  text default 'normal';  -- normal | anulado | nota_credito
alter table sales add column if not exists annuls_id   uuid;     -- (NC) venda que esta nota anula
alter table sales add column if not exists finalized_at timestamptz;

-- ── Definições fiscais da instituição ──────────────────────────────────────────
create table if not exists fiscal_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  nif          text,
  address      text,
  default_series text default 'A',
  default_doc_type text default 'FS',
  updated_at   timestamptz default now()
);
alter table fiscal_settings enable row level security;
do $$ begin create policy "fiscal_settings_own" on fiscal_settings for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- ── Função: alocar o próximo número de uma série de forma atómica ───────────────
create or replace function next_doc_seq(p_user uuid, p_type text, p_series text, p_year int)
returns int language plpgsql security definer as $$
declare v_seq int;
begin
  insert into doc_series (user_id, doc_type, series, year, next_seq)
    values (p_user, p_type, p_series, p_year, 2)
    on conflict (user_id, doc_type, series, year)
    do update set next_seq = doc_series.next_seq + 1
    returning next_seq - 1 into v_seq;
  return v_seq;
end $$;
