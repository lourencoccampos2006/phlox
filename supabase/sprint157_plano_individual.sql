-- supabase/sprint157_plano_individual.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint156. O sprint153 (permissões por área)
-- deve correr DEPOIS deste — ou outra vez, se já o tiveres corrido.
--
-- ── O QUE ISTO ACRESCENTA ───────────────────────────────────────────────────
-- O Plano Individual: PIC num lar, PII num centro de dia.
--
-- É a caixa que faltava. Aquele software trabalha em quatro:
-- Planear → Ordens de Serviço → Registar → Evolução. Nós tínhamos só a
-- terceira — registávamos muito bem o que aconteceu e não tínhamos onde dizer
-- o que era suposto acontecer.
--
-- Na prática isso quer dizer duas coisas. Que o dia da casa vive na cabeça das
-- pessoas, e quando alguém falta, falta também o que só essa pessoa sabia que
-- se fazia às quintas. E que numa visita da Segurança Social não há plano
-- individual para mostrar, porque não havia onde o escrever.
--
-- ── TRÊS TABELAS, E PORQUÊ TRÊS ─────────────────────────────────────────────
--   planos            uma por pessoa e por período de vigência
--   plano_objetivos   o que se quer para esta pessoa
--   plano_acoes       o que se faz para lá chegar, e com que frequência
--
-- Os objetivos e as ações são níveis separados porque a pergunta «porque é que
-- fazemos isto?» tem de ter resposta escrita. Uma lista de tarefas sem
-- objetivo é uma lista de tarefas: ao fim de seis meses ninguém sabe se serviu
-- para alguma coisa, e a revisão do plano passa a ser um carimbo.
--
-- E há `plano_avaliacoes`: a revisão, que é o que a inspeção pergunta.
--
-- ── ISTO NÃO SUBSTITUI O `care_plans` ───────────────────────────────────────
-- O `care_plans` que já existe é outra coisa: a folha das preferências
-- permanentes (dieta, textura, posicionamento, prevenção de quedas). Coisas
-- que são verdade sobre a pessoa e não mudam de semana para semana. Fica como
-- está, com os dados que tiver — o /refeicoes e o portal da família leem-no.
-- O plano lê-o também, em vez de o repetir.
--
-- ── A ORDEM DAS INSTRUÇÕES ──────────────────────────────────────────────────
-- Tabelas novas, sem linhas: as restrições podem entrar com a tabela. Foi
-- exatamente isto que correu mal no sprint152 — uma restrição criada por cima
-- de linhas antigas — e é por isso que agora há a guarda
-- `scripts/check-migracoes.mjs`, que simula cada restrição contra os dados
-- reais antes de o ficheiro te chegar às mãos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── O plano ─────────────────────────────────────────────────────────────────
create table if not exists planos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  org_id         uuid references organizations(id) on delete set null,
  patient_id     uuid not null references patients(id) on delete cascade,

  estado         text not null default 'rascunho'
                   check (estado in ('rascunho', 'ativo', 'arquivado')),
  inicio         date not null default current_date,
  -- Quando toca rever. Seis meses é o intervalo habitual e é o que a aplicação
  -- propõe; fica editável porque há casas que revêem de três em três.
  rever_em       date,

  elaborado_por  text,
  -- O que a pessoa e a família disseram que queriam, nas palavras delas.
  -- Fica no topo do plano de propósito: um plano escrito só pela equipa é um
  -- plano feito SOBRE a pessoa, e não COM ela.
  voz_da_pessoa  text,
  notas          text,

  recorded_by_id uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Uma pessoa só pode ter UM plano ativo de cada vez. Dois planos ativos é a
-- forma mais rápida de a equipa seguir o errado — e não há maneira de saber
-- qual, porque ambos parecem bons.
create unique index if not exists planos_um_ativo_por_pessoa
  on planos (patient_id) where estado = 'ativo';
create index if not exists planos_pt_idx on planos (patient_id, estado);
create index if not exists planos_org_rever_idx on planos (org_id, rever_em)
  where org_id is not null and estado = 'ativo';


