-- sprint185_medicamento_explicado.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- A BULA LIDA, TRADUZIDA E ARRUMADA — guardada uma vez, para todas as casas.
--
-- ── O PEDIDO ───────────────────────────────────────────────────────────────
-- «Na parte da descrição dos medicamentos quero que leias todo o texto com IA
--  e o traduzas e coloques de maneira que dê para entender melhor.»
--
-- ── O QUE ESTAVA LÁ ────────────────────────────────────────────────────────
-- O texto do rótulo da FDA, cru e em inglês, em quatro abas. Oitocentos a mil
-- e duzentos caracteres de prosa regulatória americana por secção, do género
--
--     "In clinical trials, the most commonly reported adverse reactions
--      (incidence ≥2% and greater than placebo) were..."
--
-- numa aplicação cujo utilizador é uma auxiliar de lar portuguesa. Estar lá
-- era melhor do que não estar; ser legível é outra coisa.
--
-- ── PORQUE É QUE A TRADUÇÃO SE GUARDA, E AQUI ──────────────────────────────
-- Porque é a mesma para toda a gente. O rótulo da varfarina não muda de casa
-- para casa, e por isso a leitura dele também não. Guardada na linha que já
-- existe, a explicação custa UMA chamada de IA por medicamento — a primeira
-- vez que alguém abre a ficha, em qualquer instituição — e nunca mais.
--
-- Fazê-la a cada abertura seria pagar mil vezes pela mesma resposta, e numa
-- aplicação com tecto de orçamento nas rotas de IA isso gasta-se depressa.
--
-- ── O QUE NÃO ENTRA AQUI ───────────────────────────────────────────────────
-- Nada de nenhuma pessoa. Esta tabela é referência pública — o que o
-- fabricante publicou e a leitura disso. Não tem `org_id` e não o pode ter.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- A explicação, em português, já estruturada. `jsonb` e não colunas soltas:
-- a forma do que se explica vai mudar (hoje são cinco campos, amanhã talvez
-- seis) e cada mudança dessas não deve ser uma migração.
alter table public.medicamento_efeitos
  add column if not exists explicacao jsonb;

-- Quando foi lida, e por que modelo. Sem isto, uma leitura feita por um modelo
-- antigo fica indistinguível de uma feita hoje — e quando o modelo melhorar
-- não há como saber o que vale a pena voltar a ler.
alter table public.medicamento_efeitos
  add column if not exists explicado_em timestamptz;

alter table public.medicamento_efeitos
  add column if not exists explicado_por text;

-- A leitura só se refaz quando o TEXTO do rótulo muda. Guardar a impressão
-- digital do texto que foi lido é o que permite saber isso sem o comparar
-- inteiro — e sem refazer a leitura de tudo de cada vez que a cache do rótulo
-- é renovada por outra razão qualquer.
alter table public.medicamento_efeitos
  add column if not exists explicacao_de text;

notify pgrst, 'reload schema';
