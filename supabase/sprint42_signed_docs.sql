-- sprint42_signed_docs.sql
-- Phlox Signed Documents — documentos com assinatura HMAC-SHA256 e URL de
-- verificação pública. Imutáveis após assinar. Para recibos, declarações,
-- relatórios — qualquer coisa onde a autenticidade importe.

create table if not exists signed_docs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,                 -- ex: 'recibo', 'declaracao', 'relatorio'
  title        text not null,
  payload      jsonb not null,                 -- conteúdo canónico assinado
  signature    text not null,                  -- HMAC-SHA256 hex (chave no servidor)
  signed_at    timestamptz not null default now(),
  signer_name  text,
  public_view  boolean not null default true,
  revoked      boolean not null default false,
  revoked_at   timestamptz
);
create index if not exists signed_docs_user_idx on signed_docs(user_id);
alter table signed_docs enable row level security;
do $$ begin create policy "signed_docs_own" on signed_docs for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
-- leitura pública só pelo endpoint de verificação (service role)
