-- supabase/sprint159_medicacao_sos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint158. O sprint153 fica sempre para o fim.
--
-- ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
-- Medicação SOS: a que se dá quando é preciso, não a horas certas. O
-- paracetamol para as dores, o lorazepam para a agitação, o inalador.
--
-- Hoje o Phlox RECONHECE o SOS mas não o trata. O `lib/horarioToma.ts` lê a
-- frequência escrita à mão («em SOS», «se necessário») e devolve zero horas,
-- de propósito. Só que essa informação morre ali:
--
--   • `patient_meds` não tem campo nenhum que diga que é SOS;
--   • um SOS tem `shifts` vazio, e tanto o /mar como «O Dia» leem isso como
--     «todos os turnos» — ou seja, **um SOS aparece como dose por dar em cada
--     turno de cada dia, para sempre**. Enche a lista de trabalho com coisas
--     que não são para fazer, e ensina a equipa a ignorar a lista;
--   • não há onde registar que se deu, porquê, nem se resultou.
--
-- ── PORQUE É QUE A TOMA SOS NÃO VAI PARA `mar_records` ──────────────────────
-- Duas razões, e as duas contam.
--
-- A primeira é de desenho: uma toma SOS não é uma dose agendada que se marca.
-- É um ACONTECIMENTO — teve uma hora, teve um motivo, e tem uma pergunta a
-- seguir («resultou?») que uma dose das oito da manhã não tem. Guardá-la num
-- mapa de horários faz perder as três coisas.
--
-- A segunda é prática: o sprint158 pôs uma restrição única em
-- `mar_records (patient_id, med_id, date, shift)`, para duas pessoas não
-- gravarem a mesma dose a dobrar. Um SOS pode ser dado três vezes no mesmo dia
-- e no mesmo turno — colidia com ela à segunda vez.
--
-- ── A SEGURANÇA QUE ISTO TRAZ ───────────────────────────────────────────────
-- Com `sos_max_dia` e `sos_intervalo_horas` escritos, a aplicação consegue
-- responder à pergunta que importa antes de alguém dar o comprimido: «já se
-- deu hoje? há quanto tempo?». Sem isso, a resposta está na cabeça de quem
-- estava no turno anterior.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── O medicamento sabe que é SOS ────────────────────────────────────────────
alter table patient_meds
  add column if not exists sos boolean not null default false;

-- Quantas vezes no máximo por dia, e quanto tempo entre tomas. Ambos opcionais:
-- há SOS sem limite escrito, e inventar um seria pior do que não ter nenhum.
alter table patient_meds
  add column if not exists sos_max_dia int;
alter table patient_meds
  add column if not exists sos_intervalo_horas int;

-- O que o medicamento serve para tratar, em palavras de quem cuida: «dores de
-- cabeça», «agitação ao fim do dia». É o que a auxiliar lê antes de decidir.
alter table patient_meds
  add column if not exists sos_para text;

-- Marca como SOS o que JÁ está escrito como tal na frequência. Mesmo padrão do
-- lib/horarioToma.ts, para o que a aplicação já reconhecia não ter de ser
-- reescrito à mão pessoa a pessoa.
--
-- Só escreve onde ainda é `false`: uma marcação feita à mão nunca é desfeita
-- por isto, hoje nem quando isto voltar a correr.
update patient_meds
   set sos = true
 where sos = false
   and frequency is not null
   and (
     frequency ~* '\ysos\y'
     or frequency ~* 'se necess'
     or frequency ~* 'em caso de'
     or frequency ~* 'quando (precisar|necess)'
     or frequency ~* '\yapenas se\y'
   );


-- ── As tomas ────────────────────────────────────────────────────────────────
create table if not exists tomas_sos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete set null,
  patient_id  uuid not null references patients(id) on delete cascade,
  med_id      uuid not null references patient_meds(id) on delete cascade,

  -- A HORA, não o turno. Um SOS das duas da manhã e outro das seis da tarde
  -- são acontecimentos diferentes, e é a hora que os distingue.
  dada_em     timestamptz not null default now(),
  -- Porque é que se deu. Obrigatório: um SOS sem motivo escrito é
  -- indistinguível de um engano, e é a primeira coisa que uma inspeção
  -- pergunta.
  motivo      text not null,
  -- Resultou? Fica em branco e preenche-se mais tarde, que é como a vida é —
  -- ninguém sabe se a dor passou no momento em que dá o comprimido.
  resultado   text,

  dada_por    text,
  recorded_by_id uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- «Quantas já se deram hoje a esta pessoa» e «há quanto tempo foi a última»:
-- as duas perguntas que a aplicação faz antes de deixar dar outra.
create index if not exists tomas_sos_med_idx on tomas_sos (med_id, dada_em desc);
create index if not exists tomas_sos_pt_idx on tomas_sos (patient_id, dada_em desc);
create index if not exists tomas_sos_org_idx on tomas_sos (org_id, dada_em desc)
  where org_id is not null;


-- ── RLS: o padrão das outras tabelas da casa ────────────────────────────────
alter table tomas_sos enable row level security;

do $$ begin
  create policy "sos_proprio" on tomas_sos for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "sos_casa" on tomas_sos for all
    using (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true))
    with check (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true));
exception when duplicate_object then null; end $$;

revoke select on tomas_sos from anon;

do $$ begin
  alter publication supabase_realtime add table tomas_sos;
exception when others then null; end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- Quantos medicamentos ficaram marcados como SOS a partir do que já estava
-- escrito na frequência:
--   select count(*) from patient_meds where sos;
--
-- E a lista, para confirmares que nenhum foi apanhado por engano:
--   select name, frequency from patient_meds where sos order by name;
--
-- select count(*) from tomas_sos;   -- 0, sem erro
