import { chromium } from 'playwright'
import { assentar, entrar } from './qa-esperar.mjs'
const BASE='http://localhost:3311'
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1600,height:1000},locale:'pt-PT'}); const p=await ctx.newPage()
await entrar(p, BASE)
for (const [n, r] of [['painel','/painel'],['mar','/mar'],['activities','/activities'],['patients','/patients'],['equipa','/equipa'],['faturacao','/faturacao']]) {
  await p.goto(`${BASE}${r}`,{waitUntil:'domcontentloaded'})
  await assentar(p); await p.waitForTimeout(2000); await assentar(p)
  await p.screenshot({ path: `tmp-fotos/v2-${n}.png` })
}
console.log('ok')
await b.close()
