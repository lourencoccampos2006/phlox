// scripts/qa-cardex.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O Cardex diz a verdade sobre o que está e o que não está na ficha?
//
// ── PORQUE É QUE ISTO NÃO SE VERIFICA A OLHO ───────────────────────────────
// Porque a folha engana das duas maneiras, e nenhuma delas dá erro:
//
//   • Diz «NÃO ESTÁ REGISTADO» num campo que está preenchido. A equipa vê o
//     aviso falso uma vez, e a partir daí ignora-o — inclusive quando é
//     verdadeiro.
//   • Não diz nada num campo vazio. Quem lê a folha conclui que não há
//     alergias. Essa é a que mata.
//
// Por isso o que se mede aqui não é «apareceu alguma coisa no ecrã». Pergunta-se
// à BASE DE DADOS, com a chave de serviço, o que está mesmo escrito na ficha
// daquela pessoa, calcula-se o que a folha TEM de dizer, e compara-se com o que
// ela diz. Se a ficha tem alergias e o ecrã grita, é o ecrã que está errado.
//
//   BASE=http://localhost:3311 node scripts/qa-cardex.mjs
//   PID=<uuid> BASE=... node scripts/qa-cardex.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { assentar, textoDe, esperarPor, entrar } from './qa-esperar.mjs'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = 'tmp-qa-cardex'
mkdirSync(OUT, { recursive: true })

const falhas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

