-- supabase/sprint176_ausencias_do_utente.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint175, e o sprint153 a seguir.
--
-- ── DE ONDE VEIO ────────────────────────────────────────────────────────────
-- Da pesquisa ao Ankira, onde «Ausências» é uma das caixas da aplicação de
-- registo. E de uma coisa que se vê em qualquer lar: há sempre alguém no
-- hospital, e alguém que foi passar o fim de semana a casa da filha.
--
-- ── O QUE HAVIA, E PORQUE NÃO SERVE ────────────────────────────────────────
-- A tabela `attendance` é um registo DIÁRIO: uma linha por pessoa por dia, com
-- hora de chegada e de saída. Serve um centro de dia, onde as pessoas entram e
-- saem todos os dias.
--
-- Num lar não serve. Alguém internado três semanas precisaria de vinte e uma
-- linhas, e ninguém as cria — por isso a ausência simplesmente não fica
-- registada em lado nenhum.
--
-- ── E ISSO TEM TRÊS CONSEQUÊNCIAS, TODAS MÁS ───────────────────────────────
-- 1. O «O Dia» continua a pedir a medicação e o banho de quem está no
--    hospital. Numa lista de setenta linhas, as que são impossíveis ensinam a
--    equipa a ignorar a lista toda.
-- 2. A faturação não sabe. Há acordos em que a mensalidade desce ao fim de X
--    dias de ausência, e isso faz-se a olhar para um calendário de papel.
-- 3. A família não vê. O portal diz que não houve registos — que é verdade e
--    não explica nada.
--
-- ── O MESMO FEITIO DAS AUSÊNCIAS DA EQUIPA, DE PROPÓSITO ───────────────────
-- `inicio` + `fim` (null = ainda fora). A aritmética é a mesma e vive num sítio
-- só (`lib/periodo.ts`): «está fora neste dia?» é a pergunta que erra nos
-- limites, e duas implementações dela acabam por discordar.
--
-- ── O QUE ESTA TABELA NÃO DECIDE ───────────────────────────────────────────
-- Não decide quanto se cobra. Cada acordo de cooperação tem a sua regra, e
-- metê-la aqui seria o Phlox a dizer a uma casa quanto deve faturar. Guarda-se
-- o FACTO — esteve fora, de tal a tal dia, por este motivo — e a regra é de
-- quem a tem.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ausencias_do_utente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,

  -- `hospital` | `familia` | `ferias` | `consulta` | `outro`
  --
  -- `consulta` é uma ausência de horas, não de dias — mas marca-se na mesma,
  -- porque é o que explica à família porque é que não houve registos à tarde.
  tipo text not null default 'hospital',
  inicio date not null,
  -- Null = ainda fora. Uma ida ao hospital sem data de alta é o caso normal, e
  -- inventar um regresso seria pior do que não saber.
  fim date,

  motivo text,
  -- Para onde foi: o nome do hospital, o nome de quem a levou. É isto que
  -- responde ao telefonema da outra filha a perguntar onde está a mãe.
  onde text,
  notas text,
  created_at timestamptz not null default now(),

  constraint ausencias_utente_tipo check (
    tipo in ('hospital', 'familia', 'ferias', 'consulta', 'outro')),
  constraint ausencias_utente_datas check (fim is null or fim >= inicio)
);

create index if not exists ausencias_utente_idx
  on ausencias_do_utente (patient_id, inicio desc);
-- A pergunta do dia: quem é que está fora agora? As que já acabaram não
-- entram, e são a maioria ao fim de um ano.
create index if not exists ausencias_utente_abertas_idx
  on ausencias_do_utente (org_id, inicio) where fim is null;
create index if not exists ausencias_utente_periodo_idx
  on ausencias_do_utente (org_id, inicio, fim);

comment on table ausencias_do_utente is
  'Ausências de vários dias (hospital, família). A `attendance` é o registo diário de um centro de dia e não serve para isto.';


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
--   select count(*) from ausencias_do_utente;   -- 0, nasce vazia
--
-- Quem está fora hoje:
--   select p.name, a.tipo, a.inicio, a.fim
--     from ausencias_do_utente a join patients p on p.id = a.patient_id
--    where a.inicio <= current_date and (a.fim is null or a.fim >= current_date);
--
-- E na aplicação: marque alguém como internado e abra o /o-dia — as tarefas
-- dessa pessoa saem da lista, e o topo diz quantas pessoas estão fora.
--
-- CORRE O sprint153 A SEGUIR.
