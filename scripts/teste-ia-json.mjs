// scripts/teste-ia-json.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A escada de IA nao pode parar no primeiro que responde mal.
//
// ── O QUE ISTO ESTA A PROTEGER ─────────────────────────────────────────────
// A 2026-09-17 o /scan e o /vault deixaram de funcionar: "Nao foi possivel
// interpretar a resposta da IA. Tenta novamente" -- e tentar outra vez nao
// resolvia, porque a falha era deterministica. Duas causas:
//
//   1. os Gemini modernos PENSAM antes de responder, e o pensamento sai do
//      mesmo orcamento de `maxOutputTokens`; a resposta saia cortada a meio;
//   2. o aiJSON pedia UMA resposta e desistia se ela nao fosse JSON -- havia
//      quatro fornecedores a seguir na fila que nunca eram chamados.
//
// Estes testes nao chamam a internet: fingem os fornecedores. O que se verifica
// e a REGRA -- responder nao chega, tem de responder uma coisa utilizavel.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-ia-json.mjs
// ─────────────────────────────────────────────────────────────────────────────

process.env.GEMINI_API_KEY = 'teste'
process.env.GROQ_API_KEY = 'teste'
process.env.ANTHROPIC_API_KEY = 'teste'
delete process.env.OPENAI_API_KEY

const { extrairJSON, aiJSON } = await import('../lib/ai.ts')

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── Tirar JSON de uma resposta, venha como vier ────────────────────────────
seccao('Tirar o JSON de uma resposta')
{
  verificar('JSON limpo', extrairJSON('{"a":1}')?.a === 1)
  verificar('dentro de ```json',
    extrairJSON('```json\n{"a":1}\n```')?.a === 1)
  verificar('dentro de ``` sem etiqueta',
    extrairJSON('```\n{"a":1}\n```')?.a === 1)
  verificar('com prosa a frente',
    extrairJSON('Claro! Aqui esta o resultado:\n{"a":1}')?.a === 1)
  verificar('com prosa a frente e atras',
    extrairJSON('Aqui vai:\n{"a":1}\nEspero ter ajudado.')?.a === 1)
  verificar('um array tambem', extrairJSON('[{"a":1},{"a":2}]')?.length === 2)
  verificar('acentos passam', extrairJSON('{"t":"anemia ligeira, hipertensão"}')?.t.includes('hipertensão'))

  verificar('resposta vazia da undefined', extrairJSON('') === undefined)
  verificar('so espacos da undefined', extrairJSON('   \n ') === undefined)
  verificar('null nao rebenta', extrairJSON(null) === undefined)
  verificar('prosa sem JSON nenhum da undefined',
    extrairJSON('Desculpe, nao consigo ajudar com isso.') === undefined)

  // ── O caso que partiu tudo: cortado a meio de uma string ────────────────
  const cortado = '{"kind":"analise","values":[{"name":"Hemoglobina","value":"11,2"},{"name":"Colesterol","value":"232"},{"name":"Plaquetas","value":"245","note":"O numero de plaquetas, que ajudam na coagul'
  const r = extrairJSON(cortado)
  verificar('um JSON cortado a meio aproveita o que esta completo',
    r && r.values?.length === 2, r)
  verificar('e o que aproveita esta certo', r?.values?.[0]?.name === 'Hemoglobina', r?.values)
}

// ── A escada ───────────────────────────────────────────────────────────────
seccao('A escada segue quando um fornecedor responde mal')
{
  const original = globalThis.fetch
  const chamados = []

  function fingir(respostas) {
    globalThis.fetch = async (url) => {
      const u = String(url)
      let quem = 'desconhecido'
      if (u.includes('groq.com')) quem = 'groq'
      else if (u.includes('anthropic.com')) quem = 'anthropic'
      else if (u.includes('googleapis.com')) quem = `gemini:${(u.match(/models\/([^:]+):/) || [])[1]}`
      chamados.push(quem)

      const r = respostas(quem)
      if (r === null) return new Response('{"error":{"message":"nao disponivel"}}', { status: 400 })

      if (quem === 'anthropic') {
        return Response.json({ content: [{ type: 'text', text: r }] })
      }
      if (quem === 'groq') {
        return Response.json({ choices: [{ message: { content: r } }] })
      }
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: r }] } }] })
    }
  }

  // 1. O primeiro responde prosa; o seguinte responde JSON. Tem de sair JSON.
  chamados.length = 0
  fingir(quem => quem === 'anthropic' ? 'Claro, posso ajudar com isso!' : '{"kind":"analise","ok":true}')
  let out = null, erro = null
  try { out = await aiJSON([{ role: 'user', content: 'x' }], { qualidade: true }) } catch (e) { erro = e }
  verificar('um fornecedor a responder prosa nao mata o pedido',
    !erro && out?.ok === true, erro?.message || out)
  verificar('e passou mesmo ao seguinte da escada',
    chamados.length > 1, chamados)

  // 2. Um JSON cortado a meio conta como resposta boa se sobrar o util.
  chamados.length = 0
  fingir(quem => quem === 'anthropic' ? '{"kind":"analise","items":[{"a":1},{"a":2' : '{"kind":"outro"}')
  out = null; erro = null
  try { out = await aiJSON([{ role: 'user', content: 'x' }], { qualidade: true }) } catch (e) { erro = e }
  verificar('um JSON cortado mas aproveitavel serve',
    !erro && out?.items?.length === 1, erro?.message || out)

  // 3. Todos respondem mal: aí sim, falha -- mas só depois de tentar todos.
  chamados.length = 0
  fingir(() => 'nao faco ideia do que me estas a pedir')
  out = null; erro = null
  try { out = await aiJSON([{ role: 'user', content: 'x' }], { qualidade: true }) } catch (e) { erro = e }
  verificar('se nenhum servir, falha (nao inventa)', !!erro, out)
  verificar('mas so depois de tentar a escada toda',
    chamados.length >= 5, chamados)

  // 4. O caso real: a conta Anthropic sem saldo (HTTP 400) nao pode travar nada.
  chamados.length = 0
  fingir(quem => quem === 'anthropic' ? null : '{"kind":"analise","ok":true}')
  out = null; erro = null
  try { out = await aiJSON([{ role: 'user', content: 'x' }], { qualidade: true }) } catch (e) { erro = e }
  verificar('a conta do topo sem saldo nao trava o resto',
    !erro && out?.ok === true, erro?.message)

  globalThis.fetch = original
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
