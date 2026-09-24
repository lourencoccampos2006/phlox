-- supabase/sprint156_mural_dirigido.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: corre isto depois do sprint155.
--
-- ── O QUE MUDA ──────────────────────────────────────────────────────────────
-- Pediste que «o mural dê para falar com pessoas específicas». Hoje tudo o que
-- lá se escreve vai para a casa toda, e por isso ninguém escreve lá o que é
-- para uma pessoa só — diz-se de viva voz, e perde-se.
--
-- Um recado ganha destinatários: `para_ids`. Vazio (null) quer dizer o que
-- quer dizer hoje — é para toda a gente.
--
-- ── UMA DECISÃO QUE TENS DE CONFIRMAR ───────────────────────────────────────
-- Um recado dirigido é lido SÓ por quem está nele e por quem o escreveu. Nem a
-- direção, nem o dono.
--
-- Escolhi assim porque «falar com pessoas específicas» tem de querer dizer
-- isso, senão é uma etiqueta e não uma conversa — e uma equipa que descobre
-- que o «privado» não era privado nunca mais lá escreve nada. Se preferires
-- que quem gere a casa veja tudo, diz-me e acrescento ao `using` da política
-- `tm_dirigido` a condição de ter `equipa.editar`. É uma linha.
--
-- ── PORQUE É QUE ISTO É UMA POLÍTICA E NÃO UM FILTRO NA ROTA ────────────────
-- O browser fala diretamente com a base de dados. Um filtro na rota protege de
-- quem usa a aplicação; não protege de quem abre a consola e escreve
-- `supabase.from('team_messages').select('*')`. A única fechadura a sério é a
-- que está na base de dados.
-- ─────────────────────────────────────────────────────────────────────────────

alter table team_messages
  add column if not exists para_ids uuid[];

-- Quem procura «os meus recados» pergunta sempre a mesma coisa: os que são
-- para mim, ou para toda a gente. O índice GIN é o que torna `para_ids @> …`
-- barato; sem ele é uma varredura da tabela por cada abertura do mural.
create index if not exists team_messages_para_idx on team_messages using gin (para_ids);


-- ── Só quem está no recado o lê ─────────────────────────────────────────────
-- RESTRITIVA: soma-se com E às políticas que já existem, por isso não larga
-- nada do que já protege a tabela (o âmbito por organização continua a
-- decidir). Acrescenta por cima: «e tens de ser destinatário».
do $$ begin
  drop policy if exists "tm_dirigido" on team_messages;
  create policy "tm_dirigido" on team_messages as restrictive for select using (
    para_ids is null                       -- recado para a casa toda
    or (select auth.uid()) = any(para_ids)  -- sou destinatário
    or author_id = (select auth.uid())      -- fui eu que o escrevi
  );
end $$;

-- Ninguém pode reescrever os destinatários de um recado que não é seu: mudar
-- o `para_ids` de uma mensagem alheia seria uma maneira de a ler.
do $$ begin
  drop policy if exists "tm_dirigido_alterar" on team_messages;
  create policy "tm_dirigido_alterar" on team_messages as restrictive for update using (
    para_ids is null
    or (select auth.uid()) = any(para_ids)
    or author_id = (select auth.uid())
  );
end $$;


-- ── Confirmar ───────────────────────────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'team_messages' and column_name = 'para_ids';   -- 1 linha
--
-- E na app: escreve um recado dirigido a uma pessoa, entra com outra conta e
-- confirma que ela não o vê.
