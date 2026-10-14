-- sprint184_capacidades_geradas.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- A `default_capabilities()` POSTA EM DIA — e a correção dos inquéritos.
--
-- ── O BUG, MEDIDO ──────────────────────────────────────────────────────────
-- A conta da direção técnica, que tem TODAS as permissões da casa, recebia
-- isto ao criar um inquérito de satisfação:
--
--     403  new row violates row-level security policy
--          "inqueritos_area_criar" for table "inqueritos"
--
-- Não era a política que estava errada. Era a função que ela consulta.
--
-- As permissões de cada papel vivem em `lib/permissoes.ts`. Esta função era
-- uma SEGUNDA CÓPIA das mesmas permissões, escrita à mão no sprint152. A 6 de
-- outubro a área `qualidade` ganhou `editar` e `eliminar` (os inquéritos são
-- coisas que se criam, e uma área só de leitura não gera política de escrita).
-- O TypeScript foi corrigido; esta função ficou na versão antiga, com apenas
-- `qualidade.ver`.
--
-- A página mostrava o botão — lê o TypeScript. A base de dados recusava — lê
-- isto. Ninguém na casa, nem o dono, conseguia criar um inquérito.
--
-- ── O QUE MUDA ──────────────────────────────────────────────────────────────
-- Esta função deixa de se escrever à mão: é GERADA a partir do
-- `lib/permissoes.ts` pelo `scripts/gerar-capacidades.mjs`, e o
-- `scripts/check-capacidades.mjs` falha quando as duas divergem. Não voltar a
-- editar este ficheiro à mão — mudar `lib/permissoes.ts` e gerar outra vez.
--
-- ── QUEM É AFETADO ──────────────────────────────────────────────────────────
-- Só quem tem `capabilities` a null, ou seja, quem herda do papel — que é a
-- maioria. Quem tem uma lista própria (dada à mão ou por um perfil de acesso)
-- não passa por aqui e já estava certo.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- GERADO. Não editar à mão: scripts/gerar-capacidades.mjs

create or replace function default_capabilities(role text) returns text[]
language sql immutable as $$
  select case role
    when 'dono' then array['atividades.editar', 'atividades.eliminar', 'atividades.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'avaliacoes.ver', 'definicoes.editar', 'documentos.editar', 'documentos.eliminar', 'documentos.ver', 'equipa.editar', 'equipa.eliminar', 'equipa.ver', 'familias.editar', 'familias.ver', 'feridas.editar', 'feridas.eliminar', 'feridas.ver', 'financeiro.editar', 'financeiro.eliminar', 'financeiro.ver', 'medicacao.editar', 'medicacao.eliminar', 'medicacao.ver', 'ocorrencias.editar', 'ocorrencias.eliminar', 'ocorrencias.ver', 'permissoes.editar', 'qualidade.editar', 'qualidade.eliminar', 'qualidade.ver', 'registo_atividade.ver', 'registos.editar', 'registos.eliminar', 'registos.ver', 'stock.editar', 'stock.eliminar', 'stock.ver', 'utentes.editar', 'utentes.eliminar', 'utentes.ver']::text[]
    when 'direcao' then array['atividades.editar', 'atividades.eliminar', 'atividades.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'avaliacoes.ver', 'definicoes.editar', 'documentos.editar', 'documentos.eliminar', 'documentos.ver', 'equipa.editar', 'equipa.eliminar', 'equipa.ver', 'familias.editar', 'familias.ver', 'feridas.editar', 'feridas.eliminar', 'feridas.ver', 'financeiro.editar', 'financeiro.eliminar', 'financeiro.ver', 'medicacao.editar', 'medicacao.eliminar', 'medicacao.ver', 'ocorrencias.editar', 'ocorrencias.eliminar', 'ocorrencias.ver', 'permissoes.editar', 'qualidade.editar', 'qualidade.eliminar', 'qualidade.ver', 'registo_atividade.ver', 'registos.editar', 'registos.eliminar', 'registos.ver', 'stock.editar', 'stock.eliminar', 'stock.ver', 'utentes.editar', 'utentes.eliminar', 'utentes.ver']::text[]
    when 'enfermagem' then array['atividades.ver', 'avaliacoes.editar', 'avaliacoes.eliminar', 'avaliacoes.ver', 'documentos.ver', 'equipa.ver', 'familias.editar', 'familias.ver', 'feridas.editar', 'feridas.eliminar', 'feridas.ver', 'medicacao.editar', 'medicacao.eliminar', 'medicacao.ver', 'ocorrencias.editar', 'ocorrencias.ver', 'qualidade.ver', 'registo_atividade.ver', 'registos.editar', 'registos.ver', 'stock.editar', 'stock.ver', 'utentes.editar', 'utentes.ver']::text[]
    when 'auxiliar' then array['atividades.editar', 'atividades.ver', 'avaliacoes.ver', 'equipa.ver', 'familias.ver', 'feridas.ver', 'medicacao.editar', 'medicacao.ver', 'ocorrencias.editar', 'ocorrencias.ver', 'registos.editar', 'registos.ver', 'stock.ver', 'utentes.ver']::text[]
    when 'animacao' then array['atividades.editar', 'atividades.eliminar', 'atividades.ver', 'equipa.ver', 'familias.editar', 'familias.ver', 'registos.ver', 'utentes.ver']::text[]
    when 'administrativo' then array['documentos.editar', 'documentos.eliminar', 'documentos.ver', 'equipa.ver', 'financeiro.editar', 'financeiro.ver', 'qualidade.ver', 'stock.editar', 'stock.ver', 'utentes.editar', 'utentes.ver']::text[]
    when 'convidado' then array['atividades.ver', 'avaliacoes.ver', 'documentos.ver', 'equipa.ver', 'familias.ver', 'feridas.ver', 'medicacao.ver', 'ocorrencias.ver', 'qualidade.ver', 'registos.ver', 'stock.ver', 'utentes.ver']::text[]
    else array[]::text[]
  end;
$$;

-- ── Verificar ───────────────────────────────────────────────────────────────
-- Deve devolver true:
--   select 'qualidade.editar' = any(default_capabilities('direcao'));
--   select 'qualidade.editar' = any(default_capabilities('dono'));

notify pgrst, 'reload schema';
