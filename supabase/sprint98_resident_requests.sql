-- sprint98_resident_requests.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RONDA 8 — Pedidos & observações do utente (lar/centro de dia).
-- Regista o que o utente PEDE ou DIZ (ex.: "quer mudar de quarto", "queixa-se de
-- dor à noite", "pediu para ligar à filha") para TODA a equipa saber e poder
-- intervir. Org-scoped (sprint91/97), com quem registou e estado de seguimento.
-- 2026-06-30.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists resident_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  recorded_by_id uuid references auth.users(id),
  patient_id  uuid not null references patients(id) on delete cascade,
  kind        text not null default 'pedido' check (kind in ('pedido','observacao','queixa')),
  content     text not null,
  status      text not null default 'aberto' check (status in ('aberto','em_curso','resolvido')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists resident_requests_idx on resident_requests (patient_id, created_at desc);
create index if not exists resident_requests_org_idx on resident_requests (org_id) where org_id is not null;

-- ─── RLS — próprio (user_id) OU membro da org (sprint91/97 pattern) ──────────
alter table resident_requests enable row level security;
do $$ begin
  create policy "rr_own" on resident_requests for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "rr_org_access" on resident_requests for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table resident_requests; exception when others then null; end $$;
