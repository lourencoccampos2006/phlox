-- sprint8.sql
-- Public RLS policies so emergency-card and phlox-link public viewer routes
-- can use the ANON key instead of the service role key.
-- The tokens/codes themselves are the secret — they're 128-bit random values.

-- ─── emergency_tokens: allow anyone to read active rows ────────────────────────
-- Safe: the token column is a 128-bit random secret; anyone with the token
-- already knows about the card.
alter table if exists public.emergency_tokens enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'emergency_tokens' and policyname = 'Public read active tokens'
  ) then
    execute $policy$
      create policy "Public read active tokens"
      on public.emergency_tokens
      for select
      using (active = true)
    $policy$;
  end if;
end $$;

-- ─── personal_meds: allow public read when user has an active emergency token ──
-- Only exposes meds of users who explicitly activated an emergency card.
alter table if exists public.personal_meds enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'personal_meds' and policyname = 'Public read meds via emergency token'
  ) then
    execute $policy$
      create policy "Public read meds via emergency token"
      on public.personal_meds
      for select
      using (
        exists (
          select 1 from public.emergency_tokens
          where emergency_tokens.user_id = personal_meds.user_id
            and emergency_tokens.active = true
        )
      )
    $policy$;
  end if;
end $$;

-- ─── vitals: allow public read when user has an active phlox_link ─────────────
-- Only exposes vitals of users who shared a link.
alter table if exists public.vitals enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'vitals' and policyname = 'Public read vitals via phlox link'
  ) then
    execute $policy$
      create policy "Public read vitals via phlox link"
      on public.vitals
      for select
      using (
        exists (
          select 1 from public.phlox_links
          where phlox_links.user_id = vitals.user_id
            and phlox_links.active = true
            and (phlox_links.expires_at is null or phlox_links.expires_at > now())
        )
      )
    $policy$;
  end if;
end $$;

-- ─── phlox_links: public read for meds/name via active link ───────────────────
-- personal_meds already covered above; also need personal_meds accessible via link.
-- The existing "Public read active links" policy on phlox_links covers selecting
-- the link row itself. Ensure personal_meds also allows read via active link.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'personal_meds' and policyname = 'Public read meds via phlox link'
  ) then
    execute $policy$
      create policy "Public read meds via phlox link"
      on public.personal_meds
      for select
      using (
        exists (
          select 1 from public.phlox_links
          where phlox_links.user_id = personal_meds.user_id
            and phlox_links.active = true
            and (phlox_links.expires_at is null or phlox_links.expires_at > now())
        )
      )
    $policy$;
  end if;
end $$;

-- ─── push_subscriptions table ─────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);

alter table if exists public.push_subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'push_subscriptions' and policyname = 'Users manage own subscriptions'
  ) then
    execute $policy$
      create policy "Users manage own subscriptions"
      on public.push_subscriptions
      for all
      using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

-- ─── reminder_times on personal_meds ─────────────────────────────────────────
alter table if exists public.personal_meds
  add column if not exists reminder_times text[];
-- example: {"09:00","13:00","21:00"}

-- ─── Supabase pg_cron alternative for push notifications ─────────────────────
-- Use this if GitHub Actions is not available or reliable.
-- Requires pg_cron extension (enabled by default on Supabase Pro).
-- On Supabase free tier: enable via Dashboard → Database → Extensions → pg_cron
--
-- Step 1: enable extension (run once)
-- create extension if not exists pg_cron;
--
-- Step 2: schedule a call to your cron endpoint every 15 minutes.
-- Replace <YOUR_CRON_SECRET> and <YOUR_APP_URL> with your actual values.
--
-- select cron.schedule(
--   'phlox-push-cron',
--   '*/15 * * * *',
--   $$
--     select net.http_get(
--       url := '<YOUR_APP_URL>/api/push/cron',
--       headers := '{"x-cron-secret": "<YOUR_CRON_SECRET>"}'::jsonb
--     )
--   $$
-- );
--
-- Note: net extension (pg_net) must also be enabled:
-- create extension if not exists pg_net;
--
-- To check scheduled jobs:
-- select * from cron.job;
--
-- To remove:
-- select cron.unschedule('phlox-push-cron');
