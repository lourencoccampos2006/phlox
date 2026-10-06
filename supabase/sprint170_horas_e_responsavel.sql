-- supabase/sprint170_horas_e_responsavel.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto. Se ainda não correste o sprint169, este ficheiro já o
-- inclui — o primeiro bloco é o mesmo, e correr os dois não faz mal nenhum.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «No /o-dia as coisas aparecem de forma estranha, não há horas, não há ordem,
-- apenas tarefas, muda isso, é preciso haver horas para as coisas, medicação
-- incluída.»
--
-- E: «É necessário haver em várias ferramentas a atribuição de um responsável.»
--
-- São dois problemas e a mesma migração, porque são as duas colunas que
-- faltavam às mesmas cinco tabelas.
--
-- ── PORQUE É QUE NÃO HAVIA HORAS ────────────────────────────────────────────
-- De tudo o que enche o dia, só as ATIVIDADES sabem a que horas são
-- (`activities.start_time`). A medicação sabe o TURNO (`patient_meds.shifts`),
-- os cuidados de rotina sabem o turno, as ações do plano sabem o turno.
--
-- Um turno são sete horas. Dizer que a insulina é «de manhã» e o banho é «de
-- manhã» é dizer que são a mesma coisa — e não são: a insulina é antes do
-- pequeno-almoço e o banho é às dez. Sem hora não há ordem nenhuma que
-- signifique alguma coisa, e por isso a página mostrava uma pilha.
--
-- ── A HORA É OPCIONAL, E ISSO É DE PROPÓSITO ────────────────────────────────
-- Não se obriga ninguém a pôr hora em nada. Uma casa que não queira horas
-- continua a trabalhar por turnos exactamente como antes — o que tem hora
-- aparece no relógio, o que não tem aparece a seguir, em «a qualquer hora».
--
-- Pôr uma hora falsa em tudo para a lista ficar ordenada seria inventar
-- informação clínica. Num centro de dia então, onde metade das coisas
-- acontecem quando calha, era mentira a dobrar.
--
-- ── PORQUE É QUE A MEDICAÇÃO LEVA `jsonb` E O RESTO LEVA `text` ────────────
-- Um cuidado de rotina tem UM turno (`servicos_do_utente.turno`), por isso tem
-- uma hora. Um medicamento tem VÁRIOS (`patient_meds.shifts` é uma lista): o
-- brifen é de manhã e à noite, e são horas diferentes.
--
-- A tentação é um segundo array, `horas`, à mesma ordem que `shifts`. É a
-- forma clássica de partir isto: basta alguém tirar um turno do meio da lista
-- e todas as horas a seguir passam a estar na linha errada — e ninguém repara,
-- porque continua a haver uma hora em cada sítio.
--
-- Por isso é um objeto com o turno na chave:
--     {"manha": "08:00", "noite": "22:00"}
-- Não há ordem para se perder, e um turno sem hora é simplesmente uma chave
-- que não existe.
--
-- ── O RESPONSÁVEL: DUAS COLUNAS, E NÃO UMA ─────────────────────────────────
-- `responsavel_id` é quem é — é por ele que a pessoa encontra o que lhe
-- compete, e é ele que tem de ser um utilizador a sério.
-- `responsavel` é o NOME no momento em que foi atribuído.
--
-- Guardar o nome parece redundante até alguém sair da casa: o `id` deixa de
-- resolver para lado nenhum e o registo do que aconteceu fica sem autor. É o
-- mesmo par que o `incidents` já usa desde o sprint133 (`responsavel_id` +
-- `responsavel`), e não se inventa aqui um segundo feitio para a mesma coisa.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. A COLUNA QUE FAZ AS ETIQUETAS FUNCIONAR   (igual ao sprint169)
-- ═══════════════════════════════════════════════════════════════════════════
-- «As etiquetas não funcionam, não dá para adicionar etiquetas a utentes.»
--
-- Não são só as etiquetas. Todo o código que escreve numa tabela da casa passa
-- por `scope.stamp()` (lib/orgScope.ts), que acrescenta `user_id`, `org_id` e
-- `recorded_by_id`. As tabelas feitas na semana passada não têm a terceira — e
-- o PostgREST recusa a escrita INTEIRA quando lhe mandam uma coluna que não
-- existe:
--
--     POST /rest/v1/etiquetas_do_utente
--     → 400  Could not find the 'recorded_by_id' column
--
-- Medido contra esta base de dados: com a coluna no corpo, 400; sem ela, 201.
-- Pôr uma etiqueta em alguém nunca funcionou — nem inscrever, nem marcar no
-- calendário, nem guardar um modelo, nem criar um serviço no catálogo, nem
-- acrescentar um objetivo ao plano.
--
-- É dinâmico e não uma lista escrita à mão porque uma lista à mão é uma lista
-- que volta a escapar — foi assim que isto aconteceu.
do $$
declare
  t record;
  n int := 0;
  nomes text := '';
