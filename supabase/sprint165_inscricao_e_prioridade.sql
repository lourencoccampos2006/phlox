-- supabase/sprint165_inscricao_e_prioridade.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint164, e o sprint153 no fim de todos.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «É necessário mesmo colocar uma melhor maneira de inscrever as pessoas, pois
--  nem a sua data de nascimento é preciso, tens de colocar muito mais coisas.
--  Inclusivamente uma calculadora automática com os critérios de prioridade
--  de entrada.»
--
-- ── O QUE EU ENCONTREI ──────────────────────────────────────────────────────
-- A tabela `patients` tem 50 colunas. O formulário de inscrição usa 12. A
-- morada, o NIF, o número de utente, o médico de família, a dieta, a
-- mobilidade, o estado cognitivo, a história de vida — está tudo lá, criado
-- em sprints antigos, e nunca ninguém o conseguiu preencher.
--
-- Não foi preciso inventar quase nada. Foi preciso abrir o que já existia.
--
-- ── A PARTE QUE FALTAVA A SÉRIO: INSCRIÇÃO NÃO É UTENTE ────────────────────
-- Hoje o botão «Novo utente» cria a pessoa na casa nesse instante. Isso serve
-- para quem já lá está. Não serve para a realidade portuguesa, que é:
--
--   a família preenche a ficha  →  fica em lista de espera  →  abre vaga  →  entra
--
-- Entre o primeiro e o último passo passam meses, às vezes anos. Hoje não há
-- onde guardar essas pessoas — e são precisamente elas sobre quem os critérios
-- de prioridade decidem. Uma calculadora de prioridade sem lista de espera não
-- ordena nada; é uma conta que não serve para nada.
--
-- Por isso há `candidaturas`. Quem é admitido passa a `patients`, e a
-- candidatura fica com o registo de que foi admitida e com quantos pontos
-- tinha nesse dia.
--
-- ── PORQUE É QUE OS PESOS SÃO EDITÁVEIS E NÃO ESTÃO NO CÓDIGO ──────────────
-- Os critérios de admissão de uma IPSS estão no seu REGULAMENTO INTERNO, e o
-- regulamento é de cada casa. Duas instituições na mesma rua dão pesos
-- diferentes à retaguarda familiar. Se eu escrevesse os pesos em TypeScript,
-- estava a impor o regulamento de uma casa imaginária a todas as outras — e a
-- primeira direção que comparasse a ordem da lista com o seu próprio
-- regulamento deixava de confiar no número.
--
-- Vêm semeados com os critérios habituais. São um ponto de partida, não uma
-- regra: mudam-se os pesos, apagam-se, acrescentam-se.
--
-- ── A CALCULADORA NUNCA DECIDE ──────────────────────────────────────────────
-- Ordena a lista e mostra a conta por extenso. Quem admite é a direção. Não há
-- nem nunca haverá «admitir o primeiro da lista» automático: a lei obriga a
-- decisão a ser de pessoas, e há sempre coisas que nenhum critério apanha.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. A IDADE DEIXA DE SER ESCRITA À MÃO
-- ═══════════════════════════════════════════════════════════════════════════
-- `patients.age` é um inteiro que alguém escreveu no dia da inscrição. Quem
-- entrou com 78 fica com 78 para sempre. 149 sítios no código leem essa
-- coluna — não os vou reescrever a todos; vou fazer com que a coluna passe a
-- estar certa sozinha.
--
-- O gatilho trata de quem se escreve. A função `refrescar_idades()` trata dos
-- aniversários de quem ninguém tocou, e é chamada uma vez por dia pelo cron
-- que já existe (/api/cron/diario). Não é preciso cron novo nem mexer no
-- vercel.json — que no plano Hobby rebenta com o deploy.

alter table patients add column if not exists date_of_birth date;

create or replace function patients_idade_da_data()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Uma data no futuro é engano de quem escreveu (troca de dia com mês, ou o
  -- ano a mais). Guarda-se à mesma, para a pessoa ver o que pôs e corrigir,
  -- mas não se calcula uma idade negativa a partir dela.
  if new.date_of_birth is not null and new.date_of_birth <= current_date then
    new.age := extract(year from age(current_date, new.date_of_birth))::int;
  end if;
  return new;
end $$;

