'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import HeroFlower from '@/components/home/HeroFlower'

// ── Homepage v4 — reconstrução real (2026-07-11) ─────────────────────────────
// A v3 (ato escuro + esferas 3D a orbitar) foi rejeitada com força: "odiei",
// "cores gritam feito por ia", "elemento 3d horroroso", "não há animação ao
// scroll". Diagnóstico e resposta:
//   - Cores: fora o escuro+verde-néon inteiro (essa combinação É o clichê,
//     gradiente ou não) — volta à paleta real e clara do site
//     (`app/globals.css`), zero linear/radial-gradient, zero blur-glow em
//     qualquer sítio da página.
//   - 3D: fora as esferas a orbitar. Entra a flor Phlox (o nome da marca É uma
//     flor) a abrir — objeto único, específico, materiais foscos planos, as 5
//     pétalas SÃO os 5 mundos (mesma cor do cartão correspondente, fio
//     condutor real). Ver components/home/HeroFlower.tsx.
//   - Scroll: a v3 dependia de animation-timeline:view(), uma feature CSS
//     recente que falha em silêncio sem suporte — exatamente "sem animação
//     nenhuma" é o sintoma disso. Trocado por um motor de scroll a JS puro
//     (IntersectionObserver para entradas + getPointAtLength para o traço
//     curvo), que funciona em qualquer browser, sem depender de feature-query.

