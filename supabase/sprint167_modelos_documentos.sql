-- supabase/sprint167_modelos_documentos.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint166. O sprint153 continua a ser o último.
--
-- ── O QUE PEDISTE ───────────────────────────────────────────────────────────
-- «Em documentos deveria de conseguir enviar-se apenas uma "template" de um
--  documento, por exemplo, do documento de inscrição, e aquilo preenchia o
--  documento com base nas condições da pessoa.»
--
-- ── DUAS TABELAS, E A SEGUNDA É A QUE IMPORTA A SÉRIO ──────────────────────
-- `modelos_documentos` guarda o texto com as marcas (`{{nome}}`, `{{nif}}`).
-- Essa é a parte óbvia.
--
-- `documentos_emitidos` guarda o texto JÁ PREENCHIDO de cada documento que
-- saiu, e é essa que não se podia deixar de fora. Um contrato assinado em
-- março tem de continuar a ler-se como estava em março, mesmo que em setembro
-- alguém corrija uma cláusula do modelo. Guardar só a ligação ao modelo
-- significava que o documento mudava sozinho depois de estar assinado — e numa
-- inspeção não há como provar o que a pessoa assinou.
--
-- É por isso que `corpo_final` é `not null`: um documento emitido sem o texto
-- que saiu não serve de registo de nada.
--
-- ── AS MARCAS NÃO SÃO VALIDADAS AQUI ────────────────────────────────────────
-- Os campos válidos vivem em `lib/modelos.ts`, que os lê de `lib/inscricao.ts`
-- — a mesma lista que desenha o formulário da ficha. Um CHECK nesta tabela
-- teria de repetir essa lista em SQL e ficaria desencontrado no dia em que se
-- acrescentasse um campo à ficha. Quem avisa é o ecrã, antes de gravar, e
-- quem garante que nada sai errado é a lista do que falta antes de imprimir.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists modelos_documentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete cascade,

  nome        text not null,
  categoria   text not null default 'outro'
                check (categoria in ('inscricao', 'contrato', 'consentimento',
                                     'declaracao', 'outro')),
  -- O texto com as marcas. Não há limite: um contrato de prestação de
  -- serviços tem páginas.
  corpo       text not null,
  -- Para que serve este modelo, para quem o vê numa lista de quinze não ter
  -- de o abrir para saber.
  descricao   text,

  ativo       boolean not null default true,
  criado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists modelos_org_idx on modelos_documentos (org_id, categoria) where ativo;
-- Dois modelos com o mesmo nome na mesma casa é o caminho para alguém emitir
-- o errado. `lower()` porque «Contrato» e «contrato» são o mesmo.
create unique index if not exists modelos_nome_unico
  on modelos_documentos (org_id, lower(nome)) where org_id is not null;


-- ── O que saiu, e como saiu ─────────────────────────────────────────────────
create table if not exists documentos_emitidos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  org_id      uuid references organizations(id) on delete cascade,

  -- `on delete set null`: apagar um modelo não pode apagar o registo dos
  -- documentos que já saíram dele. O nome fica guardado à parte, para o
  -- registo continuar a fazer sentido depois de o modelo desaparecer.
  modelo_id   uuid references modelos_documentos(id) on delete set null,
  modelo_nome text not null,

  patient_id  uuid references patients(id) on delete cascade,
  nome_pessoa text,

  -- O texto tal como saiu. É isto que faz deste registo uma prova.
  corpo_final text not null,
  -- Os campos que estavam em branco quando o documento saiu. Guarda-se porque
  -- é a diferença entre «o documento estava incompleto» e «alguém apagou o
  -- valor depois», e a pergunta faz-se meses mais tarde.
  em_falta    text[],

  emitido_em  timestamptz not null default now(),
  emitido_por text
);
create index if not exists emitidos_org_idx on documentos_emitidos (org_id, emitido_em desc);
create index if not exists emitidos_pt_idx on documentos_emitidos (patient_id, emitido_em desc);


