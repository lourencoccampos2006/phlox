-- supabase/sprint177_ocorrencias_da_casa.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint176. Não precisa do 153 a seguir (não
-- cria tabelas nenhumas — só alarga uma restrição).
--
-- ── O QUE FALTAVA ───────────────────────────────────────────────────────────
-- Da pesquisa ao Ankira: «Ocorrências — registo e acompanhamento de ocorrências
-- gerais E DE UTENTES».
--
-- No Phlox só havia as de utentes. O formulário tinha, à letra:
--
--     if (!form.patient_id) throw new Error('Seleciona um utente')
--
-- Por isso um cano rebentado, uma falha de energia de quatro horas ou uma
-- visita da ASAE não tinham onde ser registados.
--
-- ── E SÃO ESTAS QUE EXPLICAM O RESTO ───────────────────────────────────────
-- Três meses depois, alguém olha para um dia em que faltou metade dos registos
-- e não percebe porquê. A resposta era «esteve quatro horas sem água» — e essa
-- frase não estava escrita em lado nenhum.
--
-- A ASAE pergunta pelo controlo de pragas. Os bombeiros perguntam pelos
-- alarmes. A Segurança Social pergunta pelas visitas anteriores. Nenhuma
-- dessas perguntas tinha resposta.
--
-- ── PORQUE É QUE O `patient_id` NÃO MUDA ───────────────────────────────────
-- Já era opcional na base de dados — nunca teve `not null`. Quem obrigava era
-- o formulário. Esta migração só alarga a lista de tipos; o resto é código.
-- ─────────────────────────────────────────────────────────────────────────────

-- A restrição anterior sai pelo nome que tiver. O sprint161 criou-a como
-- `incidents_type_check`, mas uma casa que tenha corrido uma versão anterior
-- pode ter outro nome — por isso procura-se pelo conteúdo, como lá.
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
  -- ── De uma pessoa (sprint161) ─────────────────────────────────────────────
  'fall', 'medication_error', 'pressure_ulcer', 'behavioral', 'choking',
  'infection', 'other',
  'fuga', 'agressao', 'transporte', 'material', 'reclamacao',
  'ausencia_equipa', 'erro_alimentar',

  -- ── Da casa (novos) ───────────────────────────────────────────────────────
  'agua',       -- corte, rotura, inundação, falta de água quente
  'energia',    -- falha de eletricidade ou de gás
  'incendio',   -- fogo, fumo, ou o alarme a disparar (mesmo que falso)
  'seguranca',  -- intrusão, furto, porta que ficou aberta
  'pragas',     -- a ASAE pergunta pelo controlo de pragas
  'inspecao',   -- Segurança Social, ASAE, bombeiros
  'obras'       -- avaria ou obra que mudou a rotina
));


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- Nenhuma ocorrência que já existe pode ter ficado de fora. Se esta migração
-- corresse e alguma linha não coubesse, o Postgres recusava-a inteira — por
-- isso, se correu, está tudo lá:
--   select type, count(*) from incidents group by type order by 2 desc;
--
-- E na aplicação: /incidents → «Registar» → o tipo «Água», em «Na casa».
-- Não deve pedir nenhum utente.