const MUNDOS = [
  {
    n: '01', tag: 'Para si', t: 'A minha saúde', accent: '#0d6e42', href: '/login?mode=personal',
    lead: 'A sua medicação organizada, a sua saúde debaixo de olho.',
    items: ['Foto à receita → lista e horários automáticos', 'Lembretes que chegam a tempo', 'Vê se os comprimidos se dão bem entre si'],
  },
  {
    n: '02', tag: 'Para a família', t: 'Cuidar de alguém', accent: '#b5502e', href: '/login?mode=caregiver',
    lead: 'A saúde de cada pessoa de quem cuida, num só lugar.',
    items: ['Um perfil por cada familiar', 'Quem tomou o quê, e quando', 'Partilha tudo com o médico por um código'],
  },
  {
    n: '03', tag: 'Para estudar', t: 'Estudante de saúde', accent: '#6b4a8a', href: '/login?mode=student',
    lead: 'Treino a sério para medicina, farmácia e enfermagem.',
    items: ['Arena de casos clínicos com IA', 'OSCE e simulador de decisões', 'O seu progresso, sempre à vista'],
  },
  {
    n: '04', tag: 'Para profissionais', t: 'Trabalho na saúde', accent: '#35618a', href: '/login?mode=clinical',
    lead: 'Decisão clínica com a evidência que se usa em Portugal.',
    items: ['Interações, STOPP/START e critérios de Beers', 'Calculadoras e protocolos (DGS, ESC)', 'Revisão e otimização da medicação'],
  },
  {
    n: '05', tag: 'Para instituições', t: 'Centro de dia e lar', accent: '#2d7268', href: '/centro-de-dia',
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

// ── Motor de scroll (JS puro, sem animation-timeline) ───────────────────────
// 1 IntersectionObserver para todas as entradas .reveal + 1 listener de scroll
// (rAF-throttled) para o traço curvo, que lê a posição real ao longo do <path>
// via getPointAtLength — funciona em qualquer browser, nunca falha em silêncio.
function useScrollEngine(pathRef: React.RefObject<SVGPathElement | null>, dotRef: React.RefObject<SVGCircleElement | null>, trackRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-in'))
    } else {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      els.forEach(el => io.observe(el))
    }

    const path = pathRef.current
    const dot = dotRef.current
    const track = trackRef.current
    let raf = 0
    let total = 0
    if (path) total = path.getTotalLength()

    function update() {
      raf = 0
      if (!path || !dot || !track || !total) return
      const r = track.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh - r.top) / (r.height + vh)))
      const pt = path.getPointAtLength(p * total)
      dot.setAttribute('cx', String(pt.x))
      dot.setAttribute('cy', String(pt.y))
      dot.style.opacity = p > 0.01 && p < 0.995 ? '1' : '0'
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const pathRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useScrollEngine(pathRef, dotRef, trackRef)

  return (
    <div className="lp">
      <noscript><style>{`.reveal{opacity:1!important;transform:none!important;}`}</style></noscript>

      {/* ── HERO — fixo no ecrã enquanto a flor abre, liberta-se no fim ──── */}
      <section className="lp-hero-pin">
        <div className="lp-hero-pin-inner">
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
              <HeroFlower accents={MUNDOS.map(m => m.accent)} />
            </div>
          </div>
        </div>
      </section>

      {/* ── OS 5 MUNDOS — cenas a toda a largura, entram ao scroll ──────── */}
      <section className="lp-worlds" id="mundos">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 01</span>
            <h2 className="lp-h2">Um Phlox para cada pessoa</h2>
            <p className="lp-sec-sub">O site adapta-se a si. Escolha o seu mundo — pode mudar quando quiser. As cores acima são as mesmas pétalas da flor.</p>
          </header>
        </div>
        <div className="lp-pulse-track" ref={trackRef}>
          <svg className="lp-pulse-svg" viewBox="0 0 100 800" preserveAspectRatio="none" aria-hidden="true">
            <path ref={pathRef} className="lp-pulse-path" d="M50 0 C90 50 10 90 50 140 C90 190 10 230 50 280 C90 330 10 370 50 420 C90 470 10 510 50 560 C90 610 10 650 50 700 C80 740 20 770 50 800" />
            <circle ref={dotRef} className="lp-pulse-dot" r="3.2" cx="50" cy="0" style={{ opacity: 0 }} />
          </svg>
          {MUNDOS.map((m, i) => (
            <Link key={m.n} href={m.href} className={`lp-world reveal ${i % 2 === 1 ? 'from-right' : 'from-left'}`} style={{ ['--a' as string]: m.accent }}>
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

      {/* ── COMO SE PROPAGA ── */}
      <section className="lp-sec lp-sec-paper">
        <div className="lp-wrap">
          <header className="lp-sec-h reveal">
            <span className="lp-sec-no">§ 02</span>
            <h2 className="lp-h2">Um cuidado a sério puxa outro</h2>
            <p className="lp-sec-sub">Não construímos cinco produtos separados — construímos uma rede. Veja como um dia no centro chega a quem mais precisa.</p>
          </header>
          <div className="lp-ciclo">
            {CICLO.map((c, idx) => (
              <div key={c.n} className="lp-ciclo-beat reveal">
                <div className="lp-ciclo-n">{c.n}</div>
                <h3 className="lp-ciclo-t">{c.t}</h3>
                <p className="lp-ciclo-d">{c.d}</p>
                {idx < CICLO.length - 1 && <span className="lp-ciclo-arrow" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="lp-sec">
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
      <section className="lp-sec lp-sec-paper">
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

      {/* ── FECHO — bloco escuro sóbrio, sem gradientes (padrão já existente) ── */}
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
        .lp em { font-style:italic; color:var(--green); }

        /* ── HERO — pinado no ecrã durante a abertura da flor (estilo Apple:
           o objeto fica fixo enquanto se desce, liberta-se quando termina) ── */
        .lp-hero-pin { position:relative; height:170vh; }
        .lp-hero-pin-inner { position:sticky; top:0; height:100vh; display:flex; align-items:center; overflow:hidden; }
        .lp-hero-pin-inner .lp-wrap { width:100%; }
        @media (max-width:860px) {
          .lp-hero-pin { height:auto; }
          .lp-hero-pin-inner { position:static; height:auto; padding:clamp(32px,10vh,64px) 0 40px; overflow:visible; }
        }
        .lp-hero-grid { display:grid; grid-template-columns:1.05fr 0.95fr; gap:clamp(28px,5vw,56px); align-items:center; }
        .lp-hero-l { opacity:0; transform:translateY(14px); transition:opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
        .lp-hero-l.in { opacity:1; transform:none; }
        .lp-kicker { display:flex; align-items:center; gap:11px; font-family:var(--font-mono); font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-4); font-weight:700; margin-bottom:26px; }
        .lp-kicker-rule { width:34px; height:1.5px; background:var(--green); }
        .lp-h1 { font-family:var(--font-serif); font-weight:500; font-size:clamp(40px,7.2vw,76px); line-height:1.0; letter-spacing:-.03em; margin:0 0 24px; color:var(--ink); }
        .lp-lead { font-size:clamp(16px,1.9vw,18.5px); color:var(--ink-3); line-height:1.62; max-width:44ch; margin:0 0 30px; }
        .lp-actions { display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
        .lp-go { display:inline-block; padding:15px 28px; background:var(--ink); color:#fff; border-radius:2px; text-decoration:none; font-weight:700; font-size:15px; letter-spacing:.01em; transition:background .18s, transform .15s; }
        .lp-go:hover { background:var(--green); transform:translateY(-1px); }
        .lp-go-light { background:#fff; color:var(--ink); }
        .lp-go-light:hover { background:var(--bg-2); }
        .lp-link { font-size:15px; font-weight:600; color:var(--ink); text-decoration:none; border-bottom:1.5px solid var(--green); padding-bottom:2px; transition:color .15s; }
        .lp-link:hover { color:var(--green); }
        .lp-link-dark { color:#fff; border-bottom-color:#fff; }
        .lp-meta { font-family:var(--font-mono); font-size:11.5px; color:var(--ink-4); margin-top:22px; letter-spacing:.04em; }

        /* ── Flor 3D/SVG do herói ── */
        .flower-wrap { display:flex; align-items:center; justify-content:center; padding:12px; }
        .flower-3d { width:min(100%,420px); aspect-ratio:1; }
        .flower-svg { width:min(100%,340px); aspect-ratio:1; overflow:visible; }
        .flower-petal { transition:none; }

        /* ── OS 5 MUNDOS — cenas a toda a largura ── */
        .lp-worlds { padding:clamp(48px,7vw,88px) 0 clamp(24px,4vw,40px); position:relative; }
        .lp-pulse-track { position:relative; display:flex; flex-direction:column; gap:clamp(20px,3vw,32px); padding:0 clamp(20px,5vw,40px); max-width:1080px; margin:0 auto; }
        .lp-pulse-svg { position:absolute; left:-8px; top:0; width:26px; height:100%; overflow:visible; display:none; }
        @media (min-width:960px) { .lp-pulse-svg { display:block; left:-2px; } }
        .lp-pulse-path { fill:none; stroke:var(--border-2); stroke-width:1.5; }
        .lp-pulse-dot { fill:var(--green); transition:opacity .3s ease; }

        .lp-world { display:flex; align-items:center; gap:clamp(20px,4vw,48px); text-decoration:none; padding:clamp(20px,3vw,32px); border-radius:var(--r-md); border:1px solid var(--border); border-left:3px solid var(--a); background:#fff; transition:border-color .2s, box-shadow .2s, transform .2s; }
        .lp-world:hover { border-color:var(--border-2); border-left-color:var(--a); box-shadow:var(--shadow-md); transform:translateY(-2px); }
        .lp-world-body { width:100%; }
        .lp-world-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .lp-world-tag { font-family:var(--font-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--a); font-weight:700; }
        .lp-world-n { font-family:var(--font-mono); font-size:11px; color:var(--ink-4); }
        .lp-world-t { font-family:var(--font-serif); font-weight:500; font-size:clamp(21px,2.8vw,28px); letter-spacing:-.015em; line-height:1.12; margin:0 0 10px; color:var(--ink); }
        .lp-world-lead { font-size:14px; color:var(--ink-3); line-height:1.55; margin:0 0 16px; max-width:52ch; }
        .lp-world-list { list-style:none; margin:0 0 18px; padding:0; display:flex; flex-direction:column; gap:7px; }
        .lp-world-list li { position:relative; padding-left:16px; font-size:13px; color:var(--ink-3); line-height:1.45; }
        .lp-world-list li::before { content:''; position:absolute; left:0; top:8px; width:6px; height:6px; border-radius:50%; background:var(--a); }
        .lp-world-go { font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--a); text-transform:uppercase; letter-spacing:.06em; display:inline-flex; align-items:center; gap:7px; }
        .lp-world-arrow { transition:transform .2s; }
        .lp-world:hover .lp-world-arrow { transform:translateX(4px); }

        /* ── Reveal — motor JS (IntersectionObserver), sem CSS scroll-timeline ── */
        .reveal { opacity:0; transform:translateY(22px); transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1); }
        .reveal.from-left { transform:translateX(-32px); }
        .reveal.from-right { transform:translateX(32px); }
        .reveal.is-in { opacity:1; transform:none; }

        /* ── Secções ── */
        .lp-sec { padding:clamp(56px,8vw,104px) 0; }
        .lp-sec-paper { background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .lp-sec-h { margin-bottom:clamp(32px,5vw,52px); }
        .lp-sec-no { font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:var(--green); display:block; margin-bottom:14px; }
        .lp-h2 { font-family:var(--font-serif); font-weight:500; font-size:clamp(26px,4vw,42px); letter-spacing:-.02em; margin:0 0 8px; line-height:1.1; color:var(--ink); }
        .lp-sec-sub { font-size:clamp(14.5px,1.6vw,16.5px); color:var(--ink-4); margin:0; line-height:1.6; max-width:60ch; }

        .lp-ciclo { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
        .lp-ciclo-beat { position:relative; padding-right:clamp(12px,2vw,28px); }
        .lp-ciclo-n { font-family:var(--font-mono); font-size:12px; color:var(--green); letter-spacing:.08em; margin-bottom:14px; }
        .lp-ciclo-t { font-family:var(--font-serif); font-weight:500; font-size:clamp(18px,2vw,21px); letter-spacing:-.01em; margin:0 0 8px; line-height:1.2; color:var(--ink); }
        .lp-ciclo-d { font-size:13.5px; color:var(--ink-3); line-height:1.55; margin:0; }
        .lp-ciclo-arrow { position:absolute; top:1px; right:-2px; font-family:var(--font-mono); color:var(--border-2); font-size:16px; }

        .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(24px,3vw,44px); }
        .lp-step-rule { height:2px; background:var(--ink); width:100%; margin-bottom:18px; }
        .lp-step-n { font-family:var(--font-serif); font-size:30px; color:var(--green); line-height:1; margin-bottom:12px; }
        .lp-step-t { font-size:18px; font-weight:700; margin:0 0 8px; letter-spacing:-.01em; }
        .lp-step-d { font-size:14.5px; color:var(--ink-3); line-height:1.62; margin:0; }

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
        .vsc-sheet { background:#fff; border:1px solid var(--border); border-top:3px solid var(--ink); padding:26px 26px 20px; box-shadow:var(--shadow-lg); transition:transform .3s cubic-bezier(.16,1,.3,1); transform-style:preserve-3d; }
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

        /* ── Fecho escuro (bookend — padrão já existente antes da v3) ── */
        .lp-close { background:var(--ink); color:#fff; padding:clamp(64px,9vw,120px) 0; }
        .lp-close-no { font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; color:#5fae87; display:block; margin-bottom:18px; }
        .lp-close-h { font-family:var(--font-serif); font-weight:500; font-size:clamp(30px,5vw,54px); letter-spacing:-.025em; line-height:1.06; margin:0 0 20px; }
        .lp-close-p { font-size:16px; color:#a7aeb4; line-height:1.7; max-width:50ch; margin:0 0 30px; }
        .lp-close-p strong { color:#fff; font-weight:600; }

        /* ── Responsivo ── */
        @media (max-width:860px) {
          .lp-hero-grid { grid-template-columns:1fr; gap:36px; }
          .lp-steps { grid-template-columns:1fr; gap:28px; }
          .lp-ciclo { grid-template-columns:1fr 1fr; gap:28px 20px; }
          .lp-ciclo-beat { padding-right:0; }
          .lp-ciclo-arrow { display:none; }
          .lp-world { flex-direction:column; align-items:flex-start; }
          .lp-proof { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
          .lp-ciclo { grid-template-columns:1fr; }
        }
        @media (prefers-reduced-motion:reduce) {
          .lp-hero-l { transition:none; opacity:1; transform:none; }
          .reveal { opacity:1; transform:none; transition:none; }
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
