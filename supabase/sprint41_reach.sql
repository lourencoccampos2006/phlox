-- sprint41_reach.sql
-- Phlox Reach — sistema de convites e referrals. Cada utilizador tem o seu código.
-- Quando alguém se regista com esse código e faz upgrade, ambos ganham créditos
-- (um mês oferecido). Cria viralidade orgânica.
-- RLS: o utilizador vê só os SEUS convites.

create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null unique,           -- "FERN-AB12CD" (curto, partilhável)
  uses        int not null default 0,
  uses_limit  int,                              -- null = ilimitado
  created_at  timestamptz not null default now()
);
create index if not exists invites_user_idx on invites(user_id);
create index if not exists invites_code_idx on invites(code);
alter table invites enable row level security;
do $$ begin create policy "invites_own" on invites for all using (user_id = auth.uid()); exception when duplicate_object then null; end $$;

create table if not exists invite_redemptions (
  id            uuid primary key default gen_random_uuid(),
  invite_id     uuid not null references invites(id) on delete cascade,
  referrer_id   uuid not null references auth.users(id) on delete cascade,
  invitee_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text,
  at            timestamptz not null default now(),
  upgraded      boolean default false,         -- true quando o convidado faz upgrade
  upgraded_at   timestamptz,
  reward_status text default 'pending'         -- pending | paid | revoked
);
create index if not exists invite_redemptions_referrer_idx on invite_redemptions(referrer_id);
create index if not exists invite_redemptions_invitee_idx on invite_redemptions(invitee_id);
alter table invite_redemptions enable row level security;
-- referrer e invitee podem ler o seu próprio registo
do $$ begin create policy "invite_redemptions_visible" on invite_redemptions for select using (referrer_id = auth.uid() or invitee_id = auth.uid()); exception when duplicate_object then null; end $$;
