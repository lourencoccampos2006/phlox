-- supabase/sprint160_stock_por_utente.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint159, e o sprint153 outra vez no fim
-- (para as tabelas novas ficarem protegidas por área como as outras).
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «Queria que houvesse um stock POR UTENTE — fraldas, medicação. Tomar um
-- medicamento baixa automaticamente o stock. Quando o stock estiver baixo dá o
-- alerta, para quem o precisar de ver, apenas.»
--
-- O que existia era `stock_items`: o armazém da CASA. Serve para saber quantas
-- caixas de luvas há, e não serve para a pergunta que se faz cem vezes por
-- semana — «a D. Maria ainda tem fraldas para o fim de semana?».
--
-- ── DUAS TABELAS ────────────────────────────────────────────────────────────
--   stock_utente      o que cada pessoa tem, e o mínimo abaixo do qual avisa
--   stock_movimentos  cada entrada e cada saída, com a razão
--
-- Os movimentos existem porque um número sozinho não se defende. Quando a
-- família pergunta «mas eu trouxe um pacote na segunda», a resposta tem de ser
-- uma linha com a data, e não um encolher de ombros. É também o que permite
-- saber o RITMO: quantas fraldas por dia, e portanto para quantos dias chega o
-- que lá está.
--
-- ── A BAIXA AUTOMÁTICA É UM GATILHO, NÃO CÓDIGO DA APLICAÇÃO ───────────────
-- Esta é a decisão importante do ficheiro.
--
-- Marcar uma toma acontece hoje em QUATRO sítios: o /mar, o /o-dia, o portal
-- da família e as tomas SOS. Se a baixa do stock vivesse na aplicação, teria de
-- estar escrita nos quatro — e bastava alguém acrescentar um quinto para o
-- stock começar a mentir devagar, sem ninguém dar por isso.
--
-- Num gatilho, está escrita uma vez e não há forma de a contornar. É uma regra
-- sobre os DADOS («uma administração consome unidades»), e regras sobre dados
-- pertencem à base de dados.
--
-- O preço é que fica invisível a quem lê só o código da aplicação. Por isso
-- está escrito aqui em cima, e há um comentário em lib/stockUtente.ts a
-- apontar para cá.
--
-- ── DESMARCAR DEVOLVE ───────────────────────────────────────────────────────
-- Enganar-se a marcar uma toma é comum. Se desmarcar não devolvesse a unidade,
-- o stock ficava a contar tomas que não aconteceram — e ao fim de um mês o
-- número deixava de valer nada. O gatilho trata do caminho de volta.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── O que cada pessoa tem ───────────────────────────────────────────────────
create table if not exists stock_utente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  patient_id  uuid not null references patients(id) on delete cascade,

  nome        text not null,
  -- As mesmas categorias do armazém da casa (app/stock/page.tsx), para as duas
  -- listas falarem a mesma língua.
  categoria   text not null default 'geral'
                check (categoria in ('medicamento', 'incontinencia', 'consumivel',
                                     'epi', 'limpeza', 'geral')),
  unidade     text,                      -- 'unidades', 'comprimidos', 'ml'…

  quantidade  numeric not null default 0,
  -- Abaixo disto, avisa. Zero ou null = não avisa: há coisas que se repõem
  -- quando dá jeito, e inventar um mínimo seria encher a lista de avisos que
  -- ninguém pediu.
  minimo      numeric,

  -- ── A ligação que faz a baixa automática acontecer ───────────────────────
  -- Quando este artigo está ligado a um medicamento desta pessoa, cada
  -- administração desconta `por_toma` unidades. Sem ligação, o artigo existe
  -- na mesma e desconta-se à mão (é o caso das fraldas).
  med_id      uuid references patient_meds(id) on delete set null,
  por_toma    numeric not null default 1,

  notas       text,
  recorded_by_id uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um medicamento não pode estar ligado a dois artigos de stock da mesma
-- pessoa: o gatilho não teria como escolher qual descontar.
create unique index if not exists stock_utente_um_por_med
  on stock_utente (patient_id, med_id) where med_id is not null;
create index if not exists stock_utente_pt_idx on stock_utente (patient_id);
create index if not exists stock_utente_org_idx on stock_utente (org_id) where org_id is not null;


