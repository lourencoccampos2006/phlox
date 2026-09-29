-- supabase/sprint162_servicos_de_cuidado.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint161, e o sprint153 a seguir.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «É preciso dar para colocar mais serviços de cuidado, como banhos, entre
-- outras coisas.» E, sobre o /o-dia: «está completamente inútil neste momento
-- porque é preciso adicionar muitas mais tarefas e serviços ao software,
-- porque senão apenas aparece para registar a medicação.»
--
-- São a mesma coisa, e esta é a peça que faltava.
--
-- ── ESTA É A CAIXA «ORDENS DE SERVIÇO» ─────────────────────────────────────
-- Aquele software trabalha em quatro caixas: Planear → Ordens de Serviço →
-- Registar → Evolução. Com o sprint157 ganhámos o Planear, e o Registar já
-- existia. Isto é a do meio: o que se faz a esta pessoa, com que frequência.
--
-- ── PORQUE É QUE NÃO SÃO AÇÕES DO PLANO ────────────────────────────────────
-- O `plano_acoes` tem a forma certa — o quê, quem, com que cadência — e seria
-- tentador meter lá o banho. Mas uma ação do plano existe para chegar a um
-- OBJETIVO («voltar a almoçar na mesa grande»), e o banho não é um objetivo:
-- é o que se faz todas as terças e sextas, para sempre, a toda a gente que
-- precisa.
--
-- Metê-los no plano obrigaria a inventar um objetivo falso chamado «cuidados
-- de rotina» para pendurar dez ações — e a revisão semestral do plano passava
-- a ter de rever o banho. São duas coisas e ficam duas.
--
-- O que É partilhado é o motor da cadência (`lib/plano.ts`): «às terças e
-- sextas» quer dizer o mesmo nos dois sítios, e isso não pode ter duas
-- implementações.
--
-- ── TRÊS TABELAS ───────────────────────────────────────────────────────────
--   catalogo_servicos     o que esta casa faz (editável, e vem preenchido)
--   servicos_do_utente    quem leva o quê, e quando
--   servicos_execucoes    o que ficou feito
--
-- O catálogo vem PREENCHIDO com os serviços reais de um lar e de um centro de
-- dia. Uma casa que abre isto e encontra uma lista vazia fecha-a; uma que
-- encontra vinte e cinco serviços apaga os cinco que não faz e fica a
-- trabalhar em dois minutos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── O que esta casa faz ─────────────────────────────────────────────────────
create table if not exists catalogo_servicos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  org_id     uuid references organizations(id) on delete cascade,

  nome       text not null,
  categoria  text not null default 'outro'
               check (categoria in ('higiene', 'mobilidade', 'alimentacao',
                                    'saude', 'social', 'apoio', 'outro')),
  -- A área de permissões. É o que decide quem vê este serviço no dia — e é o
  -- primeiro passo para o que pediste a seguir: duas pessoas, dentro da mesma
  -- ferramenta, não verem as mesmas coisas.
  area       text not null default 'registos',
  -- Quanto tempo costuma levar. Serve para a conta da carga de um turno, e
  -- fica em branco quando ninguém sabe — um número inventado é pior.
  minutos    int,
  ativo      boolean not null default true,
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists catserv_org_idx on catalogo_servicos (org_id, ordem) where ativo;
-- Duas entradas com o mesmo nome na mesma casa é um engano, não uma escolha.
create unique index if not exists catserv_nome_unico
  on catalogo_servicos (org_id, lower(nome)) where org_id is not null;


-- ── Quem leva o quê, e quando ───────────────────────────────────────────────
create table if not exists servicos_do_utente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  patient_id  uuid not null references patients(id) on delete cascade,
  servico_id  uuid not null references catalogo_servicos(id) on delete cascade,

  -- O MESMO vocabulário do plano (lib/plano.ts). «Às terças e sextas» tem de
  -- querer dizer o mesmo nos dois sítios, e o motor que o calcula é um só.
  cadencia    text not null default 'diaria'
                check (cadencia in ('diaria', 'dias_da_semana', 'semanal',
                                    'quinzenal', 'mensal', 'quando_necessario')),
  dias        int[],                      -- só para 'dias_da_semana'. 0 = domingo
  turno       text check (turno is null or turno in ('manha', 'tarde', 'noite')),
  desde       date not null default current_date,

  -- O PAPEL de quem costuma fazer, não a pessoa: as pessoas mudam de turno.
  quem        text,
  notas       text,                       -- «prefere de manhã», «só com ajuda de dois»
  ativo       boolean not null default true,
  recorded_by_id uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
-- Um serviço uma vez por pessoa. Dois «banho» na mesma pessoa é um engano de
-- dedo, e dava duas linhas iguais no dia de trabalho.
create unique index if not exists servutente_unico
  on servicos_do_utente (patient_id, servico_id);
create index if not exists servutente_pt_idx on servicos_do_utente (patient_id) where ativo;
create index if not exists servutente_org_idx on servicos_do_utente (org_id) where ativo and org_id is not null;