/** Pergunta à base de dados sem passar pela aplicação. */
async function bd(caminho) {
  const r = await fetch(`${U}/rest/v1/${caminho}`, {
    headers: { apikey: K, Authorization: `Bearer ${K}` },
  })
  if (!r.ok) throw new Error(`${caminho} → ${r.status} ${await r.text()}`)
  return r.json()
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', e => erros.push(String(e.message || e)))

  const dentro = await entrar(page, BASE)
  diz(dentro, dentro ? 'sessão de QA de pé' : 'o login falhou — nada do que vem abaixo mede o Cardex')
  if (!dentro) throw new Error('sem sessão')

  // ── Quem ─────────────────────────────────────────────────────────────────
  let pid = process.env.PID || null
  if (!pid) {
    await page.goto(`${BASE}/patients`, { waitUntil: 'domcontentloaded' })
    await assentar(page)
    const link = page.locator('a[href^="/patients/"]').first()
    const n = await link.count()
    diz(n > 0, n > 0 ? 'há pelo menos uma ficha na lista' : 'a lista de utentes está vazia — nada a medir')
    if (!n) throw new Error('sem utentes')
    pid = (await link.getAttribute('href')).split('/').pop()
  }
  console.log(`  ficha: ${pid}`)

  // ── O que a base de dados diz ────────────────────────────────────────────
  const [utente] = await bd(`patients?id=eq.${pid}&select=*`)
  const meds = await bd(`patient_meds?patient_id=eq.${pid}&select=*`)
  const contactos = await bd(`resident_contacts?patient_id=eq.${pid}&select=*`)
  const planos = await bd(`care_plans?patient_id=eq.${pid}&select=*`)
  const plano = planos[0] || null
  diz(!!utente, `a ficha existe na base de dados: ${utente?.name || '—'}`)

  const temAlergias = !!(utente.allergies || '').trim()
  const temDieta = !!((plano?.diet_type || utente.diet || '').trim())
  const temMobilidade = !!((plano?.mobility || utente.mobility || '').trim())
  const temMedico = !!(utente.doctor || '').trim()
  const temQuemAvisar = contactos.length > 0 || !!(utente.emergency_phone || '').trim()
  console.log(`  base de dados → alergias:${temAlergias} dieta:${temDieta} `
    + `mobilidade:${temMobilidade} médico:${temMedico} quem avisar:${temQuemAvisar} `
    + `· ${meds.filter(m => m.active !== false).length} medicamento(s) ativo(s)`)

  // ── O separador ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/patients/${pid}?aba=cardex`, { waitUntil: 'domcontentloaded' })

  // ── Esperar pelo ESTADO FINAL, e não por um instante escolhido por mim ──
  // `assentar` sozinho não chega aqui: enquanto a ficha é um esqueleto, o DOM
  // está quieto — o esqueleto é uma animação de CSS e não mexe em nada. A
  // primeira versão deste teste leu nessa altura e acusou o Cardex de não
  // existir.
  //
  // A frase é a do subtítulo, que só aparece depois de as três consultas
  // voltarem: até lá o componente diz «A montar o Cardex…».
  const t = await esperarPor(page, ['quem entra a substituir'])

  diz(t.includes('cardex'), 'o separador «Cardex» abriu pelo endereço (?aba=cardex)')
  diz(/o que .{0,3} preciso saber para cuidar/.test(t),
    'a folha explica para que serve')
  diz(!/a montar o cardex/.test(t), 'já não está a carregar quando se lê')

  // ── As secções ───────────────────────────────────────────────────────────
  for (const s of ['alergias', 'saúde', 'medicação', 'alimentação', 'quem avisar']) {
    diz(t.includes(s), `secção «${s}» no ecrã`)
  }

  // ── A folha concorda com a base de dados? ────────────────────────────────
  // ── O QUE CORREU MAL À PRIMEIRA ────────────────────────────────────────
  // A primeira versão procurava «alergias» seguido de «não está registado»
  // dentro de 120 caracteres, no texto da página inteira. Acusou o Cardex de
  // esconder uma alergia que ele estava a mostrar: o «não está registado» que
  // apanhou era o do DIAGNÓSTICO, quarenta caracteres mais abaixo.
  //
  // Agora lê-se o bloco certo e só o bloco certo — pelo DOM, e não por
  // distância no texto.
  const bloco = await page.evaluate(() => {
    const escolher = (titulo) => {
      const d = [...document.querySelectorAll('div')]
        .find(x => x.children.length === 0 && x.textContent.trim().toLowerCase() === titulo)
      return d?.parentElement?.innerText?.toLowerCase() || ''
    }
    const seccao = (titulo) => {
      const s = [...document.querySelectorAll('section')]
        .find(x => (x.innerText || '').trim().toLowerCase().startsWith(titulo))
      return s?.innerText?.toLowerCase() || ''
    }
    return { falta: escolher('falta o essencial'), alergias: seccao('alergias') }
  })

  diz(!!bloco.alergias, `a secção das alergias existe: «${bloco.alergias.replace(/\n/g, ' · ').slice(0, 70)}»`)
  const gritaAlergias = /n[ãa]o est[áa] registado/.test(bloco.alergias)
  diz(temAlergias ? !gritaAlergias : gritaAlergias,
    temAlergias
      ? (gritaAlergias
        ? `A FICHA TEM ALERGIAS («${utente.allergies}») E O ECRÃ DIZ QUE NÃO ESTÁ REGISTADO`
        : `a ficha tem «${utente.allergies}» e o ecrã mostra-o, sem gritar`)
      : (gritaAlergias
        ? 'a ficha não tem alergias e o ecrã avisa que o campo está em branco'
        : 'A FICHA NÃO TEM ALERGIAS E O ECRÃ NÃO AVISA — é o engano que mata'))
  if (temAlergias) {
    diz(bloco.alergias.includes(utente.allergies.trim().toLowerCase()),
      `o que está escrito na ficha aparece na folha: «${utente.allergies}»`)
  }

  const faltaOEssencial = t.includes('falta o essencial')
  const deviaFaltar = !temAlergias || !temDieta || !temMobilidade || !temMedico || !temQuemAvisar
  diz(faltaOEssencial === deviaFaltar,
    faltaOEssencial === deviaFaltar
      ? (deviaFaltar
        ? 'o aviso «Falta o essencial» aparece, e a base de dados confirma que falta'
        : 'não falta nada essencial, e o aviso não aparece')
      : `DESACORDO: o ecrã ${faltaOEssencial ? 'diz' : 'não diz'} que falta o essencial, `
        + `a base de dados diz o contrário`)

  // Cada campo em branco tem de estar NOMEADO no aviso, e não só contado.
  if (deviaFaltar) {
    const esperados = [
      [!temAlergias, 'alergias'], [!temMedico, 'médico assistente'],
      [!temDieta, 'dieta'], [!temMobilidade, 'mobilidade'],
      [!temQuemAvisar, 'quem avisar'],
    ].filter(([f]) => f).map(([, n]) => n)
    for (const n of esperados) {
      diz(bloco.falta.includes(n), `o aviso nomeia «${n}»`)
    }
    // E o contrário: o que ESTÁ preenchido não pode aparecer na lista do que
    // falta. Um aviso falso visto uma vez ensina a ignorar os verdadeiros.
    const naoDeviam = [
      [temAlergias, 'alergias'], [temMedico, 'médico assistente'],
      [temDieta, 'dieta'], [temMobilidade, 'mobilidade'],
      [temQuemAvisar, 'quem avisar'],
    ].filter(([f]) => f).map(([, n]) => n)
    for (const n of naoDeviam) {
      diz(!bloco.falta.includes(n),
        bloco.falta.includes(n)
          ? `AVISO FALSO: «${n}» está preenchido na ficha e o ecrã diz que falta`
          : `«${n}» está preenchido e não aparece na lista do que falta`)
    }
    diz(/em branco n[ãa]o quer dizer que n[ãa]o haja/.test(t),
      'o aviso explica que em branco não quer dizer que não haja')
  }

  // ── A medicação ──────────────────────────────────────────────────────────
  const ativos = meds.filter(m => m.active !== false && m.take_location !== 'casa' && !m.sos)
  if (ativos.length) {
    const falta = ativos.filter(m => !t.includes((m.name || '').toLowerCase()))
    diz(falta.length === 0,
      falta.length === 0
        ? `os ${ativos.length} medicamentos da casa estão todos na folha`
        : `FALTAM na folha: ${falta.map(m => m.name).join(', ')}`)
  } else {
    diz(/nenhum medicamento/.test(t), 'sem medicação, a folha diz que não há')
  }
  const sos = meds.filter(m => m.active !== false && m.sos)
  if (sos.length) {
    diz(/sos .{0,3} s[óo] se for preciso/.test(t), 'o SOS tem secção própria')
  }

  // ── As feridas são de quem tem a ferramenta das feridas ─────────────────
  // ── O DEFEITO QUE ISTO GUARDA ──────────────────────────────────────────
  // O `useClinicPrefs` começa por dizer `nursing_home` e só depois pergunta ao
  // servidor. Num centro de dia, o Cardex carregava duas vezes — e a primeira
  // resposta, com as feridas de um lar, chegava DEPOIS da segunda e escrevia
  // por cima. O centro de dia ficava com uma secção de feridas que a casa nem
  // sequer tem.
  //
  // Não se vê a olho: a folha parece bem, só tem uma secção a mais. Mede-se
  // assim, comparando com o tipo da casa.
  const [perfil] = await bd(
    `profiles?email=eq.${encodeURIComponent(process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')}&select=institution_type`)
  const tipo = perfil?.institution_type || '—'
  const feridasNaBase = await bd(`wounds?patient_id=eq.${pid}&select=location,status`)
  const deviaTerFeridas = tipo === 'nursing_home'
  const temSeccaoFeridas = t.includes('feridas ativas')
  diz(temSeccaoFeridas === deviaTerFeridas,
    temSeccaoFeridas === deviaTerFeridas
      ? `a secção das feridas ${deviaTerFeridas ? 'aparece' : 'não aparece'}, como manda o tipo «${tipo}»`
      : `A SECÇÃO DAS FERIDAS ${temSeccaoFeridas ? 'APARECE' : 'NÃO APARECE'} NUM «${tipo}» `
        + `(há ${feridasNaBase.length} ferida(s) na base de dados — provavelmente a resposta antiga a chegar tarde)`)

  // ── Imprimir existe, e NÃO se clica ──────────────────────────────────────
  // Clicar abre o diálogo do sistema e tranca a passagem toda.
  diz(await page.getByRole('button', { name: 'Imprimir' }).count() > 0,
    'o botão de imprimir está lá (não se clica)')

  await page.screenshot({ path: `${OUT}/cardex.png` })

  // ── Telemóvel ────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await assentar(page)
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
  const tm = await textoDe(page)
  diz(tm.includes('alergias'), 'as alergias continuam visíveis no telemóvel')
  await page.screenshot({ path: `${OUT}/telemovel.png` })

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally {
  await browser.close()
}

console.log(falhas.length
  ? `\n✗ ${falhas.length} falha(s).`
  : '\n✓ A folha concorda com a base de dados, campo a campo.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
