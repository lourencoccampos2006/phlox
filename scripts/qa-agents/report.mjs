#!/usr/bin/env node
// report.mjs — o Relator. Junta tudo o que os agentes encontraram e escreve UM
// relatório em PT-PT, ordenado por gravidade.
//
// É INTEIRAMENTE DETERMINÍSTICO: zero tokens, zero custo, corre em qualquer
// sítio. A revisão visual por IA vive no workflow, autenticada pela subscrição.
//
// A REGRA QUE FAZ ISTO SERVIR PARA ALGUMA COISA: o relatório tem de poder dizer
// "nada a assinalar", e nunca passa de 5 pontos. Um agente a quem se pede
// "encontra problemas" encontra sempre alguma coisa — e ao quarto dia de ruído
// deixa-se de ler o relatório. Um relatório que não é lido não vale nada.

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SAIDA = process.env.QA_OUT || 'qa-out'
const MAX_PONTOS = 5

const brutos = readdirSync(SAIDA)
  .filter(f => f.startsWith('bruto-') && f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(SAIDA, f), 'utf8')))

if (!brutos.length) {
  console.error('Sem ficheiros bruto-*.json em', SAIDA, '— o run.mjs correu?')
  process.exit(1)
}

// ─── Camada determinística: factos, não opiniões ───────────────────────────
const achados = []
const add = (gravidade, titulo, detalhe, onde) => achados.push({ gravidade, titulo, detalhe, onde })

for (const b of brutos) {
  const alvo = b.etiqueta
  for (const r of b.rotas) {
    const onde = `${alvo} · ${r.nome} (${r.path}, ${r.viewport})`

    if (r.erroNavegacao) {
      add(0, 'Página não carrega', r.erroNavegacao, onde)
      continue
    }
    if (r.estado && r.estado >= 500) add(0, `Servidor devolveu ${r.estado}`, 'A página está em baixo.', onde)
    else if (r.estado && r.estado >= 400) add(1, `Página devolveu ${r.estado}`, '', onde)

    if (r.scroll?.aplicavel && !r.scroll.ok) {
      add(0, 'Scroll partido', `A roda do rato move a página só ${r.scroll.scrollY}px numa página de ${r.scroll.alturaPagina}px. É o bug do overflow-x — ver scripts/check-scroll.mjs.`, onde)
    }
    if (r.excecoes?.length) {
      add(0, 'Exceção não apanhada', r.excecoes[0], onde)
    }
    if (r.transbordo && r.transbordo.ok === false) {
      add(1, 'Transbordo horizontal', `${r.transbordo.scrollWidth}px de conteúdo em ${r.transbordo.clientWidth}px de ecrã. Suspeitos: ${(r.transbordo.culpados || []).join(', ')}`, onde)
    }
    if (r.erros?.length) {
      add(2, 'Erros de consola', `${r.erros.length}× nesta página. Primeiro: ${r.erros[0]}`, onde)
    }
    const falhas4xx = (r.pedidosFalhados || []).filter(p => p.estado >= 400)
    if (falhas4xx.length) {
      add(2, 'Pedidos falhados', `${falhas4xx.length}× · ` + falhas4xx.slice(0, 3).map(p => `${p.estado} ${p.url}`).join(' · '), onde)
    }
    const viol = r.a11y?.violacoes || []
    if (viol.length) {
      add(3, 'Problemas de acessibilidade', viol.map(v => `${v.id} (${v.nos}×)`).join(' · '), onde)
    }

    // Regressão visual — a página mudou de aspeto face à referência guardada.
    if (r.visual?.dimensaoMudou) {
      add(1, 'A página mudou de altura', `Era ${r.visual.antes}, agora ${r.visual.agora}.`, onde)
    } else if (typeof r.visual?.percentagem === 'number' && r.visual.percentagem > 1.5) {
      const g = r.visual.percentagem > 12 ? 0 : 1
      add(g, 'Mudança visual face à referência',
        `${r.visual.percentagem}% dos píxeis mudaram. Se foi de propósito, atualiza a referência: apaga tests/baselines/${r.captura} e corre outra vez.`,
        onde)
    }

    if (r.problemasMeta?.length) {
      add(3, 'Metadados incompletos', r.problemasMeta.join(' · '), onde)
    }
    if (r.cabecalhosEmFalta?.length) {
      add(2, 'Cabeçalhos de segurança em falta', r.cabecalhosEmFalta.join(' · '), onde)
    }
  }

  if (b.linksPartidos?.length) {
    add(1, `${b.linksPartidos.length} link(s) interno(s) partido(s)`,
      b.linksPartidos.slice(0, 5).map(l => `${l.estado} ${l.caminho}`).join(' · ') +
      `  (de ${b.linksVerificados} verificados)`,
      alvo)
  }
  if (b.modo === 'completo' && b.sessaoIniciada === false) {
    add(0, 'Login da conta de QA falhou', 'As rotas privadas não foram verificadas — a cobertura de hoje está incompleta.', alvo)
  }
}

// A camada de IA já não vive aqui. A revisão visual passou para o workflow,
// onde corre com a claude-code-action autenticada pela SUBSCRIÇÃO
// (CLAUDE_CODE_OAUTH_TOKEN) — sem créditos de API. Este ficheiro ficou
// inteiramente determinístico: corre em qualquer sítio, de graça e sempre.

// ─── O relatório ───────────────────────────────────────────────────────────
const NOMES = ['CRÍTICO', 'GRAVE', 'MÉDIO', 'MENOR']
const todos = [...achados].sort((a, b) => a.gravidade - b.gravidade)

// Agregar repetições: o mesmo problema em 12 rotas é UM ponto, não 12.
const agregados = []
for (const a of todos) {
  const igual = agregados.find(x => x.titulo === a.titulo && x.gravidade === a.gravidade)
  if (igual) igual.ondes.push(a.onde)
  else agregados.push({ ...a, ondes: [a.onde] })
}

const mostrados = agregados.slice(0, MAX_PONTOS)
const escondidos = agregados.length - mostrados.length
const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

let md = `# Relatório de QA — ${hoje}\n\n`
md += brutos.map(b => `- **${b.etiqueta}**: ${b.alvo} · ${b.rotas.length} visitas`).join('\n') + '\n\n'

if (!agregados.length) {
  md += '## Nada a assinalar\n\nTodas as rotas carregaram, o scroll funciona, sem erros de consola nem transbordo horizontal.\n'
} else {
  md += `## ${agregados.length} ponto(s)${escondidos > 0 ? ` — os ${MAX_PONTOS} mais graves` : ''}\n\n`
  mostrados.forEach((a, i) => {
    md += `### ${i + 1}. [${NOMES[a.gravidade]}] ${a.titulo}\n\n`
    if (a.detalhe) md += `${a.detalhe}\n\n`
    const lista = [...new Set(a.ondes)]
    md += lista.length > 4
      ? `Em ${lista.length} sítios, incluindo: ${lista.slice(0, 3).join(' · ')}\n\n`
      : `${lista.join('\n')}\n\n`
  })
  if (escondidos > 0) md += `_Mais ${escondidos} ponto(s) de menor gravidade em \`bruto-*.json\`._\n\n`
}


writeFileSync(join(SAIDA, 'report.md'), md)
writeFileSync(join(SAIDA, 'tem-achados'), agregados.length ? '1' : '0')

console.log(md)
console.log(`\n✓ ${agregados.length} achado(s) · qa-out/report.md`)
