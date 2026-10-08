import { chromium } from 'playwright'
import { assentar, entrar } from './qa-esperar.mjs'
const BASE='http://localhost:3311'
async function tirar(w,h,nome,abrir){
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:w,height:h},locale:'pt-PT'}); const p=await ctx.newPage()
  const erros=[]; p.on('pageerror',e=>erros.push(String(e.message).slice(0,200)))
  await entrar(p, BASE)
  await p.goto(`${BASE}/mar`,{waitUntil:'domcontentloaded'})
  await p.waitForFunction(()=>/UTENTES . [1-9]|RESIDENTES . [1-9]|ainda não há/i.test(document.body.innerText),null,{timeout:40000}).catch(()=>{})
  await assentar(p); await p.waitForTimeout(900)
  if (abrir) { await p.locator('button').filter({hasText:'teste 1'}).first().click().catch(()=>{}); await p.waitForTimeout(800) }
  const m = await p.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth, rola:document.documentElement.scrollHeight-window.innerHeight}))
  await p.screenshot({ path: `tmp-fotos/${nome}.png` })
  console.log(`${nome}: transbordo ${m.over}px · pagina rola ${m.rola}px · erros: ${erros.length?erros.join(' | '):'nenhum'}`)
  await b.close()
}
await tirar(1600,1000,'mar-novo',true)
await tirar(390,844,'mar-novo-tel')
