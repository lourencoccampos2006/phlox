#!/usr/bin/env node
// dependencias.mjs — o especialista de dependências e segredos.
//
// INTEIRAMENTE DETERMINÍSTICO: zero tokens. Duas perguntas, ambas respondíveis
// por regra, portanto não há aqui camada de IA nenhuma:
//   1. Alguma dependência tem uma vulnerabilidade conhecida grave?
//   2. Está alguma chave a sério dentro de um ficheiro versionado?
//
// A segunda só olha para ficheiros SEGUIDOS PELO GIT. O `.env.local` está no
// .gitignore e é o sítio certo para os segredos viverem — acusá-lo seria acusar
// o funcionamento normal, e um relatório que grita lobo deixa de ser lido.

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const achados = []

/* ─── 1. Dependências ───────────────────────────────────────────────────── */
try {
  // `npm audit` sai com código != 0 quando encontra alguma coisa, por isso a
  // chamada vive num try e o que interessa é o JSON, não o código de saída.
  const bruto = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  registarAuditoria(JSON.parse(bruto))
} catch (e) {
  if (e.stdout) {
    try { registarAuditoria(JSON.parse(e.stdout)) }
    catch { achados.push(['MENOR', 'npm audit não devolveu JSON válido', String(e.message).slice(0, 120)]) }
  } else {
    achados.push(['MENOR', 'npm audit não correu', String(e.message).slice(0, 120)])
  }
}

function registarAuditoria(dados) {
  const vulns = dados.vulnerabilities || {}
  // Só `high` e `critical`. As `low`/`moderate` num projeto com centenas de
  // dependências transitivas são ruído permanente que ninguém vai tratar.
  const graves = Object.entries(vulns).filter(([, v]) => v.severity === 'high' || v.severity === 'critical')
  if (!graves.length) return

  // Separar o que tem correção do que não tem: só o primeiro é acionável hoje.
  const comCorrecao = graves.filter(([, v]) => v.fixAvailable)
  const semCorrecao = graves.filter(([, v]) => !v.fixAvailable)

  if (comCorrecao.length) {
    achados.push(['GRAVE', `${comCorrecao.length} dependência(s) com vulnerabilidade grave e correção disponível`,
      comCorrecao.slice(0, 6).map(([n, v]) => `${n} (${v.severity})`).join(' · ') + '\n\nCorre `npm audit fix` e confirma que o build passa.'])
  }
  if (semCorrecao.length) {
    achados.push(['MENOR', `${semCorrecao.length} dependência(s) com vulnerabilidade grave e SEM correção`,
      semCorrecao.slice(0, 6).map(([n, v]) => `${n} (${v.severity})`).join(' · ') + '\n\nNão há nada a fazer hoje além de saber que existe.'])
  }
}

/* ─── 2. Segredos em ficheiros versionados ──────────────────────────────── */
// Padrões DELIBERADAMENTE ESTREITOS. Um `/sk-/` largo acusa qualquer palavra
// que calhe conter essas letras, e à terceira acusação falsa o relatório passa
// a ser ignorado. Cada padrão aqui identifica um formato de chave real.
const PADROES = [
  [/\bsk_live_[A-Za-z0-9]{20,}/, 'chave secreta de produção do Stripe'],
  [/\brk_live_[A-Za-z0-9]{20,}/, 'chave restrita de produção do Stripe'],
  [/\bwhsec_[A-Za-z0-9]{20,}/, 'segredo de webhook do Stripe'],
  [/\bsk-proj-[A-Za-z0-9_-]{20,}/, 'chave da OpenAI'],
  [/\bAC[0-9a-f]{32}\b/, 'Account SID da Twilio'],
  [/\bSK[0-9a-f]{32}\b/, 'API Key SID da Twilio'],
  [/\bre_[A-Za-z0-9]{16,}/, 'chave da Resend'],
  [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'chave privada'],
  // O JWT do Supabase com papel service_role: ignora TODO o RLS. É o pior de
  // todos os que podem aqui aparecer.
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\./, 'JWT service_role do Supabase'],
]

// Estes ficheiros contêm exemplos de formato por desenho, não segredos.
const ISENTOS = /(^|\/)(package-lock\.json|\.env\.example|scripts\/qa-agents\/dependencias\.mjs)$/

let ficheiros = []
try {
  ficheiros = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    .split('\n').filter(Boolean)
    .filter((f) => !ISENTOS.test(f))
    .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|sql|sh|env|txt)$/.test(f))
} catch (e) {
  achados.push(['MENOR', 'não consegui listar os ficheiros do git', String(e.message).slice(0, 120)])
}

const expostos = []
for (const f of ficheiros) {
  let texto
  try { texto = readFileSync(f, 'utf8') } catch { continue }
  for (const [re, nome] of PADROES) {
    const m = texto.match(re)
    if (!m) continue
    const linha = texto.slice(0, m.index).split('\n').length
    expostos.push(`${f}:${linha} — ${nome}`)
    break   // um achado por ficheiro chega para o pôr a olhar
  }
}

if (expostos.length) {
  achados.push(['CRÍTICO', `${expostos.length} segredo(s) dentro de ficheiros versionados`,
    expostos.slice(0, 10).join('\n') +
    '\n\nEstá no histórico do git, portanto REVOGA a chave — apagar o ficheiro não chega.'])
}

/* ─── Relatório ─────────────────────────────────────────────────────────── */
const ORDEM = { 'CRÍTICO': 0, 'GRAVE': 1, 'MÉDIO': 2, 'MENOR': 3 }
achados.sort((a, b) => ORDEM[a[0]] - ORDEM[b[0]])

const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
let md = `# Dependências e segredos — ${hoje}\n\n`

if (!achados.length) {
  md += 'Nada a assinalar. Sem vulnerabilidades graves nas dependências e sem chaves em ficheiros versionados.\n'
} else {
  for (const [gravidade, titulo, detalhe] of achados) {
    md += `### [${gravidade}] ${titulo}\n\n${detalhe}\n\n`
  }
}

console.log(md)

// Um ficheiro à parte para o workflow decidir se abre issue, em vez de o fazer
// analisando a saída — analisar texto para tomar decisões parte ao primeiro
// acento fora do sítio.
const { writeFileSync, mkdirSync } = await import('fs')
mkdirSync('qa-out', { recursive: true })
writeFileSync('qa-out/dependencias.md', md)
writeFileSync('qa-out/dependencias-tem-achados', achados.length ? '1' : '0')
