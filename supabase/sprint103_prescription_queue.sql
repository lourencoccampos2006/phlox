-- sprint103_prescription_queue.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ronda 11 — a ferramenta /prescription-queue (Validação de prescrições) e o
-- bloco "validation_queue" do cockpit da farmácia consultavam a tabela
-- prescription_queue que NUNCA foi criada → 404 em toda a carga do /painel da
-- farmácia. Criamos a tabela (schema documentado no topo do próprio ficheiro da
-- ferramenta), org-scoped, com RLS. Torna a feature realmente funcional.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists prescription_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  org_id uuid references organizations(id) on delete set null,
  recorded_by_id uuid references auth.users(id),
  patient_name text not null,
  patient_dob date,
  patient_weight numeric,
  ward text, bed text, prescriber text,
  drug_name text not null,
  dose text not null,
  route text, frequency text,
  indication text, duration text,
  status text default 'pending' check (status in ('pending','reviewing','approved','modified','rejected','on_hold')),
  reviewer_id uuid references profiles(id),
  reviewed_at timestamptz,
  intervention_type text, intervention_note text,
  clinical_checks jsonb,
  priority text default 'normal',
  created_at timestamptz default now()
);
create index if not exists prescription_queue_org_idx on prescription_queue (org_id, status, created_at desc);
create index if not exists prescription_queue_user_idx on prescription_queue (user_id);

alter table prescription_queue enable row level security;

-- Dono individual (org_id null) vê o seu; equipa vê o da organização.
do $$
begin
  begin execute $p$create policy "prescription_queue_own" on prescription_queue for all using (user_id = auth.uid()) with check (user_id = auth.uid())$p$; exception when others then null; end;
  begin execute $p$create policy "prescription_queue_org_access" on prescription_queue for all
    using (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))
    with check (org_id is not null and org_id in (select org_id from org_members where user_id = auth.uid() and active = true))$p$; exception when others then null; end;
end $$;
