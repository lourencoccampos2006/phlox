-- supabase/sprint178_inqueritos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ JÁ CORREU, E TEM UM ERRO: as políticas aqui em baixo perguntam a
--   `team_members` quem é o utilizador, e a pertença desta casa é `org_members`.
--   O **sprint179** corrige isso. Não editar este ficheiro: ele é o que correu.
--
-- FERNANDO: corre isto depois do sprint177, e DEPOIS corre o sprint153 outra
-- vez (cria tabelas novas, e é o 153 que lhes põe as regras de leitura).
--
-- ── O QUE É ─────────────────────────────────────────────────────────────────
-- Os inquéritos de satisfação a utentes, famílias e equipa.
--
-- O Modelo de Avaliação da Qualidade das Respostas Sociais, da Segurança
-- Social, pede a toda a casa com acordo que meça a satisfação dos clientes e
-- dos significativos pelo menos uma vez por ano, que analise o resultado e que
-- defina ações de melhoria. Não é uma sondagem: é um critério de avaliação.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- A COISA MAIS IMPORTANTE DESTE FICHEIRO
-- ═══════════════════════════════════════════════════════════════════════════
-- `inqueritos_respostas` NÃO TEM, E NUNCA PODE TER:
--
--     patient_id · user_id · recorded_by_id · team_member_id
--     o id do convite · o endereço IP · qualquer coluna que ligue a resposta
--     a uma pessoa
--
-- ── PORQUÊ ──────────────────────────────────────────────────────────────────
-- Uma pessoa que depende desta casa para comer, para se lavar e para se deitar
-- não escreve «a auxiliar da noite trata-me mal» com o nome dela ao lado. Se a
-- resposta puder ser seguida até quem a deu, o inquérito deixa de medir
-- satisfação e passa a medir medo — e o número que sai é bonito, que é o pior
-- que podia acontecer.
--
-- ── E NÃO É UMA POLÍTICA, É UMA GARANTIA ───────────────────────────────────
-- Uma promessa de anonimato cumprida pelo ecrã dura até alguém com acesso à
-- base de dados fazer uma consulta. Aqui a informação NÃO EXISTE: nem o dono
-- da casa, nem eu, nem uma intimação conseguem dizer quem respondeu o quê.
--
-- Por isso o `user_id` também não está cá. Ele existe em quase todas as
-- tabelas deste esquema e a RLS costuma apoiar-se nele — aqui a RLS apoia-se
-- SÓ no `org_id`, e é de propósito.
--
-- Quem escrever uma migração futura a acrescentar `recorded_by_id` a esta
-- tabela «para ficar igual às outras» está a desfazer isto. Não fica igual às
-- outras. Não pode.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── As campanhas ────────────────────────────────────────────────────────────
create table if not exists public.inqueritos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,

  titulo text not null,
  publico text not null check (publico in ('utentes', 'familias', 'equipa')),
  ano int not null default extract(year from current_date),

  -- As perguntas ficam GRAVADAS AQUI, e não numa referência ao modelo que
  -- vive no código. Se o modelo mudar no ano que vem — e vai mudar, porque a
  -- casa quer acrescentar uma pergunta —, o inquérito do ano passado continua
  -- a querer dizer o que queria dizer. Sem isto, uma resposta de 2026 passava
  -- a ser lida com a pergunta de 2027 e ninguém dava por isso.
  perguntas jsonb not null default '[]'::jsonb,

  aberto_em date not null default current_date,
  fechado_em date,

  -- Quantas pessoas foram convidadas. É o denominador da taxa de resposta, e
  -- a taxa de resposta é a primeira coisa que uma inspeção pergunta. Fica à
  -- mão de propósito: num centro de dia convidam-se as famílias que aparecem,
  -- e esse número não sai de nenhuma consulta.
  convidados int not null default 0 check (convidados >= 0),

  -- O código da ligação pública, para quem responde do telemóvel. Curto, para
  -- se escrever num papel afixado na entrada.
  codigo text unique,

  created_at timestamptz not null default now()
);

create index if not exists idx_inqueritos_org on public.inqueritos (org_id, ano desc);
create index if not exists idx_inqueritos_codigo on public.inqueritos (codigo) where codigo is not null;

comment on column public.inqueritos.perguntas is
  'Cópia das perguntas no momento em que o inquérito foi criado. Nunca uma referência ao modelo.';
comment on column public.inqueritos.convidados is
  'Denominador da taxa de resposta. Escrito à mão — não sai de nenhuma consulta.';


-- ── As respostas ────────────────────────────────────────────────────────────
create table if not exists public.inqueritos_respostas (
  id uuid primary key default gen_random_uuid(),
  inquerito_id uuid not null references public.inqueritos(id) on delete cascade,

  -- O `org_id` é o ÚNICO laço, e é com a casa — nunca com uma pessoa. Serve
  -- para a RLS e para nada mais.
  org_id uuid references public.organizations(id) on delete cascade,

  -- `{"u_comida": 4, "u_espera": null, "u_mudar": "mais passeios"}`
  -- As chaves são os ids das perguntas gravadas no inquérito. `null` é
  -- «não sei / não se aplica», que é uma resposta e não um silêncio.
  respostas jsonb not null default '{}'::jsonb,

  -- Por onde veio. Não diz quem: diz se foi em papel, no portal ou escrita
  -- por alguém da equipa a ler as perguntas em voz alta a quem não consegue
  -- escrever — que é como metade delas vai ser recolhida.
  como text not null default 'papel' check (como in ('portal', 'papel', 'equipa')),

  respondido_em timestamptz not null default now()
);

create index if not exists idx_respostas_inquerito on public.inqueritos_respostas (inquerito_id);

comment on table public.inqueritos_respostas is
  'ANÓNIMA POR CONSTRUÇÃO. Nunca acrescentar patient_id, user_id nem recorded_by_id — ver o cabeçalho do sprint178.';


-- ═══════════════════════════════════════════════════════════════════════════
-- AS REGRAS DE LEITURA
-- ═══════════════════════════════════════════════════════════════════════════
-- O sprint153 trata das duas tabelas pelo padrão da casa (org_id). Até ele
-- correr, ficam fechadas: ligar a RLS sem nenhuma regra é o estado seguro, e
-- não o contrário.
alter table public.inqueritos enable row level security;
alter table public.inqueritos_respostas enable row level security;

-- Uma regra mínima para a casa ver os seus inquéritos antes do 153 correr.
do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'inqueritos' and policyname = 'inqueritos_da_casa') then
    create policy inqueritos_da_casa on public.inqueritos
      for all to authenticated
      using (org_id in (select org_id from public.team_members where user_id = auth.uid()))
      with check (org_id in (select org_id from public.team_members where user_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'inqueritos_respostas' and policyname = 'respostas_da_casa') then
    create policy respostas_da_casa on public.inqueritos_respostas
      for all to authenticated
      using (org_id in (select org_id from public.team_members where user_id = auth.uid()))
      with check (org_id in (select org_id from public.team_members where user_id = auth.uid()));
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. As duas tabelas existem e a das respostas não tem laços com pessoas:
--      select column_name from information_schema.columns
--       where table_name = 'inqueritos_respostas' order by 1;
--    Tem de dar exatamente: como, id, inquerito_id, org_id, respondido_em,
--    respostas. Se aparecer aqui um `user_id` ou um `patient_id`, alguém
--    desfez a única coisa que faz este módulo funcionar.
--
-- 2. Na aplicação: /inqueritos → «Novo inquérito» → Famílias → imprimir a
--    folha em branco, e lançar uma resposta em papel.
--
-- 3. CORRER O sprint153 A SEGUIR.
