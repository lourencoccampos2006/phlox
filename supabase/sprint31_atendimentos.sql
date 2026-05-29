-- Sprint 31: Atendimentos avulsos — para instituições SEM doentes fixos
-- (farmácia, centro de saúde de passagem, etc.). Não exige criar um doente.
-- Pode ser promovido a ficha de doente se a pessoa for recorrente.
-- Liga-se ao Health Pass: uma visita via QR também entra aqui.
-- Run in Supabase SQL Editor.

create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  at timestamptz not null default now(),
  -- identificação leve (tudo opcional — pode ser anónimo)
  person_name text,
  age int,
  patient_id uuid,                 -- preenchido se associado/promovido a ficha
  -- conteúdo do atendimento
  type text not null default 'atendimento'
    check (type in ('atendimento','indicacao','rastreio','vacina','consulta','transporte','outro')),
  reason text,                     -- motivo
  action text,                     -- o que se fez / aconselhou
  outcome text,                    -- desfecho
  follow_up text,                  -- seguimento recomendado
  professional text,               -- quem atendeu
  source text not null default 'manual' check (source in ('manual','healthpass')),
  created_at timestamptz default now()
);
alter table encounters enable row level security;
do $$ begin
  create policy "encounters_own" on encounters for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists encounters_idx on encounters(user_id, at desc);
