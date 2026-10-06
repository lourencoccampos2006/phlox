-- supabase/sprint172_servicos_gerais.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint171, e o sprint153 a seguir (é ele que
-- põe a RLS por área nas tabelas novas).
--
-- ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
-- Da pesquisa ao Ankira. Eles têm doze módulos na aplicação base, e o Phlox
-- tem alguma coisa para onze deles. O que falta inteiro chama-se «Serviços»:
--
--     «Gestão de serviços gerais, como a higiene dos espaços e lavandaria.»
--
-- É o trabalho que a casa faz sobre SI PRÓPRIA — limpar, lavar a roupa,
-- cozinhar, medir a temperatura das arcas — e não sobre uma pessoa. Tudo o que
-- o Phlox sabia até agora pendurava-se num utente. Isto não se pendura em
-- ninguém, e por isso não tinha onde viver.
--
-- ── E EM PORTUGAL NÃO É UMA CONVENIÊNCIA ───────────────────────────────────
-- Um lar português tem DOIS inspetores, e o Phlox não ajudava em nada no
-- segundo:
--
--   • a Segurança Social, pela resposta social (Portaria 67/2012);
--   • a ASAE, pela cozinha — porque uma casa que serve refeições é um
--     estabelecimento alimentar como outro qualquer.
--
-- A ASAE, antes sequer de olhar para o plano HACCP, verifica os pré-requisitos:
-- plano de higienização afixado e REGISTADO, registos de temperatura dos
-- equipamentos de frio, controlo de pragas, formação dos colaboradores.
--
-- E o registo de higienização tem conteúdo obrigatório: a data, o produto
-- usado, os acessórios, e QUEM limpou. É por isso que `produto` e `feito_por`
-- são colunas e não uma nota de texto livre — num caderno de texto livre essa
-- informação existe em metade das linhas.
--
-- ── DUAS COISAS, E NÃO UMA ──────────────────────────────────────────────────
-- As TAREFAS (limpar o quarto 3, lavar a roupa branca) seguem o mesmo motor de
-- cadência dos cuidados de rotina — «às terças e sextas» tem de querer dizer o
-- mesmo nos dois sítios, e isso não pode ter duas implementações.
--
-- As TEMPERATURAS são outra coisa: não são uma tarefa que se marca como feita,
-- são um NÚMERO que se lê e que pode estar fora do intervalo. Uma arca a −12 °C
-- não é «feito» nem «por fazer»: é um problema. Por isso tem tabela própria,
-- com o intervalo guardado no equipamento.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. O QUE A CASA TEM DE FAZER A SI PRÓPRIA
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists tarefas_da_casa (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,

  nome text not null,
  -- `limpeza` | `lavandaria` | `cozinha` | `manutencao` | `outro`
  categoria text not null default 'limpeza',
  -- Onde. Texto livre de propósito: cada casa chama aos seus espaços o que
  -- quer, e uma lista fechada obrigava-as a traduzir «copa» para o nosso
  -- vocabulário antes de poderem usar a ferramenta.
  zona text,
  -- O produto, porque o registo de higienização tem de o dizer.
  produto text,

  -- O MESMO motor de cadência dos cuidados de rotina (lib/plano.ts).
  cadencia text not null default 'diaria',
  dias integer[],
  turno text,
  hora text,
  -- A ANCORA da cadencia, e nao uma data decorativa. «Uma vez por semana»
  -- precisa de saber a partir de QUE semana, e «uma vez por mes» de saber em
  -- que dia do mes. Sem isto, lib/plano.ts nao consegue responder se e hoje —
  -- e o motor da cadencia e o mesmo dos cuidados de rotina, de proposito.
  desde date not null default current_date,

  minutos integer,
  responsavel_id uuid references auth.users(id) on delete set null,
  responsavel text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),

  constraint tarefas_casa_categoria check (
    categoria in ('limpeza', 'lavandaria', 'cozinha', 'manutencao', 'outro')),
  constraint tarefas_casa_hora check (
    hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create index if not exists tarefas_casa_org_idx on tarefas_da_casa (org_id, ordem) where ativo;


-- ── O que ficou feito ───────────────────────────────────────────────────────
create table if not exists tarefas_da_casa_execucoes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,

  tarefa_id uuid not null references tarefas_da_casa(id) on delete cascade,
  data date not null,
  turno text,
  -- O nome de quem limpou, guardado no momento. Sobrevive a quem sai da casa —
  -- e um registo de higienização sem autor não serve para uma inspeção.
  feito_por text,
  -- O produto REALMENTE usado, quando não foi o do plano.
  produto text,
  nota text,
  created_at timestamptz not null default now(),

  -- A mesma tarefa, no mesmo dia e turno, uma vez. Dois toques seguidos não
  -- fazem duas limpezas.
  unique (tarefa_id, data, turno)
);