-- ═══════════════════════════════════════════════════════════════════════════
-- OS MODELOS QUE VÊM DE ORIGEM
-- ═══════════════════════════════════════════════════════════════════════════
-- Os documentos que qualquer lar ou centro de dia em Portugal emite. São um
-- ponto de partida para a casa editar, não um texto legal aprovado: cada
-- instituição tem o seu regulamento e o seu jurista. É por isso que estão em
-- texto editável e não fechados no programa.
do $$
declare
  o record;
  n int := 0;
begin
    -- `select id from organizations`, e nao `select id, user_id`:
    -- `organizations` NAO tem `user_id`. Tem `owner_id` — e, nesta base de
    -- dados, esta a null em todas as dez casas. Escrevi `user_id` em quatro
    -- migracoes seguidas e as quatro rebentaram na cara do Fernando com
    -- «column user_id does not exist».
    --
    -- E `user_id` sai tambem da lista de colunas: estas linhas sao da CASA,
    -- nao de uma pessoa. Ninguem as escreveu, e por isso a coluna fica a
    -- null — que e a verdade. Quem as pode ler e quem pertence a casa, pela
    -- politica `_casa` que usa o `org_id`; a politica `_proprio` nunca se
    -- aplica a elas, e esta certo assim.
    --
    -- E so as casas que sao lar ou centro de dia: semear «banho assistido»
    -- ou «contrato de prestacao de servicos» numa farmacia e encher-lhe a
    -- base de dados de coisas que ela nunca vai usar.
  for o in select id from organizations where kind in ('day_care', 'nursing_home') loop
    if exists (select 1 from modelos_documentos where org_id = o.id) then continue; end if;

    insert into modelos_documentos (org_id, nome, categoria, descricao, corpo) values

    (o.id, 'Ficha de inscrição', 'inscricao',
     'Os dados de quem se inscreve, para assinar e arquivar.',
$m$FICHA DE INSCRIÇÃO
{{casa.nome}}

Data: {{hoje}}

1. IDENTIFICAÇÃO
Nome completo: {{nome}}
Data de nascimento: {{data_nascimento}} ({{idade}} anos)
Sexo: {{sexo}}
Estado civil: {{estado_civil}}
Naturalidade: {{naturalidade}}
NIF: {{nif}}
N.º de utente de saúde: {{sns}}

2. RESIDÊNCIA E CONTACTO
Morada: {{morada}}
Telefone: {{telefone}}

3. PESSOA A CONTACTAR
Nome: {{contacto_nome}}
Parentesco: {{contacto_relacao}}
Telefone: {{contacto_telefone}}

4. SAÚDE
Diagnósticos: {{diagnosticos}}
Alergias: {{alergias}}
Médico de família: {{medico}}

5. AUTONOMIA
Deslocação: {{mobilidade}}
Orientação: {{estado_cognitivo}}
Dieta: {{dieta}}

6. PERCURSO
Profissão que teve: {{profissao}}
Escolaridade: {{escolaridade}}


Declaro que os dados acima são verdadeiros.


___________________________          ___________________________
O/A utente ou representante                    {{casa.nome}}$m$),

    (o.id, 'Contrato de prestação de serviços', 'contrato',
     'O contrato entre a instituição e o utente ou o seu representante.',
$m$CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Entre:

PRIMEIRO OUTORGANTE
{{casa.nome}}, com sede em {{casa.morada}}, NIF {{casa.nif}},
representada por {{casa.diretor}}.

SEGUNDO OUTORGANTE
{{nome}}, nascido(a) a {{data_nascimento}}, NIF {{nif}},
residente em {{morada}}.

É celebrado o presente contrato, nos termos seguintes:

CLÁUSULA 1.ª — OBJETO
O primeiro outorgante obriga-se a prestar ao segundo os serviços previstos no
regulamento interno da instituição, que o segundo outorgante declara conhecer
e aceitar.

CLÁUSULA 2.ª — INÍCIO
Os serviços têm início a {{hoje.curto}}.

CLÁUSULA 3.ª — CUIDADOS ESPECÍFICOS
Ficam registadas as seguintes necessidades, comunicadas pelo segundo
outorgante: dieta {{dieta}}; deslocação: {{mobilidade}}.

CLÁUSULA 4.ª — ALTERAÇÕES
Qualquer alteração ao presente contrato é feita por escrito e assinada por
ambas as partes.


{{casa.cidade}}, {{hoje}}


___________________________          ___________________________
Primeiro outorgante                          Segundo outorgante$m$),

    (o.id, 'Consentimento para tratamento de dados', 'consentimento',
     'RGPD: o consentimento informado para tratar os dados da pessoa.',
$m$CONSENTIMENTO PARA O TRATAMENTO DE DADOS PESSOAIS

Eu, {{nome}}, NIF {{nif}}, na qualidade de titular dos dados ou de seu
representante legal, declaro ter sido informado(a) de que:

a) {{casa.nome}} (NIF {{casa.nif}}) é responsável pelo tratamento dos meus
   dados pessoais e de saúde;

