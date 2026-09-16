'use client'

// /scan — EXPLICAR
// ─────────────────────────────────────────────────────────────────────────────
// A ferramenta mais importante do Phlox: uma foto a qualquer papel de saúde,
// explicado em português simples.
//
// ── PORQUE É QUE FOI REFEITA (2026-09-15) ──────────────────────────────────
// A versão anterior estava correta e era invisível. Chamava-se "Tirar foto a
// uma receita ou caixa" — uma instrução, não uma promessa — e devolvia um
// resumo de duas frases. Quem chega ao Phlox com um relatório do hospital na
// mão não tem como saber que isto existe, e se descobrisse não veria o que
// ganha com ele.
//
// Três mudanças de fundo:
//
//   1. O nome. Passou por "Decifrar" e não chegou: era abstrato demais, e
//      quem lê não fica a saber o que a ferramenta faz. "Explicar" é o que
//      ela faz POR SI, e é um verbo que toda a gente usa.
//   2. A promessa está no ecrã antes de haver resultado. Vê-se logo o que ele
//      lê — receita, análises, relatório, caixa, bula — porque a dúvida de
//      quem chega é "isto serve para o meu caso?".
//   3. O resultado deixou de ser um resumo e passou a ser um documento
//      decifrado: o essencial, o que importa, o glossário das palavras
//      difíceis, o relatório reescrito secção a secção, o que perguntar ao
//      médico, e o que fazer a seguir. E dá para CONTINUAR A PERGUNTAR — que
//      é o que acontece sempre a seguir a ler um relatório.
//
// A IA é a de qualidade (Claude primeiro; ver `qualidade` em lib/ai.ts). Num
// relatório médico, ler mal uma frase não é um defeito de estilo.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { extractFromFile } from '@/lib/docExtract'
import { useUsageLimit } from '@/lib/useUsageLimit'
import UpgradeNudge from '@/components/UpgradeNudge'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import NaoEDispositivoMedico from '@/components/NaoEDispositivoMedico'
import { horasDaFrequencia } from '@/lib/horarioToma'

/** O nome da ferramenta, num sítio só — muda aqui e muda em todo o lado. */
export const NOME_FERRAMENTA = 'Explicar'

const ACCENT = '#0d6e42'

// Reduz a foto antes de enviar. As fotos da câmara (3–12 MB) em base64
// estouravam o payload e o tempo da chamada de visão. ~1600px mantém o texto
// pequeno legível — subiu de 1280 porque o modelo bom aproveita a resolução a
// mais, e é aí que estão as letras das análises.
function downscaleImage(file: File, maxDim = 1600, q = 0.85): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ b64: (c.toDataURL('image/jpeg', q).split(',')[1]) || '', mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

interface Med { name: string; dose?: string; frequency?: string; paraQue?: string; _import?: boolean }
interface Valor { name: string; value?: string; unit?: string; reference?: string; status?: string; note?: string }
interface Termo { termo: string; simples: string }
interface Seccao { titulo: string; texto: string }

interface Explicado {
  kind: string
  title?: string
  emDuasLinhas?: string
  oQueImporta?: string[]
  termos?: Termo[]
  secoes?: Seccao[]
  meds?: Med[]
  values?: Valor[]
  perguntasParaOMedico?: string[]
  aSeguir?: string[]
  warning?: string
  legibilidade?: string
  confidence?: string
}

const TIPOS: Record<string, { icon: string; label: string }> = {
  receita:     { icon: '℞', label: 'Receita médica' },
  medicamento: { icon: '◈', label: 'Medicamento' },
  analise:     { icon: '◉', label: 'Análises' },
  relatorio:   { icon: '§', label: 'Relatório médico' },
  bula:        { icon: '¶', label: 'Folheto informativo' },
  outro:       { icon: '?', label: 'Documento de saúde' },
  nao_saude:   { icon: '—', label: 'Não parece ser de saúde' },
}

/** O que ele lê. Está no ecrã ANTES de haver resultado, de propósito: a
 *  primeira pergunta de quem chega é "isto serve para o meu caso?". */