create index if not exists tarefas_casa_exec_idx
  on tarefas_da_casa_execucoes (org_id, data);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. OS EQUIPAMENTOS DE FRIO, E O QUE ELES MARCAM
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,

  nome text not null,
  -- `frigorifico` | `arca` | `camara` | `quente` | `outro`
  tipo text not null default 'frigorifico',
  zona text,

  -- O intervalo aceitável, em graus. É no EQUIPAMENTO e não na leitura: o
  -- intervalo é uma propriedade da arca, e repeti-lo em cada leitura dava
  -- milhares de cópias do mesmo número — e, no dia em que mudasse, metade das
  -- leituras passadas a dizer uma coisa e metade outra.
  temp_min numeric,
  temp_max numeric,
  -- Quantas vezes por dia se lê. Serve para saber quantas faltam.
  leituras_por_dia integer not null default 1,

  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),

  constraint equipamentos_tipo check (
    tipo in ('frigorifico', 'arca', 'camara', 'quente', 'outro'))
);

create index if not exists equipamentos_org_idx on equipamentos (org_id, ordem) where ativo;


create table if not exists leituras_temperatura (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,

  equipamento_id uuid not null references equipamentos(id) on delete cascade,
  data date not null,
  hora text,
  valor numeric not null,
  -- Quando está fora do intervalo, o que se fez. Uma leitura fora do intervalo
  -- sem ação escrita é a pior linha que um caderno pode ter: prova que se viu
  -- e não se diz que se fez alguma coisa.
  acao text,
  medido_por text,
  nota text,
  created_at timestamptz not null default now(),

  constraint leituras_hora check (
    hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create index if not exists leituras_temp_idx
  on leituras_temperatura (org_id, data desc);
create index if not exists leituras_temp_equip_idx
  on leituras_temperatura (equipamento_id, data desc);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. VEM PREENCHIDO
-- ═══════════════════════════════════════════════════════════════════════════
-- Uma casa que abra isto e encontre uma lista vazia fecha-a. Uma que encontre
-- o plano de higienização já escrito apaga o que não faz e fica a trabalhar.
--
-- Só em lares e centros de dia: semear um plano de limpeza de cozinha numa
-- farmácia é enchê-la de coisas que nunca vai usar. (Foi exactamente o erro
-- que rebentou quatro migrações no sprint162-165.)
do $$
declare
  o record;
  i int;
  base text[][] := array[
    -- nome                                categoria     zona          cadencia   produto
    ['Limpeza dos quartos',                'limpeza',    'Quartos',    'diaria',    'Detergente desinfetante'],
    ['Limpeza das casas de banho',         'limpeza',    'Sanitários', 'diaria',    'Desinfetante'],
    ['Limpeza das salas comuns',           'limpeza',    'Salas',      'diaria',    'Detergente desinfetante'],
    ['Limpeza do refeitório',              'limpeza',    'Refeitório', 'diaria',    'Detergente desinfetante'],
    ['Limpeza da cozinha',                 'cozinha',    'Cozinha',    'diaria',    'Desengordurante alimentar'],
    ['Limpeza dos corredores',             'limpeza',    'Corredores', 'diaria',    'Detergente'],
    ['Desinfeção de superfícies de toque', 'limpeza',    'Toda a casa','diaria',    'Desinfetante'],
    ['Recolha de resíduos',                'limpeza',    'Toda a casa','diaria',    null],
    ['Lavagem da roupa de cama',           'lavandaria', 'Lavandaria', 'semanal',   'Detergente + desinfetante'],
    ['Lavagem da roupa pessoal',           'lavandaria', 'Lavandaria', 'diaria',    'Detergente'],
    ['Engomadoria',                        'lavandaria', 'Lavandaria', 'diaria',    null],
    ['Limpeza das arcas e frigoríficos',   'cozinha',    'Cozinha',    'semanal',   'Desinfetante alimentar'],
    ['Limpeza da copa',                    'cozinha',    'Copa',       'diaria',    'Desengordurante alimentar'],
    ['Limpeza dos filtros do exaustor',    'cozinha',    'Cozinha',    'mensal',    'Desengordurante'],
    ['Controlo de pragas',                 'manutencao', 'Toda a casa','mensal',    null],
    ['Verificação dos extintores',         'manutencao', 'Toda a casa','mensal',    null]
  ];
begin
  for o in select id from organizations where kind in ('day_care', 'nursing_home') loop
    for i in 1 .. array_length(base, 1) loop
      insert into tarefas_da_casa (org_id, nome, categoria, zona, cadencia, produto, ordem)
      values (o.id, base[i][1], base[i][2], base[i][3], base[i][4], base[i][5], i)
      on conflict do nothing;
    end loop;

    -- Os equipamentos de frio mais comuns, com os intervalos da ASAE.
    insert into equipamentos (org_id, nome, tipo, zona, temp_min, temp_max, leituras_por_dia, ordem)
    values
      (o.id, 'Frigorífico da cozinha',  'frigorifico', 'Cozinha', 0,   5,  2, 1),
      (o.id, 'Arca congeladora',        'arca',        'Cozinha', -25, -18, 2, 2),
      (o.id, 'Frigorífico de medicação','frigorifico', 'Enfermagem', 2, 8, 1, 3)
    on conflict do nothing;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
--   select count(*) from tarefas_da_casa;      -- 16 por casa de lar/CD
--   select count(*) from equipamentos;         -- 3 por casa
--
-- E CORRE O sprint153 A SEGUIR: as quatro tabelas nascem com a RLS ligada e,
-- sem ele, sem política nenhuma — ninguém lê nada e parece avariado.
