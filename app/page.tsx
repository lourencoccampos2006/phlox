'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

// ── Homepage 2026-06-24 (v3) — editorial / revista clínica com carácter ────────
// Conceito: tipografia a mandar (Lora serif + Syne), grelha Swiss assimétrica,
// verde MUITO escuro e muted (#0d6e42, nada saturado), muito branco. O herói é
// o CONTEÚDO REAL — a resposta de interação composta como uma página de revista.
// Zero telemóvel 3D, zero gradientes "de IA". Carácter via marcas de índice
// (01/02/03), filetes finos, mono labels — não via efeitos.

const INK = '#16181d'
const INK_3 = '#545862'
const INK_4 = '#767b86'
const GREEN = '#0d6e42'
const RED = '#9e2f24'
const BORDER = '#e7e8ea'
const PAPER = '#fbfaf7'

const PARES = [
  { a: 'Varfarina', b: 'Ibuprofeno', ok: false, veredito: 'Não misturar', txt: 'O ibuprofeno aumenta o risco de hemorragia em quem toma varfarina.', alt: 'Para as dores, o paracetamol costuma ser mais seguro — confirme com o farmacêutico.' },
  { a: 'Sertralina', b: 'Tramadol', ok: false, veredito: 'Não misturar', txt: 'Juntos podem causar excesso de serotonina, o que é perigoso.', alt: 'Há outras opções para a dor. Fale com o médico antes de combinar.' },
  { a: 'Omeprazol', b: 'Paracetamol', ok: true, veredito: 'Sem problema', txt: 'Não há interação conhecida entre estes dois. Pode tomar com tranquilidade.', alt: '' },
]

