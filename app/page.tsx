'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import HeroOrbit from '@/components/home/HeroOrbit'

// ── Homepage v3 — reconstruída DO ZERO (2026-07-11) ─────────────────────────────
// Feedback direto do Fernando à v2: "está igual, mesmas cores, mesmo layout".
// Esta versão muda a sério, mantendo o sentido:
//   - Um "ato escuro" de abertura (hero + os 5 mundos + o ciclo) — paleta nova,
//     dramática, só desta página (ver bloco .lp-act-dark abaixo) — seguido de um
//     "ato claro" de prova prática. Estrutura em atos, não um scroll plano de
//     secções iguais como a v2.
//   - NetworkOrbit: um elemento 3D real (CSS perspective + preserve-3d), os 5
//     mundos em órbita à volta do Phlox — balanço contínuo + entrada "monta-se"
//     ao scroll, na linha do que a Apple faz ao apresentar um produto nas suas
//     páginas (sem WebGL — tudo CSS, com fallback estático via prefers-reduced-
//     motion, que já desliga toda a animação do site, ver globals.css).
//   - Os 5 mundos deixam de ser uma grelha estática — cada um é uma cena a toda
//     a largura que entra ao scroll, alternando o lado.
//   - Um traço curvo (nunca reto) acompanha o scroll pela secção dos mundos via
//     offset-path — um ponto que viaja a curva consoante se desce a página.
//   - Zero dados falsos (regra de sempre). Zero WebGL — tudo CSS moderno com
//     fallback seguro.

const MUNDOS = [
  {
    n: '01', tag: 'Para si', t: 'A minha saúde', accent: '#22c55e', href: '/login?mode=personal',
    lead: 'A sua medicação organizada, a sua saúde debaixo de olho.',
    items: ['Foto à receita → lista e horários automáticos', 'Lembretes que chegam a tempo', 'Vê se os comprimidos se dão bem entre si'],
  },
  {
    n: '02', tag: 'Para a família', t: 'Cuidar de alguém', accent: '#f0a94e', href: '/login?mode=caregiver',
    lead: 'A saúde de cada pessoa de quem cuida, num só lugar.',
    items: ['Um perfil por cada familiar', 'Quem tomou o quê, e quando', 'Partilha tudo com o médico por um código'],
  },
  {
    n: '03', tag: 'Para estudar', t: 'Estudante de saúde', accent: '#a78bfa', href: '/login?mode=student',
    lead: 'Treino a sério para medicina, farmácia e enfermagem.',
    items: ['Arena de casos clínicos com IA', 'OSCE e simulador de decisões', 'O seu progresso, sempre à vista'],
  },
  {
    n: '04', tag: 'Para profissionais', t: 'Trabalho na saúde', accent: '#60a5fa', href: '/login?mode=clinical',
    lead: 'Decisão clínica com a evidência que se usa em Portugal.',
    items: ['Interações, STOPP/START e critérios de Beers', 'Calculadoras e protocolos (DGS, ESC)', 'Revisão e otimização da medicação'],
  },
  {
    n: '05', tag: 'Para instituições', t: 'Centro de dia e lar', accent: '#2dd4bf', href: '/centro-de-dia',
    lead: 'Montado de raiz para o dia inteiro do seu centro.',
    items: ['O dia de cada utente: presenças, medicação, cuidados', 'O portal que as famílias abrem sozinhas', 'Equipa, rondas e stock, tudo num painel'],
  },
]

const CICLO = [
  { n: '01', t: 'O centro regista.', d: 'Presenças, medicação dada, o dia de cada utente — à medida que acontece.' },
  { n: '02', t: 'A família vê.', d: 'Sem telefonar, sem perguntar. O diário do dia, a foto, o que foi feito.' },
  { n: '03', t: 'Torna-se sua.', d: 'A mesma conta abre a porta à própria saúde — e à de quem mais cuida.' },
  { n: '04', t: 'Espalha-se.', d: 'Quem sente o cuidado a sério, mostra-o a mais alguém que precisa.' },
]

