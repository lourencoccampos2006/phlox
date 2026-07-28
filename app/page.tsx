import Link from 'next/link'
import Petal from '@/components/home/Petal'
import Reveal from '@/components/home/Reveal'

// ── Homepage — reescrita por completo (2026-07-13), movimento moderado
// acrescentado depois (2026-07-21) ──────────────────────────────────────────
// Depois de duas tentativas de herói 3D (ver memória de projeto), Fernando
// decidiu: zero grelhas de cartões, zero frases de bandeja ("cuidado com quem
// já sabe do que fala", listar marcas para parecer que se sabe do assunto,
// símbolos "§" a fingir rigor suíço). Esta versão:
//   - copy mais curta e direta, sem alegações vagas;
//   - a flor da marca ("Phlox") como assinatura gráfica própria (glifo de 5
//     pétalas desenhado à mão, components/home/Petal.tsx) em vez de um
//     pacote de ícones genérico — usado como acento decorativo no herói e
//     como ícone de cada "mundo";
//   - "os 5 mundos" e "o ciclo" deixam de ser grelhas de cartões iguais e
//     passam a listas editoriais / tiras de processo ligadas por um traço
//     fino — cada secção com a sua própria lógica de layout, não o mesmo
//     molde repetido 4 vezes;
//   - 2026-07-21: a versão "zero animações" ficava direita a mais. Movimento
//     MODERADO e orquestrado (não 3D, não scroll-jacking): o herói entra em
//     cascata curta ao carregar, cada secção seguinte revela-se (fade + subida
//     curta) ao chegar ao ecrã (components/home/Reveal.tsx, um padrão só,
//     repetido), e a flor de fundo do herói roda devagar, como algo vivo.
// Zero dados falsos: sem testemunhos/logótipos fabricados.

const PARES = [
  { a: 'Varfarina', b: 'Ibuprofeno', ok: false, veredito: 'Não misturar', txt: 'O ibuprofeno aumenta o risco de hemorragia em quem toma varfarina.', alt: 'Para as dores, o paracetamol costuma ser mais seguro — confirme com o farmacêutico.' },
]

function VerdictCard() {
  const p = PARES[0]
  const accent = p.ok ? 'var(--green)' : 'var(--red)'
  return (
    <div className="vsc">
      <div className="vs-tag">Verificação real</div>
      <div className="vs-pair">
        {[p.a, p.b].map((n, k) => (
          <span key={n} className="vs-chip">{n}{k === 0 && <span className="vs-plus">+</span>}</span>
        ))}
      </div>
      <div className="vs-verdict" style={{ color: accent }}>
        <span className="vs-dot" style={{ background: accent }} />{p.veredito}
      </div>
      <p className="vs-txt">{p.txt}</p>
      <p className="vs-alt">{p.alt}</p>
    </div>
  )
}

const PASSOS = [
  { n: '1', t: 'Crie a conta', d: 'Um email, sem cartão.' },
  { n: '2', t: 'Fotografe a receita', d: 'Tiramos os medicamentos, doses e horários.' },
  { n: '3', t: 'Deixe connosco', d: 'Avisamos do que importa.' },
]

const MUNDOS = [
  {
    tag: 'Para lares e centros de dia', t: 'A instituição', accent: '#0f766e', href: '/centro-de-dia',
    lead: 'O dia de cada utente, num painel.',
    items: ['Presenças e medicação', 'Portal das famílias', 'Equipa e stock'],
  },
  {
    tag: 'Para si', t: 'A minha saúde', accent: 'var(--green)', href: '/login?mode=personal',
    lead: 'A sua medicação, debaixo de olho.',
    items: ['Foto à receita', 'Lembretes a tempo', 'Vê o que não se dá bem'],
  },
  {
    tag: 'Para a família', t: 'Cuidar de alguém', accent: '#b9690e', href: '/login?mode=caregiver',
    lead: 'A saúde de quem cuida, num lugar.',
    items: ['Um perfil por pessoa', 'Quem tomou o quê', 'Partilha com o médico'],
  },
  {
    tag: 'Para estudar', t: 'Estudante de saúde', accent: '#7c3aed', href: '/login?mode=student',
    lead: 'Treino a sério, todos os dias.',
    items: ['Casos clínicos com IA', 'OSCE e decisões', 'O seu progresso'],
  },
]

