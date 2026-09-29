-- supabase/sprint163_etiquetas.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint162, e o sprint153 a seguir.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «Quero também que seja possível criar etiquetas para identificar e conseguir
-- pesquisar utentes com essas etiquetas automaticamente.»
--
-- ── PORQUE É QUE SÃO DUAS COISAS E NÃO UMA ─────────────────────────────────
-- A forma preguiçosa é uma coluna `etiquetas text[]` em `patients` e deixar
-- cada pessoa escrever o que quiser. Funciona uma semana. Depois há
-- «diabético», «Diabético», «diabetes» e «DM2» — quatro etiquetas para a mesma
-- coisa, e a pesquisa que devia dar oito pessoas dá duas.
--
-- Por isso há um CATÁLOGO por casa (`etiquetas`), e a pessoa fica ligada às
-- etiquetas que existem. Quem precisa de uma nova cria-a — mas cria-a UMA vez,
-- e a partir daí toda a gente usa a mesma.
--
-- A cor não é enfeite: numa lista de trinta pessoas, uma etiqueta vermelha de
-- «risco de queda» vê-se antes de se ler seja o que for.
--
-- ── PORQUE É QUE A LIGAÇÃO É UMA TABELA E NÃO UM ARRAY ─────────────────────
-- Um `text[]` em `patients` pesquisa-se depressa com um índice GIN, e foi a
-- primeira coisa que pensei fazer. O problema aparece ao mudar o nome de uma
-- etiqueta: com um array, era preciso reescrever a coluna de todas as pessoas
-- que a têm, e qualquer falha a meio deixava metade com o nome velho.
--
-- Com uma tabela de ligação, mudar o nome é mudar uma linha.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── O catálogo da casa ──────────────────────────────────────────────────────
create table if not exists etiquetas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  org_id     uuid references organizations(id) on delete cascade,

  nome       text not null,
  cor        text not null default 'cinza'
               check (cor in ('cinza', 'vermelho', 'laranja', 'amarelo',
                              'verde', 'azul', 'roxo', 'rosa')),
  -- Para que serve esta etiqueta. Uma etiqueta sem explicação acaba usada de
  -- três maneiras diferentes por três pessoas.
  descricao  text,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);
-- Duas etiquetas com o mesmo nome na mesma casa é exatamente o problema que
-- isto vem resolver. `lower()` porque «Diabético» e «diabético» são a mesma.
create unique index if not exists etiquetas_nome_unico
  on etiquetas (org_id, lower(nome)) where org_id is not null;
create index if not exists etiquetas_org_idx on etiquetas (org_id) where ativa;


-- ── Quem leva que etiqueta ──────────────────────────────────────────────────
create table if not exists etiquetas_do_utente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  patient_id  uuid not null references patients(id) on delete cascade,
  etiqueta_id uuid not null references etiquetas(id) on delete cascade,
  posta_por   text,
  created_at  timestamptz not null default now()
);
create unique index if not exists etiqutente_unico
  on etiquetas_do_utente (patient_id, etiqueta_id);
create index if not exists etiqutente_pt_idx on etiquetas_do_utente (patient_id);
-- A consulta que a pesquisa faz: quem tem esta etiqueta.
create index if not exists etiqutente_et_idx on etiquetas_do_utente (etiqueta_id);


-- ── O catálogo vem com sugestões ────────────────────────────────────────────
-- As mesmas de sempre num lar e num centro de dia. São sugestões: apagam-se,
-- mudam-se de nome, acrescentam-se. Uma casa que abre isto e encontra nada
-- fecha-o — e volta a escrever tudo nas notas, que é onde nada se pesquisa.
do $$
declare
  o record;
  n int := 0;
  base text[][] := array[
    ['Risco de queda',        'vermelho', 'Já caiu, ou a marcha não está segura.'],
    ['Risco de fuga',         'vermelho', 'Tende a sair sem avisar.'],
    ['Disfagia',              'laranja',  'Engasga-se; precisa de textura adaptada.'],
    ['Diabetes',              'laranja',  'Vigiar açúcar e dieta.'],
    ['Alergias',              'vermelho', 'Ver a ficha antes de dar o que quer que seja.'],
    ['Demência',              'roxo',     'Precisa de orientação e rotina.'],
    ['Acamado',               'azul',     'Não se levanta; posicionar.'],
    ['Cadeira de rodas',      'azul',     'Precisa de apoio para se mover.'],
    ['Oxigénio',              'azul',     'Depende de oxigénio.'],
    ['Isolamento',            'amarelo',  'Cuidados de contacto.'],
    ['Ferida ativa',          'laranja',  'Tratamento em curso.'],
    ['Sem família próxima',   'cinza',    'Não há quem venha; a casa é a família.'],
    ['Transporte da casa',    'verde',    'Vem e vai na carrinha.'],
    ['Apoio à alimentação',   'verde',    'Precisa de ajuda para comer.'],
    ['Aniversário a assinalar','rosa',    'Faz questão que se lembrem.']
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
    if exists (select 1 from etiquetas where org_id = o.id) then continue; end if;
    for i in 1 .. array_length(base, 1) loop
      insert into etiquetas (org_id, nome, cor, descricao)
      values (o.id, base[i][1], base[i][2], base[i][3])
      on conflict do nothing;
    end loop;
    n := n + 1;
  end loop;
  raise notice '% casa(s) ficaram com etiquetas sugeridas.', n;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['etiquetas', 'etiquetas_do_utente'] loop
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


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select nome, cor from etiquetas order by nome;    -- 15 sugestões
-- select count(*) from etiquetas_do_utente;         -- 0, ainda ninguém tem
--
-- E na app: abre a ficha de alguém, põe «Risco de queda», e depois vai a
-- /patients e filtra por essa etiqueta.