begin
  for t in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name = 'org_id'
       -- Só tabelas. Uma vista não se altera, e tentar fazê-lo rebenta o
       -- bloco inteiro — e com ele a migração toda, porque o editor do
       -- Supabase corre o ficheiro numa transação.
       and exists (
         select 1 from information_schema.tables x
          where x.table_schema = 'public'
            and x.table_name = c.table_name
            and x.table_type = 'BASE TABLE'
       )
       and not exists (
         select 1 from information_schema.columns y
          where y.table_schema = 'public'
            and y.table_name = c.table_name
            and y.column_name = 'recorded_by_id'
       )
     order by c.table_name
  loop
    execute format(
      'alter table public.%I add column if not exists recorded_by_id uuid '
      || 'references auth.users(id) on delete set null', t.table_name);
    n := n + 1;
    nomes := nomes || t.table_name || ', ';
  end loop;

  if n = 0 then
    raise notice 'recorded_by_id: nada a fazer, ja estavam todas.';
  else
    raise notice 'recorded_by_id: % tabela(s) — %', n, rtrim(nomes, ', ');
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. AS HORAS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Medicação ───────────────────────────────────────────────────────────────
-- {"manha": "08:00", "tarde": "13:00", "noite": "22:00"} — só os turnos que
-- têm hora marcada. Ver a nota lá em cima sobre porque não é um array.
alter table patient_meds
  add column if not exists horas jsonb not null default '{}'::jsonb;

comment on column patient_meds.horas is
  'Hora de cada toma, por turno: {"manha":"08:00"}. Turno sem chave = sem hora marcada, dá-se durante o turno.';

-- ── Cuidados de rotina, ações do plano, reforços ────────────────────────────
-- Estes têm um turno só, por isso têm uma hora só.
alter table servicos_do_utente     add column if not exists hora text;
alter table plano_acoes            add column if not exists hora text;
alter table dietary_reinforcements add column if not exists hora text;

comment on column servicos_do_utente.hora is 'HH:MM, ou null para «a qualquer hora do turno».';
comment on column plano_acoes.hora is 'HH:MM, ou null para «a qualquer hora do turno».';
comment on column dietary_reinforcements.hora is 'HH:MM, ou null para «a qualquer hora do turno».';

-- Uma hora que não seja uma hora estraga a ordenação de toda a página, e
-- estraga-a em silêncio: '8h' ordena antes de '10:00' e ninguém percebe
-- porquê. O formato fica fechado aqui, onde não há forma de o contornar.
--
-- `not valid` não é uma desistência: a restrição vale para tudo o que for
-- escrito de agora em diante, e só não vai reler as linhas que já lá estão.
-- Como a coluna acabou de nascer a null, não há nada para reler.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servicos_hora_hhmm') then
    alter table servicos_do_utente add constraint servicos_hora_hhmm
      check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plano_acoes_hora_hhmm') then
    alter table plano_acoes add constraint plano_acoes_hora_hhmm
      check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reforcos_hora_hhmm') then
    alter table dietary_reinforcements add constraint reforcos_hora_hhmm
      check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. O RESPONSÁVEL
-- ═══════════════════════════════════════════════════════════════════════════
-- `on delete set null`: quem sai da casa não leva o trabalho com ele. A linha
-- fica, sem dono, e aparece a quem estiver a olhar por quem não tem ninguém.
-- O nome em `responsavel` sobrevive à saída, que é para isso que lá está.
do $$
declare t text;
begin
  foreach t in array array[
    'servicos_do_utente',   -- o banho da Dona Maria é da Ana
    'plano_acoes',          -- a ação do plano tem um responsável pelo objetivo
    'support_services',     -- o pedido de apoio tem quem o vá tratar
    'team_tasks',           -- já tinha `assignee` em texto; ganha o id a sério
    'activities'            -- já tinha `responsible` em texto; idem
  ]
  loop
    execute format('alter table public.%I add column if not exists responsavel_id uuid '
      || 'references auth.users(id) on delete set null', t);
    execute format('alter table public.%I add column if not exists responsavel text', t);
    -- O índice é para a pergunta que a aplicação faz a toda a hora: «o que é
    -- que é meu?». Parcial, porque as linhas sem responsável são a maioria e
    -- não interessam a essa pergunta nenhuma.
    execute format('create index if not exists %I on public.%I (responsavel_id) '
      || 'where responsavel_id is not null', 'idx_' || t || '_responsavel', t);
  end loop;
  raise notice 'responsavel_id + responsavel: 5 tabelas.';
end $$;

-- As duas colunas de texto que já existiam ficam onde estão, e não se
-- convertem. `activities.responsible` e `team_tasks.assignee` têm nomes
-- escritos à mão há meses — «Ana», «equipa da tarde», «enfermagem» — e nem
-- todos são pessoas. Adivinhar a quem correspondem seria atribuir trabalho a
-- gente que nunca o aceitou. Passam a ser o que já eram: uma nota.
comment on column activities.responsible is
  'Texto livre, histórico. Quem é mesmo o responsável está em responsavel_id.';
comment on column team_tasks.assignee is
  'Texto livre, histórico. Quem é mesmo o responsável está em responsavel_id.';


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- Deve devolver ZERO linhas (tabelas da casa ainda sem a coluna de auditoria):
--   select c.table_name from information_schema.columns c
--    where c.table_schema='public' and c.column_name='org_id'
--      and exists (select 1 from information_schema.tables x
--                   where x.table_schema='public' and x.table_name=c.table_name
--                     and x.table_type='BASE TABLE')
--      and not exists (select 1 from information_schema.columns y
--                       where y.table_schema='public' and y.table_name=c.table_name
--                         and y.column_name='recorded_by_id');
--
-- Deve devolver 5 linhas:
--   select table_name from information_schema.columns
--    where table_schema='public' and column_name='responsavel_id' order by 1;
--
-- E na aplicação:
--   • ficha de alguém → pôr a etiqueta «Risco de queda» → recarregar → lá está
--   • /mar → num medicamento, marcar a hora da toma da manhã
--   • /o-dia → a lista aparece por horas, com a linha de «agora» no sítio
