// scripts/qa-estados.mjs — páginas que ABREM mas mostram um erro a quem as usa.
// A varredura de consola não apanha isto: o pedido falha em silêncio e a
// página escreve "não foi possível carregar" com toda a calma.

import { chromium } from 'playwright'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const BASE = process.env.BASE || 'http://localhost:3100'
function rotas(dir='app', pre='') { const o=[]
  for (const e of readdirSync(dir)) { const p=join(dir,e); if(!statSync(p).isDirectory())continue
    if(e.startsWith('[')||e==='api'||e.startsWith('(')||e.startsWith('_'))continue
    const r=pre+'/'+e; try{statSync(join(p,'page.tsx'));o.push(r)}catch{}; o.push(...rotas(p,r)) } return o }
const ALVO = ['/', ...rotas().filter(r => !/^\/(blog|partilhar|c|v|auth|checkout|convite)\b/.test(r))].sort()

// Frases que só aparecem quando algo correu mal, e lixo técnico que nunca
// devia chegar ao ecrã.
const MAU = [
  /não foi possível carregar/i, /nao foi possivel carregar/i,
  /ocorreu um erro/i, /algo correu mal/i, /tenta de novo/i,
  /\bundefined\b/, /\bNaN\b/, /\[object Object\]/,
  /TypeError|ReferenceError|Cannot read/,
  /Application error/i, /Internal Server Error/i,
]
const b = await chromium.launch()
const maus = []
try {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} }); const p = await ctx.newPage()
  await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'})
  await p.fill('input[type="email"]', process.env.QA_EMAIL||'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD||'QaPhlox2026!')
  await p.click('button[type="submit"]'); await p.waitForURL(/\/inicio|\/painel/,{timeout:30000}).catch(()=>{})
  console.log(`${ALVO.length} rotas\n`)
  for (const r of ALVO) {
    try { await p.goto(BASE+r,{waitUntil:'domcontentloaded',timeout:20000}); await p.waitForTimeout(1600) } catch { continue }
    const t = (await p.evaluate(() => (document.body?.innerText||'').replace(/\s+/g,' ')).catch(()=>''))
    const achados = MAU.filter(re => re.test(t)).map(re => String(re))
    if (achados.length) {
      const trecho = MAU.map(re => t.match(re)).find(Boolean)
      maus.push(r); console.log(`✗ ${r.padEnd(28)} ${achados[0]}`)
      const i = t.search(MAU.find(re => re.test(t)))
      console.log(`     …${t.slice(Math.max(0,i-60), i+80)}…`)
    }
  }
} finally { await b.close() }
console.log(`\n${maus.length ? maus.length+' rotas com estado de erro visível' : 'Nenhuma rota mostra erro ao utilizador.'} (de ${ALVO.length})`)