drop trigger if exists patients_idade on patients;
create trigger patients_idade
  before insert or update of date_of_birth on patients
  for each row execute function patients_idade_da_data();

create or replace function refrescar_idades()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update patients
     set age = extract(year from age(current_date, date_of_birth))::int
   where date_of_birth is not null
     and date_of_birth <= current_date
     -- Só quem fez anos. Num dia normal são zero ou uma pessoa; sem esta
     -- linha era a tabela inteira reescrita todas as manhãs.
     and age is distinct from extract(year from age(current_date, date_of_birth))::int;
  get diagnostics n = row_count;
  return n;
end $$;

-- `security definer` porque o cron corre sem sessão e tem de poder tocar em
-- todas as casas. Mas isso torna-a chamável por RPC por qualquer conta com
-- sessão — e ninguém de fora tem nada que mandar reescrever a tabela inteira,
-- por muito inofensivo que o conteúdo da escrita seja.
revoke all on function refrescar_idades() from public, anon, authenticated;
grant execute on function refrescar_idades() to service_role;

-- Quem já tem data de nascimento fica com a idade certa hoje.
select refrescar_idades();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. O QUE FALTAVA A UMA FICHA DE INSCRIÇÃO A SÉRIO
-- ═══════════════════════════════════════════════════════════════════════════
-- Tudo o que está numa ficha de inscrição em papel de qualquer lar do país e
-- que aqui não tinha onde ficar. `if not exists` em todas, para isto poder
-- correr duas vezes sem estragar nada.

