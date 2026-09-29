-- supabase/sprint161_ocorrencias.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint160, e o sprint153 a seguir.
--
-- ── PORQUE É QUE AS OCORRÊNCIAS PRECISAVAM DISTO ───────────────────────────
-- Disseste que este centro de dia as usa imenso. O que estava construído
-- regista bem o que aconteceu — tipo, gravidade, descrição, o que se fez — e
-- falha na parte que faz uma ocorrência valer alguma coisa: o SEGUIMENTO.
--
-- Havia `follow_up_required` (um sim/não) e `follow_up_notes` (texto livre).
-- Nada disso diz QUEM e ATÉ QUANDO. E um seguimento sem dono não é um
-- seguimento: é uma intenção. Passa uma semana, ninguém fez nada, e quando a
-- inspeção pergunta o que foi feito a seguir à queda de dia 3, a resposta é
-- uma caixa de texto vazia.
--
-- ── O QUE ISTO ACRESCENTA ──────────────────────────────────────────────────
--   responsavel_id / responsavel   quem trata
--   prazo                          até quando
--   fechado_em / fechado_por       quem deu por resolvido, e quando
--   fotos                          o que se viu
--
-- ── OS TIPOS ───────────────────────────────────────────────────────────────
-- Os sete de origem são de enfermaria: queda, erro de medicação, úlcera de
-- pressão, comportamental, engasgamento, infeção, outro. Faltam os que
-- acontecem mesmo num centro de dia — uma fuga, um desaparecimento à hora do
-- transporte, uma agressão entre utentes, uma reclamação de família, um
-- acidente com material.
--
-- «Outro» a apanhar metade das ocorrências é o mesmo que não ter tipos: não se
-- consegue contar nada, e é por tipo que se percebe onde a casa tem um
-- problema a repetir-se.
--
-- A restrição sai por DESCOBERTA e não por nome — a lição do sprint152.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Seguimento com dono e prazo ─────────────────────────────────────────────
alter table incidents add column if not exists responsavel_id uuid references auth.users(id);
alter table incidents add column if not exists responsavel text;
alter table incidents add column if not exists prazo date;
alter table incidents add column if not exists fechado_em timestamptz;
alter table incidents add column if not exists fechado_por text;

-- As fotografias. São caminhos no balde PRIVADO `documents`, com o prefixo
-- `incidentes/` — e não num balde público como o das feridas. A fotografia de
-- uma queda é um documento de saúde de uma pessoa identificável; um endereço
-- permanente e adivinhável seria isso a circular para sempre.
alter table incidents add column if not exists fotos text[];

-- A consulta que o painel faz: o que está por fechar, por prazo.
create index if not exists incidents_prazo_idx on incidents (org_id, prazo)
  where org_id is not null and status <> 'closed';
-- A consulta da repetição: o que já aconteceu a esta pessoa, deste tipo.
create index if not exists incidents_pt_tipo_idx on incidents (patient_id, type, date desc);


-- ── Tipos que fazem falta num centro de dia ─────────────────────────────────
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where contype = 'c' and conrelid = 'incidents'::regclass
       and pg_get_constraintdef(oid) ilike '%type%'
       and pg_get_constraintdef(oid) ilike '%fall%'
  loop
    execute format('alter table incidents drop constraint %I', c.conname);
    raise notice '  restricao de tipo largada: %', c.conname;
  end loop;
end $$;

alter table incidents add constraint incidents_type_check check (type in (
  -- os que já existiam
  'fall', 'medication_error', 'pressure_ulcer', 'behavioral', 'choking',
  'infection', 'other',
  -- os que faltavam
  'fuga',            -- saiu sem ninguém dar por isso
  'agressao',        -- entre utentes, ou a alguém da equipa
  'transporte',      -- a carrinha, a chegada, a saída
  'material',        -- equipamento que falhou ou magoou
  'reclamacao',      -- de uma família, e essas têm de ficar escritas
  'ausencia_equipa', -- faltou quem devia estar, e isso é uma ocorrência
  'erro_alimentar'   -- dieta trocada, alergia, textura errada
));


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'incidents'
--    and column_name in ('responsavel_id','prazo','fechado_em','fotos');   -- 4 linhas
--
-- E que nenhuma ocorrência que já existe deixou de caber na restrição:
--   select type, count(*) from incidents group by type;
--
-- No teu computador, antes de correres:
--   node scripts/check-migracoes.mjs
