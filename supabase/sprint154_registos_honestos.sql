-- supabase/sprint154_registos_honestos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto no SQL Editor, DEPOIS do sprint152 e ANTES do sprint153.
-- (O 153 põe as permissões por área em cima de todas as tabelas; se correr
--  antes desta, estas duas tabelas ficam de fora e tens de correr o 153 outra
--  vez. Ele pode correr as vezes que forem precisas, não estraga nada.)
--
-- ── O QUE ISTO ACRESCENTA ───────────────────────────────────────────────────
-- Uma tabela: `cuidados_nao_prestados`.
--
-- O Phlox sabia registar o que foi feito. Não sabia registar o que NÃO foi —
-- e num lar ou num centro de dia isso é metade da verdade do dia.
--
-- Na medicação já havia («administrado», «recusou», «suspenso»). Fora dela não
-- havia sítio nenhum: um banho que a pessoa não quis, um almoço recusado, uma
-- ginástica em que não participou. O `attended` das atividades é sim/não — não
-- distingue «não veio» de «veio e não quis», que para quem cuida são coisas
-- completamente diferentes.
--
-- ── PORQUE É QUE ISTO IMPORTA, EM TRÊS SÍTIOS ───────────────────────────────
-- 1. A inspeção. Um registo que só tem o que correu bem não é um registo. Um
--    cuidado recusado, com o motivo e a hora, é a prova de que a equipa esteve
--    lá e tentou.
-- 2. O que merece atenção. Três banhos recusados numa semana não são três
--    contrariedades: são um sinal. Sem isto escrito, ninguém o vê.
-- 3. A família. O relato honesto do dia inclui «hoje não quis almoçar».
--
-- ── PORQUE É UMA TABELA À PARTE E NÃO UM CAMPO EM CADA REGISTO ──────────────
-- A pergunta que se faz é «o que é que esta pessoa tem recusado ultimamente?»,
-- e essa atravessa as áreas todas. Uma tabela responde-lhe numa consulta; seis
-- campos em seis tabelas dariam seis migrações e seis sítios para esquecer.
--
-- Os motivos são os mesmos em lib/naoPrestado.ts. Se mudares lá, muda aqui.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cuidados_nao_prestados (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  org_id         uuid references organizations(id) on delete set null,
  patient_id     uuid not null references patients(id) on delete cascade,

  data           date not null default current_date,
  turno          text,                    -- 'manha' | 'tarde' | 'noite' | null

  -- A área de permissões a que o cuidado pertence: 'registos', 'atividades',
  -- 'medicacao'. É o que decide quem o pode ver (sprint153).
  area           text not null default 'registos',

  -- O que não foi feito, em palavras de quem cuida: «banho», «almoço»,
  -- «ginástica da manhã».
  o_que          text not null,

  motivo         text not null check (motivo in
                   ('recusou','ausente','adiado','clinico','sem_condicoes','outro')),
  nota           text,

  -- De onde veio, para se poder voltar lá: 'care-log', 'activities',
  -- 'refeicoes', 'hidratacao'… e o id da linha que o originou, quando há.
  origem         text,
  origem_id      uuid,

  recorded_by_id uuid references auth.users(id),
  recorded_by    text,
  created_at     timestamptz not null default now()
);

-- A consulta que a ficha do utente faz: o que esta pessoa não fez, por ordem.
create index if not exists cnp_pt_data_idx on cuidados_nao_prestados (patient_id, data desc);
-- A consulta do dia: o que ficou por fazer hoje, na casa toda.
create index if not exists cnp_org_data_idx on cuidados_nao_prestados (org_id, data desc)
  where org_id is not null;

-- ── RLS: o mesmo padrão das outras tabelas de registo ───────────────────────
-- Próprio OU membro da casa. A restrição por área (quem da equipa pode ver
-- registos) vem por cima, no sprint153.
alter table cuidados_nao_prestados enable row level security;

do $$ begin
  create policy "cnp_own" on cuidados_nao_prestados for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cnp_org" on cuidados_nao_prestados for all
    using (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true))
    with check (org_id is not null and org_id in (
      select org_id from org_members where user_id = (select auth.uid()) and active = true));
exception when duplicate_object then null; end $$;

-- Quem não tem sessão não lê isto. Nunca.
revoke select on cuidados_nao_prestados from anon;

do $$ begin
  alter publication supabase_realtime add table cuidados_nao_prestados;
exception when others then null; end $$;


-- ── As atividades passam a distinguir «não veio» de «veio e não quis» ───────
-- O `attended` fica como está (é o que o código todo já lê). O motivo entra ao
-- lado: quando `attended = false` e há motivo, a interface mostra a razão em
-- vez de um «Ausente» seco que não diz nada a ninguém.
alter table activity_participations
  add column if not exists motivo text;

do $$ begin
  alter table activity_participations
    add constraint activity_participations_motivo_check
    check (motivo is null or motivo in
      ('recusou','ausente','adiado','clinico','sem_condicoes','outro'));
exception when duplicate_object then null; end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select count(*) from cuidados_nao_prestados;                     -- 0, sem erro
-- select column_name from information_schema.columns
--  where table_name = 'activity_participations' and column_name = 'motivo';  -- 1 linha
