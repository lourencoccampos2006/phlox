-- supabase/sprint166_calendario_do_ano.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint165. O sprint153 continua a ser o último.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «Uma página com um calendário de um ano inteiro, onde ficavam marcadas
--  automaticamente todas as coisas com data, visitas, atividades, aniversários
--  de utentes, e muitas outras coisas, e também dá para adicionar manualmente
--  coisas.»
--
-- ── PORQUE É QUE ISTO É UMA TABELA SÓ, E PEQUENA ───────────────────────────
-- Quase tudo o que vai aparecer no calendário JÁ está guardado noutro sítio:
-- as atividades em `activities`, as visitas em `visit_requests`, as consultas
-- em `appointments`, os prazos em `incidents`, as validades em `stock_items` e
-- em `documents`, os aniversários na data de nascimento que o sprint165
-- passou a recolher.
--
-- Copiar essas datas para uma tabela de calendário era criar uma segunda
-- verdade: alguém mudava a data de uma atividade e o calendário continuava a
-- mostrar a antiga, sem nada a assinalar a diferença. O calendário LÊ de onde
-- as coisas vivem.
--
-- O que não existia era sítio para o resto — a festa de Natal, a semana de
-- obras na cozinha, a visita da segurança social, o aniversário da casa. É só
-- isso que esta tabela guarda.
--
-- ── A REPETIÇÃO ANUAL ───────────────────────────────────────────────────────
-- Não gera linhas para os anos seguintes. Guarda-se a data uma vez e
-- `repete = 'anual'`; quem desenha o ano é que a põe no ano que está a ver
-- (`noAno()` em lib/calendario.ts, que também trata do 29 de fevereiro).
--
-- Gerar as linhas à frente parecia mais simples e é uma armadilha: passados
-- dois anos alguém muda a data da festa e fica com a nova em 2028 e a velha
-- em 2029 e 2030, que já tinham sido geradas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists calendario_marcas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete cascade,

  titulo      text not null,
  detalhe     text,

  data        date not null,
  -- Coisas que duram dias: uma semana de obras, umas férias, uma campanha de
  -- vacinação. Vazio = um dia só.
  ate         date,
  -- Vazio = o dia todo. Uma festa tem hora; um aniversário da casa não tem.
  hora        time,

  repete      text not null default 'nao' check (repete in ('nao', 'anual')),

  -- Quando a marca é sobre alguém. `on delete cascade`: arquivar uma pessoa
  -- não apaga nada (o arquivo é `active = false`), mas apagar mesmo não pode
  -- deixar marcas penduradas a apontar para ninguém.
  patient_id  uuid references patients(id) on delete cascade,

  -- Uma cor à escolha de quem marca. Sem isto, tudo o que é manual fica da
  -- mesma cor e um calendário com trinta marcas deixa de se ler.
  cor         text not null default 'cinza'
                check (cor in ('cinza', 'vermelho', 'laranja', 'amarelo',
                               'verde', 'azul', 'roxo', 'rosa')),

  criada_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A consulta que a página faz: as marcas de uma casa num intervalo de datas.
create index if not exists calmarcas_org_data_idx on calendario_marcas (org_id, data);
-- As anuais são lidas todas, seja qual for o ano que se está a ver — a data
-- guardada pode ser de 2019 e a marca aparece em 2031.
create index if not exists calmarcas_anuais_idx on calendario_marcas (org_id) where repete = 'anual';
create index if not exists calmarcas_pt_idx on calendario_marcas (patient_id) where patient_id is not null;

-- Um intervalo que acaba antes de começar é sempre engano de quem escreveu, e
-- desenha uma barra ao contrário no ecrã.
do $$ begin
  alter table calendario_marcas add constraint calmarcas_intervalo
    check (ate is null or ate >= data);
exception when duplicate_object then null; end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.calendario_marcas enable row level security;

do $$ begin
  create policy calmarcas_proprio on public.calendario_marcas for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy calmarcas_casa on public.calendario_marcas for all
    using (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true))
    with check (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true));
exception when duplicate_object then null; end $$;

revoke select on public.calendario_marcas from anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- select count(*) from calendario_marcas;      -- 0, ainda ninguém marcou nada
--
-- O intervalo ao contrário tem de ser recusado:
-- insert into calendario_marcas (org_id, titulo, data, ate)
--   values ((select id from organizations limit 1), 'teste', '2026-05-10', '2026-05-01');
--   -- ERROR: new row violates check constraint "calmarcas_intervalo"
--
-- E na app: abre /calendario-do-ano. Os aniversários aparecem sozinhos assim
-- que houver datas de nascimento (sprint165).
