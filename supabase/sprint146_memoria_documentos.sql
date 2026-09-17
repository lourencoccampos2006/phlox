-- sprint146_memoria_documentos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR).
--
-- ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
-- Duas coisas, com a mesma tabela.
--
-- 1. **A mesma pergunta dá a mesma resposta.** Hoje, analisar duas vezes o
--    mesmo relatório dá dois textos diferentes — porque é um modelo de
--    linguagem e cada chamada é nova. Para quem está a tentar perceber um
--    exame, isso mina a confiança toda: se a resposta muda, qual delas é
--    verdade? Guardando a leitura com a impressão digital do documento
--    (sha-256 do conteúdo), a segunda vez devolve a PRIMEIRA leitura.
--
-- 2. **O Phlox passa a conhecer a pessoa.** Cada documento lido é uma peça da
--    história de saúde de alguém. Guardadas, o Copiloto e o Sentinel passam a
--    ter contexto real em vez de responderem no vazio.
--
-- ── A PARTE LEGAL, QUE É O MAIS IMPORTANTE DESTE FICHEIRO ──────────────────
-- Guardar documentos de saúde de alguém sem essa pessoa saber não se faz. Por
-- isso:
--   • há um interruptor de MEMÓRIA nas definições, para todos os planos;
--   • está LIGADO por omissão mas é dito na primeira leitura, não escondido;
--   • desligar apaga o que já lá está (ver /api/memoria, modo 'esquecer');
--   • quem tem plano pago tem um segundo interruptor para mandar os
--     documentos também para o cofre visível.
--
-- Com a memória DESLIGADA não se grava nada — nem a análise, nem o resumo, nem
-- a impressão digital. É desligada mesmo, não "escondida".
--
-- Nota de idempotência: `duplicate_object` NÃO apanha o 42P07 que uma
-- constraint única levanta ao criar o índice. Daí o `or duplicate_table`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. A memória ────────────────────────────────────────────────────────────
create table if not exists documentos_memoria (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Quando o documento é sobre outra pessoa (um familiar acompanhado).
  profile_id  uuid,
  -- sha-256 do conteúdo. É isto que faz a mesma leitura voltar igual.
  hash        text not null,
  tipo        text,                  -- relatorio | analise | receita | ...
  titulo      text,
  resumo      text,                  -- o "em duas linhas", para listar
  analise     jsonb,                 -- a leitura completa, tal como foi dada
  origem      text default 'scan',   -- scan | vault
  -- true quando também foi para o cofre visível (health_vault).
  no_cofre    boolean not null default false,
  criado_em   timestamptz not null default now()
);

-- Uma leitura por documento e por pessoa. É a chave da cache E da não
-- duplicação: ler o mesmo papel dez vezes não enche a memória de dez cópias.
do $$ begin
  create unique index documentos_memoria_user_hash_uidx on documentos_memoria (user_id, hash);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists documentos_memoria_user_idx on documentos_memoria (user_id, criado_em desc);

alter table documentos_memoria enable row level security;

-- Só o dono. Não há política de partilha nem de organização: isto é a história
-- de saúde de uma pessoa, e não pertence a mais ninguém.
do $$ begin
  create policy "documentos_memoria_own" on documentos_memoria for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object or duplicate_table then null; end $$;

-- ── 2. As duas escolhas ─────────────────────────────────────────────────────
-- `memoria_documentos`: guardar o que é lido. Ligado por omissão, dito à
-- pessoa na primeira leitura, desligável a qualquer momento.
alter table if exists profiles
  add column if not exists memoria_documentos boolean not null default true;

-- `guardar_no_cofre`: além de memorizar, pôr no cofre visível. Só faz sentido
-- em planos com cofre, por isso vem DESLIGADO — é uma ação com consequência
-- visível e deve ser pedida, não assumida.
alter table if exists profiles
  add column if not exists guardar_no_cofre boolean not null default false;

comment on column profiles.memoria_documentos is
  'A pessoa autoriza o Phlox a guardar os documentos que manda analisar. Desligar apaga o que já existe.';
comment on column profiles.guardar_no_cofre is
  'Além de memorizar, guardar também no cofre visível (health_vault). Só planos com cofre.';
