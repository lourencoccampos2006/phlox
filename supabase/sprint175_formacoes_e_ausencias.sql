-- supabase/sprint175_formacoes_e_ausencias.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint174, e o sprint153 a seguir.
--
-- ── DE ONDE VEIO ────────────────────────────────────────────────────────────
-- Da pesquisa ao Ankira, que tem um módulo inteiro de «Recursos Humanos», e do
-- que a ASAE verifica numa inspeção antes sequer de olhar para o plano HACCP:
-- **a formação dos colaboradores**.
--
-- O Phlox tinha, na `team_members`:
--   • `next_training text`   — uma frase solta, sem histórico nem data
--   • `competencies jsonb`   — uma lista do que a pessoa sabe
--   • `status`               — `sick` / `vacation` / `on_shift`, SEM DATAS
--
-- Nenhum dos três responde às duas perguntas que se fazem de facto.
--
-- ── PERGUNTA 1: «QUEM TEM FORMAÇÃO POR RENOVAR?» ───────────────────────────
-- Uma formação não é um estado, é um acontecimento com data — e muitas têm
-- VALIDADE. O suporte básico de vida renova-se, a higiene alimentar renova-se.
-- Um certificado que caducou é exactamente a coisa que ninguém se lembra, e é
-- a primeira que uma inspeção pede.
--
-- Com um campo de texto chamado «próxima formação» isso não se consegue
-- perguntar. Com uma linha por formação e uma data de validade, pergunta-se
-- com um `where`.
--
-- ── PERGUNTA 2: «QUANDO É QUE ELA VOLTA?» ──────────────────────────────────
-- `status = 'vacation'` diz que a pessoa está de férias. Não diz desde quando,
-- nem até quando — e por isso quem faz a escala da semana seguinte não tem
-- como saber se conta com ela.
--
-- Pior: um estado tem de ser desligado à mão. Quem volta de férias e ninguém
-- muda o campo fica de férias para sempre, e a escala conta com menos uma
-- pessoa do que tem.
--
-- Uma ausência com início e fim resolve-se sozinha: no dia seguinte ao fim, a
-- pessoa está cá outra vez sem ninguém ter de fazer nada.
--
-- ── O `status` FICA, E NÃO SE CONVERTE ──────────────────────────────────────
-- A `EscalasEquipa` lê-o em cinco sítios, incluindo a sugestão de vagas. Mexer
-- nele agora partia a cobertura de turnos — que é o que a casa usa todos os
-- dias — para arrumar o que ainda ninguém usa.
--
-- Passa a haver uma fonte melhor ao lado. O `status` continua a ser o estado
-- de agora; as ausências são o calendário.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. AS FORMAÇÕES
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists formacoes_da_equipa (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  -- A quem. `team_members` e não `auth.users`: há funcionários na escala que
  -- nunca entraram no Phlox, e esses também têm formação para registar.
  team_member_id uuid not null references team_members(id) on delete cascade,

  tema text not null,
  data date not null,
  -- As horas contam para os relatórios de formação anual.
  horas numeric(5,1),
  formador text,
  entidade text,

  -- ── A COLUNA QUE FAZ ISTO VALER A PENA ──────────────────────────────────
  -- Null = não caduca (uma licenciatura não caduca). Com data, é por aqui que
  -- se pergunta quem está a precisar de renovar — e é essa pergunta que não se
  -- conseguia fazer com um campo de texto.
  valida_ate date,

  certificado_path text,
  notas text,
  created_at timestamptz not null default now(),

  constraint formacoes_validade check (valida_ate is null or valida_ate >= data),
  constraint formacoes_horas check (horas is null or horas > 0)
);

create index if not exists formacoes_membro_idx on formacoes_da_equipa (team_member_id, data desc);
-- Parcial: a pergunta «quem está a caducar» só olha para as que têm validade,
-- e essas são a minoria.
create index if not exists formacoes_validade_idx
  on formacoes_da_equipa (org_id, valida_ate) where valida_ate is not null;

comment on table formacoes_da_equipa is
  'Formação de cada funcionário. `valida_ate` é o que permite perguntar quem está por renovar — a ASAE pede isto.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AS AUSÊNCIAS
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists ausencias_da_equipa (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  team_member_id uuid not null references team_members(id) on delete cascade,

  -- `ferias` | `baixa` | `falta` | `licenca` | `formacao` | `outro`
  --
  -- `formacao` é uma ausência: a pessoa não está cá nesse dia e a escala não
  -- pode contar com ela. Que seja por um bom motivo não muda o facto.
  tipo text not null default 'ferias',
  inicio date not null,
  -- Null = ainda sem data de regresso (uma baixa que não se sabe quanto dura).
  -- É honesto, e aparece no ecrã como «sem data de regresso» em vez de deixar
  -- quem faz a escala a achar que é um dia só.
  fim date,
  motivo text,
  notas text,
  created_at timestamptz not null default now(),

  constraint ausencias_tipo check (tipo in ('ferias', 'baixa', 'falta', 'licenca', 'formacao', 'outro')),
  constraint ausencias_datas check (fim is null or fim >= inicio)
);

create index if not exists ausencias_membro_idx on ausencias_da_equipa (team_member_id, inicio desc);
create index if not exists ausencias_periodo_idx on ausencias_da_equipa (org_id, inicio, fim);

comment on table ausencias_da_equipa is
  'Ausências com DATAS. Ao contrário de team_members.status, resolve-se sozinha: no dia a seguir ao fim, a pessoa está cá.';


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
--   select count(*) from formacoes_da_equipa;   -- 0, nasce vazia
--   select count(*) from ausencias_da_equipa;   -- 0
--
-- Quem está a caducar nos próximos 60 dias:
--   select tema, valida_ate from formacoes_da_equipa
--    where valida_ate is not null and valida_ate <= current_date + 60
--    order by valida_ate;
--
-- E CORRE O sprint153 A SEGUIR: as duas nascem com a RLS ligada e, sem ele,
-- sem política nenhuma.
