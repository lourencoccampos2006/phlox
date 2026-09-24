-- supabase/sprint155_marcadores_leitura.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint154. Pode correr antes ou depois do 153.
--
-- ── O PROBLEMA ──────────────────────────────────────────────────────────────
-- Pediste um símbolo de notificação com um número em CADA ferramenta, por
-- pessoa. O que existia era `family_thread_messages.read_by_staff`: um campo
-- por MENSAGEM que diz «alguém da equipa já viu». Isso responde à pergunta
-- errada de duas maneiras:
--
--   • é por mensagem, não por ferramenta — não dá para dizer «o mural tem 3»;
--   • é «alguém», não «eu» — se a colega da manhã abriu, a da tarde deixa de
--     ver o aviso, e o recado era para as duas.
--
-- ── A FORMA CERTA ───────────────────────────────────────────────────────────
-- Uma linha por pessoa e por ferramenta, com a hora a que essa pessoa a abriu
-- pela última vez. O número é «quantas coisas entraram depois disso».
--
-- É uma linha por pessoa por ferramenta — com uma equipa de 20 e 18
-- ferramentas, 360 linhas. Não é uma tabela que cresce com o uso.
--
-- ── PORQUE É QUE NÃO GUARDAMOS O NÚMERO ─────────────────────────────────────
-- Um contador guardado tem de ser acertado em cada escrita, em cada apagar, em
-- cada correção — e o dia em que falha um sítio, fica um «3» eterno numa
-- ferramenta vazia. Guardamos a HORA (que muda só quando a pessoa abre) e
-- contamos na altura. O que se conta é sempre verdade.
--
-- A contagem é feita em app/api/contadores, com a sessão de quem pergunta, por
-- isso passa pela RLS: ninguém recebe um número de uma área que não pode ver.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists marcadores_leitura (
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid references organizations(id) on delete cascade,
  -- O id da ferramenta em lib/contadores.ts ('mural', 'ocorrencias', …).
  -- Não é a rota: as rotas mudam, e uma pessoa não deve perder o que já leu
  -- só porque a página mudou de endereço.
  ferramenta text not null,
  visto_em   timestamptz not null default now(),
  primary key (user_id, ferramenta)
);

alter table marcadores_leitura enable row level security;

-- Cada pessoa vê e escreve SÓ os seus marcadores. Nem o dono lê os dos outros:
-- saber quem abriu o quê e quando é vigilância sobre a equipa, e não é para
-- isso que isto existe.
do $$ begin
  create policy "marcadores_proprios" on marcadores_leitura for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

revoke select on marcadores_leitura from anon;


-- ── Índices para as contagens ───────────────────────────────────────────────
-- Cada contagem é «quantas linhas desta casa entraram depois desta hora». Sem
-- índice por (org_id, created_at) isso é uma varredura por tabela e por
-- pessoa, a cada abertura de página. Com índice, é uma leitura de índice.
--
-- Só as tabelas que alimentam um contador. `if not exists` em todas e um
-- `to_regclass` a proteger, para isto correr numa instalação incompleta.
do $$
declare
  t text;
  tabelas text[] := array[
    'family_thread_messages', 'incidents', 'resident_requests',
    'activities', 'documents', 'handovers', 'care_records',
    'attendance', 'mar_records', 'assessments', 'wounds',
    'billing_entries', 'stock_items', 'support_services',
    'cuidados_nao_prestados', 'org_invites', 'activity_log'
  ];
  n int := 0;
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is null then
      raise notice '  (salta) % nao existe', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'created_at'
    ) then
      raise notice '  (salta) % nao tem created_at', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'org_id'
    ) then
      raise notice '  (salta) % nao tem org_id', t;
      continue;
    end if;
    execute format(
      'create index if not exists %I on public.%I (org_id, created_at desc) where org_id is not null',
      t || '_org_novo_idx', t);
    n := n + 1;
  end loop;
  raise notice '% indice(s) de contagem prontos.', n;
end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select count(*) from marcadores_leitura;   -- 0, sem erro
-- E na app: abre o painel. Os números aparecem ao lado das ferramentas; abre
-- uma e o número dela desaparece (só para ti).
