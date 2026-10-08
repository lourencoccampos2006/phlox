import { chromium } from 'playwright'
import { assentar, entrar } from './qa-esperar.mjs'
const BASE='http://localhost:3311'
const rota = '/' + process.env.ROTA, nome = process.env.NOME, abrir = process.env.ABRIR
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1600,height:1000},locale:'pt-PT'}); const p=await ctx.newPage()
const erros=[]; p.on('pageerror',e=>erros.push(String(e.message).slice(0,200)))
await entrar(p, BASE)
await p.goto(`${BASE}${rota}`,{waitUntil:'domcontentloaded'})
await p.waitForFunction(()=>/· [1-9]|ainda não há|nada marcado/i.test(document.body.innerText),null,{timeout:40000}).catch(()=>{})
await assentar(p); await p.waitForTimeout(1200)
if (abrir) { await p.locator('button').filter({hasText:abrir}).first().click().catch(()=>{}); await p.waitForTimeout(900) }
const m = await p.evaluate(()=>({over:document.documentElement.scrollWidth-document.documentElement.clientWidth, rola:document.documentElement.scrollHeight-window.innerHeight}))
await p.screenshot({ path: `tmp-fotos/${nome}.png` })
console.log(`${nome}: transbordo ${m.over}px · rola ${m.rola}px · erros: ${erros.length?erros.join(' | '):'nenhum'}`)
await b.close()