const PARES = [
  { a: 'Varfarina', b: 'Ibuprofeno', ok: false, veredito: 'Não misturar', txt: 'O ibuprofeno aumenta o risco de hemorragia em quem toma varfarina.', alt: 'Para as dores, o paracetamol costuma ser mais seguro — confirme com o farmacêutico.' },
  { a: 'Sertralina', b: 'Tramadol', ok: false, veredito: 'Não misturar', txt: 'Juntos podem causar excesso de serotonina, o que é perigoso.', alt: 'Há outras opções para a dor. Fale com o médico antes de combinar.' },
  { a: 'Omeprazol', b: 'Paracetamol', ok: true, veredito: 'Sem problema', txt: 'Não há interação conhecida entre estes dois. Pode tomar com tranquilidade.', alt: '' },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="lp">

      {/* ═══════════════════ ATO I — ESCURO: a visão ═══════════════════════ */}
      <div className="lp-act-dark">

        {/* ── HERO ── */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div className={`lp-hero-l ${mounted ? 'in' : ''}`}>
              <div className="lp-kicker"><span className="lp-kicker-rule" />Saúde em português, para todos</div>
              <h1 className="lp-h1">
                Toda a saúde,<br />numa só <em>rede</em>.
              </h1>
              <p className="lp-lead">
                Para si, para quem cuida da família, para quem estuda, para quem trabalha na saúde —
                e para o centro de dia ou lar que cuida de todos eles. Cada um com o Phlox à sua
                medida, todos ligados.
              </p>
              <div className="lp-actions">
                <Link href="/login" className="lp-go">Criar conta grátis</Link>
                <Link href="#mundos" className="lp-link">Ver o que faz&nbsp;↓</Link>
              </div>
              <div className="lp-meta">Grátis · Sem instalar · Um minuto a começar</div>
            </div>
            <div className="lp-hero-r">
              <HeroOrbit nodes={MUNDOS} />
            </div>
          </div>
        </section>

        {/* ── OS 5 MUNDOS — cenas a toda a largura, entram ao scroll ──────── */}
        <section className="lp-worlds" id="mundos">
          <div className="lp-wrap">
            <header className="lp-sec-h dark reveal">
              <span className="lp-sec-no">§ 01</span>
              <h2 className="lp-h2 light">Um Phlox para cada pessoa</h2>
              <p className="lp-sec-sub light">O site adapta-se a si. Escolha o seu mundo — pode mudar quando quiser.</p>
            </header>
          </div>
          <div className="lp-pulse-track">
            <svg className="lp-pulse-svg" viewBox="0 0 100 800" preserveAspectRatio="none" aria-hidden="true">
              <path className="lp-pulse-path" d="M50 0 C90 50 10 90 50 140 C90 190 10 230 50 280 C90 330 10 370 50 420 C90 470 10 510 50 560 C90 610 10 650 50 700 C80 740 20 770 50 800" />
              <circle className="lp-pulse-dot" r="4" />
            </svg>
            {MUNDOS.map((m, i) => (
              <Link key={m.n} href={m.href} className={`lp-world reveal ${i % 2 === 1 ? 'from-right' : 'from-left'}`} style={{ ['--a' as string]: m.accent }}>
                <div className="lp-world-glow" />
                <div className="lp-world-body">
                  <div className="lp-world-top">
                    <span className="lp-world-tag">{m.tag}</span>
                    <span className="lp-world-n">{m.n}</span>
                  </div>
                  <h3 className="lp-world-t">{m.t}</h3>
                  <p className="lp-world-lead">{m.lead}</p>
                  <ul className="lp-world-list">
                    {m.items.map(it => <li key={it}>{it}</li>)}
                  </ul>
                  <span className="lp-world-go">Entrar <span className="lp-world-arrow">→</span></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── COMO SE PROPAGA — a história real e diferenciada ────────────── */}
        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-sec-h dark reveal">
              <span className="lp-sec-no">§ 02</span>
              <h2 className="lp-h2 light">Um cuidado a sério puxa outro</h2>
              <p className="lp-sec-sub light">Não construímos cinco produtos separados — construímos uma rede. Veja como um dia no centro chega a quem mais precisa.</p>
            </header>
            <div className="lp-ciclo">
              {CICLO.map((c, idx) => (
                <div key={c.n} className="lp-ciclo-beat reveal">
                  <div className="lp-ciclo-n">{c.n}</div>
                  <h3 className="lp-ciclo-t light">{c.t}</h3>
                  <p className="lp-ciclo-d">{c.d}</p>
                  {idx < CICLO.length - 1 && <span className="lp-ciclo-arrow" aria-hidden="true">→</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ═══════════════════ ATO II — CLARO: a prova ═══════════════════════ */}

      {/* ── COMO FUNCIONA ── */}
      <section className="lp-sec lp-sec-quiet">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 03</span>
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

      {/* ── Manifesto ── */}
      <section className="lp-manifesto">
        <div className="lp-wrap">
          <div className="lp-rule" />
          <p className="lp-mani-txt reveal">
            Conhece o Ben-u-ron, o Brufen e o Concor pelo nome.
            Segue as regras do <strong>INFARMED</strong>. Fala como o seu farmacêutico.
          </p>
        </div>
      </section>

      {/* ── O QUE GANHA + prova real (demo interativa) ──────────────────── */}
      <section className="lp-sec lp-sec-quiet">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 04</span>
            <h2 className="lp-h2">O que ganha</h2>
          </header>
          <div className="lp-proof">
            <div className="lp-three">
              {[
                { k: 'Foto', t: 'A caixa diz tudo', d: 'Fotografe a receita ou a caixa. Em segundos, sabe o que é, para que serve, e como e quando tomar.' },
                { k: 'Pergunta', t: 'Tire a dúvida agora', d: '«Posso tomar com café?» «Falhei uma dose — e agora?» Perguntas simples, respostas diretas, em português.' },
                { k: 'Aviso', t: 'Antes de virar problema', d: 'Dois medicamentos que não se dão bem, uma toma esquecida há dias — avisamo-lo a tempo de agir.' },
              ].map((x, idx) => (
                <div key={x.t} className="lp-feat reveal">
                  <div className="lp-feat-k"><span>0{idx + 1}</span>{x.k}</div>
                  <h3 className="lp-feat-t">{x.t}</h3>
                  <p className="lp-feat-d">{x.d}</p>
                </div>
              ))}
            </div>
            <VerdictScene />
          </div>
          <div className="lp-badges reveal">
            {['INFARMED', 'DGS', 'EMA', 'ESC 2024', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} className="lp-badge">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FECHO — bookend escuro ═══════════════════════ */}
      <section className="lp-close">
        <div className="lp-wrap">
          <span className="lp-close-no reveal">§ 05</span>
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

      <style>{`
        .lp { background:var(--bg); color:var(--ink); font-family:var(--font-sans); overflow-x:hidden; }
        .lp-wrap { max-width:1080px; margin:0 auto; padding:0 clamp(20px,5vw,40px); }
        .lp em { font-style:italic; color:#4ade80; }

        /* ── Paleta escura, só desta página — o "ato" de abertura ── */
        .lp-act-dark { background:#080b09; position:relative; }
        .lp-act-dark::after { content:''; position:absolute; inset:0 0 auto 0; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent); }

        /* ── HERO ── */
        .lp-hero { padding:clamp(64px,11vh,120px) 0 clamp(40px,6vw,64px); }
        .lp-hero-grid { display:grid; grid-template-columns:1.05fr 0.95fr; gap:clamp(28px,5vw,56px); align-items:center; }
        .lp-hero-l { opacity:0; transform:translateY(14px); transition:opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
        .lp-hero-l.in { opacity:1; transform:none; }
        .lp-kicker { display:flex; align-items:center; gap:11px; font-family:var(--font-mono); font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,0.45); font-weight:700; margin-bottom:26px; }
        .lp-kicker-rule { width:34px; height:1.5px; background:#4ade80; }
        .lp-h1 { font-family:var(--font-serif); font-weight:500; font-size:clamp(40px,7.2vw,74px); line-height:1.0; letter-spacing:-.03em; margin:0 0 24px; color:#fff; }
        .lp-lead { font-size:clamp(16px,1.9vw,18.5px); color:rgba(255,255,255,0.62); line-height:1.62; max-width:44ch; margin:0 0 30px; }
        .lp-actions { display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
        .lp-go { display:inline-block; padding:15px 28px; background:#4ade80; color:#052e16; border-radius:3px; text-decoration:none; font-weight:800; font-size:15px; letter-spacing:.01em; transition:background .18s, transform .15s, box-shadow .18s; box-shadow:0 0 0 rgba(74,222,128,0); }
        .lp-go:hover { background:#6ee7a0; transform:translateY(-1px); box-shadow:0 8px 30px -8px rgba(74,222,128,0.5); }
        .lp-go-light { background:#fff; color:var(--ink); }
        .lp-go-light:hover { background:var(--bg-2); box-shadow:none; }
        .lp-link { font-size:15px; font-weight:600; color:#fff; text-decoration:none; border-bottom:1.5px solid #4ade80; padding-bottom:2px; transition:opacity .15s; }
        .lp-link:hover { opacity:.75; }
        .lp-link-dark { color:#fff; border-bottom-color:#fff; }
        .lp-meta { font-family:var(--font-mono); font-size:11.5px; color:rgba(255,255,255,0.35); margin-top:22px; letter-spacing:.04em; }

        /* ── NetworkOrbit — o elemento 3D ── */
        .orbit-wrap { display:flex; align-items:center; justify-content:center; padding:20px 0; opacity:0; transform:scale(.85) translateY(24px); }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .orbit-wrap { animation:orbitReveal linear both; animation-timeline:view(); animation-range:entry 0% entry 60%; }
          }
        }
        @keyframes orbitReveal { to { opacity:1; transform:scale(1) translateY(0); } }
        .orbit-stage { perspective:900px; width:min(100%,420px); aspect-ratio:1; position:relative; }
        .orbit-ring { position:absolute; inset:0; transform-style:preserve-3d; animation:orbitSway 16s ease-in-out infinite; }
        @keyframes orbitSway {
          0%,100% { transform:rotateX(58deg) rotateZ(-8deg); }
          50%     { transform:rotateX(62deg) rotateZ(8deg); }
        }
        .orbit-core { position:absolute; top:50%; left:50%; width:64px; height:64px; margin:-32px 0 0 -32px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #1a2e22, #081a10); border:1px solid rgba(74,222,128,0.35); display:flex; align-items:center; justify-content:center; box-shadow:0 0 40px -6px rgba(74,222,128,0.4), inset 0 0 20px rgba(0,0,0,0.5); }
        .orbit-core-mark { font-family:var(--font-serif); font-size:26px; color:#4ade80; line-height:1; }
        .orbit-node { position:absolute; top:50%; left:50%; width:0; height:0;
          transform:translate(-50%,-50%) rotate(calc(var(--i) * 72deg)) translateY(-150px) rotate(calc(var(--i) * -72deg));
          display:flex; flex-direction:column; align-items:center; gap:8px; white-space:nowrap;
          opacity:0; }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .orbit-node { animation:nodeIn linear both; animation-timeline:view(); animation-range:entry calc(10% + var(--i) * 8%) entry calc(55% + var(--i) * 8%); }
          }
        }
        @media (prefers-reduced-motion:reduce) { .orbit-node { opacity:1; } }
        @keyframes nodeIn { to { opacity:1; } }
        .orbit-node-dot { width:13px; height:13px; border-radius:50%; background:var(--accent); box-shadow:0 0 16px 2px var(--accent); border:2px solid rgba(255,255,255,0.5); }
        .orbit-node-label { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.08em; color:rgba(255,255,255,0.75); text-transform:uppercase; background:rgba(8,11,9,0.7); padding:3px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); }
        @media (prefers-reduced-motion:reduce) { .orbit-ring, .orbit-wrap { animation:none !important; opacity:1 !important; transform:rotateX(58deg) !important; } }

        /* ── Secções escuras (headers) ── */
        .lp-sec-h.dark .lp-sec-no { color:#4ade80; }
        .lp-h2.light { color:#fff; }
        .lp-sec-sub.light { color:rgba(255,255,255,0.5); }
        .lp-ciclo-t.light { color:#fff; }

        /* ── OS 5 MUNDOS — cenas a toda a largura ── */
        .lp-worlds { padding:clamp(48px,7vw,88px) 0 clamp(24px,4vw,40px); position:relative; }
        .lp-pulse-track { position:relative; display:flex; flex-direction:column; gap:clamp(20px,3vw,32px); padding:0 clamp(20px,5vw,40px); max-width:1080px; margin:0 auto; }
        .lp-pulse-svg { position:absolute; left:-8px; top:0; width:26px; height:100%; overflow:visible; display:none; }
        @media (min-width:960px) { .lp-pulse-svg { display:block; left:-2px; } }
        .lp-pulse-path { fill:none; stroke:rgba(255,255,255,0.14); stroke-width:1.5; }
        .lp-pulse-dot { fill:#4ade80; filter:drop-shadow(0 0 6px #4ade80); offset-path:path('M50 0 C90 50 10 90 50 140 C90 190 10 230 50 280 C90 330 10 370 50 420 C90 470 10 510 50 560 C90 610 10 650 50 700 C80 740 20 770 50 800'); offset-distance:0%; }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .lp-pulse-dot { animation:pulseTravel linear both; animation-timeline:view(); animation-range:cover 0% cover 100%; }
          }
        }
        @keyframes pulseTravel { from { offset-distance:0%; } to { offset-distance:100%; } }

        .lp-world { display:flex; align-items:center; gap:clamp(20px,4vw,48px); text-decoration:none; padding:clamp(20px,3vw,32px); border-radius:14px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); position:relative; overflow:hidden; transition:border-color .2s, background .2s, transform .2s; }
        .lp-world:hover { border-color:rgba(255,255,255,0.18); background:rgba(255,255,255,0.045); transform:translateY(-2px); }
        .lp-world-glow { position:absolute; width:280px; height:280px; border-radius:50%; background:var(--a); opacity:0.14; filter:blur(70px); top:50%; right:-80px; transform:translateY(-50%); pointer-events:none; }
        .lp-world-body { position:relative; z-index:1; width:100%; }
        .lp-world-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .lp-world-tag { font-family:var(--font-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--a); font-weight:700; }
        .lp-world-n { font-family:var(--font-mono); font-size:11px; color:rgba(255,255,255,0.3); }
        .lp-world-t { font-family:var(--font-serif); font-weight:500; font-size:clamp(21px,2.8vw,28px); letter-spacing:-.015em; line-height:1.12; margin:0 0 10px; color:#fff; }
        .lp-world-lead { font-size:14px; color:rgba(255,255,255,0.6); line-height:1.55; margin:0 0 16px; max-width:52ch; }
        .lp-world-list { list-style:none; margin:0 0 18px; padding:0; display:flex; flex-direction:column; gap:7px; }
        .lp-world-list li { position:relative; padding-left:16px; font-size:13px; color:rgba(255,255,255,0.5); line-height:1.45; }
        .lp-world-list li::before { content:''; position:absolute; left:0; top:8px; width:6px; height:6px; border-radius:50%; background:var(--a); }
        .lp-world-go { font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--a); text-transform:uppercase; letter-spacing:.06em; display:inline-flex; align-items:center; gap:7px; }
        .lp-world-arrow { transition:transform .2s; }
        .lp-world:hover .lp-world-arrow { transform:translateX(4px); }
        .lp-world.from-left { opacity:0; transform:translateX(-36px); }
        .lp-world.from-right { opacity:0; transform:translateX(36px); }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .lp-world.from-left, .lp-world.from-right { animation:worldInL linear both; animation-timeline:view(); animation-range:entry 0% entry 45%; }
            .lp-world.from-right { animation-name:worldInR; }
          }
        }
        @keyframes worldInL { to { opacity:1; transform:none; } }
        @keyframes worldInR { to { opacity:1; transform:none; } }

        /* ── Secções ── */
        .lp-sec { padding:clamp(56px,8vw,104px) 0; }
        .lp-sec-quiet { background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .lp-sec-h { margin-bottom:clamp(32px,5vw,52px); }
        .lp-sec-no { font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:var(--green); display:block; margin-bottom:14px; }
        .lp-h2 { font-family:var(--font-serif); font-weight:500; font-size:clamp(26px,4vw,42px); letter-spacing:-.02em; margin:0 0 8px; line-height:1.1; color:var(--ink); }
        .lp-sec-sub { font-size:clamp(14.5px,1.6vw,16.5px); color:var(--ink-4); margin:0; line-height:1.6; max-width:60ch; }

        .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(24px,3vw,44px); }
        .lp-step-rule { height:2px; background:var(--ink); width:100%; margin-bottom:18px; }
        .lp-step-n { font-family:var(--font-serif); font-size:30px; color:var(--green); line-height:1; margin-bottom:12px; }
        .lp-step-t { font-size:18px; font-weight:700; margin:0 0 8px; letter-spacing:-.01em; }
        .lp-step-d { font-size:14.5px; color:var(--ink-3); line-height:1.62; margin:0; }

        /* Ciclo — dentro do ato escuro */
        .lp-ciclo { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
        .lp-ciclo-beat { position:relative; padding-right:clamp(12px,2vw,28px); opacity:0; transform:translateY(18px); }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .lp-ciclo-beat { animation:lpUp linear both; animation-timeline:view(); animation-range:entry 0% entry 45%; }
          }
        }
        .lp-ciclo-n { font-family:var(--font-mono); font-size:12px; color:#4ade80; letter-spacing:.08em; margin-bottom:14px; }
        .lp-ciclo-t { font-family:var(--font-serif); font-weight:500; font-size:clamp(18px,2vw,21px); letter-spacing:-.01em; margin:0 0 8px; line-height:1.2; }
        .lp-ciclo-d { font-size:13.5px; color:rgba(255,255,255,0.55); line-height:1.55; margin:0; }
        .lp-ciclo-arrow { position:absolute; top:1px; right:-2px; font-family:var(--font-mono); color:rgba(255,255,255,0.2); font-size:16px; }

        /* ── Manifesto ── */
        .lp-manifesto { padding:clamp(28px,4vw,44px) 0; }
        .lp-rule { height:1px; background:var(--border); margin-bottom:clamp(28px,4vw,44px); }
        .lp-mani-txt { font-family:var(--font-serif); font-size:clamp(22px,3.4vw,34px); line-height:1.32; letter-spacing:-.015em; max-width:24ch; color:var(--ink); }
        .lp-mani-txt strong { color:var(--green); font-weight:500; }

        /* ── Prova: 3 colunas + demo interativa lado a lado ── */
        .lp-proof { display:grid; grid-template-columns:1fr 1fr; gap:clamp(32px,5vw,64px); align-items:start; margin-bottom:clamp(40px,6vw,64px); }
        .lp-three { display:flex; flex-direction:column; gap:clamp(22px,3vw,32px); }
        .lp-feat-k { display:flex; align-items:center; gap:9px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-4); margin-bottom:10px; }
        .lp-feat-k span { color:var(--green); }
        .lp-feat-t { font-family:var(--font-serif); font-size:19px; font-weight:500; margin:0 0 8px; letter-spacing:-.01em; line-height:1.2; }
        .lp-feat-d { font-size:14px; color:var(--ink-3); line-height:1.6; margin:0; }
        .lp-badges { display:flex; gap:8px; flex-wrap:wrap; padding-top:28px; border-top:1px solid var(--border); }
        .lp-badge { font-family:var(--font-mono); font-size:11px; color:var(--ink-4); padding:5px 12px; border:1px solid var(--border); border-radius:2px; }

        /* ── Ficha de veredito — demo interativa (prova real) ── */
        .vsc { padding:8px 0; }
        .vsc-sheet { background:#fff; border:1px solid var(--border); border-top:3px solid var(--ink); padding:26px 26px 20px; box-shadow:0 24px 50px -28px rgba(22,24,29,.4); transition:transform .3s cubic-bezier(.16,1,.3,1); transform-style:preserve-3d; }
        .vs-tag { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-4); display:block; margin-bottom:16px; }
        .vs-pair { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
        .vs-chip { position:relative; font-family:var(--font-serif); font-size:23px; color:var(--ink); }
        .vs-plus { margin:0 6px 0 10px; color:var(--ink-4); font-family:var(--font-sans); }
        .vs-verdict { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:800; letter-spacing:-.01em; margin-bottom:12px; text-transform:uppercase; font-family:var(--font-mono); }
        .vs-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .vs-txt { font-size:15.5px; color:var(--ink); line-height:1.55; margin:0 0 8px; }
        .vs-alt { font-size:13.5px; color:var(--ink-4); line-height:1.55; margin:0; }
        .vsc-switch { display:flex; gap:6px; border-top:1px solid var(--border); padding-top:16px; margin-top:18px; }
        .vs-sw { flex:1; padding:8px 4px; background:none; border:1px solid var(--border); border-radius:2px; font-family:var(--font-mono); font-size:10px; color:var(--ink-4); cursor:pointer; letter-spacing:.02em; transition:all .15s; }
        .vs-sw:hover { border-color:var(--ink-4); color:var(--ink); }
        .vs-sw.on { border-color:var(--ink); color:var(--ink); background:var(--bg-2); }

        /* ── Fecho escuro (bookend) ── */
        .lp-close { background:#080b09; color:#fff; padding:clamp(64px,9vw,120px) 0; }
        .lp-close-no { font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:#4ade80; display:block; margin-bottom:18px; }
        .lp-close-h { font-family:var(--font-serif); font-weight:500; font-size:clamp(30px,5vw,54px); letter-spacing:-.025em; line-height:1.06; margin:0 0 20px; }
        .lp-close-p { font-size:16px; color:rgba(255,255,255,0.55); line-height:1.7; max-width:50ch; margin:0 0 30px; }
        .lp-close-p strong { color:#fff; font-weight:600; }

        /* ── Reveal (fallback seguro) ── */
        .reveal { opacity:1; }
        @supports (animation-timeline:view()) {
          @media (prefers-reduced-motion:no-preference) {
            .reveal { opacity:0; transform:translateY(20px); animation:lpUp linear both; animation-timeline:view(); animation-range:entry 0% entry 38%; }
          }
        }
        @keyframes lpUp { to { opacity:1; transform:none; } }

        /* ── Responsivo ── */
        @media (max-width:860px) {
          .lp-hero-grid { grid-template-columns:1fr; gap:40px; text-align:left; }
          .lp-steps { grid-template-columns:1fr; gap:28px; }
          .lp-ciclo { grid-template-columns:1fr 1fr; gap:28px 20px; }
          .lp-ciclo-beat { padding-right:0; }
          .lp-ciclo-arrow { display:none; }
          .lp-world { flex-direction:column; align-items:flex-start; }
          .lp-proof { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
          .lp-ciclo { grid-template-columns:1fr; }
          .orbit-stage { width:280px; }
          .orbit-node { transform:translate(-50%,-50%) rotate(calc(var(--i) * 72deg)) translateY(-108px) rotate(calc(var(--i) * -72deg)); }
        }
        @media (prefers-reduced-motion:reduce) {
          .lp-hero-l { transition:none; opacity:1; transform:none; }
          .lp-go,.lp-world-arrow { transition:none; }
          .lp-world.from-left, .lp-world.from-right { opacity:1; transform:none; }
        }
      `}</style>
    </div>
  )
}

// O herói da prova: a resposta REAL do produto, como uma ficha de revista
// clínica. Profundidade subtil (sombra + leve inclinação ao ponteiro).
function VerdictScene() {
  const [i, setI] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const p = PARES[i]
  const accent = p.ok ? 'var(--green)' : 'var(--red)'

  function onMove(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 3.5, y: px * 4.5 })
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
