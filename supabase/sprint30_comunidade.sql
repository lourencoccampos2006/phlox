-- Sprint 30: Comunidade estudante — mural de dúvidas e partilha por área de estudo.
-- Estudantes publicam dúvidas/recursos, respondem e dão upvote. Cooperação entre pares.
-- Run in Supabase SQL Editor.

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  author_name text,
  area text,                       -- área de estudo (medicine, pharmacy, ...)
  kind text not null default 'question' check (kind in ('question','resource','tip')),
  subject text,                    -- matéria (ex: Farmacologia)
  title text not null,
  body text,
  link text,                       -- recurso opcional
  upvotes int not null default 0,
  answer_count int not null default 0,
  created_at timestamptz default now()
);
alter table community_posts enable row level security;
-- Leitura aberta a utilizadores autenticados; escrita só do próprio
do $$ begin
  create policy "cposts_read" on community_posts for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cposts_write" on community_posts for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cposts_update_own" on community_posts for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cposts_delete_own" on community_posts for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists cposts_idx on community_posts(area, created_at desc);

create table if not exists community_answers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  author_name text,
  body text not null,
  upvotes int not null default 0,
  created_at timestamptz default now()
);
alter table community_answers enable row level security;
do $$ begin
  create policy "cans_read" on community_answers for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cans_write" on community_answers for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cans_del_own" on community_answers for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists cans_idx on community_answers(post_id, created_at);

-- Votos (1 por user por alvo) para evitar duplicação
create table if not exists community_votes (
  user_id uuid references auth.users(id) on delete cascade not null,
  target_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, target_id)
);
alter table community_votes enable row level security;
do $$ begin
  create policy "cvotes_own" on community_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