const LE: { nome: string; exemplo: string }[] = [
  { nome: 'Relatórios e cartas médicas', exemplo: 'a alta do hospital, o resultado de uma TAC' },
  { nome: 'Análises', exemplo: 'sangue, urina — valor a valor' },
  { nome: 'Receitas', exemplo: 'o que é, para que serve, como se toma' },
  { nome: 'Caixas de medicamentos', exemplo: 'uma foto da caixa chega' },
  { nome: 'Folhetos informativos', exemplo: 'o papel que vem dentro da caixa' },
]

const COR_ESTADO: Record<string, string> = { normal: '#0d6e42', baixo: '#b45309', alto: '#b91c1c' }

export default function ExplicarPage() {
  const { user, supabase } = useAuth() as any
  const [busy, setBusy] = useState('')
  const [res, setRes] = useState<Explicado | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [err, setErr] = useState('')
  const [importado, setImportado] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [perfil, setPerfil] = useState<ActiveProfile | null>(getActiveProfile())
  const [pergunta, setPergunta] = useState('')
  const [conversa, setConversa] = useState<{ q: string; r: string }[]>([])
  const [aPerguntar, setAPerguntar] = useState(false)
  const camaraRef = useRef<HTMLInputElement>(null)
  const ficheiroRef = useRef<HTMLInputElement>(null)
  const uso = useUsageLimit('scan')

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  function limpar() {
    setErr(''); setRes(null); setMeds([]); setImportado(false)
    setGuardado(false); setConversa([]); setPergunta('')
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (uso.hit) { limpar(); setErr('limit'); return }
    limpar()

    const nome = (file.name || '').toLowerCase()
    const ehDoc = /\.(pdf|docx?|pptx?|txt|md)$/.test(nome) || file.type === 'application/pdf'
      || file.type.startsWith('text/') || file.type.includes('word') || file.type.includes('officedocument')
    // A câmara do telemóvel devolve muitas vezes `type` vazio (ou HEIC): não se
    // confia só no mimeType, olha-se também à extensão.
    const ehImagem = !ehDoc && (
      file.type.startsWith('image/') || file.type === '' ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(nome)
    )

    try {
      let payload: any
      if (ehImagem) {
        setBusy('A ler o documento…')
        let b64 = '', mime = 'image/jpeg'
        try {
          const pequena = await downscaleImage(file)
          if (!pequena.b64) throw new Error('vazio')
          b64 = pequena.b64; mime = pequena.mime
        } catch {
          // O browser não soube descodificar (HEIC antigo): envia-se o ficheiro cru.
          b64 = await new Promise<string>((ok, mau) => {
            const rd = new FileReader()
            rd.onload = () => {
              const r = String(rd.result || ''); const v = r.indexOf(',')
              if (v < 0) { mau(new Error('Não consegui ler a imagem. Tenta outra foto.')); return }
              ok(r.slice(v + 1))
            }
            rd.onerror = () => mau(new Error('Não consegui ler a imagem. Tenta outra foto.'))
            rd.readAsDataURL(file)
          })
          mime = file.type?.startsWith('image/') ? file.type : 'image/jpeg'
        }
        payload = { image: b64, mimeType: mime }
      } else {
        setBusy('A ler o documento…')
        const ex = await extractFromFile(file)
        if (!ex.text || ex.text.trim().length < 10) throw new Error('Não encontrei texto neste ficheiro. Se for um PDF digitalizado, tenta tirar-lhe uma foto.')
        payload = { text: ex.text }
      }

      setBusy('A explicar…')
      const r = await fetch('/api/scan', { method: 'POST', headers: await auth(), body: JSON.stringify(payload) })
      const texto = await r.text()
      let j: any = null
      try { j = JSON.parse(texto) } catch { throw new Error('O servidor demorou demasiado. Tenta com uma foto mais pequena.') }
      if (r.status === 429 || j.limit_reached) { setErr('limit'); return }
      if (!r.ok) throw new Error(j.error || 'Não consegui interpretar.')

      setRes(j)
      setMeds((j.meds || []).map((m: Med) => ({ ...m, _import: true })))
    } catch (e: any) {
      setErr(e.message || 'Não consegui processar.')
    } finally { setBusy('') }
  }

  // ── Guardar os medicamentos ────────────────────────────────────────────────
  // COM a hora do lembrete. A versão anterior gravava só nome/dose/frequência e
  // deixava `reminder_times` a null — e o cron das notificações filtra
  // precisamente por isso, por isso um medicamento vindo daqui nunca dava
  // lembrete. Ver lib/horarioToma.
  async function guardarMedicamentos() {
    if (!user) { setErr('Inicia sessão para guardar.'); return }
    const escolhidos = meds.filter(m => m._import)
    if (!escolhidos.length) return
    setBusy('A guardar…')
    const paraFamiliar = perfil?.type === 'family' && perfil.id !== 'self'
    for (const m of escolhidos) {
      const horas = horasDaFrequencia(m.frequency).horas
      const linha: any = {
        user_id: user.id, name: m.name, dose: m.dose || null, frequency: m.frequency || null,
        reminder_times: horas.length ? horas : null,
      }
      if (paraFamiliar) {
        await supabase.from('family_profile_meds').insert({ ...linha, profile_id: perfil!.id }).then(() => {}, () => {})
      } else {
        await supabase.from('personal_meds').insert(linha).then(() => {}, () => {})
      }
    }
    setBusy(''); setImportado(true)
  }

  // ── Guardar no cofre ───────────────────────────────────────────────────────
  async function guardarNoCofre() {
    if (!user || !res) { setErr('Inicia sessão para guardar.'); return }
    setBusy('A guardar no cofre…')
    const partes = [
      res.emDuasLinhas,
      res.oQueImporta?.length ? '\nO que importa:\n' + res.oQueImporta.map(x => `• ${x}`).join('\n') : '',
      res.secoes?.length ? '\n' + res.secoes.map(s => `${s.titulo}\n${s.texto}`).join('\n\n') : '',
      res.values?.length ? '\nValores:\n' + res.values.map(v => `${v.name}: ${v.value || ''} ${v.unit || ''} (${v.status || ''})`).join('\n') : '',
      res.termos?.length ? '\nTermos:\n' + res.termos.map(t => `${t.termo} — ${t.simples}`).join('\n') : '',
    ].filter(Boolean).join('\n')

    const categoria = res.kind === 'analise' ? 'analises'
      : res.kind === 'receita' ? 'receitas'
      : res.kind === 'relatorio' ? 'relatorios' : 'outros'

    const { error } = await supabase.from('health_vault').insert({
      user_id: user.id,
      title: res.title || 'Documento decifrado',
      category: categoria,
      body_text: partes.slice(0, 20000),
      notes: 'Explicado pelo Phlox',
      issued_at: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    setBusy('')
    if (error) setErr('Não foi possível guardar no cofre.')
    else setGuardado(true)
  }

  async function perguntar() {
    const q = pergunta.trim()
    if (!q || !res || aPerguntar) return
    setAPerguntar(true); setPergunta('')
    try {
      const r = await fetch('/api/scan/perguntar', {
        method: 'POST', headers: await auth(),
        body: JSON.stringify({ documento: res, pergunta: q, anteriores: conversa }),
      })
      const j = await r.json()
      setConversa(c => [...c, { q, r: r.ok ? (j.resposta || '') : (j.error || 'Não consegui responder.') }])
    } catch {
      setConversa(c => [...c, { q, r: 'Não consegui responder agora. Tenta outra vez.' }])
    } finally { setAPerguntar(false) }
  }

  const tipo = res ? (TIPOS[res.kind] || TIPOS.outro) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2, #fbfaf8)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>

        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: res ? 20 : 26 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 9,
          }}>Phlox</div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,5.4vw,44px)', fontWeight: 400,
            color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.08,
          }}>{NOME_FERRAMENTA}</h1>
          <p style={{
            fontSize: 15.5, color: 'var(--ink-3)', margin: '10px 0 0',
            maxWidth: '44ch', lineHeight: 1.55, textWrap: 'pretty' as any,
          }}>
            Tire uma foto a um exame, receita ou relatório. Nós explicamos o que
            lá está, em português simples.
          </p>
        </div>

        {!res && !busy && (
          <>
            {/* ── A captura ─────────────────────────────────────────────── */}
            <div style={{
              background: 'white', border: `2px dashed ${ACCENT}44`, borderRadius: 16,
              padding: 'clamp(24px,5vw,36px) 22px', textAlign: 'center',
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', background: `${ACCENT}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 25, color: ACCENT,
              }} aria-hidden>◎</div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => camaraRef.current?.click()} style={{
                  padding: '14px 26px', background: ACCENT, color: 'white', border: 'none',
                  borderRadius: 11, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', minHeight: 52,
                }}>Tirar foto</button>
                <button onClick={() => ficheiroRef.current?.click()} style={{
                  padding: '14px 22px', background: 'white', color: 'var(--ink-2)',
                  border: '1.5px solid var(--border)', borderRadius: 11,
                  fontSize: 15, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit', minHeight: 52,
                }}>Escolher ficheiro</button>
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginTop: 14, lineHeight: 1.55 }}>
                Foto, PDF ou documento. Fica só na sua conta.
              </div>

              {/* `capture` abre a câmara direto no telemóvel; o outro aceita tudo. */}
              <input ref={camaraRef} type="file" accept="image/*" capture="environment"
                onChange={aoEscolher} style={{ display: 'none' }} />
              <input ref={ficheiroRef} type="file"
                accept="image/*,application/pdf,.doc,.docx,.txt,.md"
                onChange={aoEscolher} style={{ display: 'none' }} />
            </div>

            {/* ── A promessa, antes de haver resultado ───────────────────── */}
            <div style={{ marginTop: 26 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12,
              }}>O que consegue ler</div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                background: 'var(--border)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                {LE.map(x => (
                  <div key={x.nome} style={{ background: 'white', padding: '13px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>{x.nome}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.5 }}>{x.exemplo}</div>
                  </div>
                ))}
              </div>
              <p style={{
                fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 16,
                maxWidth: '62ch', textWrap: 'pretty' as any,
              }}>
                De cada documento tira o essencial em duas linhas, explica as palavras
                difíceis, diz o que importa reter, o que perguntar na próxima consulta —
                e fica disponível para as perguntas que vierem a seguir.
              </p>
            </div>

            <NaoEDispositivoMedico />
          </>
        )}

        {/* ── A trabalhar ───────────────────────────────────────────────── */}
        {busy && (
          <div style={{
            background: 'white', border: '1px solid var(--border)', borderRadius: 14,
            padding: '30px 22px', textAlign: 'center',
          }}>
            <div style={{
              width: 26, height: 26, border: '2.5px solid var(--bg-3)', borderTopColor: ACCENT,
              borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)', fontWeight: 600 }}>{busy}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginTop: 6, lineHeight: 1.5 }}>
              Pode demorar até meio minuto. Usamos o modelo mais cuidadoso — num documento
              de saúde vale a pena esperar.
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Erros ─────────────────────────────────────────────────────── */}
        {err === 'limit' && <UpgradeNudge used={uso.used} limit={uso.limit} what="documentos decifrados" plan="pro" />}
        {err && err !== 'limit' && (
          <div style={{
            background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 12,
            padding: '14px 16px', fontSize: 13.5, color: '#c53030', lineHeight: 1.6, marginTop: 14,
          }}>
            {err}
            <button onClick={limpar} style={{
              display: 'block', marginTop: 10, padding: '7px 14px', background: 'white',
              border: '1px solid #fed7d7', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              color: '#c53030', cursor: 'pointer', fontFamily: 'inherit',
            }}>Tentar outra vez</button>
          </div>
        )}

        {/* ── O documento decifrado ─────────────────────────────────────── */}
        {res && !busy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* identificação */}
            <div style={{
              background: 'white', border: '1px solid var(--border)', borderRadius: 14,
              padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12, flexWrap: 'wrap' }}>
                <span aria-hidden style={{
                  width: 34, height: 34, borderRadius: 9, background: `${ACCENT}12`, color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontFamily: 'var(--font-serif)', flexShrink: 0,
                }}>{tipo!.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'var(--ink-5)',
                  }}>{tipo!.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 1 }}>
                    {res.title || 'Documento'}
                  </div>
                </div>
                <button onClick={limpar} style={{
                  padding: '7px 13px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12.5, fontWeight: 650, color: 'var(--ink-3)',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>Outro documento</button>
              </div>

              {res.emDuasLinhas && (
                <p style={{
                  fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px,2.4vw,20px)',
                  lineHeight: 1.5, color: 'var(--ink)', margin: 0, maxWidth: '52ch',
                  textWrap: 'pretty' as any,
                }}>{res.emDuasLinhas}</p>
              )}

              {(res.legibilidade || res.confidence === 'baixa') && (
                <div style={{
                  marginTop: 13, padding: '10px 13px', background: '#fffbeb',
                  border: '1px solid #fde68a', borderRadius: 9, fontSize: 12.5,
                  color: '#854d0e', lineHeight: 1.55,
                }}>
                  {res.legibilidade || 'Não consegui ler tudo com certeza — confirme o que aparece aqui com o documento original.'}
                </div>
              )}
            </div>

            {res.warning && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
                padding: '14px 16px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: '#b91c1c', marginBottom: 5,
                }}>A ter em conta</div>
                <div style={{ fontSize: 14, color: '#7f1d1d', lineHeight: 1.6 }}>{res.warning}</div>
              </div>
            )}

            <Bloco titulo="O que importa" quando={!!res.oQueImporta?.length}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {res.oQueImporta!.map((x, i) => (
                  <li key={i} style={{ display: 'flex', gap: 11, fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                    <span aria-hidden style={{ color: ACCENT, flexShrink: 0, fontWeight: 700 }}>—</span>
                    <span style={{ textWrap: 'pretty' as any }}>{x}</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            {/* o relatório reescrito */}
            <Bloco titulo="O documento, em simples" quando={!!res.secoes?.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {res.secoes!.map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>{s.titulo}</div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, textWrap: 'pretty' as any }}>{s.texto}</p>
                  </div>
                ))}
              </div>
            </Bloco>

            {/* valores das análises */}
            <Bloco titulo="Valor a valor" quando={!!res.values?.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {res.values!.map((v, i) => {
                  const cor = COR_ESTADO[String(v.status || '').toLowerCase()] || 'var(--ink-4)'
                  return (
                    <div key={i} style={{ background: 'white', padding: '11px 13px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>{v.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, color: cor }}>
                          {v.value}{v.unit ? ` ${v.unit}` : ''}
                        </span>
                        {v.status && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, color: cor, background: `${cor}14`,
                            padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>{v.status}</span>
                        )}
                        {v.reference && (
                          <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>ref. {v.reference}</span>
                        )}
                      </div>
                      {v.note && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{v.note}</div>}
                    </div>
                  )
                })}
              </div>
            </Bloco>

            {/* medicamentos */}
            <Bloco titulo="Medicamentos" quando={!!meds.length}>
              <div style={{ marginBottom: 12 }}>
                <ProfileSelector onChange={setPerfil} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meds.map((m, i) => {
                  const horas = horasDaFrequencia(m.frequency).horas
                  return (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 11, background: 'var(--bg-2)',
                      borderRadius: 9, padding: '11px 13px', cursor: 'pointer',
                    }}>
                      <input type="checkbox" checked={!!m._import} style={{ width: 17, height: 17, marginTop: 2, flexShrink: 0 }}
                        onChange={() => setMeds(p => p.map((x, j) => j === i ? { ...x, _import: !x._import } : x))} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--ink)' }}>
                          {m.name}{m.dose ? ` · ${m.dose}` : ''}
                        </div>
                        {m.frequency && <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 1 }}>{m.frequency}</div>}
                        {m.paraQue && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>{m.paraQue}</div>}
                        {horas.length > 0 && (
                          <div style={{ fontSize: 11.5, color: ACCENT, marginTop: 4, fontWeight: 600 }}>
                            lembrete às {horas.join(' e ')}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
              {importado ? (
                <div style={{
                  marginTop: 12, padding: '11px 14px', background: '#f0fdf4',
                  border: '1px solid #86efac', borderRadius: 9, fontSize: 13, color: '#166534', lineHeight: 1.55,
                }}>
                  Guardado. <Link href="/mymeds" style={{ color: '#166534', fontWeight: 700 }}>Ver os medicamentos →</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={guardarMedicamentos} disabled={!meds.some(m => m._import)} style={{
                    padding: '10px 18px', background: meds.some(m => m._import) ? ACCENT : 'var(--bg-3)',
                    color: meds.some(m => m._import) ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9,
                    fontSize: 13.5, fontWeight: 700, cursor: meds.some(m => m._import) ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}>Guardar nos meus medicamentos</button>
                  {meds.filter(m => m._import).length >= 2 && (
                    <Link href={`/interactions?drugs=${encodeURIComponent(meds.filter(m => m._import).map(m => m.name).join(','))}`} style={{
                      padding: '10px 16px', background: 'white', color: 'var(--ink-2)',
                      border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13.5,
                      fontWeight: 650, textDecoration: 'none', display: 'inline-block',
                    }}>Ver interações</Link>
                  )}
                </div>
              )}
            </Bloco>

            {/* glossário */}
            <Bloco titulo="As palavras difíceis" quando={!!res.termos?.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {res.termos!.map((t, i) => (
                  <div key={i}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{t.termo}</span>
                    <span style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.55 }}> — {t.simples}</span>
                  </div>
                ))}
              </div>
            </Bloco>

            <Bloco titulo="Para perguntar na consulta" quando={!!res.perguntasParaOMedico?.length}>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {res.perguntasParaOMedico!.map((q, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                    <span aria-hidden style={{ color: 'var(--ink-5)', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ textWrap: 'pretty' as any }}>{q}</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            <Bloco titulo="A seguir" quando={!!res.aSeguir?.length}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {res.aSeguir!.map((x, i) => (
                  <li key={i} style={{ display: 'flex', gap: 11, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                    <span aria-hidden style={{ color: ACCENT, flexShrink: 0 }}>→</span>
                    <span style={{ textWrap: 'pretty' as any }}>{x}</span>
                  </li>
                ))}
              </ul>
            </Bloco>

            {/* ── Continuar a perguntar ──────────────────────────────────── */}
            <div style={{
              background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 4,
              }}>Ficou com dúvidas?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 13, lineHeight: 1.55, maxWidth: '54ch' }}>
                Pergunte o que quiser sobre este documento. Respondo com o que ele diz —
                se a resposta não estiver lá, digo-lhe isso.
              </div>

              {conversa.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
                  {conversa.map((t, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{t.q}</div>
                      <div style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, textWrap: 'pretty' as any }}>{t.r}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') perguntar() }}
                  placeholder="Ex: o que quer dizer este valor?"
                  disabled={aPerguntar}
                  style={{
                    flex: '1 1 220px', minWidth: 0, border: '1.5px solid var(--border)',
                    borderRadius: 9, padding: '11px 13px', fontSize: 14.5,
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }} />
                <button onClick={perguntar} disabled={aPerguntar || !pergunta.trim()} style={{
                  padding: '11px 20px', background: aPerguntar || !pergunta.trim() ? 'var(--bg-3)' : 'var(--ink)',
                  color: aPerguntar || !pergunta.trim() ? 'var(--ink-4)' : 'white', border: 'none',
                  borderRadius: 9, fontSize: 14, fontWeight: 700,
                  cursor: aPerguntar || !pergunta.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>{aPerguntar ? 'A pensar…' : 'Perguntar'}</button>
              </div>
            </div>

            {/* ── Guardar ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {guardado ? (
                <div style={{
                  flex: 1, padding: '12px 15px', background: '#f0fdf4', border: '1px solid #86efac',
                  borderRadius: 10, fontSize: 13.5, color: '#166534', lineHeight: 1.55,
                }}>
                  Guardado no cofre. <Link href="/vault" style={{ color: '#166534', fontWeight: 700 }}>Abrir o cofre →</Link>
                </div>
              ) : (
                <button onClick={guardarNoCofre} style={{
                  padding: '12px 20px', background: 'white', color: 'var(--ink-2)',
                  border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14,
                  fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit',
                }}>Guardar no cofre</button>
              )}
            </div>

            <NaoEDispositivoMedico />
          </div>
        )}
      </div>
    </div>
  )
}

/** Um bloco do resultado. Só aparece quando tem conteúdo — um cartão vazio com
 *  um título é pior do que não ter cartão nenhum. */
function Bloco({ titulo, quando, children }: { titulo: string; quando: boolean; children: React.ReactNode }) {
  if (!quando) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 12,
      }}>{titulo}</div>
      {children}
    </div>
  )
}
