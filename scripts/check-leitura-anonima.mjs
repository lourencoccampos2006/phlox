// scripts/check-leitura-anonima.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Que tabelas respondem a quem NAO tem sessao?
//
// A chave `anon` esta no browser de toda a gente -- e publica por desenho. O
// que protege os dados e a RLS e as permissoes. A 2026-09-23 havia 24 tabelas
// a devolver dados sem sessao nenhuma, incluindo o email de toda a gente
// (`profiles`), a medicacao (`personal_meds`), alergias e contactos de
// emergencia (`emergency_tokens`) e o registo de atividade das instituicoes
// (`org_audit_feed`, que e privado por decisao de produto).
//
// Isto e o tipo de coisa que nao se ve a olhar para o codigo: o codigo esta
// certo, e a permissao na base de dados que esta aberta. So se descobre
// perguntando a API como um estranho.
//
//   node scripts/check-leitura-anonima.mjs
//
// Precisa da chave de servico (para listar as tabelas) e da anon (para as
// tentar ler). Le o .env.local sozinho.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'

try {
  for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* usa o ambiente */ }

const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !ANON || !K) {
  console.log('! Faltam chaves no .env.local — nao da para verificar.')
  console.log('  Isto NAO quer dizer que esteja tudo bem.')
  process.exit(0)
}

// Conteudo de referencia que PODE ser publico: nao tem dados de ninguem, e sao
// as paginas que trazem gente ao site.
const PUBLICAS = new Set([
  'lab_value_library', 'medical_library', 'procedure_guides', 'ecg_library',
  'infarmed_drugs', 'infarmed_drugs_stats', 'infarmed_shortage_list',
  'infarmed_shortage_sync', 'infarmed_recall_notices',
])

const spec = await (await fetch(`${U}/rest/v1/`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json()
const tabelas = Object.keys(spec.paths || {}).filter(p => p !== '/' && !p.startsWith('/rpc/')).map(p => p.slice(1))

const abertas = []
for (const t of tabelas) {
  try {
    const r = await fetch(`${U}/rest/v1/${encodeURIComponent(t)}?select=*&limit=1`, {
      headers: { apikey: ANON, Prefer: 'count=exact', Range: '0-0' },
    })
    if (!r.ok) continue
    const total = Number(r.headers.get('content-range')?.split('/')[1] ?? 0)
    if (total > 0 && !PUBLICAS.has(t)) abertas.push({ t, total })
  } catch { /* segue */ }
}

console.log(`Tabelas expostas pela API: ${tabelas.length}`)
console.log(`Conteudo publico por decisao: ${PUBLICAS.size}\n`)

if (!abertas.length) {
  console.log('✓ Nenhuma tabela com dados devolve linhas a quem nao tem sessao.')
  process.exit(0)
}

// As VISTAS sao a causa mais comum, e a menos obvia: correm com os direitos de
// QUEM AS CRIOU e por isso ignoram a RLS das tabelas por baixo. Marcar quais
// sao poupa meia hora a quem for corrigir. (E o "Security Definer View" do
// Security Advisor do Supabase.)
const vistas = new Set()
try {
  const sql = fs.readdirSync('supabase').filter(f => f.endsWith('.sql'))
    .map(f => fs.readFileSync('supabase/' + f, 'utf8')).join('\n')
  const re = /create\s+(?:or replace\s+)?(?:materialized\s+)?view\s+([a-z_0-9]+)/gi
  let m
  while ((m = re.exec(sql))) vistas.add(m[1])
} catch { /* sem ficheiros, segue sem a marca */ }

console.log('Devolvem DADOS a quem nao tem sessao nenhuma:\n')
for (const a of abertas.sort((x, y) => y.total - x.total)) {
  const marca = vistas.has(a.t) ? '   [VISTA — ignora a RLS das tabelas por baixo]' : ''
  console.log(`  ⚠  ${a.t.padEnd(24)} ${String(a.total).padStart(5)} linha(s)${marca}`)
}
console.log(`\n✗ ${abertas.length} tabela(s) abertas. Ver supabase/sprint150_fechar_leitura_anonima.sql`)
process.exit(1)
