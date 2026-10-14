-- sprint183_apoio_domiciliario.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- SERVIÇO DE APOIO DOMICILIÁRIO (SAD) — a resposta que faltava.
--
-- ── O QUE FALTAVA, E PORQUE É QUE NINGUÉM DAVA POR ISSO ────────────────────
-- A ficha de inscrição já pergunta a valência, e `apoio_domiciliario` é uma
-- das quatro opções (sprint165). Uma casa podia pôr uma pessoa na lista de
-- espera para apoio domiciliário, atribuir-lhe prioridade e admiti-la — e a
-- partir daí não havia nada. A pessoa passava a ser um utente como os outros,
-- numa casa que assume que todos os utentes estão cá dentro.
--
-- O apoio domiciliário é o contrário disso: a equipa é que vai lá. E isso muda
-- tudo o que o resto da aplicação dá por garantido:
--
--   · Não há presença para marcar. Não há chegada ao centro nem saída.
--   · Há uma MORADA, e um caminho entre moradas, e a ordem por que se fazem.
--   · Há uma porta que tem de se abrir: quem tem a chave, quem abre, o cão.
--   · Há visitas em que não está lá ninguém — e isso é um acontecimento a
--     registar, não um erro de quem foi.
--   · Os serviços são os da Portaria 38/2013: higiene pessoal, higiene
--     habitacional, refeições, tratamento de roupa, acompanhamento ao
--     exterior, teleassistência. Não é uma lista que uma casa invente.
--
-- ── O QUE ISTO *NÃO* FAZ: UM TERCEIRO TIPO DE INSTITUIÇÃO ──────────────────
-- A primeira ideia era `institution = 'sad'`. Está errada, e o Fernando já
-- disse a frase que a mata: «não há 5 tipos de instituição, apenas dois».
--
-- Um lar com apoio domiciliário não é um terceiro tipo de casa — é um lar que
-- também faz apoio domiciliário. É o que acontece na prática: a mesma IPSS
-- tem ERPI, centro de dia e SAD com a mesma equipa e a mesma direção técnica.
-- Fazer disto um tipo de instituição obrigava a casa a escolher um, e a
-- escolher mal.
--
-- Por isso o SAD é um MÓDULO: as duas tabelas abaixo, e um utente que tenha
-- plano é um utente que recebe apoio em casa. Quem não tem plano não vê
-- diferença nenhuma.
--
-- ── O QUE NÃO SE DUPLICA ───────────────────────────────────────────────────
-- A morada, as coordenadas e o telefone já vivem em `patients` (a morada
-- desde sempre; `lat`/`lon` desde o sprint136, para o mapa dos transportes).
-- Copiá-las para cá dava duas moradas para a mesma pessoa, e um dia uma delas
-- ficaria velha sem ninguém saber qual. O que fica aqui é só o que é do apoio
-- domiciliário e de mais nada: como se entra, que serviços, que dias.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. O PLANO: quem recebe apoio em casa, que dias, e como se entra
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.sad_planos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  patient_id    uuid not null references public.patients(id) on delete cascade,

  ativo         boolean not null default true,
  desde         date,
  ate           date,

  -- Os dias da semana em que se vai lá. 1 = segunda … 7 = domingo, como o
  -- resto da aplicação (ver as `weekdays` do /apoio-servicos e do /care-log).
  dias          smallint[] not null default '{}',
  -- A hora a que se costuma chegar. Não é um compromisso com a família — é o
  -- que ordena a volta do dia.
  hora_prevista time,

  -- ── COMO SE ENTRA ──────────────────────────────────────────────────────
  -- A coisa mais prática deste módulo inteiro, e a que não tem sítio em
  -- nenhuma outra tabela. «A chave está na vizinha do 2.º esquerdo»,
  -- «a filha abre às 9», «não toque à campainha, o marido dorme de dia»,
  -- «o cão está solto no quintal». Quem vai pela primeira vez a uma casa
  -- precisa disto antes de precisar de qualquer outra coisa.
  como_entrar   text,
  notas         text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Uma pessoa tem UM plano de apoio domiciliário. Dois planos para a mesma
-- pessoa são duas voltas à mesma casa no mesmo dia, e a equipa a discutir qual
-- é o certo.
create unique index if not exists sad_planos_patient_unq
  on public.sad_planos (patient_id);

create index if not exists sad_planos_org_idx on public.sad_planos (org_id);
create index if not exists sad_planos_ativo_idx on public.sad_planos (org_id, ativo);

alter table public.sad_planos enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. OS SERVIÇOS DE CADA PLANO
-- ═══════════════════════════════════════════════════════════════════════════
-- Linhas e não colunas booleanas, por duas razões: cada serviço tem os SEUS
-- dias (a higiene pessoal é todos os dias, a habitacional é à terça) e as suas
-- notas; e um conjunto de colunas `tem_higiene`, `tem_refeicao`… obriga a uma
-- migração cada vez que a lista muda.
create table if not exists public.sad_servicos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  plano_id    uuid not null references public.sad_planos(id) on delete cascade,

  -- A lista da Portaria 38/2013, mais `enfermagem` (que algumas casas fazem
  -- em protocolo) e `outro`. O CHECK é de propósito: é uma lista oficial, e
  -- um valor escrito à mão num sítio e noutro impede qualquer contagem.
  servico     text not null check (servico in (
    'higiene_pessoal', 'higiene_habitacional', 'refeicao', 'roupa',
    'acompanhamento', 'teleassistencia', 'enfermagem', 'outro'
  )),
  dias        smallint[] not null default '{}',
  notas       text,

  criado_em   timestamptz not null default now()
);

-- O mesmo serviço duas vezes no mesmo plano são duas linhas a dizer o mesmo.
create unique index if not exists sad_servicos_plano_servico_unq
  on public.sad_servicos (plano_id, servico);

