#!/usr/bin/env node
// scripts/estado-das-migracoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QUE MIGRAÇÕES CORRERAM MESMO?
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Porque a lista de «por aplicar» que eu dou no fim de cada sessão é uma
// AFIRMAÇÃO MINHA, e já esteve errada. Durante três sessões disse que faltava
// correr o sprint179 quando o que faltava era outra coisa (ver a memória
// `permissoes_duas_copias_2026_10_14`), e noutra deduzi pelo tempo de resposta
// que o sprint182 tinha corrido.
//
// Isto não deduz nada: pergunta à base de dados. Para cada migração por
// correr, diz-se qual é a PROVA de que ela correu — a tabela que cria, a
// coluna que acrescenta, ou a função que redefine — e verifica-se.
//
//   node scripts/estado-das-migracoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

/* A prova de cada uma. `tabela` é o caso simples; `coluna` para as que só
   acrescentam campos; `rpc` para as que redefinem uma função. */
const MIGRACOES = [
  { n: 179, ficheiro: 'sprint179_inqueritos_rls.sql', oQue: 'RLS dos inquéritos',
    /* O 179 não cria nada — só troca políticas. A prova é indirecta: as
       tabelas do 178 existem e o 184 (que é quem desbloqueia a criação)
       responde. Marca-se como «não se consegue provar» em vez de se adivinhar. */
    semProva: 'Só troca políticas de RLS — não deixa marca no esquema. A prova de que os inquéritos funcionam é o teste do 184.' },
  { n: 180, ficheiro: 'sprint180_conformidade_da_casa.sql', oQue: 'conformidade da casa',
    indice: { tabela: 'compliance_items' },
    semProva: 'Junta linhas duplicadas e troca uma unicidade — não acrescenta colunas. Sem marca no esquema.' },
  { n: 153, ficheiro: 'sprint153_rls_por_area.sql', oQue: 'RLS por área',
    semProva: 'Só cria políticas. A prova é o 184 responder e as escritas passarem.' },
  { n: 181, ficheiro: 'sprint181_perfis_de_acesso.sql', oQue: 'perfis de acesso',
    tabela: 'perfis_acesso' },
  { n: 182, ficheiro: 'sprint182_efeitos_da_medicacao.sql', oQue: 'efeitos da medicação',
    tabela: 'medicamento_efeitos' },
  { n: 183, ficheiro: 'sprint183_apoio_domiciliario.sql', oQue: 'apoio domiciliário',
    tabela: 'sad_planos' },
  { n: 184, ficheiro: 'sprint184_capacidades_geradas.sql', oQue: 'capacidades geradas',
    rpc: { nome: 'default_capabilities', corpo: { role: 'direcao' }, contem: 'qualidade.editar' } },
  { n: 185, ficheiro: 'sprint185_medicamento_explicado.sql', oQue: 'bula traduzida',
    coluna: { tabela: 'medicamento_efeitos', nome: 'explicacao' } },
  { n: 186, ficheiro: 'sprint186_psicossocial.sql', oQue: 'processo psicossocial',
    tabela: 'psi_processo' },
]

const spec = await fetch(`${U}/rest/v1/`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  .then(r => r.json())
const defs = spec.definitions || spec.components?.schemas || {}

let porCorrer = 0
let incerto = 0

console.log('')
for (const m of MIGRACOES) {
  let estado = null
  let porque = ''

  if (m.tabela) {
    estado = !!defs[m.tabela]
    porque = `tabela ${m.tabela}`
  } else if (m.coluna) {
    const d = defs[m.coluna.tabela]
    estado = !!d && !!(d.properties || {})[m.coluna.nome]
    porque = `${m.coluna.tabela}.${m.coluna.nome}`
  } else if (m.rpc) {
    const r = await fetch(`${U}/rest/v1/rpc/${m.rpc.nome}`, {
      method: 'POST',
      headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(m.rpc.corpo),
    })
    if (!r.ok) { estado = null; porque = `não consegui chamar ${m.rpc.nome}() (${r.status})` }
    else {
      const lista = await r.json()
      estado = Array.isArray(lista) && lista.includes(m.rpc.contem)
      porque = `${m.rpc.nome}('${m.rpc.corpo.role}') ${estado ? 'tem' : 'NÃO tem'} «${m.rpc.contem}»`
    }
  }

  if (estado === true) {
    console.log(`  ✓ ${m.n}  ${m.oQue.padEnd(26)} ${porque}`)
  } else if (estado === false) {
    porCorrer++
    console.log(`  ✗ ${m.n}  ${m.oQue.padEnd(26)} POR CORRER — ${porque}`)
  } else {
    incerto++
    console.log(`  ? ${m.n}  ${m.oQue.padEnd(26)} ${m.semProva || porque}`)
  }
}

console.log('')
if (porCorrer) {
  console.log(`${porCorrer} migração(ões) POR CORRER, provadas contra a base de dados.`)
} else {
  console.log('Todas as que deixam marca no esquema já correram.')
}
if (incerto) {
  console.log(`${incerto} não deixam marca e não se conseguem provar daqui — ver a nota de cada uma.`)
}
console.log('')