-- ── O que ficou feito ───────────────────────────────────────────────────────
create table if not exists servicos_execucoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  servico_utente_id uuid not null references servicos_do_utente(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,

  data         date not null default current_date,
  turno        text check (turno is null or turno in ('manha', 'tarde', 'noite')),
  feito_por    text,
  feito_em     timestamptz not null default now(),
  nota         text,
  recorded_by_id uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
-- Uma marca por serviço, por dia e por turno. `coalesce` porque em Postgres
-- NULL nunca é igual a NULL: sem isso, um serviço sem turno nunca colidia
-- consigo próprio e o índice não protegia nada.
create unique index if not exists servexec_uma_por_turno
  on servicos_execucoes (servico_utente_id, data, coalesce(turno, '-'));
create index if not exists servexec_pt_idx on servicos_execucoes (patient_id, data desc);
create index if not exists servexec_org_dia_idx on servicos_execucoes (org_id, data)
  where org_id is not null;

-- O que NÃO foi feito continua a ir para `cuidados_nao_prestados` (sprint154),
-- que é a mesma tabela para o produto todo. Duas tabelas a guardar recusas
-- seria a mesma pergunta com duas respostas.


-- ── O CATÁLOGO VEM PREENCHIDO ───────────────────────────────────────────────
-- Vinte e cinco serviços reais de um lar e de um centro de dia, para cada casa
-- que ainda não tenha nenhum. Uma casa que abre isto e encontra uma lista
-- vazia fecha-a e continua a fazer tudo de cabeça.
--
-- São sugestões, não regras: apagam-se, mudam-se de nome, acrescentam-se.
do $$
declare
  o record;
  n int := 0;
  base text[][] := array[
    -- nome                        categoria       area         minutos
    ['Banho',                      'higiene',      'registos',  '30'],
    ['Higiene íntima',             'higiene',      'registos',  '10'],
    ['Higiene oral',               'higiene',      'registos',  '5'],
    ['Mudança de fralda',          'higiene',      'registos',  '10'],
    ['Vestir e despir',            'higiene',      'registos',  '15'],
    ['Cuidados ao cabelo',         'higiene',      'registos',  '15'],
    ['Corte de unhas',             'higiene',      'registos',  '15'],
    ['Barba',                      'higiene',      'registos',  '10'],

    ['Levante',                    'mobilidade',   'registos',  '15'],
    ['Deitar',                     'mobilidade',   'registos',  '15'],
    ['Posicionamento',             'mobilidade',   'registos',  '10'],
    ['Transferência',              'mobilidade',   'registos',  '10'],
    ['Marcha acompanhada',         'mobilidade',   'registos',  '20'],
    ['Exercícios de mobilidade',   'mobilidade',   'registos',  '20'],

    ['Apoio à refeição',           'alimentacao',  'registos',  '30'],
    ['Alimentação assistida',      'alimentacao',  'registos',  '40'],
    ['Hidratação',                 'alimentacao',  'registos',  '5'],

    ['Tratamento de feridas',      'saude',        'feridas',   '20'],
    ['Sinais vitais',              'saude',        'registos',  '10'],
    ['Pesagem',                    'saude',        'registos',  '5'],
    ['Acompanhamento a consulta',  'saude',        'registos',  '120'],
    ['Fisioterapia',               'saude',        'registos',  '45'],

    ['Companhia e conversa',       'social',       'registos',  '20'],
    ['Passeio',                    'social',       'atividades','45'],
    ['Apoio ao telefonema à família', 'social',    'familias',  '10']
  ];
  i int;
begin
    -- `select id from organizations`, e nao `select id, user_id`:
    -- `organizations` NAO tem `user_id`. Tem `owner_id` — e, nesta base de
    -- dados, esta a null em todas as dez casas. Escrevi `user_id` em quatro
    -- migracoes seguidas e as quatro rebentaram na cara do Fernando com
    -- «column user_id does not exist».
    --
    -- E `user_id` sai tambem da lista de colunas: estas linhas sao da CASA,
    -- nao de uma pessoa. Ninguem as escreveu, e por isso a coluna fica a
    -- null — que e a verdade. Quem as pode ler e quem pertence a casa, pela
    -- politica `_casa` que usa o `org_id`; a politica `_proprio` nunca se
    -- aplica a elas, e esta certo assim.
    --
    -- E so as casas que sao lar ou centro de dia: semear «banho assistido»
    -- ou «contrato de prestacao de servicos» numa farmacia e encher-lhe a
    -- base de dados de coisas que ela nunca vai usar.
  for o in select id from organizations where kind in ('day_care', 'nursing_home') loop
    -- Só as casas que ainda não têm catálogo nenhum. Correr isto outra vez
    -- não desfaz o que alguém já tenha apagado ou renomeado.
    if exists (select 1 from catalogo_servicos where org_id = o.id) then
      continue;
    end if;
    for i in 1 .. array_length(base, 1) loop
      insert into catalogo_servicos (org_id, nome, categoria, area, minutos, ordem)
      values (o.id, base[i][1], base[i][2], base[i][3], base[i][4]::int, i)
      on conflict do nothing;
    end loop;
    n := n + 1;
  end loop;
  raise notice '% casa(s) ficaram com o catalogo de servicos preenchido.', n;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['catalogo_servicos', 'servicos_do_utente', 'servicos_execucoes'] loop
    execute format('alter table public.%I enable row level security', t);

    begin
      execute format($f$
        create policy %I on public.%I for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()))
      $f$, t || '_proprio', t);
    exception when duplicate_object then null; end;

    begin
      execute format($f$
        create policy %I on public.%I for all
          using (org_id is not null and org_id in (
            select org_id from org_members where user_id = (select auth.uid()) and active = true))
          with check (org_id is not null and org_id in (
            select org_id from org_members where user_id = (select auth.uid()) and active = true))
      $f$, t || '_casa', t);
    exception when duplicate_object then null; end;

    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;

do $$ begin
  alter publication supabase_realtime add table servicos_execucoes;
exception when others then null; end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- Quantos serviços ficaram no catálogo da tua casa:
--   select categoria, count(*) from catalogo_servicos group by categoria;
--
-- select count(*) from servicos_do_utente;   -- 0, ainda ninguém tem nenhum
-- select count(*) from servicos_execucoes;   -- 0
--
-- E depois, na app: abre a ficha de alguém, secção «Cuidados de rotina»,
-- escolhe o banho às terças e sextas de manhã. Na terça de manhã ele aparece
-- no /o-dia.