create index if not exists sad_servicos_org_idx on public.sad_servicos (org_id);

alter table public.sad_servicos enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. A VISITA: o que ficou feito, por quem, a que horas
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.sad_visitas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  patient_id    uuid not null references public.patients(id) on delete cascade,

  data          date not null,
  chegou_as     time,
  saiu_as       time,

  -- Quem foi. Texto e não uma referência: quem vai às casas é muitas vezes
  -- uma dupla, e às vezes é alguém que não tem conta na aplicação.
  quem          text,

  -- Os serviços que ficaram feitos, dos que o plano prevê.
  feitos        text[] not null default '{}',

  -- ── «NÃO ESTAVA NINGUÉM» É UM REGISTO, NÃO UM ERRO ────────────────────
  -- A equipa foi, bateu à porta, e não abriu. Isso tem de ficar escrito: é o
  -- que explica à família porque não houve almoço, e é o primeiro sinal de
  -- que alguma coisa se passou com a pessoa. Sem um sítio para o dizer, a
  -- visita não se registava — e o dia ficava igual a um dia em que ninguém
  -- foi lá.
  sem_resposta  boolean not null default false,
  -- O que estava previsto e não se fez, e porquê. A recusa da pessoa conta.
  nao_feito     text,
  notas         text,

  criado_em     timestamptz not null default now()
);

-- Pode haver mais do que uma visita no mesmo dia à mesma pessoa (manhã e
-- jantar são duas), por isso NÃO há unicidade por (patient_id, data).
create index if not exists sad_visitas_org_data_idx on public.sad_visitas (org_id, data);
create index if not exists sad_visitas_patient_idx on public.sad_visitas (patient_id, data);

alter table public.sad_visitas enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. QUEM LÊ E QUEM ESCREVE
-- ═══════════════════════════════════════════════════════════════════════════
-- O mesmo par do resto da casa: a permissiva da organização decide QUAL casa,
-- e as restritivas por área (sprint153) decidem QUEM lá dentro.
--
-- As áreas não são novas de propósito. O plano é quem recebe o quê, e isso é
-- `utentes`; a visita é um registo do dia, e isso é `registos`. Inventar uma
-- vigésima quinta área punha mais duas linhas na página de acessos para dizer
-- o que as que lá estão já dizem.
do $$
declare
  tabelas text[] := array['sad_planos', 'sad_servicos', 'sad_visitas'];
  t text;
begin
  foreach t in array tabelas loop
    begin
      execute format($p$
        create policy %I on public.%I for all
          using (
            org_id is not null
            and org_id in (
              select org_id from public.org_members
               where user_id = (select auth.uid()) and active = true
            )
          )
          with check (
            org_id is not null
            and org_id in (
              select org_id from public.org_members
               where user_id = (select auth.uid()) and active = true
            )
          )$p$, t || '_casa', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- As restritivas por área. O corpo é LETRA POR LETRA o que o gerador do
-- sprint153 escreve — incluindo o `coalesce(capabilities,
-- default_capabilities(role))`, que é o que faz as permissões do PAPEL valerem
-- quando a pessoa não tem lista própria. Escrever aqui uma variante parecida
-- seria criar uma segunda regra que um dia diverge da primeira em silêncio.
--
-- Na próxima regeração do sprint153 estas três tabelas entram na lista dele e
-- este bloco pode sair.
--
-- O ciclo é indexado sobre uma matriz 2D e não `foreach a, b, c in array`:
-- essa forma NÃO existe em PL/pgSQL (o `FOREACH` com várias variáveis espera
-- uma linha composta) e fez o sprint181 falhar com
-- «ERROR: 42804: cannot assign non-composite value to a row variable».
do $$
declare
  mapa text[][] := array[
    ['sad_planos',   'utentes',  'sad_planos_area'],
    ['sad_servicos', 'utentes',  'sad_servicos_area'],
    ['sad_visitas',  'registos', 'sad_visitas_area']
  ];
  acoes text[][] := array[
    ['ver',     'select', 'ver'],
    ['editar',  'insert', 'criar'],
    ['editar',  'update', 'mudar'],
    ['eliminar','delete', 'apagar']
  ];
  i int;
  j int;
  chave text;
  nome text;
begin
  for i in 1 .. array_length(mapa, 1) loop
    for j in 1 .. array_length(acoes, 1) loop
      chave := mapa[i][2] || '.' || acoes[j][1];
      nome  := mapa[i][3] || '_' || acoes[j][3];
      begin
        if acoes[j][2] = 'insert' then
          execute format($f$
            create policy %I on public.%I as restrictive for insert with check (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, mapa[i][1], chave);
        elsif acoes[j][2] = 'update' then
          execute format($f$
            create policy %I on public.%I as restrictive for update using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, mapa[i][1], chave);
        elsif acoes[j][2] = 'select' then
          execute format($f$
            create policy %I on public.%I as restrictive for select using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, mapa[i][1], chave);
        else
          execute format($f$
            create policy %I on public.%I as restrictive for delete using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, mapa[i][1], chave);
        end if;
      exception when duplicate_object then null; end;
    end loop;
  end loop;
end $$;


-- ── 5. A hora a que o plano mudou ──────────────────────────────────────────
-- Serve à página para dizer «revisto a 3 de março», que é o que uma visita da
-- Segurança Social pergunta a seguir a «quem recebe apoio domiciliário».
create or replace function public.sad_planos_tocar()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists sad_planos_tocar_trg on public.sad_planos;
create trigger sad_planos_tocar_trg
  before update on public.sad_planos
  for each row execute function public.sad_planos_tocar();

notify pgrst, 'reload schema';
