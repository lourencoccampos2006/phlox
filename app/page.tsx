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
function VerdictSheet() {
  const [i, setI] = useState(0)
  const p = PARES[i]
  const accent = p.ok ? GREEN : RED
  return (
    <div className="vs">
      <div className="vs-head">
        <span className="vs-tag">Verificação · em tempo real</span>
        <div className="vs-pair">
          {[p.a, p.b].map((n, k) => (
            <span key={n} className="vs-chip">{n}{k === 0 && <span className="vs-plus">+</span>}</span>
          ))}
        </div>
      </div>
      <div className="vs-verdict" style={{ color: accent }}>
        <span className="vs-dot" style={{ background: accent }} />
        {p.veredito}
      </div>
      <p className="vs-txt">{p.txt}</p>
      {p.alt && <p className="vs-alt">{p.alt}</p>}
      <div className="vs-switch">
        {PARES.map((x, k) => (
          <button key={k} onClick={() => setI(k)} className={`vs-sw ${i === k ? 'on' : ''}`} aria-label={`${x.a} e ${x.b}`}>
            {x.a.slice(0, 4)}·{x.b.slice(0, 4)}
          </button>
        ))}
      </div>
    </div>
  )
}

const CAMINHOS = [
  { n: '01', t: 'A minha medicação', d: 'Guardar os comprimidos, ter lembretes e ver se se dão bem.', href: '/login?mode=personal' },
  { n: '02', t: 'Cuidar de alguém', d: 'Organizar a medicação de um familiar, tudo num só sítio.', href: '/login?mode=caregiver' },
  { n: '03', t: 'Estudar saúde', d: 'Casos, quizzes e treino para medicina, farmácia ou enfermagem.', href: '/login?mode=student' },
  { n: '04', t: 'Um centro de dia', d: 'O dia dos utentes e as famílias tranquilas, montado de raiz.', href: '/centro-de-dia' },
  { n: '05', t: 'Trabalho em saúde', d: 'Ferramentas a sério para farmácia, lar ou clínica.', href: '/login?mode=clinical' },
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
              <div className="lp-kicker"><span className="lp-kicker-rule" />Saúde, em português claro</div>
              <h1 className="lp-h1">
                Saber o que<br />tomar deixou<br />de ser <em>confuso</em>.
              </h1>
              <p className="lp-lead">
                Tire uma foto à receita. O Phlox diz-lhe o que é cada comprimido, a que horas
                tomar, e se se dão bem uns com os outros. Feito para qualquer pessoa.
              </p>
              <div className="lp-actions">
                <Link href="/login" className="lp-go">Criar conta grátis</Link>
                <Link href="/interactions" className="lp-link">Experimentar sem conta&nbsp;→</Link>
              </div>
              <div className="lp-meta">Sem cartão · Sem instalar · Pronto num minuto</div>
            </div>
            <div className="lp-hero-r">
              <VerdictSheet />
            </div>
          </div>
        </div>
      </section>

      {/* ── Filete + frase-manifesto ────────────────────────────────────────── */}
      <section className="lp-manifesto">
        <div className="lp-wrap">
          <div className="lp-rule" />
          <p className="lp-mani-txt reveal">
            As apps lá de fora tropeçam nos nomes de marca e no SNS.
            <strong> Esta não.</strong> Os medicamentos são os das farmácias cá, as regras
            são as do INFARMED, e a linguagem é a sua.
          </p>
        </div>
      </section>

      {/* ── COMO FUNCIONA — índice numerado, Swiss ──────────────────────────── */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 01</span>
            <h2 className="lp-h2">Como funciona</h2>
            <p className="lp-sec-sub">Três passos. Não precisa de saber nada de tecnologia.</p>
          </header>
          <div className="lp-steps">
            {[
              { n: '1', t: 'Crie uma conta', d: 'Menos de um minuto. Só precisa de um email — sem cartão, sem instalar nada.' },
              { n: '2', t: 'Diga o que precisa', d: 'Cuidar de si, de um familiar, ou estudar? O Phlox arruma tudo à sua volta.' },
              { n: '3', t: 'Comece a usar', d: 'Tire foto à receita, faça uma pergunta. A entrada mostra sempre o passo seguinte.' },
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

      {/* ── CAMINHOS — lista editorial com números de índice ────────────────── */}
      <section className="lp-sec lp-sec-paper">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 02</span>
            <h2 className="lp-h2">O que o traz aqui?</h2>
            <p className="lp-sec-sub">Escolha um. Pode mudar quando quiser.</p>
          </header>
          <div className="lp-paths">
            {CAMINHOS.map(c => (
              <Link key={c.n} href={c.href} className="lp-path reveal">
                <span className="lp-path-n">{c.n}</span>
                <span className="lp-path-body">
                  <span className="lp-path-t">{c.t}</span>
                  <span className="lp-path-d">{c.d}</span>
                </span>
                <span className="lp-path-arrow">→</span>
              </Link>
            ))}
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
              { k: 'Foto', t: 'Tira uma foto, e está feito', d: 'Foto da receita ou da caixa e o Phlox lê tudo: que medicamento é, para que serve, e cria a sua lista.' },
              { k: 'Voz', t: 'Pergunte o que quiser', d: 'Posso tomar com álcool? Esqueci-me de uma dose, e agora? Respostas claras, sem o palavreado das bulas.' },
              { k: 'Aviso', t: 'Avisa antes do problema', d: 'O Phlox olha pela sua medicação e diz-lhe o que merece atenção, mesmo sem ter de perguntar.' },
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
          <h2 className="lp-close-h reveal">Comece de graça.<br />Pague só se gostar.</h2>
          <p className="lp-close-p reveal">
            O plano <strong>Base</strong> é grátis e tem o essencial. O <strong>Plus</strong>, a 3,99 €
            por mês, tira os anúncios e desbloqueia o resto. Cancela quando quiser, sem letras pequeninas.
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

        /* ── Ficha de veredito (herói) ── */
        .vs { border:1px solid ${BORDER}; border-top:3px solid ${INK}; background:#fff; padding:24px 24px 20px; box-shadow:0 1px 0 ${BORDER}; }
        .vs-head { display:flex; flex-direction:column; gap:14px; margin-bottom:18px; }
        .vs-tag { font-family:var(--font-mono,monospace); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:${INK_4}; }
        .vs-pair { display:flex; flex-wrap:wrap; gap:8px; }
        .vs-chip { position:relative; font-family:var(--font-serif,Georgia,serif); font-size:21px; color:${INK}; }
        .vs-plus { margin:0 6px 0 10px; color:${INK_4}; font-family:var(--font-sans); }
        .vs-verdict { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:800; letter-spacing:-.01em; margin-bottom:12px; text-transform:uppercase; font-family:var(--font-mono,monospace); }
        .vs-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .vs-txt { font-size:15.5px; color:${INK}; line-height:1.55; margin:0 0 8px; }
        .vs-alt { font-size:13.5px; color:${INK_4}; line-height:1.55; margin:0 0 18px; }
        .vs-switch { display:flex; gap:6px; border-top:1px solid ${BORDER}; padding-top:14px; }
        .vs-sw { flex:1; padding:7px 4px; background:none; border:1px solid ${BORDER}; border-radius:2px; font-family:var(--font-mono,monospace); font-size:10px; color:${INK_4}; cursor:pointer; letter-spacing:.02em; transition:all .15s; }
        .vs-sw.on { border-color:${INK}; color:${INK}; background:${PAPER}; }

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

        .lp-paths { border-top:1px solid ${BORDER}; }
        .lp-path { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:clamp(16px,3vw,32px); padding:clamp(20px,3vw,28px) 4px; border-bottom:1px solid ${BORDER}; text-decoration:none; color:${INK}; transition:padding-left .25s ease, background .2s; }
        .lp-path:hover { padding-left:16px; background:rgba(13,110,66,0.025); }
        .lp-path-n { font-family:var(--font-mono,monospace); font-size:12px; color:${INK_4}; letter-spacing:.06em; }
        .lp-path-t { display:block; font-family:var(--font-serif,Georgia,serif); font-size:clamp(19px,2.6vw,26px); letter-spacing:-.01em; margin-bottom:3px; }
        .lp-path-d { display:block; font-size:13.5px; color:${INK_4}; line-height:1.5; }
        .lp-path-arrow { font-size:20px; color:${INK_4}; transition:transform .25s, color .2s; }
        .lp-path:hover .lp-path-arrow { transform:translateX(5px); color:${GREEN}; }

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
        @media (max-width:860px) {
          .lp-hero-grid { grid-template-columns:1fr; gap:34px; }
          .lp-steps { grid-template-columns:1fr; gap:28px; }
          .lp-three { grid-template-columns:1fr; gap:30px; }
          .lp-path { grid-template-columns:auto 1fr auto; }
        }
        @media (prefers-reduced-motion:reduce) {
          .lp-hero-grid { transition:none; opacity:1; transform:none; }
          .lp-path,.lp-go,.lp-path-arrow { transition:none; }
        }
      `}</style>
    </div>
  )
}
