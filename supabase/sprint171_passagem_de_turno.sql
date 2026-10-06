-- supabase/sprint171_passagem_de_turno.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto DEPOIS do sprint170, e o sprint153 a seguir.
--
-- ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
-- Da pesquisa aos programas que as casas já usam. Os três ingleses — Person
-- Centred Software, Nourish, Log my Care — têm todos a mesma peça, e os
-- portugueses não: a PASSAGEM DE TURNO.
--
-- «Flag any care log for handover to keep the next carer updated», e as
-- ocorrências entram sozinhas. É a peça que faz a informação atravessar a
-- porta quando a equipa muda — e sem ela cada turno começa do zero, ou começa
-- com o que alguém se lembrar de dizer no corredor.
--
-- ── A TABELA JÁ EXISTIA, E NUNCA FOI USADA ─────────────────────────────────
-- `handovers` está na base de dados desde há meses com as colunas certas
-- (`from_user_id`, `to_user_id`, `shift`, `date`, `patients_summary`,
-- `general_notes`, `completed`) e aparece num sítio só do código inteiro:
-- `lib/areasDeDados.ts`, a dizer a que área pertence. Nunca ninguém lá
-- escreveu nem leu.
--
-- Por isso esta migração é pequena: falta-lhe UMA coisa.
--
-- ── O QUE FALTA: SABER QUEM LEU ────────────────────────────────────────────
-- Uma passagem que ninguém confirma ter lido é um papel em cima da mesa. O
-- que os programas ingleses vendem não é o texto — é o «read receipt»: quem
-- entra ao turno marca como lida, e quem gere a casa vê quem ainda não
-- marcou.
--
-- Sem isso, no dia em que alguma coisa corre mal, a pergunta «mas isso estava
-- na passagem?» não tem resposta possível.
--
-- ── PORQUE É QUE É UMA TABELA E NÃO UMA COLUNA `lida_por uuid[]` ───────────
-- Um array guarda QUEM leu e perde QUANDO. E o quando é metade do valor:
-- «leu» e «leu quarenta minutos depois de entrar ao turno» são coisas
-- diferentes numa auditoria.
--
-- Pior: dois colegas a marcarem como lida no mesmo segundo fazem cada um um
-- `update` sobre o array que leram — e o segundo apaga o primeiro. Com uma
-- linha por pessoa isso não pode acontecer.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Quem leu a passagem, e quando ───────────────────────────────────────────
create table if not exists passagem_leituras (
  id uuid primary key default gen_random_uuid(),
  passagem_id uuid not null references handovers(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  -- O nome sobrevive a quem sai da casa. É o mesmo par que o `incidents` usa:
  -- o `id` deixa de resolver, e o registo de quem leu não pode ficar anónimo.
  nome text,
  lida_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Uma pessoa lê uma passagem uma vez. Sem isto, abrir a página duas vezes
  -- fazia duas linhas e a casa contava dois leitores onde há um.
  unique (passagem_id, user_id)
);

create index if not exists idx_passagem_leituras_passagem on passagem_leituras (passagem_id);
create index if not exists idx_passagem_leituras_org on passagem_leituras (org_id);

alter table passagem_leituras enable row level security;


-- ── O que faltava à `handovers` ─────────────────────────────────────────────
-- `user_id` para a política da casa a saber tratar como as outras, e
-- `fechada_em` para se saber quando o turno acabou de facto — que não é a hora
-- a que a linha foi criada (a passagem começa a escrever-se a meio do turno).
alter table handovers add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table handovers add column if not exists recorded_by_id uuid references auth.users(id) on delete set null;
alter table handovers add column if not exists fechada_em timestamptz;
alter table handovers add column if not exists autor_nome text;

comment on column handovers.patients_summary is
  'O que foi marcado para a passagem, por pessoa: [{patient_id, nome, nota}]. O resto (ocorrências, recusas, o que ficou por fazer) é CALCULADO em lib/passagemDeTurno.ts e não se grava aqui — gravado, ficava desatualizado assim que alguém corrigisse o registo de origem.';

comment on column handovers.completed is
  'A passagem foi fechada e entregue. Enquanto for falsa é um rascunho, e só quem a escreve a vê.';


-- ── Uma passagem por casa, por dia, por turno ───────────────────────────────
-- Duas passagens do mesmo turno são duas verdades sobre a mesma noite, e no
-- dia em que discordarem ninguém sabe qual vale. Quem chega a meio acrescenta
-- à que existe.
create unique index if not exists idx_handover_unico
  on handovers (org_id, date, shift);


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) A tabela existe e tem a RLS ligada:
--    select relname, relrowsecurity from pg_class where relname = 'passagem_leituras';
--
-- 2) CORRE O sprint153 A SEGUIR. É ele que põe a política por área, e sem ela
--    esta tabela fica com a RLS ligada e SEM política nenhuma — ou seja,
--    ninguém lê nada e a funcionalidade parece avariada.
--
-- 3) Na aplicação: painel → Passagem de turno → escrever e fechar. Sair da
--    conta, entrar com outra, e confirmar que aparece por ler.