-- ── Cada entrada e cada saída ───────────────────────────────────────────────
create table if not exists stock_movimentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete set null,
  stock_id    uuid not null references stock_utente(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,

  -- Negativo sai, positivo entra. Um só campo em vez de dois (entrada/saída)
  -- porque somar uma coluna é trivial e somar duas é onde os enganos moram.
  delta       numeric not null,
  motivo      text not null default 'acerto'
                check (motivo in ('toma', 'uso', 'entrada', 'acerto', 'perda', 'devolucao')),
  -- De onde veio, para se poder voltar lá: 'mar_records', 'tomas_sos', 'mao'.
  origem      text,
  origem_id   uuid,

  nota        text,
  feito_por   text,
  created_at  timestamptz not null default now()
);
create index if not exists stock_mov_idx on stock_movimentos (stock_id, created_at desc);
create index if not exists stock_mov_pt_idx on stock_movimentos (patient_id, created_at desc);
-- ── PORQUE É QUE AQUI NÃO HÁ CHAVE ÚNICA ───────────────────────────────────
-- A minha primeira versão tinha uma, em `(origem, origem_id)`, para o gatilho
-- não descontar duas vezes a mesma toma. Tinha dois defeitos, e os dois só
-- dariam pelo nome em produção:
--
--   1. Era um índice PARCIAL (`where origem_id is not null`), e um
--      `on conflict (a, b)` não casa com um índice parcial a não ser que a
--      instrução repita o predicado. O insert rebentava — e como está dentro
--      de um `exception when others`, rebentava EM SILÊNCIO: a quantidade
--      mudava e o histórico ficava vazio.
--
--   2. Desmarcar uma toma gera uma DEVOLUÇÃO com a mesma origem e o mesmo id
--      da toma. Ela colidia com a saída e era engolida.
--
-- Pôr o `motivo` na chave resolvia o segundo, mas continuava a perder um
-- movimento no vaivém marcar → desmarcar → marcar, em que o id não muda.
--
-- E a protecção era redundante desde o início: o Postgres dispara um gatilho
-- UMA vez por linha e por instrução, e o sprint158 já impede duas
-- administrações iguais em `mar_records`. Uma defesa que não defende nada e
-- que perde dados é pior do que não ter defesa nenhuma.
--
-- Fica um índice NORMAL, para a pergunta «que movimento veio desta toma?».
create index if not exists stock_mov_origem_idx
  on stock_movimentos (origem, origem_id) where origem_id is not null;


-- ── O GATILHO ───────────────────────────────────────────────────────────────
-- `security definer` porque tem de escrever em `stock_utente` e
-- `stock_movimentos` em nome de quem marcou a toma — e essa pessoa pode ter
-- permissão de medicação sem ter permissão de stock. Uma auxiliar que dá um
-- comprimido tem de fazer o stock baixar, mesmo que não possa abrir a página
-- de stock.
--
-- `search_path` fixo: sem isso, um `search_path` manipulado podia apontar
-- estes nomes para outras tabelas.
create or replace function stock_aplicar_toma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  art      stock_utente;
  p_id     uuid;
  m_id     uuid;
  sentido  numeric;
  origem_t text := tg_table_name;
begin
  -- Que toma é, e para que lado.
  if tg_table_name = 'mar_records' then
    if tg_op = 'INSERT' then
      if new.status is distinct from 'administered' then return new; end if;
      p_id := new.patient_id; m_id := new.med_id; sentido := -1;
    elsif tg_op = 'DELETE' then
      if old.status is distinct from 'administered' then return old; end if;
      p_id := old.patient_id; m_id := old.med_id; sentido := 1;
    else -- UPDATE: só interessa quando o estado ATRAVESSA 'administered'
      if new.status = old.status then return new; end if;
      if new.status = 'administered' then
        p_id := new.patient_id; m_id := new.med_id; sentido := -1;
      elsif old.status = 'administered' then
        p_id := old.patient_id; m_id := old.med_id; sentido := 1;
      else
        return new;
      end if;
    end if;
  else -- tomas_sos
    if tg_op = 'INSERT' then
      p_id := new.patient_id; m_id := new.med_id; sentido := -1;
    else
      p_id := old.patient_id; m_id := old.med_id; sentido := 1;
    end if;
  end if;

  select * into art from stock_utente
   where patient_id = p_id and med_id = m_id limit 1;
  -- Sem artigo ligado não há nada a descontar, e isso é o normal: a maior parte
  -- da medicação de uma casa não tem stock por pessoa.
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  update stock_utente
     set quantidade = quantidade + (sentido * art.por_toma),
         updated_at = now()
   where id = art.id;

  -- O movimento.
  begin
    insert into stock_movimentos (user_id, org_id, stock_id, patient_id, delta, motivo, origem, origem_id)
    values (
      art.user_id, art.org_id, art.id, p_id,
      sentido * art.por_toma,
      case when sentido < 0 then 'toma' else 'devolucao' end,
      origem_t,
      case when tg_op = 'DELETE' then old.id else new.id end
    );
  exception when others then
    -- Um movimento que não se consegue escrever NÃO pode impedir a toma de
    -- ficar registada. A toma é o facto clínico; o movimento é a contabilidade.
    raise warning 'stock: movimento nao registado (%).', sqlerrm;
  end;

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists trg_stock_mar on mar_records;
create trigger trg_stock_mar
  after insert or update or delete on mar_records
  for each row execute function stock_aplicar_toma();

drop trigger if exists trg_stock_sos on tomas_sos;
create trigger trg_stock_sos
  after insert or delete on tomas_sos
  for each row execute function stock_aplicar_toma();


-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table stock_utente enable row level security;
alter table stock_movimentos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['stock_utente', 'stock_movimentos'] loop
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
  alter publication supabase_realtime add table stock_utente;
exception when others then null; end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select count(*) from stock_utente;      -- 0, sem erro
-- select count(*) from stock_movimentos;  -- 0
--
-- Os dois gatilhos ficaram mesmo postos:
--   select tgname from pg_trigger
--    where tgname in ('trg_stock_mar', 'trg_stock_sos');   -- 2 linhas
--
-- E para veres a baixa automática a acontecer: cria um artigo ligado a um
-- medicamento na ficha de alguém, marca a toma no /o-dia, e volta à ficha.
-- A quantidade desceu, e há uma linha no histórico a dizer porquê.