const CICLO = [
  { t: 'O centro regista.', d: 'O dia de cada utente, em tempo real.' },
  { t: 'A família vê.', d: 'Sem telefonar. Só abrir e ver.' },
  { t: 'Torna-se sua.', d: 'A mesma conta cuida da sua saúde.' },
  { t: 'Espalha-se.', d: 'Quem sente, mostra a mais alguém.' },
]

const GANHOS = [
  { k: 'Foto', t: 'A caixa diz tudo', d: 'Fotografe e saiba o que é, para que serve, como tomar.' },
  { k: 'Pergunta', t: 'Tire a dúvida agora', d: 'Perguntas simples, respostas diretas, em português.' },
  { k: 'Aviso', t: 'Antes de virar problema', d: 'Interações e tomas esquecidas — a tempo de agir.' },
]

export default function HomePage() {
  return (
    <div className="lp">

      {/* ── HERÓI — cascata curta ao carregar, não à espera de scroll ──────── */}
      <section className="lp-hero">
        <div className="lp-hero-mark lp-hero-mark-spin"><Petal size={560} outline color="var(--ink)" /></div>
        <div className="lp-wrap">
          <div className="lp-hero-grid">
            <div>
              <h1 className="lp-h1 lp-fade" style={{ animationDelay: '0.05s' }}>Medicação, <em>sem confusão</em>.</h1>
              <p className="lp-lead lp-fade" style={{ animationDelay: '0.16s' }}>Interações, doses e dúvidas do dia a dia — com as regras do INFARMED.</p>
              <div className="lp-actions lp-fade" style={{ animationDelay: '0.26s' }}>
                <Link href="/login" className="lp-go">Criar conta grátis</Link>
                <Link href="#mundos" className="lp-link">Ver como funciona&nbsp;→</Link>
              </div>
              <p className="lp-meta lp-fade" style={{ animationDelay: '0.34s' }}>Sem cartão de crédito · Cancele quando quiser</p>
            </div>
            <div className="lp-fade" style={{ animationDelay: '0.2s' }}>
              <VerdictCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto — uma frase, curta e real ─────────────────────────────── */}
      <Reveal>
        <section className="lp-manifesto">
          <div className="lp-wrap">
            <p className="lp-mani-txt">As marcas, as doses e as regras são as de Portugal.</p>
          </div>
        </section>
      </Reveal>

      {/* ── COMO FUNCIONA — tira de processo, não cartões ───────────────────── */}
      <Reveal>
        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-sec-h">
              <h2 className="lp-h2">Como funciona</h2>
              <p className="lp-sec-sub">Três passos, e está a usar.</p>
            </header>
            <div className="lp-flow">
              {PASSOS.map(s => (
                <div key={s.n} className="lp-flow-item">
                  <span className="lp-flow-dot" />
                  <div className="lp-flow-n">{s.n}</div>
                  <h3 className="lp-flow-t">{s.t}</h3>
                  <p className="lp-flow-d">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── OS 5 MUNDOS — índice editorial, não grelha de cartões ───────────── */}
      <Reveal>
        <section className="lp-sec lp-sec-paper" id="mundos">
          <div className="lp-wrap">
            <header className="lp-sec-h">
              <h2 className="lp-h2">Um Phlox para cada pessoa</h2>
              <p className="lp-sec-sub">Escolha o seu mundo. Muda quando quiser.</p>
            </header>
            <div className="lp-index">
              {MUNDOS.map(m => (
                <Link key={m.t} href={m.href} className="lp-index-row" style={{ ['--a' as string]: m.accent }}>
                  <span className="lp-index-icon"><Petal size={26} color={m.accent} /></span>
                  <span className="lp-index-main">
                    <span className="lp-index-top">
                      <span className="lp-index-tag">{m.tag}</span>
                      <span className="lp-index-t">{m.t}</span>
                    </span>
                    <span className="lp-index-lead">{m.lead}</span>
                    <span className="lp-index-items">{m.items.join(' · ')}</span>
                  </span>
                  <span className="lp-index-go">→</span>
                </Link>
              ))}
            </div>
            <div className="lp-index-cta">
              <p>Ainda não sabe qual é o seu?</p>
              <Link href="/login" className="lp-go">Criar conta grátis</Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── COMO SE PROPAGA — mesma tira de processo, 4 batidas ─────────────── */}
      <Reveal>
        <section className="lp-sec">
          <div className="lp-wrap">
            <header className="lp-sec-h">
              <h2 className="lp-h2">Um cuidado a sério puxa outro</h2>
              <p className="lp-sec-sub">Não são cinco produtos. É uma rede.</p>
            </header>
            <div className="lp-flow lp-flow-4">
              {CICLO.map((c) => (
                <div key={c.t} className="lp-flow-item">
                  <span className="lp-flow-dot" />
                  <h3 className="lp-flow-t">{c.t}</h3>
                  <p className="lp-flow-d">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── O QUE GANHA — lista, não grelha ──────────────────────────────────── */}
      <Reveal>
        <section className="lp-sec lp-sec-paper">
          <div className="lp-wrap">
            <header className="lp-sec-h">
              <h2 className="lp-h2">O que ganha</h2>
            </header>
            <div className="lp-ganhos">
              {GANHOS.map((x) => (
                <div key={x.t} className="lp-ganho">
                  <span className="lp-ganho-k">{x.k}</span>
                  <h3 className="lp-ganho-t">{x.t}</h3>
                  <p className="lp-ganho-d">{x.d}</p>
                </div>
              ))}
            </div>
            <p className="lp-badges">
              {['INFARMED', 'DGS', 'EMA', 'ESC 2024', 'Beers 2023', 'STOPP/START v3'].map((s, i) => (
                <span key={s}>{i > 0 && <span className="lp-badge-sep">·</span>}{s}</span>
              ))}
            </p>
          </div>
        </section>
      </Reveal>

      {/* ── FECHO ────────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="lp-close">
          <div className="lp-wrap">
            <h2 className="lp-close-h">Experimente hoje.<br />Decida depois.</h2>
            <p className="lp-close-p">O <strong>Base</strong> é grátis. O <strong>Plus</strong> tira anúncios e abre o resto — 3,99&nbsp;€/mês, cancele quando quiser.</p>
            <div className="lp-actions">
              <Link href="/login" className="lp-go lp-go-light">Criar conta grátis</Link>
              <Link href="/pricing" className="lp-link lp-link-dark">Ver os planos&nbsp;→</Link>
            </div>
          </div>
        </section>
      </Reveal>

      <style>{`
        .lp { background:var(--bg); color:var(--ink); font-family:var(--font-sans); overflow-x:hidden; }
        .lp-wrap { max-width:1080px; margin:0 auto; padding:0 clamp(20px,5vw,40px); position:relative; }
        .lp em { font-style:italic; color:var(--green); }

        /* ── Movimento moderado: cascata do herói ao carregar + revelar por
           secção ao chegar ao ecrã. Um padrão só, repetido — nunca um efeito
           por sítio. prefers-reduced-motion trava tudo isto (regra global). ── */
        .lp-fade { opacity:0; animation:fadeUp .65s cubic-bezier(.16,1,.3,1) both; }
        .lp-reveal { opacity:0; transform:translateY(18px); transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
        .lp-reveal-in { opacity:1; transform:translateY(0); }
        .lp-hero-mark-spin { animation:spin 140s linear infinite; }

        /* ── Herói ── */
        .lp-hero { position:relative; overflow:hidden; padding:clamp(48px,8vw,88px) 0 clamp(40px,6vw,64px); }
        .lp-hero-mark { position:absolute; top:-90px; right:-140px; opacity:.05; pointer-events:none; }
        .lp-hero-grid { display:grid; grid-template-columns:1.15fr 0.85fr; gap:clamp(28px,5vw,64px); align-items:start; position:relative; }
        .lp-h1 { font-family:var(--font-serif); font-weight:500; font-size:clamp(40px,7.2vw,74px); line-height:1.0; letter-spacing:-.03em; margin:0 0 22px; }
        .lp-lead { font-size:clamp(16px,1.9vw,18.5px); color:var(--ink-3); line-height:1.6; max-width:40ch; margin:0 0 30px; }
        .lp-actions { display:flex; gap:22px; flex-wrap:wrap; align-items:center; }
        .lp-go { display:inline-block; padding:15px 28px; background:var(--ink); color:#fff; border-radius:2px; text-decoration:none; font-weight:700; font-size:15px; letter-spacing:.01em; }
        .lp-go:hover { background:var(--green); }
        .lp-go-light { background:#fff; color:var(--ink); }
        .lp-go-light:hover { background:var(--bg-2); color:var(--ink); }
        .lp-link { font-size:15px; font-weight:600; color:var(--ink); text-decoration:none; border-bottom:1.5px solid var(--green); padding-bottom:2px; }
        .lp-link:hover { color:var(--green); }
        .lp-link-dark { color:#fff; border-bottom-color:#fff; }
        .lp-meta { font-family:var(--font-mono); font-size:11.5px; color:var(--ink-4); margin-top:22px; letter-spacing:.04em; }

        /* ── Ficha de veredito ── */
        .vsc { background:#fff; border:1px solid var(--border); border-top:3px solid var(--ink); padding:26px 26px 22px; box-shadow:0 24px 50px -28px rgba(22,24,29,.4); position:relative; }
        .vs-tag { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-4); display:block; margin-bottom:16px; }
        .vs-pair { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
        .vs-chip { position:relative; font-family:var(--font-serif); font-size:23px; color:var(--ink); }
        .vs-plus { margin:0 6px 0 10px; color:var(--ink-4); font-family:var(--font-sans); }
        .vs-verdict { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:800; letter-spacing:-.01em; margin-bottom:12px; text-transform:uppercase; font-family:var(--font-mono); }
        .vs-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .vs-txt { font-size:15.5px; color:var(--ink); line-height:1.55; margin:0 0 8px; }
        .vs-alt { font-size:13.5px; color:var(--ink-4); line-height:1.55; margin:0; }

        /* ── Manifesto ── */
        .lp-manifesto { padding:clamp(36px,5vw,56px) 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .lp-mani-txt { font-family:var(--font-serif); font-size:clamp(20px,2.6vw,27px); line-height:1.4; letter-spacing:-.01em; max-width:34ch; color:var(--ink); }

        /* ── Secções ── */
        .lp-sec { padding:clamp(56px,8vw,104px) 0; }
        .lp-sec-paper { background:var(--bg-2); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
        .lp-sec-h { margin-bottom:clamp(36px,5.5vw,58px); }
        .lp-h2 { font-family:var(--font-serif); font-weight:500; font-size:clamp(26px,4vw,42px); letter-spacing:-.02em; margin:0 0 8px; line-height:1.1; }
        .lp-sec-sub { font-size:clamp(14.5px,1.6vw,16.5px); color:var(--ink-4); margin:0; line-height:1.6; max-width:60ch; }

        /* Tira de processo — traço fino a ligar os pontos, sem caixas */
        .lp-flow { position:relative; display:flex; gap:clamp(24px,4vw,48px); }
        .lp-flow::before { content:''; position:absolute; top:4px; left:0; right:0; height:1px; background:var(--border-2); }
        .lp-flow-item { position:relative; flex:1; padding-top:30px; }
        .lp-flow-dot { position:absolute; top:0; left:0; width:9px; height:9px; border-radius:50%; background:var(--green); }
        .lp-flow-n { font-family:var(--font-serif); font-size:26px; color:var(--green); line-height:1; margin-bottom:10px; }
        .lp-flow-t { font-size:17.5px; font-weight:700; margin:0 0 7px; letter-spacing:-.01em; }
        .lp-flow-d { font-size:14px; color:var(--ink-3); line-height:1.55; margin:0; }
        .lp-flow-4 .lp-flow-t { font-family:var(--font-serif); font-weight:500; font-size:19px; }

        /* Os 5 mundos — índice editorial, não cartões */
        .lp-index { border-top:1px solid var(--border); }
        .lp-index-row { display:flex; align-items:flex-start; gap:20px; padding:26px 4px; border-bottom:1px solid var(--border); text-decoration:none; color:var(--ink); transition:background .2s ease; }
        .lp-index-row:hover { background:rgba(0,0,0,.015); }
        .lp-index-row:hover .lp-index-icon { transform:scale(1.08); border-color:var(--a); }
        .lp-index-row:hover .lp-index-go { transform:translateX(3px); }
        .lp-index-icon { flex:0 0 auto; width:42px; height:42px; border-radius:50%; background:var(--bg); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; margin-top:2px; transition:transform .25s cubic-bezier(.16,1,.3,1), border-color .25s ease; }
        .lp-index-go { transition:transform .2s ease; }
        .lp-index-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
        .lp-index-top { display:flex; align-items:baseline; gap:13px; flex-wrap:wrap; }
        .lp-index-tag { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--a); font-weight:700; }
        .lp-index-t { font-family:var(--font-serif); font-size:clamp(20px,2.5vw,26px); font-weight:500; letter-spacing:-.015em; }
        .lp-index-lead { font-size:14px; color:var(--ink-3); }
        .lp-index-items { font-size:12.5px; color:var(--ink-4); font-family:var(--font-mono); letter-spacing:.01em; }
        .lp-index-go { flex:0 0 auto; align-self:center; font-size:18px; color:var(--a); }
        .lp-index-cta { display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; padding:28px 4px 0; }
        .lp-index-cta p { font-size:15px; color:var(--ink-3); margin:0; }

        /* O que ganha — lista simples, sem caixas */
        .lp-ganhos { display:flex; flex-direction:column; }
        .lp-ganho { padding:22px 0; border-top:1px solid var(--border); display:grid; grid-template-columns:110px 1fr; gap:18px; align-items:baseline; }
        .lp-ganho:first-child { border-top:none; }
        .lp-ganho-k { font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--green); }
        .lp-ganho-t { font-family:var(--font-serif); font-size:20px; font-weight:500; margin:0 0 6px; letter-spacing:-.01em; grid-column:2; }
        .lp-ganho-d { font-size:14.5px; color:var(--ink-3); line-height:1.6; margin:0; grid-column:2; }
        .lp-badges { font-family:var(--font-mono); font-size:12px; color:var(--ink-4); margin-top:clamp(32px,5vw,48px); padding-top:24px; border-top:1px solid var(--border); letter-spacing:.02em; }
        .lp-badge-sep { margin:0 10px; color:var(--border-2); }

        /* ── Fecho escuro ── */
        .lp-close { background:var(--ink); color:#fff; padding:clamp(64px,9vw,120px) 0; }
        .lp-close-h { font-family:var(--font-serif); font-weight:500; font-size:clamp(30px,5vw,54px); letter-spacing:-.025em; line-height:1.06; margin:0 0 20px; }
        .lp-close-p { font-size:16px; color:#a7aeb4; line-height:1.7; max-width:50ch; margin:0 0 30px; }
        .lp-close-p strong { color:#fff; font-weight:600; }

        /* ── Responsivo ── */
        @media (max-width:860px) {
          .lp-hero-grid { grid-template-columns:1fr; gap:34px; }
          .lp-hero-mark { opacity:.04; }
          .lp-flow { flex-direction:column; gap:26px; padding-left:8px; }
          .lp-flow::before { top:0; bottom:0; left:3px; right:auto; width:1px; height:auto; }
          .lp-flow-item { padding-top:0; padding-left:26px; }
          .lp-flow-dot { top:5px; left:-1px; }
          .lp-index-row { flex-wrap:wrap; }
          .lp-index-go { display:none; }
          .lp-ganho { grid-template-columns:1fr; gap:6px; }
          .lp-ganho-k { grid-column:1; }
          .lp-ganho-t, .lp-ganho-d { grid-column:1; }
        }
        @media (max-width:560px) {
          .lp-index-icon { width:34px; height:34px; }
        }
      `}</style>
    </div>
  )
}
