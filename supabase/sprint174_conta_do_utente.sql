-- supabase/sprint174_conta_do_utente.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint173, e o sprint153 a seguir.
--
-- ── DE ONDE VEIO ────────────────────────────────────────────────────────────
-- Da pesquisa ao Resilar (2026-10-01). Eles não são um concorrente com um
-- módulo de contas: o produto DELES é só isto, a 2 € por utente por mês.
--
--   «Despesas por utente, com movimentos e histórico organizados por tipo e
--    data. Débitos e créditos, com saldo automático. Extrato mensal em PDF,
--    enviado por email ao familiar responsável.»
--
-- O Phlox tinha a `billing_entries`: UMA linha por mês com quatro números
-- (mensalidade, comparticipação, extras, desconto). Isso é um resumo, não uma
-- conta. Não responde a «os 40 € de extras de que são?», que é a pergunta que
-- a família faz todos os meses.
--
-- ── O QUE ISTO NÃO FAZ, E PORQUÊ ───────────────────────────────────────────
-- Não substitui a `billing_entries`. Ela é lida pelo /painel, pelo
-- /estatisticas e pelo /painel-dono, e trocá-la partia os três de uma vez.
--
-- A divisão é: a MENSALIDADE e a comparticipação continuam lá (são um acordo,
-- fixo, por mês); os EXTRAS e os PAGAMENTOS passam a ser movimentos aqui, um a
-- um, com data e descrição.
--
-- ── E NÃO HÁ DOIS SÍTIOS COM OS EXTRAS ─────────────────────────────────────
-- Haveria, se ficasse por aqui: `billing_entries.extras` é um número escrito à
-- mão e isto passa a ser a lista. Duas verdades sobre a mesma dívida.
--
-- Por isso o gatilho lá em baixo faz da `billing_entries.extras` a SOMA dos
-- débitos do mês. Deixa de ser um campo e passa a ser um espelho: quem
-- acrescenta «farmácia, 12,40 €» vê o total subir sozinho, e os três ecrãs que
-- já leem `extras` continuam certos sem lhes tocar numa linha.
--
-- ── PORQUE É QUE O VALOR É SEMPRE POSITIVO ─────────────────────────────────
-- Com valores assinados, um sinal trocado é invisível: −12,40 e 12,40 lêem-se
-- quase igual numa lista, e a conta fica errada em 24,80 sem nada vermelho no
-- ecrã. Com `sentido` à parte, um movimento no sentido errado aparece na
-- coluna errada e vê-se de longe.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists conta_do_utente (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  recorded_by_id uuid references auth.users(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,

  data date not null default current_date,
  -- O mês a que PERTENCE, que não é sempre o mês da data: a farmácia de 31 de
  -- outubro entra no extrato de outubro mesmo que seja lançada a 2 de
  -- novembro. Sem esta coluna, quem lança com atraso empurra a despesa para o
  -- mês seguinte e a família recebe um extrato que não bate com nada.
  mes text not null,

  -- `debito`  = a pessoa passou a dever (farmácia, cabeleireiro, fralda extra)
  -- `credito` = a pessoa pagou, ou foi-lhe creditado (pagamento, acerto)
  sentido text not null,
  -- `farmacia` | `cabeleireiro` | `transporte` | `material` | `saude`
  -- | `pagamento` | `adiantamento` | `acerto` | `outro`
  tipo text not null default 'outro',
  descricao text not null,
  -- SEMPRE positivo. O sentido está na coluna de cima. Ver a nota no cabeçalho.
  valor numeric(10,2) not null,

  -- Comprovativo, quando há: o recibo da farmácia fotografado.
  anexo_path text,
  notas text,
  -- O nome de quem lançou, guardado no momento. Sobrevive a quem sai da casa,
  -- e uma linha de conta sem autor não se defende numa reunião com a família.
  lancado_por text,
  created_at timestamptz not null default now(),

  constraint conta_sentido check (sentido in ('debito', 'credito')),
  constraint conta_tipo check (tipo in (
    'farmacia', 'cabeleireiro', 'transporte', 'material', 'saude',
    'pagamento', 'adiantamento', 'acerto', 'outro')),
  -- Zero não é um movimento, e negativo seria o sentido escrito duas vezes.
  constraint conta_valor_positivo check (valor > 0),
  constraint conta_mes check (mes ~ '^\d{4}-\d{2}$')
);

create index if not exists conta_utente_idx on conta_do_utente (patient_id, data desc);
create index if not exists conta_mes_idx on conta_do_utente (org_id, mes);

comment on table conta_do_utente is
  'A conta-corrente de cada pessoa: extras e pagamentos, um a um. A mensalidade continua em billing_entries.';


-- ═══════════════════════════════════════════════════════════════════════════
-- O ESPELHO: `billing_entries.extras` passa a ser a soma dos débitos do mês
-- ═══════════════════════════════════════════════════════════════════════════
-- Sem isto haveria dois sítios com os extras do mesmo mês — um escrito à mão e
-- outro somado — e no dia em que discordassem ninguém saberia qual cobrar.
--
-- O gatilho só mexe numa linha que JÁ exista. Não cria mensalidades: um extra
-- lançado num mês sem mensalidade gerada é uma dívida a sério, mas inventar
-- aqui uma linha de mensalidade a zero euros punha uma fatura falsa na lista
-- de quem cobra.
create or replace function sincronizar_extras_do_mes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p uuid;
  m text;
  total numeric(10,2);
begin
  -- Num DELETE é a linha antiga que diz de que mês falamos.
  p := coalesce(new.patient_id, old.patient_id);
  m := coalesce(new.mes, old.mes);

  select coalesce(sum(valor), 0) into total
    from conta_do_utente
   where patient_id = p and mes = m and sentido = 'debito';

  update billing_entries
     set extras = total, updated_at = now()
   where patient_id = p and month = m;

  return coalesce(new, old);
end $$;

drop trigger if exists conta_sincroniza_extras on conta_do_utente;
create trigger conta_sincroniza_extras
  after insert or update or delete on conta_do_utente
  for each row execute function sincronizar_extras_do_mes();


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
--   select count(*) from conta_do_utente;   -- 0, nasce vazia
--
-- O espelho, com dados a sério:
--   1) lança um débito de 10 € num utente que tenha mensalidade deste mês;
--   2) select extras from billing_entries where patient_id = … and month = …;
--      → tem de dizer 10.00
--   3) apaga o movimento → volta a 0.00
--
-- E CORRE O sprint153 A SEGUIR: a tabela nasce com a RLS ligada e, sem ele,
-- sem política nenhuma.
