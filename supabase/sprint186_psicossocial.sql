-- sprint186_psicossocial.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- O PROCESSO PSICOSSOCIAL — a ferramenta de trabalho da psicóloga.
--
-- ── O PEDIDO ───────────────────────────────────────────────────────────────
-- «No apoio-psicossocial não pode só ser um botão de "falei com ele", tem de
--  ter notas sobre a pessoa. Se calhar a parte que os idosos mais sofrem é com
--  problemas derivados de isolamento, tristeza, etc. O trabalho da psicóloga
--  no centro de dia e lares deve de ser facilitado com o Phlox, para ter uma
--  ferramenta super complexa onde consiga meter notas, documentos, análises,
--  pesquisas, etc, e tudo super organizado.»
--
-- ── O QUE HAVIA ────────────────────────────────────────────────────────────
-- Uma tabela, `psychosocial_notes`: uma data, um texto, e um encaminhamento.
-- Serve para registar que se falou com alguém. Não serve para ACOMPANHAR
-- ninguém — e acompanhar é o trabalho.
--
-- ── O QUE FALTA, E PORQUE É QUE SÃO TRÊS TABELAS E NÃO UMA ─────────────────
-- Porque são três coisas com ritmos diferentes:
--
--   · O PROCESSO muda uma vez por ano. É quem a pessoa é: a avaliação inicial,
--     a história, quem é a rede de apoio dela, o plano de intervenção. Uma
--     linha por pessoa, reescrita quando se revê.
--
--   · As SESSÕES são semanais. Cada uma é um acontecimento com data, duração,
--     o que se trabalhou e o que se observou. Muitas linhas por pessoa, e
--     nenhuma se apaga — a sequência é que mostra se algo está a mudar.
--
--   · Os INSTRUMENTOS são pontuais. Uma GDS-15 aplicada em março e outra em
--     setembro valem pela comparação, e por isso guardam-se as RESPOSTAS e não
--     só o total: uma pontuação de 7 pode ser sete coisas diferentes, e saber
--     quais é o que diz onde intervir.
--
-- Juntar as três numa tabela com colunas nulas dava uma linha com trinta
-- campos, dos quais vinte e cinco vazios em cada escrita.
--
-- ── A CONFIDENCIALIDADE ────────────────────────────────────────────────────
-- Uma nota de sessão de psicologia não é uma nota de cuidados. O que alguém
-- conta a uma psicóloga sobre o filho que não a visita não pertence ao turno
-- da tarde — e no entanto a área `avaliacoes`, onde isto cai, é visível a
-- quase toda a gente.
--
-- Por isso a sessão tem `so_tecnico`: uma nota marcada assim exige
-- `avaliacoes.editar` para ser LIDA, e não apenas `avaliacoes.ver`. Quem
-- escreve este tipo de notas é quem as pode ler. As restantes continuam
-- visíveis à equipa, porque muita coisa do acompanhamento TEM de ser partilhada
-- para servir para alguma coisa.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. O PROCESSO — quem a pessoa é, e o plano
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.psi_processo (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  recorded_by_id  uuid references auth.users(id) on delete set null,
  patient_id      uuid not null references public.patients(id) on delete cascade,

  -- A avaliação inicial: como a pessoa chegou, o que a trouxe, o que se
  -- percebeu na primeira conversa.
  avaliacao       text,

  -- ── A REDE DE APOIO, QUE É O CAMPO QUE MAIS IMPORTA ───────────────────
  -- Quem visita, com que frequência, quem telefona, quem decide. O isolamento
  -- de uma pessoa idosa num lar não se mede pelo que ela diz: mede-se por
  -- quem aparece. Uma pessoa com três filhos que nunca vêm está mais sozinha
  -- do que uma sem filhos com uma vizinha que vem às quartas.
  rede_apoio      text,

  -- A história: o que foi a vida, o trabalho, as perdas, o que ainda dá gosto.
  historia        text,

  -- O plano de intervenção e os objetivos. `text[]` e não texto corrido: um
  -- objetivo é uma coisa que se dá por atingida ou não, e isso precisa de
  -- fronteiras.
  plano           text,
  objetivos       text[] not null default '{}',

  -- Quando foi revisto pela última vez. É o que a Segurança Social pergunta.
  revisto_em      date,
  revisto_por     text,

  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- Um processo por pessoa. Dois seriam duas versões da mesma história a
-- discordar, e ninguém saberia qual seguir.
create unique index if not exists psi_processo_patient_unq
  on public.psi_processo (patient_id);
create index if not exists psi_processo_org_idx on public.psi_processo (org_id);

alter table public.psi_processo enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AS SESSÕES
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.psi_sessoes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  recorded_by_id  uuid references auth.users(id) on delete set null,
  patient_id      uuid not null references public.patients(id) on delete cascade,

  data            date not null,
  -- O tipo muda o que a sessão é. Uma conversa de corredor de cinco minutos
  -- não é uma sessão individual de cinquenta, e contá-las juntas num relatório
  -- dá um número que não quer dizer nada.
  tipo            text not null default 'individual' check (tipo in (
    'individual', 'grupo', 'familia', 'observacao', 'telefone', 'informal'
  )),
  duracao_min     integer,
  onde            text,

  -- O que se trabalhou, e o que se observou. São dois campos porque são duas
  -- coisas: o primeiro é o que a psicóloga fez, o segundo é o que viu.
  trabalhado      text,
  observado       text,
  -- O que fica combinado para a próxima. É o que faz uma sessão ligar-se à
  -- seguinte em vez de serem notas soltas.
  plano_proxima   text,

  -- Como a pessoa estava. Escala curta de propósito: cinco valores que se
  -- escolhem num toque, para não haver a tentação de deixar em branco.
  humor           smallint check (humor between 1 and 5),

  -- ── SÓ PARA QUEM ACOMPANHA ────────────────────────────────────────────
  -- Ver a nota sobre confidencialidade no topo.
  so_tecnico      boolean not null default false,

  criado_em       timestamptz not null default now()
);