alter table patients add column if not exists telefone          text;
alter table patients add column if not exists contacto_relacao  text;  -- filha, sobrinho, vizinha
alter table patients add column if not exists naturalidade      text;
alter table patients add column if not exists estado_civil      text;
alter table patients add column if not exists escolaridade      text;
alter table patients add column if not exists profissao         text;  -- alimenta a história de vida
alter table patients add column if not exists acordo            text;  -- quem paga: acordo ou particular
alter table patients add column if not exists candidatura_id    uuid;  -- de onde veio, se veio da lista


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. OS CRITÉRIOS DE PRIORIDADE DA CASA
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists criterios_entrada (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete cascade,

  nome        text not null,
  -- Porque é que este critério conta. Sem isto, daqui a dois anos ninguém na
  -- casa sabe dizer porque é que a habitação vale 2 e a idade vale 1.
  descricao   text,

  -- Quanto pesa em relação aos outros. A conta é peso × pontos da resposta.
  peso        int not null default 1 check (peso between 0 and 10),

  -- As respostas possíveis e o que valem:
  --   [{"valor":"grande","rotulo":"Grande dependente","pontos":3}, ...]
  -- Nos critérios automáticos cada opção leva também um `de`, que é o valor
  -- mínimo a partir do qual essa faixa se aplica.
  opcoes      jsonb not null default '[]'::jsonb,

  -- null      → alguém responde
  -- 'idade'   → sai da data de nascimento
  -- 'espera'  → sai de há quantos meses a candidatura está aberta
  automatico  text check (automatico in ('idade', 'espera')),

  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists criterios_org_idx on criterios_entrada (org_id, ordem) where ativo;
create unique index if not exists criterios_nome_unico
  on criterios_entrada (org_id, lower(nome)) where org_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. A LISTA DE ESPERA
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists candidaturas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  org_id         uuid references organizations(id) on delete cascade,

  -- ── Quem é ───────────────────────────────────────────────────────────────
  nome             text not null,
  data_nascimento  date,
  sexo             text,
  nif              text,
  sns              text,
  naturalidade     text,
  estado_civil     text,
  escolaridade     text,
  profissao        text,

  -- ── Onde vive ────────────────────────────────────────────────────────────
  morada        text,
  freguesia     text,
  concelho      text,
  telefone      text,

  -- ── Quem trata dela ──────────────────────────────────────────────────────
  contacto_nome     text,
  contacto_telefone text,
  contacto_relacao  text,
  contacto_morada   text,

  -- ── Saúde ────────────────────────────────────────────────────────────────
  diagnosticos      text,
  alergias          text,
  medicacao         text,
  medico            text,
  mobilidade        text,
  estado_cognitivo  text,
  dieta             text,

  -- ── O que procura ────────────────────────────────────────────────────────
  valencia      text check (valencia in ('lar', 'centro_dia', 'apoio_domiciliario', 'outra')),
  acordo        text,
  -- Quando quer entrar. Muita gente inscreve-se «para daqui a um ano».
  desejada_em   date,

  -- ── A calculadora ────────────────────────────────────────────────────────
  -- Guardam-se as RESPOSTAS, não a pontuação. A pontuação é recalculada
  -- sempre que se lê, com os pesos que a casa tem HOJE. Se a direção mudar o
  -- regulamento, a lista reordena-se — que é exatamente o que uma direção
  -- espera quando muda o regulamento. Uma pontuação guardada ficaria a
  -- discordar em silêncio da conta que o ecrã mostra por baixo dela.
  --   {"dependencia": "grande", "habitacao": "precaria", ...}
  respostas     jsonb not null default '{}'::jsonb,

  -- ── Em que pé está ───────────────────────────────────────────────────────
  estado        text not null default 'em_espera'
                  check (estado in ('em_espera', 'admitido', 'desistiu', 'recusado', 'suspenso')),
  -- A pontuação CONGELADA no dia da admissão. A de cima muda com os pesos;
  -- esta não pode mudar, porque é a justificação de uma decisão já tomada e
  -- alguém a pode vir pedir.
  pontuacao_admissao int,
  patient_id    uuid references patients(id) on delete set null,
  admitida_em   date,
  fechada_em    date,
  motivo_fecho  text,

  notas         text,
  criada_em     timestamptz not null default now(),
  criada_por    text,
  atualizada_em timestamptz not null default now()
);
create index if not exists candidaturas_org_idx    on candidaturas (org_id, estado);
create index if not exists candidaturas_espera_idx on candidaturas (org_id) where estado = 'em_espera';
create index if not exists candidaturas_nasc_idx   on candidaturas (data_nascimento) where data_nascimento is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. OS CRITÉRIOS HABITUAIS, SEMEADOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Estes são os que aparecem na esmagadora maioria dos regulamentos internos de
-- IPSS em Portugal. Não são lei — a lei manda ter critérios escritos, não diz
-- quais. São o ponto de partida para a direção mexer.
do $$
declare
  o record;
  n int := 0;
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
    if exists (select 1 from criterios_entrada where org_id = o.id) then continue; end if;

    insert into criterios_entrada (org_id, nome, descricao, peso, ordem, automatico, opcoes) values

    (o.id, 'Grau de dependência',
     'Quanto precisa de outra pessoa para o dia a dia. É o critério com mais peso na maioria dos regulamentos.',
     3, 1, null, '[
       {"valor":"autonomo",  "rotulo":"Autónomo",               "pontos":0},
       {"valor":"ligeira",   "rotulo":"Dependência ligeira",    "pontos":1},
       {"valor":"parcial",   "rotulo":"Dependência parcial",    "pontos":2},
       {"valor":"grande",    "rotulo":"Grande dependente",      "pontos":3},
       {"valor":"total",     "rotulo":"Dependência total",      "pontos":4}
     ]'::jsonb),

    (o.id, 'Retaguarda familiar',
     'Se há alguém de quem a pessoa possa depender. Quem não tem ninguém não tem alternativa nenhuma.',
     3, 2, null, '[
       {"valor":"presente",  "rotulo":"Família presente e disponível",     "pontos":0},
       {"valor":"limitada",  "rotulo":"Família presente, com dificuldades","pontos":1},
       {"valor":"distante",  "rotulo":"Família distante ou ausente",       "pontos":2},
       {"valor":"sozinho",   "rotulo":"Sem retaguarda familiar",           "pontos":4}
     ]'::jsonb),

    (o.id, 'Situação de quem cuida',
     'Um cuidador esgotado ou doente é uma entrada que não pode esperar pela vaga seguinte.',
     2, 3, null, '[
       {"valor":"nao_aplica","rotulo":"Não precisa de cuidador",     "pontos":0},
       {"valor":"disponivel","rotulo":"Cuidador disponível",         "pontos":0},
       {"valor":"sobrecarga","rotulo":"Cuidador em sobrecarga",      "pontos":2},
       {"valor":"incapaz",   "rotulo":"Cuidador doente ou incapaz",  "pontos":4}
     ]'::jsonb),

    (o.id, 'Condições habitacionais',
     'Onde e como vive. Uma casa com escadas e sem banho no piso é uma barreira real, não um pormenor.',
     2, 4, null, '[
       {"valor":"adequada",  "rotulo":"Habitação adequada",              "pontos":0},
       {"valor":"barreiras", "rotulo":"Com barreiras (escadas, banho)",  "pontos":1},
       {"valor":"precaria",  "rotulo":"Condições precárias",             "pontos":3},
       {"valor":"sem_casa",  "rotulo":"Sem habitação",                   "pontos":4}
     ]'::jsonb),

    (o.id, 'Situação económica',
     'Se consegue pagar outra solução. Quem pode contratar apoio em casa tem uma saída que outros não têm.',
     2, 5, null, '[
       {"valor":"confortavel","rotulo":"Rendimento confortável",   "pontos":0},
       {"valor":"suficiente", "rotulo":"Rendimento suficiente",    "pontos":1},
       {"valor":"baixo",      "rotulo":"Rendimento baixo",         "pontos":2},
       {"valor":"carencia",   "rotulo":"Situação de carência",     "pontos":4}
     ]'::jsonb),

    (o.id, 'Urgência da situação',
     'Se veio sinalizada por alguém de fora — centro de saúde, segurança social, tribunal.',
     3, 6, null, '[
       {"valor":"sem",        "rotulo":"Sem urgência",                        "pontos":0},
       {"valor":"sinalizado", "rotulo":"Sinalizado (saúde / segurança social)","pontos":2},
       {"valor":"risco",      "rotulo":"Situação de risco",                   "pontos":3},
       {"valor":"emergencia", "rotulo":"Emergência social",                   "pontos":4}
     ]'::jsonb),

    (o.id, 'Área de residência',
     'Muitos acordos obrigam a servir primeiro a freguesia e o concelho da instituição.',
     1, 7, null, '[
       {"valor":"fora",      "rotulo":"Fora do concelho",             "pontos":0},
       {"valor":"concelho",  "rotulo":"No concelho",                  "pontos":1},
       {"valor":"freguesia", "rotulo":"Na freguesia da instituição",  "pontos":2}
     ]'::jsonb),

    -- ── Os dois que ninguém responde ────────────────────────────────────────
    (o.id, 'Idade',
     'Sai sozinho da data de nascimento. Ninguém responde a este.',
     1, 8, 'idade', '[
       {"valor":"ate64", "rotulo":"Até 64 anos",    "de":0,  "pontos":0},
       {"valor":"65a74", "rotulo":"65 a 74 anos",   "de":65, "pontos":1},
       {"valor":"75a84", "rotulo":"75 a 84 anos",   "de":75, "pontos":2},
       {"valor":"85mais","rotulo":"85 anos ou mais","de":85, "pontos":3}
     ]'::jsonb),

    (o.id, 'Tempo de espera',
     'Há quanto tempo está inscrito. Sai sozinho da data da inscrição, e é o que impede que quem esperou três anos seja sempre ultrapassado.',
     1, 9, 'espera', '[
       {"valor":"m0",  "rotulo":"Menos de 6 meses",   "de":0,  "pontos":0},
       {"valor":"m6",  "rotulo":"6 meses a 1 ano",    "de":6,  "pontos":1},
       {"valor":"m12", "rotulo":"1 a 2 anos",         "de":12, "pontos":2},
       {"valor":"m24", "rotulo":"2 a 3 anos",         "de":24, "pontos":3},
       {"valor":"m36", "rotulo":"Mais de 3 anos",     "de":36, "pontos":4}
     ]'::jsonb);

    n := n + 1;
  end loop;
  raise notice '% casa(s) ficaram com os 9 criterios de prioridade sugeridos.', n;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['criterios_entrada', 'candidaturas'] loop
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


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- select nome, peso, automatico, jsonb_array_length(opcoes) as respostas
--   from criterios_entrada order by ordem;        -- 9 linhas
--
-- A idade a corrigir-se sozinha:
-- update patients set date_of_birth = '1940-03-11' where name = 'Lara';
-- select name, date_of_birth, age from patients where name = 'Lara';   -- 86
--
-- select count(*) from candidaturas;              -- 0, ainda ninguém se inscreveu
