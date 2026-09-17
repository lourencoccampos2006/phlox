-- sprint149_memoria_por_pessoa.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR), depois do sprint146.
--
-- ── O PROBLEMA QUE ISTO RESOLVE ─────────────────────────────────────────────
-- O sprint146 fez o Phlox guardar os documentos que analisa. Faltava a parte
-- difícil: de QUEM é cada documento.
--
-- Acontece a toda a hora, e é bom que aconteça: alguém está com outra pessoa
-- que tem um papel na mão e não o percebe, fotografa-o e manda-o ao Phlox. É o
-- uso normal da ferramenta. Ninguém vai criar um perfil para uma pessoa que
-- encontra uma vez — e não precisa. O documento fica na memória de QUEM O
-- MANDOU; é a conta dele, é o arquivo dele.
--
-- Mas se tudo cair no mesmo saco, a memória fica pior do que inútil: fica
-- errada. Os exames de outra pessoa passariam a informar o que o Phlox diz
-- sobre o próprio, e daí sai disparate com ar de rigor.
--
-- ── A SOLUÇÃO: SUJEITOS ─────────────────────────────────────────────────────
-- Dentro da memória de cada conta há SUJEITOS — uma gaveta por pessoa de quem
-- já se leu algum documento. Documentos de saúde trazem quase sempre o nome; a
-- IA lê-o e lib/sujeitos.ts decide a que gaveta pertence. Os perfis que a
-- pessoa já acompanha têm a sua gaveta ligada; quem aparece de passagem ganha
-- uma gaveta própria e não estraga as outras.
--
-- ── E O DOSSIER ─────────────────────────────────────────────────────────────
-- Cada gaveta tem um `dossier`: não os documentos, mas o que sobrou de os ler.
-- Condições, medicação, valores ao longo do tempo, o que foi acontecendo, e o
-- que a própria pessoa respondeu quando lhe perguntámos. É isto que volta a
-- entrar no pedido seguinte à IA — e é a diferença entre guardar e saber.
-- Ver lib/dossier.ts.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. As gavetas ───────────────────────────────────────────────────────────
create table if not exists documentos_sujeitos (
  id          uuid primary key default gen_random_uuid(),
  -- De quem é a MEMÓRIA (não de quem é o documento). É sempre a conta que
  -- mandou analisar.
  user_id     uuid not null references auth.users(id) on delete cascade,

  nome        text not null,
  -- O nome reduzido ao que o identifica: sem acentos, sem maiúsculas, sem
  -- tratamentos nem partículas. É o que sustenta o `unique` — senão "Dr. João
  -- da Silva" e "joao silva" abriam duas gavetas para a mesma pessoa.
  nome_chave  text not null,
  -- As grafias já vistas. Um nome que aparece por extenso num papel e
  -- abreviado noutro passa a ser reconhecido pelos dois sem voltar a perguntar.
  grafias     text[] not null default '{}',

  -- proprio | perfil | outro
  relacao     text not null default 'outro',
  -- Quando a gaveta corresponde a um perfil que a pessoa já acompanha.
  profile_id  uuid,

  -- O que se sabe. Ver lib/dossier.ts.
  dossier     jsonb not null default '{}'::jsonb,

  documentos  int not null default 0,
  ultimo_em   timestamptz,
  criado_em   timestamptz not null default now(),

  unique (user_id, nome_chave)
);

create index if not exists documentos_sujeitos_user_idx
  on documentos_sujeitos (user_id, ultimo_em desc nulls last);

alter table documentos_sujeitos enable row level security;

-- Só o dono da conta. Não há partilha: é o arquivo pessoal de quem analisou.
do $$ begin
  create policy "documentos_sujeitos_own" on documentos_sujeitos for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object or duplicate_table then null; end $$;

-- ── 2. Cada documento sabe a que gaveta pertence ────────────────────────────
-- `on delete set null`: apagar uma gaveta não pode apagar os documentos. Quem
-- apaga uma gaveta quer desfazer uma arrumação errada, não perder leituras.
alter table if exists documentos_memoria
  add column if not exists sujeito_id uuid references documentos_sujeitos(id) on delete set null;

create index if not exists documentos_memoria_sujeito_idx
  on documentos_memoria (sujeito_id, criado_em desc);

-- O nome tal como vinha escrito no documento. Guarda-se além da ligação para
-- se poder mostrar "o documento dizia X" quando a arrumação estiver errada.
alter table if exists documentos_memoria
  add column if not exists nome_no_documento text;

comment on table documentos_sujeitos is
  'Uma gaveta por pessoa de quem se leu algum documento, dentro da memória de uma conta. Impede que documentos de terceiros contaminem a memória do próprio.';
comment on column documentos_sujeitos.dossier is
  'O que sobrou de ler os documentos: condições, medicação, valores, acontecimentos e o que a pessoa respondeu. Volta a entrar no pedido seguinte à IA.';
