-- sprint76_notes_memory.sql
-- Phlox — Transformação das notas num SISTEMA DE MEMÓRIA.
--
-- Conceito: uma nota não é texto morto. Ao guardar, a IA extrai flashcards que
-- entram em REVISÃO ESPAÇADA (algoritmo SM-2). A app abre em "rever hoje" — o
-- loop de retorno diário. Cada nota volta a ti no momento certo.
--
-- 2026-06-05. Idempotente.

-- ─── Campos extra em study_notes (captura, fonte, contagem de cartões) ──────
alter table study_notes add column if not exists source text default 'manual';
  -- 'manual' | 'voice' | 'photo' | 'paste' | 'template'
alter table study_notes add column if not exists card_count int default 0;
alter table study_notes add column if not exists mastery numeric default 0;
  -- 0..1 — média de domínio dos cartões desta nota (para barra de progresso)

-- ─── note_cards — flashcards derivados de notas, com SM-2 ───────────────────
create table if not exists note_cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  note_id       uuid references study_notes(id) on delete cascade,
  front         text not null,
  back          text not null,
  domain        text,
  -- SM-2 spaced repetition
  ease          numeric not null default 2.5,   -- fator de facilidade
  interval_days int not null default 0,         -- intervalo atual
  repetitions   int not null default 0,         -- nº de revisões seguidas certas
  due_at        timestamptz not null default now(),
  last_reviewed_at timestamptz,
  -- estatística
  times_seen    int not null default 0,
  times_correct int not null default 0,
  suspended     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists note_cards_due_idx on note_cards(user_id, due_at) where suspended = false;
create index if not exists note_cards_note_idx on note_cards(note_id);

alter table note_cards enable row level security;
do $$ begin
  create policy "note_cards_own" on note_cards for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ─── RPC: inserir cartões gerados pela IA para uma nota ─────────────────────
-- Substitui os cartões antigos da nota (regenerar) e atualiza card_count.
create or replace function set_note_cards(p_note_id uuid, p_cards jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_domain text;
  v_card jsonb;
  v_n int := 0;
begin
  select user_id, domain into v_user, v_domain from study_notes where id = p_note_id;
  if v_user is null or v_user <> auth.uid() then
    raise exception 'not authorized';
  end if;

  delete from note_cards where note_id = p_note_id;

  for v_card in select * from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb))
  loop
    if coalesce(v_card->>'front','') <> '' and coalesce(v_card->>'back','') <> '' then
      insert into note_cards (user_id, note_id, front, back, domain, due_at)
      values (v_user, p_note_id, v_card->>'front', v_card->>'back', v_domain, now());
      v_n := v_n + 1;
    end if;
  end loop;

  update study_notes set card_count = v_n where id = p_note_id;
  return v_n;
end;
$$;

grant execute on function set_note_cards(uuid, jsonb) to authenticated;

-- ─── RPC: cartões a rever HOJE (due) — o loop diário ───────────────────────
create or replace function cards_due(p_limit int default 30)
returns setof note_cards
language sql security definer set search_path = public as $$
  select * from note_cards
  where user_id = auth.uid()
    and suspended = false
    and due_at <= now()
  order by due_at asc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function cards_due(int) to authenticated;

-- ─── RPC: registar uma revisão (SM-2) ──────────────────────────────────────
-- p_quality: 0 (errei) | 3 (difícil) | 4 (bom) | 5 (fácil)
create or replace function review_card(p_card_id uuid, p_quality int)
returns note_cards
language plpgsql security definer set search_path = public as $$
declare
  c note_cards;
  v_ease numeric;
  v_int int;
  v_reps int;
begin
  select * into c from note_cards where id = p_card_id and user_id = auth.uid();
  if c.id is null then raise exception 'card not found'; end if;

  v_ease := c.ease;
  v_reps := c.repetitions;

  if p_quality < 3 then
    -- Falhou — reinicia o intervalo, volta a aparecer hoje/breve
    v_reps := 0;
    v_int := 1;
  else
    -- Acertou — SM-2
    v_reps := v_reps + 1;
    if v_reps = 1 then v_int := 1;
    elsif v_reps = 2 then v_int := 6;
    else v_int := round(c.interval_days * v_ease);
    end if;
    -- Ajusta o fator de facilidade
    v_ease := v_ease + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
    if v_ease < 1.3 then v_ease := 1.3; end if;
  end if;

  update note_cards set
    ease = v_ease,
    interval_days = v_int,
    repetitions = v_reps,
    due_at = now() + (v_int || ' days')::interval,
    last_reviewed_at = now(),
    times_seen = times_seen + 1,
    times_correct = times_correct + (case when p_quality >= 3 then 1 else 0 end)
  where id = p_card_id
  returning * into c;

  -- Atualiza mastery da nota (média de repetitions normalizada)
  update study_notes s set mastery = sub.m from (
    select note_id, least(1.0, avg(least(repetitions,5))::numeric / 5) as m
    from note_cards where note_id = c.note_id group by note_id
  ) sub where s.id = sub.note_id and s.id = c.note_id;

  return c;
end;
$$;

grant execute on function review_card(uuid, int) to authenticated;

-- ─── RPC: contadores para a "home" das notas ───────────────────────────────
create or replace function notes_dashboard()
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'due_today', (select count(*) from note_cards where user_id = auth.uid() and suspended = false and due_at <= now()),
    'total_cards', (select count(*) from note_cards where user_id = auth.uid()),
    'total_notes', (select count(*) from study_notes where user_id = auth.uid()),
    'reviewed_today', (select count(*) from note_cards where user_id = auth.uid() and last_reviewed_at::date = now()::date)
  );
$$;

grant execute on function notes_dashboard() to authenticated;
