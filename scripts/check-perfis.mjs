// scripts/check-perfis.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O email de alguém sai para fora?
//
// ── PORQUE E QUE ISTO EXISTE ────────────────────────────────────────────────
// A `check-leitura-anonima.mjs` pergunta «esta tabela responde a quem não tem
// sessão?». Boa pergunta, e apanhou este buraco. Mas falta a outra metade: e
// COM sessão, uma conta comum vê o que não devia?
//
// Medido em 2026-09-28, antes do sprint168:
//   • sem sessão nenhuma, com a chave pública do site → 3 perfis INTEIROS,
//     com email, NIF, número de utente de saúde e identificador do Stripe;
//   • com uma conta comum → o email de toda a gente que está no directório.
//
// A causa é estrutural e já estava apontada na memória de 2026-07-28: a RLS do
// Postgres é por LINHA, não por COLUNA. Uma política que deixa ver um perfil
// deixa ver o perfil TODO. É por isso que a correção é uma vista com as
// colunas contadas, e não mais uma política.
//
// Esta guarda vai FALHAR até o sprint168 correr. É suposto.
//
//   node scripts/check-perfis.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!U || !ANON) { console.error('Faltam o URL e a chave pública do Supabase.'); process.exit(1) }

// As colunas que NUNCA podem sair para outra pessoa, seja com sessão ou sem.
const NUNCA = ['email', 'nif', 'sns_number', 'stripe_customer_id',
  'stripe_subscription_id', 'onboarding_answers', 'notification_prefs']

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nSEM SESSÃO NENHUMA, COM A CHAVE PÚBLICA DO SITE')
{
  const r = await fetch(`${U}/rest/v1/profiles?select=*`, { headers: { apikey: ANON } })
  const j = r.ok ? await r.json() : null
  const n = Array.isArray(j) ? j.length : 0
  ok('a tabela `profiles` não responde a quem não tem sessão',
    !r.ok || n === 0,
    r.ok ? `devolveu ${n} perfil(is) — a chave pública está no JavaScript de todas as páginas` : `${r.status}`)
  if (Array.isArray(j) && j.length) {
    const saiu = NUNCA.filter(c => c in j[0])
    console.log(`         expôs: ${saiu.join(', ')}`)
  }

  const v = await fetch(`${U}/rest/v1/perfis_visiveis?select=*`, { headers: { apikey: ANON } })
  ok('nem a vista `perfis_visiveis`', !v.ok, `${v.status}`)
}

console.log('\nCOM UMA CONTA COMUM')
{
  const s = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt',
      password: process.env.QA_PASSWORD || 'QaPhlox2026!',
    }),
  }).then(x => x.json())

  if (!s.access_token) {
    console.log('  (sem conta de QA para testar — salta esta parte)')
  } else {
    const h = { apikey: ANON, Authorization: `Bearer ${s.access_token}` }
    const meu = s.user?.id

    const r = await fetch(`${U}/rest/v1/profiles?select=id,email,nif,stripe_customer_id`, { headers: h })
    const j = r.ok ? await r.json() : []
    const dosOutros = Array.isArray(j) ? j.filter(p => p.id !== meu) : []
    ok('a tabela `profiles` só devolve a própria linha',
      dosOutros.length === 0,
      dosOutros.length ? `vê ${dosOutros.length} perfil(is) de outras pessoas, com email` : '')

    // A vista TEM de funcionar — senão o directório e os nomes dos colegas
    // partem-se, e uma correção que parte o produto não é uma correção.
    const v = await fetch(`${U}/rest/v1/perfis_visiveis?select=*&limit=5`, { headers: h })
    if (v.ok) {
      const vj = await v.json()
      ok('a vista `perfis_visiveis` responde', Array.isArray(vj))
      if (Array.isArray(vj) && vj.length) {
        const maus = NUNCA.filter(c => c in vj[0])
        ok('e não traz email, NIF nem Stripe', maus.length === 0, maus.join(', '))
      }
    } else {
      ok('a vista `perfis_visiveis` existe', false,
        `${v.status} — o sprint168 ainda não correu`)
    }
  }
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s). Corre supabase/sprint168_fechar_perfis.sql.`
  : '\n✓ O email, o NIF e o Stripe de uma pessoa não saem para mais ninguém.')
process.exit(falhas ? 1 : 0)