create index if not exists psi_sessoes_patient_idx on public.psi_sessoes (patient_id, data desc);
create index if not exists psi_sessoes_org_idx on public.psi_sessoes (org_id, data desc);

alter table public.psi_sessoes enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. OS INSTRUMENTOS APLICADOS
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.psi_instrumentos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  recorded_by_id  uuid references auth.users(id) on delete set null,
  patient_id      uuid not null references public.patients(id) on delete cascade,

  instrumento     text not null,
  data            date not null,

  -- ── AS RESPOSTAS, E NÃO SÓ O TOTAL ────────────────────────────────────
  -- Uma GDS-15 de 7 pontos pode ser sete coisas diferentes. Guardar só o
  -- número dá um gráfico que sobe e desce sem dizer porquê; guardar as
  -- respostas diz QUAIS os itens que mudaram — que é onde se intervém.
  -- `{"g1": true, "g2": false, …}`
  respostas       jsonb not null default '{}'::jsonb,
  pontuacao       integer,
  -- O nível em palavras, calculado no momento da aplicação. Guarda-se porque
  -- os pontos de corte podem ser revistos, e um resultado antigo tem de
  -- continuar a querer dizer o que queria dizer quando foi feito.
  interpretacao   text,
  notas           text,

  criado_em       timestamptz not null default now()
);

create index if not exists psi_instr_patient_idx on public.psi_instrumentos (patient_id, data desc);
create index if not exists psi_instr_org_idx on public.psi_instrumentos (org_id);

alter table public.psi_instrumentos enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. QUEM LÊ E QUEM ESCREVE
-- ═══════════════════════════════════════════════════════════════════════════
-- A permissiva da organização decide QUAL casa; as restritivas por área
-- (sprint153) decidem QUEM lá dentro. A área é `avaliacoes` — é onde as
-- escalas e o acompanhamento já vivem.
do $$
declare
  tabelas text[] := array['psi_processo', 'psi_sessoes', 'psi_instrumentos'];
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
-- default_capabilities(role))`. Na próxima regeração do 153 estas três entram
-- na lista dele e este bloco pode sair.
do $$
declare
  tabelas text[] := array['psi_processo', 'psi_sessoes', 'psi_instrumentos'];
  acoes text[][] := array[
    ['avaliacoes.ver',      'select', 'ver'],
    ['avaliacoes.editar',   'insert', 'criar'],
    ['avaliacoes.editar',   'update', 'mudar'],
    ['avaliacoes.eliminar', 'delete', 'apagar']
  ];
  i int;
  j int;
  nome text;
begin
  for i in 1 .. array_length(tabelas, 1) loop
    for j in 1 .. array_length(acoes, 1) loop
      nome := tabelas[i] || '_area_' || acoes[j][3];
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
            )$f$, nome, tabelas[i], acoes[j][1]);
        elsif acoes[j][2] = 'update' then
          execute format($f$
            create policy %I on public.%I as restrictive for update using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, tabelas[i], acoes[j][1]);
        elsif acoes[j][2] = 'select' then
          execute format($f$
            create policy %I on public.%I as restrictive for select using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, tabelas[i], acoes[j][1]);
        else
          execute format($f$
            create policy %I on public.%I as restrictive for delete using (
              org_id is null
              or org_id in (
                select org_id from org_members
                 where user_id = (select auth.uid()) and active = true
                   and %L = any(coalesce(capabilities, default_capabilities(role)))
              )
            )$f$, nome, tabelas[i], acoes[j][1]);
        end if;
      exception when duplicate_object then null; end;
    end loop;
  end loop;
end $$;

-- ── A NOTA CONFIDENCIAL ────────────────────────────────────────────────────
-- Uma sessão marcada `so_tecnico` só é LIDA por quem pode escrever na área.
-- É uma política RESTRITIVA a mais sobre o `select`: soma-se às outras em vez
-- de as substituir, e por isso não abre nada — só fecha.
--
-- O que alguém conta a uma psicóloga sobre o filho que não a visita não
-- pertence ao turno da tarde.
do $$
begin
  begin
    create policy psi_sessoes_confidencial on public.psi_sessoes
      as restrictive for select using (
        so_tecnico is not true
        or org_id in (
          select org_id from org_members
           where user_id = (select auth.uid()) and active = true
             and 'avaliacoes.editar' = any(coalesce(capabilities, default_capabilities(role)))
        )
      );
  exception when duplicate_object then null; end;
end $$;


-- ── A hora a que o processo mudou ──────────────────────────────────────────
create or replace function public.psi_processo_tocar()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists psi_processo_tocar_trg on public.psi_processo;
create trigger psi_processo_tocar_trg
  before update on public.psi_processo
  for each row execute function public.psi_processo_tocar();

notify pgrst, 'reload schema';
