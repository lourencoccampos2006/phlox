// scripts/ver-avisos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O que é que cada casa receberia, e a que horas do dia.
//
// Só LÊ. Não envia, não marca, não escreve nada. Serve para responder a "o cron
// está a correr e mesmo assim não chega nada — há sequer alguma coisa para
// enviar?" sem ter de esperar pela hora certa.
//
// Mostra tipos e contagens, nunca nomes de pessoas nem o conteúdo dos avisos:
// o que se passa dentro de uma casa é da casa.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/ver-avisos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { avisosDaInstituicao } from '../lib/avisos.ts'

// Lê o .env.local à mão — este script corre fora do Next.
// O ficheiro tem fins de linha do Windows. Partir só por '\n' deixa um '\r' no
// fim de cada linha, e em JavaScript o '\r' é um terminador de linha: o '.' não
// o apanha, por isso o `(.*)$` falhava em TODAS as linhas menos a última.
for (const linha of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local'); process.exit(1) }

const sb = createClient(url, chave)

const { data: casas, error } = await sb.from('organizations').select('id, name, kind')
if (error) { console.error('Não consegui ler as instituições:', error.message); process.exit(1) }

const HORAS = ['09:30', '11:00', '13:45', '17:00', '20:45']
const hoje = new Date().toISOString().slice(0, 10)

console.log(`\n${casas.length} instituições. O que cada uma receberia hoje, por hora:\n`)

let totalGeral = 0
for (const casa of casas) {
  // O nome fica reduzido: isto é um diagnóstico de operação.
  const etiqueta = `${String(casa.name || '?').slice(0, 22).padEnd(22)} ${String(casa.kind || '?').padEnd(13)}`
  const linhas = []
  for (const hora of HORAS) {
    const avisos = await avisosDaInstituicao(sb, casa.id, { agora: hora, hoje, tipoInstituicao: casa.kind })
    const empurrar = avisos.filter(a => a.empurrar)
    if (empurrar.length) {
      const tipos = [...new Set(empurrar.map(a => a.tipo))].join(', ')
      linhas.push(`      ${hora}  ${String(empurrar.length).padStart(2)} aviso(s): ${tipos}`)
      totalGeral += empurrar.length
    }
  }
  // Quantos dispositivos e que a casa tem, que é a outra metade da equacao.
  const { data: membros } = await sb.from('org_members').select('user_id').eq('org_id', casa.id).eq('active', true)
  const ids = (membros || []).map(m => m.user_id)
  const { count: subs } = ids.length
    ? await sb.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).in('user_id', ids)
    : { count: 0 }

  console.log(`${etiqueta} ${String(ids.length).padStart(2)} pessoa(s), ${String(subs || 0).padStart(2)} dispositivo(s)`)
  if (linhas.length) linhas.forEach(l => console.log(l))
  else console.log('      (nada a assinalar hoje)')
}

console.log(`\nTotal de avisos que sairiam hoje: ${totalGeral}`)
if (!totalGeral) {
  console.log(`
Zero pode ser a resposta certa: a maioria dos avisos só existe quando há mesmo
alguma coisa (uma ocorrência por seguir, uma família à espera, uma toma
recusada, stock em baixo). Se as casas estão vazias ou sem atividade hoje, não
há nada para enviar — e inventar um aviso seria pior.`)
}
