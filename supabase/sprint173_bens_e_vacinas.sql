-- supabase/sprint173_bens_e_vacinas.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint172, e o sprint153 a seguir.
--
-- ── DE ONDE VEIO ────────────────────────────────────────────────────────────
-- Da pesquisa ao MySenior, que tem sessenta e oito funcionalidades na lista de
-- novidades deles. Duas estão lá há anos, são banais de construir, e o Phlox
-- não tinha nenhuma das duas.
--
-- ── 1. A LISTA DE BENS ──────────────────────────────────────────────────────
-- «Peças de roupa, acessórios e objetos pessoais», com data de entrega e
-- fotografia.
--
-- Parece pequeno. Não é: numa casa com trinta pessoas a roupa vai para uma
-- lavandaria comum e volta, e o que desaparece desaparece sem ninguém saber se
-- chegou a entrar. A conversa que se segue é sempre a mesma — a família diz que
-- trouxe, a casa não tem como dizer que sim nem que não, e a confiança parte-se
-- por causa de uma camisola.
--
-- Vale para o que tem valor a sério: óculos, aparelhos auditivos, próteses
-- dentárias, alianças. Essas três primeiras custam centenas de euros e perdem-se
-- em lares todos os dias.
--
-- ── 2. AS VACINAS ───────────────────────────────────────────────────────────
-- A gripe todos os outonos, a COVID, o tétano, a pneumocócica. Quem já levou e
-- quem falta é uma pergunta que se faz uma vez por ano a correr, e que hoje se
-- responde a folhear o boletim de cada pessoa.
--
-- ── PORQUE É QUE SÃO DUAS TABELAS E NÃO UMA «coisas do utente» ─────────────
-- Porque as perguntas são opostas. De um bem quer-se saber SE AINDA CÁ ESTÁ —
-- entrou, saiu, voltou. De uma vacina quer-se saber QUANDO FOI A ÚLTIMA e
-- quando toca a próxima. Uma tabela só daria metade das colunas vazias em
-- metade das linhas, e nenhuma das duas perguntas respondida depressa.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. OS BENS DA PESSOA
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists bens_do_utente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,

  descricao text not null,
  -- `roupa` | `calcado` | `higiene` | `saude` | `valor` | `eletronico` | `outro`
  categoria text not null default 'roupa',
  quantidade integer not null default 1,

  -- Entrou quando, e trazido por quem. O nome de quem entregou é metade do
  -- valor do registo: sem ele, «entrou a 3 de março» não resolve a conversa.
  entrou_em date not null default current_date,
  entregue_por text,

  -- Saiu quando, e com quem. Nulo = está cá.
  saiu_em date,
  levado_por text,
  motivo_saida text,

  -- A fotografia, no mesmo balde dos outros documentos. Uma camisola
  -- fotografada é uma camisola que se reconhece; descrita por palavras, são
  -- quinze camisolas azuis.
  foto_path text,
  notas text,
  created_at timestamptz not null default now(),

  constraint bens_categoria check (
    categoria in ('roupa', 'calcado', 'higiene', 'saude', 'valor', 'eletronico', 'outro')),
  -- Não se sai antes de entrar. Uma data trocada passa despercebida para
  -- sempre, e faz a lista dizer que o objeto nunca cá esteve.
  constraint bens_datas check (saiu_em is null or saiu_em >= entrou_em)
);

create index if not exists bens_utente_idx on bens_do_utente (patient_id, entrou_em desc);
create index if not exists bens_org_idx on bens_do_utente (org_id) where saiu_em is null;

comment on table bens_do_utente is
  'O que a pessoa trouxe e o que levou. `saiu_em` nulo = está cá.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. AS VACINAS
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists vacinas_do_utente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,

  -- Texto livre e não lista fechada: o calendário vacinal muda, e uma lista
  -- fechada obrigaria a uma migração a cada vacina nova. A interface oferece
  -- as habituais; quem precisar de outra escreve-a.
  vacina text not null,
  dose text,
  data date not null,
  lote text,
  -- Onde foi dada: no centro de saúde, cá dentro, no hospital.
  onde text,
  administrada_por text,
  -- Quando toca a próxima, se houver. É esta coluna que permite a pergunta
  -- «quem falta?» sem folhear boletim nenhum.
  proxima_em date,
  notas text,
  created_at timestamptz not null default now(),

  constraint vacinas_proxima check (proxima_em is null or proxima_em >= data)
);

create index if not exists vacinas_utente_idx on vacinas_do_utente (patient_id, data desc);
create index if not exists vacinas_proxima_idx
  on vacinas_do_utente (org_id, proxima_em) where proxima_em is not null;

comment on table vacinas_do_utente is
  'Boletim de vacinas. `proxima_em` é o que permite perguntar quem falta.';


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
--   select count(*) from bens_do_utente;     -- 0, nasce vazia
--   select count(*) from vacinas_do_utente;  -- 0
--
-- E CORRE O sprint153 A SEGUIR: as duas nascem com a RLS ligada e, sem ele,
-- sem política nenhuma — ninguém lê nada e parece avariado.
