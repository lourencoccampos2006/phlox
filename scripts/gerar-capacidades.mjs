#!/usr/bin/env node
// scripts/gerar-capacidades.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A FUNÇÃO `default_capabilities()` DEIXA DE SE ESCREVER À MÃO
//
// ── O QUE CORREU MAL, E PORQUE É QUE NINGUÉM DEU POR ISSO ──────────────────
// As permissões de cada papel vivem em `lib/permissoes.ts`. A base de dados
// precisa das MESMAS permissões para as políticas de RLS (`coalesce(
// capabilities, default_capabilities(role))`), e por isso havia uma segunda
// cópia, escrita à mão em SQL, dentro do sprint152.
//
// A 6 de outubro a área `qualidade` ganhou `editar` e `eliminar` — porque os
// inquéritos de satisfação são coisas que se CRIAM, e uma área só de leitura
// não emite política de escrita nenhuma. O TypeScript foi corrigido. **O SQL
// não.**
//
// Resultado, medido a 14 de outubro contra a base de dados real: a conta da
// direção técnica — que tem TODAS as permissões — recebia
//
//   403  new row violates row-level security policy "inqueritos_area_criar"
//
// ao criar um inquérito. A página mostrava o botão (lê o TypeScript), a base
// de dados recusava (lê o SQL). Ninguém com um papel qualquer, nem o dono da
// casa, conseguia criar um inquérito. E a página engolia o erro numa frase
// genérica, por isso durante três sessões o diagnóstico foi «falta correr uma
// migração» — que estava errado.
//
// ── A LIÇÃO ────────────────────────────────────────────────────────────────
// Duas cópias da mesma regra, uma em TypeScript e outra em SQL, divergem. Não
// «podem divergir»: divergem, e em silêncio, porque nada as compara.
//
// Agora o SQL GERA-SE a partir do TypeScript, e o `check-capacidades` compara
// o que está no repositório com o que seria gerado hoje. Mudar uma permissão
// sem gerar a migração passa a ser um guarda vermelho, não um 403 daqui a
// um mês.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs \
//        scripts/gerar-capacidades.mjs              → escreve no stdout
//   ... scripts/gerar-capacidades.mjs --ficheiro    → escreve a migração
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs'
import { PAPEIS, permissoesDe } from '../lib/permissoes.ts'

/** O corpo da função, idêntico para o gerador e para o guarda. */
export function corpoDaFuncao() {
  const ramos = PAPEIS.map(p => {
    // `permissoesDe(papel, null)` é exactamente o que a aplicação calcula para
    // quem não tem lista própria — que é o mesmo caso que o `coalesce` do SQL
    // resolve. Ler daqui e não de `p.omissao` garante que qualquer regra
    // escondida dentro do `permissoesDe` também atravessa.
    const lista = [...permissoesDe(p.id, null)].sort()
    const sql = lista.map(c => `'${c}'`).join(', ')
    return `    when '${p.id}' then array[${sql}]::text[]`
  })
  return [
    'create or replace function default_capabilities(role text) returns text[]',
    'language sql immutable as $$',
    '  select case role',
    ...ramos,
    '    else array[]::text[]',
    '  end;',
    '$$;',
  ].join('\n')
}

const CABECALHO = `-- sprint184_capacidades_geradas.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- A \`default_capabilities()\` POSTA EM DIA — e a correção dos inquéritos.
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
-- As permissões de cada papel vivem em \`lib/permissoes.ts\`. Esta função era
-- uma SEGUNDA CÓPIA das mesmas permissões, escrita à mão no sprint152. A 6 de
-- outubro a área \`qualidade\` ganhou \`editar\` e \`eliminar\` (os inquéritos são
-- coisas que se criam, e uma área só de leitura não gera política de escrita).
-- O TypeScript foi corrigido; esta função ficou na versão antiga, com apenas
-- \`qualidade.ver\`.
--
-- A página mostrava o botão — lê o TypeScript. A base de dados recusava — lê
-- isto. Ninguém na casa, nem o dono, conseguia criar um inquérito.
--
-- ── O QUE MUDA ──────────────────────────────────────────────────────────────
-- Esta função deixa de se escrever à mão: é GERADA a partir do
-- \`lib/permissoes.ts\` pelo \`scripts/gerar-capacidades.mjs\`, e o
-- \`scripts/check-capacidades.mjs\` falha quando as duas divergem. Não voltar a
-- editar este ficheiro à mão — mudar \`lib/permissoes.ts\` e gerar outra vez.
--
-- ── QUEM É AFETADO ──────────────────────────────────────────────────────────
-- Só quem tem \`capabilities\` a null, ou seja, quem herda do papel — que é a
-- maioria. Quem tem uma lista própria (dada à mão ou por um perfil de acesso)
-- não passa por aqui e já estava certo.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- GERADO. Não editar à mão: scripts/gerar-capacidades.mjs
`

const RODAPE = `
-- ── Verificar ───────────────────────────────────────────────────────────────
-- Deve devolver true:
--   select 'qualidade.editar' = any(default_capabilities('direcao'));
--   select 'qualidade.editar' = any(default_capabilities('dono'));

notify pgrst, 'reload schema';
`

/* Só escreve quando é CHAMADO, nunca quando é importado.
   O `check-capacidades` importa daqui o `corpoDaFuncao`; sem esta guarda, o
   relatório do guarda vinha com a migração inteira despejada por cima — e um
   relatório que se perde no meio do que imprime deixa de se ler. */
const chamadoDirectamente = process.argv[1]?.replace(/\\/g, '/').endsWith('gerar-capacidades.mjs')

if (chamadoDirectamente) {
  const sql = CABECALHO + '\n' + corpoDaFuncao() + '\n' + RODAPE
  if (process.argv.includes('--ficheiro')) {
    const onde = 'supabase/sprint184_capacidades_geradas.sql'
    writeFileSync(onde, sql, 'utf8')
    console.log(`escrito: ${onde}`)
    console.log(`${PAPEIS.length} papéis, ${PAPEIS.map(p => permissoesDe(p.id, null).length).join('/')} capacidades`)
  } else {
    console.log(sql)
  }
}