b) os dados são tratados para a prestação dos cuidados contratados, para o
   cumprimento de obrigações legais e para comunicação com a família;

c) os dados de saúde são acedidos apenas por quem deles precisa para cuidar
   de mim, e ficam registados os acessos;

d) posso, a qualquer momento, pedir para ver, corrigir ou apagar os meus
   dados, contactando a instituição através do telefone {{casa.telefone}};

e) o consentimento pode ser retirado, sem que isso afete a licitude do
   tratamento feito antes de o retirar.

Declaro dar o meu consentimento.


{{casa.cidade}}, {{hoje}}

___________________________
{{nome}}$m$),

    (o.id, 'Autorização de imagem', 'consentimento',
     'Para fotografias de atividades partilhadas com as famílias.',
$m$AUTORIZAÇÃO PARA CAPTAÇÃO E UTILIZAÇÃO DE IMAGEM

Eu, {{nome}}, NIF {{nif}}, autorizo {{casa.nome}} a captar fotografias e
vídeos da minha participação nas atividades da instituição, e a utilizá-los
exclusivamente para:

  ( ) partilhar com a minha família, através dos meios da instituição;
  ( ) afixar no interior da instituição;
  ( ) divulgar publicamente (redes sociais, sítio da instituição).

Assinalo em cima apenas o que autorizo. A ausência de marca significa que não
autorizo.

Esta autorização pode ser retirada por escrito a qualquer momento.


{{casa.cidade}}, {{hoje}}

___________________________
{{nome}} ou representante$m$),

    (o.id, 'Declaração de frequência', 'declaracao',
     'Comprova que a pessoa frequenta a instituição. Pedida para o IRS e para a Segurança Social.',
$m$DECLARAÇÃO

{{casa.nome}}, com sede em {{casa.morada}} e NIF {{casa.nif}}, declara para
os devidos efeitos que {{nome}}, NIF {{nif}}, nascido(a) a
{{data_nascimento}}, é utente desta instituição.

A presente declaração é emitida a pedido do interessado.


{{casa.cidade}}, {{hoje}}


___________________________
{{casa.diretor}}
{{casa.nome}}$m$);

    n := n + 1;
  end loop;
  raise notice '% casa(s) ficaram com 5 modelos de documentos.', n;
end $$;


-- ── RLS ─────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['modelos_documentos', 'documentos_emitidos'] loop
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format($f$
        create policy %I on public.%I for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()))
      $f$, t || '_proprio', t);
    exception when duplicate_object then null; end;
    begin
      execute format($f$
        create policy %I on public.%I for all
          using (org_id is not null and org_id in (
            select org_id from org_members where user_id = (select auth.uid()) and active = true))
          with check (org_id is not null and org_id in (
            select org_id from org_members where user_id = (select auth.uid()) and active = true))
      $f$, t || '_casa', t);
    exception when duplicate_object then null; end;
    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CONFIRMAR
-- ═══════════════════════════════════════════════════════════════════════════
-- select nome, categoria, length(corpo) as letras from modelos_documentos
--   order by categoria, nome;                         -- 5 linhas
-- select count(*) from documentos_emitidos;           -- 0, ainda não saiu nada
--
-- E na app: /documentos → Modelos → «Ficha de inscrição» → Preencher para…
-- Escolhe alguém sem NIF e confirma que o ecrã diz que falta o NIF ANTES de
-- deixar imprimir.
