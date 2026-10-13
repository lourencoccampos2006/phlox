-- sprint181_perfis_de_acesso.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: corre isto DEPOIS do 179, do 180 e do 153.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- PERFIS DE ACESSO: A MESMA CONFIGURAÇÃO, COM UM NOME, PARA VÁRIAS PESSOAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── O QUE EXISTE HOJE E PORQUE NÃO CHEGA ───────────────────────────────────
-- Uma pessoa tem um PAPEL (`org_members.role`: enfermagem, auxiliar…) e, por
-- cima dele, pode ter uma lista própria de permissões (`capabilities`) que
-- substitui a do papel. Isso resolve o caso de UMA pessoa.
--
-- Não resolve o caso real de uma casa: «as seis auxiliares do turno da noite
-- não veem o financeiro nem as mensalidades». Hoje isso faz-se abrindo a
-- ficha de cada uma e marcando a mesma matriz seis vezes. Na sétima
-- contratação, alguém se engana — e o engano não dá erro nenhum: dá acesso a
-- mais do que devia, em silêncio.
--
-- ── O QUE ISTO ACRESCENTA ──────────────────────────────────────────────────
-- Uma tabela de PERFIS: um nome («Auxiliar de noite»), uma explicação, e a
-- lista de permissões. Aplica-se a quantas pessoas se quiser, de uma vez.
--
-- O perfil é um CARIMBO, não um vínculo vivo: aplicar copia as permissões
-- para a pessoa. Mudar o perfil depois não muda ninguém retroactivamente —
-- e isso é deliberado. Um perfil que mudasse sozinho o acesso de seis pessoas
-- a meio de um turno é a espécie de surpresa que ninguém quer numa casa com
-- inspeção. Quem muda um perfil vê quantas pessoas o usam e decide se
-- reaplica.
--
-- ── QUEM PODE ──────────────────────────────────────────────────────────────
-- Ver: quem tem `permissoes.ver`. Criar, mudar e apagar: `permissoes.editar`.
-- São as mesmas chaves que já governam a página de acessos — não se inventa
-- uma área nova para isto, porque é exactamente a mesma responsabilidade.
-- ---------------------------------------------------------------------------

-- O editor do Supabase já corre cada ficheiro numa transação.

-- ── 1. A tabela ─────────────────────────────────────────────────────────────
create table if not exists public.perfis_acesso (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  nome        text not null,
  descricao   text,
  -- O papel de base sobre o qual o perfil foi desenhado. Guarda-se para a
  -- página poder dizer «parte de Auxiliar e tira-lhe o financeiro» em vez de
  -- mostrar quarenta e oito chaves soltas.
  papel_base  text,
  -- As permissões, no mesmo formato de `org_members.capabilities`: `area.nivel`.
  permissoes  text[] not null default '{}',
  criado_em   timestamptz not null default now(),
  criado_por  uuid references auth.users(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null
);

-- Dois perfis com o mesmo nome na mesma casa não se distinguem na lista.
create unique index if not exists perfis_acesso_org_nome_unq
  on public.perfis_acesso (org_id, lower(nome));

create index if not exists perfis_acesso_org_idx on public.perfis_acesso (org_id);

alter table public.perfis_acesso enable row level security;


-- ── 2. Quem lê e quem escreve ───────────────────────────────────────────────
-- O mesmo par do resto da casa: a organização decide QUAL, e as políticas
-- restritivas por área (sprint153) decidem QUEM. Aqui fica a permissiva.
do $$
begin
  begin
    create policy perfis_acesso_casa on public.perfis_acesso for all
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
      );
  exception when duplicate_object then null; end;
end $$;

-- As restritivas por área: ver com `permissoes.ver`, escrever com
-- `permissoes.editar`. Escritas à mão aqui (e não geradas pelo sprint153)
-- porque esta tabela nasce depois dele; na próxima regeração do 153 ela entra
-- na lista e estas podem sair.
--
-- O corpo é o MESMO que o gerador escreve, letra por letra — incluindo o
-- `coalesce(capabilities, default_capabilities(role))`, que é o que faz as
-- permissões do PAPEL valerem quando a pessoa não tem lista própria. Escrever
-- aqui uma variante parecida seria criar uma segunda regra que um dia diverge
-- da primeira sem ninguém dar por isso.
-- ── O CICLO ─────────────────────────────────────────────────────────────────
-- `foreach a, b, c in array ...` NÃO existe em PL/pgSQL: o `FOREACH` com várias
-- variáveis espera uma linha composta, e uma matriz de texto não é isso. A
-- primeira versão deste ficheiro falhou no Supabase com
--
--     ERROR: 42804: cannot assign non-composite value to a row variable
--
-- O `scripts/check-sql.mjs` não o apanhou porque simula o ESQUEMA (que tabelas
-- e colunas existirão), não a semântica do PL/pgSQL. A forma certa é a que o
-- sprint153 já usa: índice sobre uma matriz 2D.
do $$
declare
  mapa text[][] := array[
    ['permissoes.ver',    'perfis_acesso_area_ver',    'select'],
    ['permissoes.editar', 'perfis_acesso_area_criar',  'insert'],
    ['permissoes.editar', 'perfis_acesso_area_mudar',  'update'],
    ['permissoes.editar', 'perfis_acesso_area_apagar', 'delete']
  ];
  i int;
begin
  for i in 1 .. array_length(mapa, 1) loop
    begin
      if mapa[i][3] = 'insert' then
        execute format($f$
          create policy %I on public.perfis_acesso as restrictive for insert with check (
            org_id is null
            or org_id in (
              select org_id from org_members
               where user_id = (select auth.uid()) and active = true
                 and %L = any(coalesce(capabilities, default_capabilities(role)))
            )
          )$f$, mapa[i][2], mapa[i][1]);
      elsif mapa[i][3] = 'update' then
        execute format($f$
          create policy %I on public.perfis_acesso as restrictive for update using (
            org_id is null
            or org_id in (
              select org_id from org_members
               where user_id = (select auth.uid()) and active = true
                 and %L = any(coalesce(capabilities, default_capabilities(role)))
            )
          )$f$, mapa[i][2], mapa[i][1]);
      elsif mapa[i][3] = 'select' then
        execute format($f$
          create policy %I on public.perfis_acesso as restrictive for select using (
            org_id is null
            or org_id in (
              select org_id from org_members
               where user_id = (select auth.uid()) and active = true
                 and %L = any(coalesce(capabilities, default_capabilities(role)))
            )
          )$f$, mapa[i][2], mapa[i][1]);
      else
        execute format($f$
          create policy %I on public.perfis_acesso as restrictive for delete using (
            org_id is null
            or org_id in (
              select org_id from org_members
               where user_id = (select auth.uid()) and active = true
                 and %L = any(coalesce(capabilities, default_capabilities(role)))
            )
          )$f$, mapa[i][2], mapa[i][1]);
      end if;
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ── 3. Quantas pessoas usam cada perfil ─────────────────────────────────────
-- Guarda-se no membro qual foi o último perfil aplicado. Serve para duas
-- coisas: a lista de perfis poder dizer «6 pessoas», e a página de acessos
-- poder mostrar «vem do perfil Auxiliar de noite» em vez de uma matriz sem
-- explicação. Não é um vínculo vivo — ver a nota lá em cima.
alter table public.org_members
  add column if not exists perfil_acesso_id uuid
  references public.perfis_acesso(id) on delete set null;

create index if not exists org_members_perfil_idx
  on public.org_members (perfil_acesso_id);
