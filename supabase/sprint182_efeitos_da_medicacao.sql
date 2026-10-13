-- sprint182_efeitos_da_medicacao.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: corre isto depois do 181.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- OS EFEITOS CONHECIDOS DE CADA MEDICAMENTO, GUARDADOS UMA VEZ SÓ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── PARA QUE SERVE ─────────────────────────────────────────────────────────
-- Quando se escreve uma ocorrência — «caiu de madrugada a caminho da casa de
-- banho», «tem estado muito sonolenta desde ontem» — a pergunta que ninguém
-- tem tempo de fazer é: *isto pode ser da medicação?*
--
-- Para a responder é preciso ter, à mão e depressa, a lista de efeitos
-- adversos conhecidos de cada medicamento que a pessoa toma. Ir buscá-los ao
-- OpenFDA no momento em que a ocorrência se grava seriam dez chamadas de rede
-- com sete segundos de espera cada — ninguém espera por isso, e a ocorrência
-- fica por registar.
--
-- ── PORQUE É QUE NÃO TEM `org_id` ──────────────────────────────────────────
-- Os efeitos adversos da varfarina são os mesmos em todas as casas. Isto é
-- dado de REFERÊNCIA, como a lista de ruturas do INFARMED: guarda-se uma vez
-- e lê-se em todo o lado. Não há aqui nada de ninguém — nem um nome, nem um
-- `patient_id`. É por isso que a leitura é aberta a quem tem sessão, e a
-- escrita é só do servidor.
--
-- ── O QUE ISTO NÃO É ───────────────────────────────────────────────────────
-- Não é uma lista de diagnósticos nem uma regra de decisão. É o que o rótulo
-- do medicamento diz, em texto, com a fonte ao lado. Quem decide é quem está
-- lá — e a aplicação diz isso em cada aviso que mostra.
-- ---------------------------------------------------------------------------

create table if not exists public.medicamento_efeitos (
  -- O nome normalizado (minúsculas, sem dose, sem forma). É a chave: a
  -- «Varfine 5mg» e a «varfarina» partilham a mesma linha.
  nome          text primary key,
  -- Como foi escrito da primeira vez que alguém o pediu. Serve para a ficha
  -- poder mostrar «varfarina (Varfine)» sem adivinhar.
  nome_original text,
  -- Os efeitos adversos conhecidos, um por entrada, em minúsculas e sem
  -- pontuação — é assim que se cruzam com o texto de uma ocorrência.
  efeitos       text[] not null default '{}',
  -- O texto integral do rótulo, para a ficha do medicamento poder mostrá-lo.
  texto_adversos text,
  interacoes    text,
  avisos        text,
  indicacoes    text,
  fonte         text,
  -- `false` quando a procura correu e não encontrou nada. Guarda-se na mesma,
  -- para não se repetir a procura falhada a cada ocorrência.
  encontrado    boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create index if not exists medicamento_efeitos_atualizado_idx
  on public.medicamento_efeitos (atualizado_em);

alter table public.medicamento_efeitos enable row level security;

-- ── Quem lê e quem escreve ──────────────────────────────────────────────────
-- Lê quem tem sessão: não há aqui dado de ninguém, e esconder a bula de um
-- medicamento a quem está a cuidar de alguém não protege nada.
-- Escreve só o servidor (chave de serviço), que é quem fala com o OpenFDA.
do $$
begin
  begin
    create policy medicamento_efeitos_ler on public.medicamento_efeitos
      for select using ((select auth.uid()) is not null);
  exception when duplicate_object then null; end;
end $$;