// O herói: uma "ficha" editorial da resposta real, como numa página de revista.
// Ficha de veredito — editorial, limpa. Profundidade SUBTIL e digna (sombra
// suave + leve inclinação ao ponteiro), sem objetos a flutuar. O herói é a
// resposta real, composta como uma página de revista clínica.
function VerdictScene() {
  const [i, setI] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const p = PARES[i]
  const accent = p.ok ? GREEN : RED

  function onMove(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 3.5, y: px * 4.5 })   // subtil, não vertiginoso
  }
  function onLeave() { setTilt({ x: 0, y: 0 }) }

  return (
    <div className="vsc" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="vsc-sheet" style={{ transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <div className="vs-tag">Verificação · resposta real</div>
        <div className="vs-pair">
          {[p.a, p.b].map((n, k) => (
            <span key={n} className="vs-chip">{n}{k === 0 && <span className="vs-plus">+</span>}</span>
          ))}
        </div>
        <div className="vs-verdict" style={{ color: accent }}>
          <span className="vs-dot" style={{ background: accent }} />{p.veredito}
        </div>
        <p className="vs-txt">{p.txt}</p>
        {p.alt && <p className="vs-alt">{p.alt}</p>}
        <div className="vsc-switch">
          {PARES.map((x, k) => (
            <button key={k} onClick={() => setI(k)} className={`vs-sw ${i === k ? 'on' : ''}`} aria-label={`${x.a} e ${x.b}`}>
              {x.a.slice(0, 4)}·{x.b.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Os 5 mundos do Phlox — cada um com o MESMO peso. Cada um com o que faz mesmo.
const MUNDOS = [
  {
    n: '01', tag: 'Para si', t: 'A minha saúde', accent: '#0d6e42', href: '/login?mode=personal',
    lead: 'A sua medicação organizada e a saúde debaixo de olho.',
    items: ['Foto à receita → lista e horários', 'Lembretes no calendário do telemóvel', 'Vê se os comprimidos se dão bem'],
  },
  {
    n: '02', tag: 'Para a família', t: 'Cuidar de alguém', accent: '#b9690e', href: '/login?mode=caregiver',
    lead: 'A saúde de cada pessoa de quem cuida, num só sítio.',
    items: ['Um perfil por familiar', 'Quem tomou o quê, e quando', 'Partilha com o médico por código'],
  },
  {
    n: '03', tag: 'Para estudar', t: 'Estudante de saúde', accent: '#7c3aed', href: '/login?mode=student',
    lead: 'Treino a sério para medicina, farmácia e enfermagem.',
    items: ['Arena de casos clínicos com IA', 'OSCE e simulador de decisões', 'Flashcards e o seu progresso'],
  },
  {
    n: '04', tag: 'Para profissionais', t: 'Trabalho na saúde', accent: '#1d4ed8', href: '/login?mode=clinical',
    lead: 'Decisão clínica com a evidência que se usa cá.',
    items: ['Interações, STOPP/START e Beers', 'Calculadoras e protocolos (DGS, ESC)', 'Revisão e otimização da medicação'],
  },
  {
    n: '05', tag: 'Para instituições', t: 'Lar, centro de dia, farmácia', accent: '#0f766e', href: '/centro-de-dia',
    lead: 'Montado de raiz para o seu tipo de instituição.',
    items: ['Painel, ronda, MAR e ocorrências', 'Portal das famílias e relatórios', 'Equipa, utentes e turnos'],
  },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="lp">

      {/* ── HERO editorial — a tipografia e a resposta real mandam ──────────── */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <div className={`lp-hero-grid ${mounted ? 'in' : ''}`}>
            <div className="lp-hero-l">
              <div className="lp-kicker"><span className="lp-kicker-rule" />Saúde em português, para todos</div>
              <h1 className="lp-h1">
                Toda a saúde<br />num <em>só sítio</em>.
              </h1>
              <p className="lp-lead">
                Para si, para quem cuida da família, para quem estuda e para quem trabalha na
                saúde. Cada pessoa tem o Phlox feito à sua medida.
              </p>
              <div className="lp-actions">
                <Link href="/login" className="lp-go">Criar conta grátis</Link>
                <Link href="#mundos" className="lp-link">Ver o que faz&nbsp;↓</Link>
              </div>
              <div className="lp-meta">Grátis · Sem instalar · Um minuto a começar</div>
            </div>
            <div className="lp-hero-r">
              <VerdictScene />
            </div>
          </div>
        </div>
      </section>

      {/* ── Filete + frase-manifesto ────────────────────────────────────────── */}
      <section className="lp-manifesto">
        <div className="lp-wrap">
          <div className="lp-rule" />
          <p className="lp-mani-txt reveal">
            Conhece o Ben-u-ron, o Brufen e o Concor pelo nome.
            Segue as regras do <strong>INFARMED</strong>. Fala como o seu farmacêutico.
          </p>
        </div>
      </section>

      {/* ── COMO FUNCIONA — índice numerado, Swiss ──────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 01</span>
            <h2 className="lp-h2">Como funciona</h2>
            <p className="lp-sec-sub">Três passos, e está a usar.</p>
          </header>
          <div className="lp-steps">
            {[
              { n: '1', t: 'Crie a conta', d: 'Um email e está dentro. Não pedimos cartão.' },
              { n: '2', t: 'Fotografe a receita', d: 'Tiramos de lá os medicamentos, as doses e os horários.' },
              { n: '3', t: 'Deixe connosco', d: 'Avisamos das tomas e do que não deve misturar.' },
            ].map(s => (
              <div key={s.n} className="lp-step reveal">
                <div className="lp-step-rule" />
                <div className="lp-step-n">{s.n}</div>
                <h3 className="lp-step-t">{s.t}</h3>
                <p className="lp-step-d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OS 5 MUNDOS — o coração da página, igual peso para cada público ──── */}
      <section className="lp-sec lp-sec-paper" id="mundos">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 02</span>
            <h2 className="lp-h2">Um Phlox para cada pessoa</h2>
            <p className="lp-sec-sub">O site adapta-se a si. Escolha o seu mundo — pode mudar quando quiser.</p>
          </header>
          <div className="lp-mundos">
            {MUNDOS.map(m => (
              <Link key={m.n} href={m.href} className="lp-mundo reveal" style={{ ['--a' as string]: m.accent }}>
                <div className="lp-mundo-top">
                  <span className="lp-mundo-tag">{m.tag}</span>
                  <span className="lp-mundo-n">{m.n}</span>
                </div>
                <h3 className="lp-mundo-t">{m.t}</h3>
                <p className="lp-mundo-lead">{m.lead}</p>
                <ul className="lp-mundo-list">
                  {m.items.map(it => <li key={it}>{it}</li>)}
                </ul>
                <span className="lp-mundo-go">Entrar <span className="lp-mundo-arrow">→</span></span>
              </Link>
            ))}
            {/* Célula de fecho — convida quem ainda não sabe */}
            <Link href="/login" className="lp-mundo lp-mundo-cta reveal">
              <h3 className="lp-mundo-t" style={{ marginBottom: 10 }}>Ainda não sabe?</h3>
              <p className="lp-mundo-lead" style={{ marginBottom: 18 }}>Crie a conta e escolhemos consigo. Demora um minuto e não custa nada.</p>
              <span className="lp-go" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>Criar conta grátis</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRÊS COISAS — colunas editoriais ────────────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 03</span>
            <h2 className="lp-h2">O que ganha</h2>
          </header>
          <div className="lp-three">
            {[
              { k: 'Foto', t: 'A caixa diz tudo', d: 'Fotografe a receita ou a caixa. Dizemos-lhe o que é, para que serve e como tomar.' },
              { k: 'Pergunta', t: 'Tire a dúvida na hora', d: '«Posso tomar com café?» «Falhei uma dose, e agora?» Respondemos sem rodeios.' },
              { k: 'Aviso', t: 'Avisamos a tempo', d: 'Dois medicamentos que não combinam, uma toma esquecida — dizemos antes de virar problema.' },
            ].map((x, idx) => (
              <div key={x.t} className="lp-feat reveal">
                <div className="lp-feat-k"><span>0{idx + 1}</span>{x.k}</div>
                <h3 className="lp-feat-t">{x.t}</h3>
                <p className="lp-feat-d">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="lp-badges reveal">
            {['INFARMED', 'DGS', 'EMA', 'ESC 2024', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} className="lp-badge">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FECHO — bloco escuro sóbrio, sem gradientes ─────────────────────── */}
      <section className="lp-close">
        <div className="lp-wrap">
          <span className="lp-close-no reveal">§ 04</span>
          <h2 className="lp-close-h reveal">Experimente hoje.<br />Decida depois.</h2>
          <p className="lp-close-p reveal">
            O <strong>Base</strong> é grátis e faz o essencial. O <strong>Plus</strong> são 3,99 € por
            mês — tira os anúncios e abre o resto. Cancela quando quiser.
          </p>
          <div className="lp-actions reveal">
            <Link href="/login" className="lp-go lp-go-light">Criar conta grátis</Link>
            <Link href="/pricing" className="lp-link lp-link-dark">Ver os planos&nbsp;→</Link>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-row">
          <span>Phlox — feito em Portugal, 2026</span>
          <div className="lp-foot-links">
            {[['Termos', '/terms'], ['Privacidade', '/privacy'], ['Para instituições', '/institucional']].map(([l, h]) => (
              <Link key={h} href={h}>{l}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        .lp { background:#fff; color:${INK}; font-family:var(--font-sans); overflow-x:hidden; }
        .lp-wrap { max-width:1080px; margin:0 auto; padding:0 clamp(20px,5vw,40px); }
        .lp em { font-style:italic; color:${GREEN}; }

        /* ── HERO ── */
        .lp-hero { padding:clamp(40px,8vh,92px) 0 clamp(40px,6vw,72px); }
        .lp-hero-grid { display:grid; grid-template-columns:1.15fr 0.85fr; gap:clamp(28px,5vw,64px); align-items:start; opacity:0; transform:translateY(14px); transition:opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
        .lp-hero-grid.in { opacity:1; transform:none; }
        .lp-kicker { display:flex; align-items:center; gap:11px; font-family:var(--font-mono,monospace); font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:${INK_4}; font-weight:700; margin-bottom:26px; }
        .lp-kicker-rule { width:34px; height:1.5px; background:${GREEN}; }
        .lp-h1 { font-family:var(--font-serif,Georgia,serif); font-weight:500; font-size:clamp(40px,7.2vw,74px); line-height:1.0; letter-spacing:-.03em; margin:0 0 24px; }
        .lp-lead { font-size:clamp(16px,1.9vw,18.5px); color:${INK_3}; line-height:1.62; max-width:42ch; margin:0 0 30px; }
        .lp-actions { display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
        .lp-go { display:inline-block; padding:15px 28px; background:${INK}; color:#fff; border-radius:2px; text-decoration:none; font-weight:700; font-size:15px; letter-spacing:.01em; transition:background .18s, transform .15s; }
        .lp-go:hover { background:${GREEN}; transform:translateY(-1px); }
        .lp-go-light { background:#fff; color:${INK}; }
        .lp-go-light:hover { background:${PAPER}; color:${INK}; }
        .lp-link { font-size:15px; font-weight:600; color:${INK}; text-decoration:none; border-bottom:1.5px solid ${GREEN}; padding-bottom:2px; transition:color .15s; }
        .lp-link:hover { color:${GREEN}; }
        .lp-link-dark { color:#fff; border-bottom-color:#fff; }
        .lp-meta { font-family:var(--font-mono,monospace); font-size:11.5px; color:${INK_4}; margin-top:22px; letter-spacing:.04em; }

        /* ── Ficha de veredito (herói) — editorial, profundidade subtil ── */
        .vsc { padding:8px 0; }
        .vsc-sheet { background:#fff; border:1px solid ${BORDER}; border-top:3px solid ${INK}; padding:26px 26px 20px; box-shadow:0 24px 50px -28px rgba(20,30,24,.35); transition:transform .3s cubic-bezier(.16,1,.3,1); transform-style:preserve-3d; }
        .vs-tag { font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:${INK_4}; display:block; margin-bottom:16px; }
        .vs-pair { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
        .vs-chip { position:relative; font-family:var(--font-serif,Georgia,serif); font-size:23px; color:${INK}; }
        .vs-plus { margin:0 6px 0 10px; color:${INK_4}; font-family:var(--font-sans); }
        .vs-verdict { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:800; letter-spacing:-.01em; margin-bottom:12px; text-transform:uppercase; font-family:var(--font-mono,monospace); }
        .vs-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .vs-txt { font-size:15.5px; color:${INK}; line-height:1.55; margin:0 0 8px; }
        .vs-alt { font-size:13.5px; color:${INK_4}; line-height:1.55; margin:0; }
        .vsc-switch { display:flex; gap:6px; border-top:1px solid ${BORDER}; padding-top:16px; margin-top:18px; }
        .vs-sw { flex:1; padding:8px 4px; background:none; border:1px solid ${BORDER}; border-radius:2px; font-family:var(--font-mono,monospace); font-size:10px; color:${INK_4}; cursor:pointer; letter-spacing:.02em; transition:all .15s; }
        .vs-sw:hover { border-color:${INK_4}; color:${INK}; }
        .vs-sw.on { border-color:${INK}; color:${INK}; background:${PAPER}; }
        @media (prefers-reduced-motion:reduce) { .vsc-sheet { transition:none; } }

        /* ── Manifesto ── */
        .lp-manifesto { padding:clamp(28px,4vw,44px) 0; }
        .lp-rule { height:1px; background:${BORDER}; margin-bottom:clamp(28px,4vw,44px); }
        .lp-mani-txt { font-family:var(--font-serif,Georgia,serif); font-size:clamp(22px,3.4vw,34px); line-height:1.32; letter-spacing:-.015em; max-width:24ch; color:${INK}; }
        .lp-mani-txt strong { color:${GREEN}; font-weight:500; }

        /* ── Secções ── */
        .lp-sec { padding:clamp(56px,8vw,104px) 0; }
        .lp-sec-paper { background:${PAPER}; border-top:1px solid ${BORDER}; border-bottom:1px solid ${BORDER}; }
        .lp-sec-h { margin-bottom:clamp(32px,5vw,52px); }
        .lp-sec-no { font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.14em; color:${GREEN}; display:block; margin-bottom:14px; }
        .lp-h2 { font-family:var(--font-serif,Georgia,serif); font-weight:500; font-size:clamp(26px,4vw,42px); letter-spacing:-.02em; margin:0 0 8px; line-height:1.1; }
        .lp-sec-sub { font-size:clamp(14.5px,1.6vw,16.5px); color:${INK_4}; margin:0; line-height:1.6; }

        .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(24px,3vw,44px); }
        .lp-step-rule { height:2px; background:${INK}; width:100%; margin-bottom:18px; }
        .lp-step-n { font-family:var(--font-serif,Georgia,serif); font-size:30px; color:${GREEN}; line-height:1; margin-bottom:12px; }
        .lp-step-t { font-size:18px; font-weight:700; margin:0 0 8px; letter-spacing:-.01em; }
        .lp-step-d { font-size:14.5px; color:${INK_3}; line-height:1.62; margin:0; }

        /* Os 5 mundos — cartões de igual peso, cada um com o seu acento */
        .lp-mundos { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; background:${BORDER}; border:1px solid ${BORDER}; }
        .lp-mundo { display:flex; flex-direction:column; background:#fff; padding:24px 22px 22px; text-decoration:none; color:${INK}; border-top:3px solid var(--a); transition:background .2s, transform .15s; }
        .lp-mundo:hover { background:${PAPER}; }
        .lp-mundo-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .lp-mundo-tag { font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--a); font-weight:700; }
        .lp-mundo-n { font-family:var(--font-mono,monospace); font-size:11px; color:${INK_4}; }
        .lp-mundo-t { font-family:var(--font-serif,Georgia,serif); font-weight:500; font-size:clamp(20px,2.4vw,25px); letter-spacing:-.015em; line-height:1.12; margin:0 0 8px; }
        .lp-mundo-lead { font-size:13.5px; color:${INK_3}; line-height:1.5; margin:0 0 16px; }
        .lp-mundo-list { list-style:none; margin:0 0 18px; padding:0; display:flex; flex-direction:column; gap:7px; }
        .lp-mundo-list li { position:relative; padding-left:16px; font-size:13px; color:${INK_3}; line-height:1.45; }
        .lp-mundo-list li::before { content:''; position:absolute; left:0; top:8px; width:7px; height:7px; border-radius:50%; background:var(--a); opacity:.55; }
        .lp-mundo-go { margin-top:auto; font-family:var(--font-mono,monospace); font-size:12px; font-weight:700; color:var(--a); text-transform:uppercase; letter-spacing:.06em; display:inline-flex; align-items:center; gap:7px; }
        .lp-mundo-arrow { transition:transform .2s; }
        .lp-mundo:hover .lp-mundo-arrow { transform:translateX(4px); }
        .lp-mundo-cta { border-top:3px solid ${INK}; background:${INK}; }
        .lp-mundo-cta .lp-mundo-t, .lp-mundo-cta .lp-mundo-lead { color:#fff; }
        .lp-mundo-cta .lp-mundo-lead { color:#a7aeb4; }
        .lp-mundo-cta:hover { background:#0a0d0b; }

        .lp-three { display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(26px,4vw,52px); }
        .lp-feat-k { display:flex; align-items:center; gap:9px; font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:${INK_4}; margin-bottom:16px; }
        .lp-feat-k span { color:${GREEN}; }
        .lp-feat-t { font-family:var(--font-serif,Georgia,serif); font-size:21px; font-weight:500; margin:0 0 10px; letter-spacing:-.01em; line-height:1.2; }
        .lp-feat-d { font-size:14.5px; color:${INK_3}; line-height:1.66; margin:0; }
        .lp-badges { display:flex; gap:8px; flex-wrap:wrap; margin-top:clamp(40px,6vw,64px); padding-top:28px; border-top:1px solid ${BORDER}; }
        .lp-badge { font-family:var(--font-mono,monospace); font-size:11px; color:${INK_4}; padding:5px 12px; border:1px solid ${BORDER}; border-radius:2px; }

        /* ── Fecho escuro sóbrio ── */
        .lp-close { background:${INK}; color:#fff; padding:clamp(64px,9vw,120px) 0; }
        .lp-close-no { font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.14em; color:#5fae87; display:block; margin-bottom:18px; }
        .lp-close-h { font-family:var(--font-serif,Georgia,serif); font-weight:500; font-size:clamp(30px,5vw,54px); letter-spacing:-.025em; line-height:1.06; margin:0 0 20px; }
        .lp-close-p { font-size:16px; color:#a7aeb4; line-height:1.7; max-width:50ch; margin:0 0 30px; }
        .lp-close-p strong { color:#fff; font-weight:600; }

        .lp-foot { background:${INK}; border-top:1px solid #262931; padding:22px 0 30px; }
        .lp-foot-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-family:var(--font-mono,monospace); font-size:11px; color:#6b7079; letter-spacing:.03em; }
        .lp-foot-links { display:flex; gap:20px; }
        .lp-foot-links a { color:#8a909a; text-decoration:none; }
        .lp-foot-links a:hover { color:#c3c8cf; }

        /* ── Reveal (moderno; fallback = visível) ── */
        .reveal { opacity:1; }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .reveal { opacity:0; transform:translateY(20px); animation:lpUp linear both; animation-timeline:view(); animation-range:entry 0% entry 38%; }
          }
        }
        @keyframes lpUp { to { opacity:1; transform:none; } }

        /* ── Responsivo ── */
        @media (max-width:920px) {
          .lp-mundos { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        @media (max-width:860px) {
          .lp-hero-grid { grid-template-columns:1fr; gap:34px; }
          .lp-steps { grid-template-columns:1fr; gap:28px; }
          .lp-three { grid-template-columns:1fr; gap:30px; }
        }
        @media (max-width:560px) {
          .lp-mundos { grid-template-columns:1fr; }
        }
        @media (prefers-reduced-motion:reduce) {
          .lp-hero-grid { transition:none; opacity:1; transform:none; }
          .lp-go,.lp-mundo-arrow { transition:none; }
        }
      `}</style>
    </div>
  )
}