-- ── Os objetivos ────────────────────────────────────────────────────────────
create table if not exists plano_objetivos (
  id         uuid primary key default gen_random_uuid(),
  plano_id   uuid not null references planos(id) on delete cascade,
  org_id     uuid references organizations(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,

  -- A MESMA área das permissões (lib/permissoes.ts). Não é decoração: é o que
  -- decide quem vê e quem mexe. Um objetivo de medicação é da enfermagem; um
  -- de animação é de quem faz animação. Sem isto, ou o plano ficava visível a
  -- toda a gente, ou era preciso inventar um segundo sistema de acessos.
  area       text not null default 'utentes',
  titulo     text not null,
  -- Porque é que isto está no plano. Uma frase.
  porque     text,
  estado     text not null default 'aberto'
               check (estado in ('aberto', 'atingido', 'suspenso')),
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plano_obj_idx on plano_objetivos (plano_id, ordem);


-- ── As ações ────────────────────────────────────────────────────────────────
create table if not exists plano_acoes (
  id           uuid primary key default gen_random_uuid(),
  objetivo_id  uuid not null references plano_objetivos(id) on delete cascade,
  org_id       uuid references organizations(id) on delete set null,
  user_id      uuid not null references auth.users(id) on delete cascade,

  o_que        text not null,
  -- O PAPEL de quem costuma fazer, não a pessoa. As pessoas mudam de turno e
  -- de casa; um plano que nomeia alguém fica errado no dia em que essa pessoa
  -- sai, e ninguém se lembra de o ir corrigir.
  quem         text,

  cadencia     text not null default 'diaria'
                 check (cadencia in ('diaria', 'dias_da_semana', 'semanal',
                                     'quinzenal', 'mensal', 'quando_necessario')),
  -- Só para 'dias_da_semana'. 0 = domingo, como a `Date` do browser conta.
  dias         int[],
  turno        text check (turno is null or turno in ('manha', 'tarde', 'noite')),
  -- Desde quando. É a âncora das cadências semanal, quinzenal e mensal.
  desde        date not null default current_date,

  ativa        boolean not null default true,
  notas        text,
  created_at   timestamptz not null default now()
);
create index if not exists plano_acoes_idx on plano_acoes (objetivo_id) where ativa;
-- A consulta que «O Dia» vai fazer: o que esta casa tem para hoje.
create index if not exists plano_acoes_org_idx on plano_acoes (org_id) where ativa and org_id is not null;


-- ── As revisões ─────────────────────────────────────────────────────────────
create table if not exists plano_avaliacoes (
  id         uuid primary key default gen_random_uuid(),
  plano_id   uuid not null references planos(id) on delete cascade,
  org_id     uuid references organizations(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,

  data       date not null default current_date,
  texto      text not null,
  autor      text,
  -- O que se decidiu. Sem isto uma revisão é uma nota solta, e a pergunta
  -- seguinte -- «e então, mudou alguma coisa?» -- fica sem resposta.
  decisao    text check (decisao is null or decisao in ('manter', 'ajustar', 'fechar')),
  created_at timestamptz not null default now()
);
create index if not exists plano_aval_idx on plano_avaliacoes (plano_id, data desc);


-- ── RLS: o mesmo padrão das outras tabelas da casa ──────────────────────────
-- Próprio OU membro da casa. A restrição por área (quem da equipa pode ver
-- utentes) vem por cima, no sprint153.
do $$
declare t text;
begin
  foreach t in array array['planos', 'plano_objetivos', 'plano_acoes', 'plano_avaliacoes'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy %I on public.%I for all
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_proprio', t);

    execute format($f$
      create policy %I on public.%I for all
        using (org_id is not null and org_id in (
          select org_id from org_members where user_id = (select auth.uid()) and active = true))
        with check (org_id is not null and org_id in (
          select org_id from org_members where user_id = (select auth.uid()) and active = true))
    $f$, t || '_casa', t);

    execute format('revoke select on public.%I from anon', t);
  end loop;
exception when duplicate_object then
  raise notice '  (as politicas ja existiam — nada mudou)';
end $$;

do $$
declare t text;
begin
  foreach t in array array['planos', 'plano_objetivos', 'plano_acoes', 'plano_avaliacoes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null; end;
  end loop;
end $$;


-- ── A área de CADA objetivo, e não só da tabela ─────────────────────────────
-- O sprint153 protege uma tabela inteira com uma área. Aqui isso não chega: os
-- objetivos de uma mesma pessoa pertencem a áreas diferentes — um de medicação
-- é da enfermagem, um de animação é de quem faz animação, e um sobre a
-- mensalidade é de quem trata das contas.
--
-- Estas políticas leem a área ESCRITA NA LINHA. São restritivas, por isso
-- somam-se com E ao que já lá está: continuam a valer o âmbito por casa e a
-- área `utentes` da tabela, e acrescenta-se «e tens de ver a área deste
-- objetivo».
--
-- O efeito no ecrã é o certo: quem não vê o financeiro abre o plano e vê o
-- plano — menos o objetivo que não lhe diz respeito. Não vê uma porta fechada,
-- nem um erro. Vê o que é dele.
do $$ begin
  drop policy if exists "plano_obj_area_ver" on plano_objetivos;
  create policy "plano_obj_area_ver" on plano_objetivos as restrictive for select using (
    org_id is null
    or exists (
      select 1 from org_members m
       where m.org_id = plano_objetivos.org_id
         and m.user_id = (select auth.uid())
         and m.active = true
         and (plano_objetivos.area || '.ver') = any(coalesce(m.capabilities, default_capabilities(m.role)))
    )
  );
end $$;

do $$ begin
  drop policy if exists "plano_obj_area_alterar" on plano_objetivos;
  create policy "plano_obj_area_alterar" on plano_objetivos as restrictive for update using (
    org_id is null
    or exists (
      select 1 from org_members m
       where m.org_id = plano_objetivos.org_id
         and m.user_id = (select auth.uid())
         and m.active = true
         and (plano_objetivos.area || '.editar') = any(coalesce(m.capabilities, default_capabilities(m.role)))
    )
  );
end $$;

-- As ações herdam a área do objetivo a que pertencem. Sem isto, quem não pode
-- ver um objetivo de medicação continuava a poder ler as ações dele escrevendo
-- `supabase.from('plano_acoes').select('*')` na consola — que é exatamente o
-- buraco que o sprint153 foi tapar no resto do produto.
do $$ begin
  drop policy if exists "plano_acoes_area_ver" on plano_acoes;
  create policy "plano_acoes_area_ver" on plano_acoes as restrictive for select using (
    org_id is null
    or exists (
      select 1
        from plano_objetivos o
        join org_members m on m.org_id = o.org_id
       where o.id = plano_acoes.objetivo_id
         and m.user_id = (select auth.uid())
         and m.active = true
         and (o.area || '.ver') = any(coalesce(m.capabilities, default_capabilities(m.role)))
    )
  );
end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select count(*) from planos;             -- 0, sem erro
-- select count(*) from plano_objetivos;    -- 0
-- select count(*) from plano_acoes;        -- 0
-- select count(*) from plano_avaliacoes;   -- 0
--
-- E no teu computador, antes de correres seja o que for:
--   node scripts/check-migracoes.mjs
