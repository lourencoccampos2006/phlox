import Header from '@/components/Header'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog Phlox Clinical — Farmacologia e Clínica em Português',
  description: 'Artigos sobre farmacologia clínica, interações medicamentosas, guidelines e decisão terapêutica. Em português, para profissionais e estudantes de saúde.',
}

const ARTICLES = [
  {
    slug: 'ibuprofeno-varfarina',
    category: 'Interações',
    date: '15 Jan 2026',
    readTime: '4 min',
    title: 'Ibuprofeno + Varfarina: uma combinação que mata',
    excerpt: 'A combinação de AINEs com anticoagulantes orais é uma das causas mais comuns de hemorragia iatrogénica. O que acontece a nível molecular, e o que fazer quando um doente anticoagulado pede algo para a dor.',
    tags: ['Anticoagulantes', 'AINEs', 'Hemorragia'],
    color: '#dc2626',
  },
  {
    slug: 'metformina-quando-parar',
    category: 'Decisão Clínica',
    date: '3 Fev 2026',
    readTime: '5 min',
    title: 'Metformina: quando parar e quando é seguro continuar',
    excerpt: 'A atualização do RCM da metformina em 2025 redefiniu os limiares de TFG para uso seguro. O que mudou, o que ficou igual, e como aplicar na prática clínica.',
    tags: ['Metformina', 'DRC', 'Diabetes'],
    color: '#0d6e42',
  },
  {
    slug: 'criterios-beers-2024',
    category: 'Geriatria',
    date: '20 Fev 2026',
    readTime: '7 min',
    title: 'Critérios de Beers 2024: o que mudou para a prática',
    excerpt: 'A American Geriatrics Society actualizou os critérios de Beers. Novos fármacos na lista, alguns saíram, e a evidência por trás de cada decisão. Guia prático para farmacêuticos e médicos.',
    tags: ['Geriatria', 'Polimedicação', 'Beers'],
    color: '#7c3aed',
  },
  {
    slug: 'amiodarona-interacoes',
    category: 'Cardiologia',
    date: '8 Mar 2026',
    readTime: '6 min',
    title: 'Amiodarona: a rainha das interações medicamentosas',
    excerpt: 'A amiodarona inibe múltiplas isoenzimas CYP450 e é transportada pela P-gp. Resultado: interage com quase tudo. Um guia completo para não cometer erros na prescrição concomitante.',
    tags: ['Amiodarona', 'CYP450', 'Arritmias'],
    color: '#1d4ed8',
  },
  {
    slug: 'antibioticos-resistencia-portugal',
    category: 'Anti-infecciosos',
    date: '22 Mar 2026',
    readTime: '8 min',
    title: 'Resistência aos antibióticos em Portugal: o estado actual',
    excerpt: 'Portugal tem uma das taxas mais altas de resistência à ciprofloxacina e ampicilina na Europa. O que os dados do ECDC dizem e como isso deve influenciar a prescrição empírica.',
    tags: ['Antibióticos', 'Resistência', 'ECDC'],
    color: '#065f46',
  },
  {
    slug: 'dose-pediatrica-erros',
    category: 'Pediatria',
    date: '10 Abr 2026',
    readTime: '5 min',
    title: 'Os 5 erros mais comuns na dose pediátrica (e como evitá-los)',
    excerpt: 'Confundir mg/kg com mg/kg/dia é o erro mais comum. Mas há outros: doses máximas ignoradas, formulações inadequadas, e arredondamentos perigosos. Casos reais e soluções práticas.',
    tags: ['Pediatria', 'Segurança', 'Dosagem'],
    color: '#b45309',
  },
]

const CATEGORIES = ['Todos', 'Interações', 'Decisão Clínica', 'Geriatria', 'Cardiologia', 'Anti-infecciosos', 'Pediatria']

export default function BlogPage() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'48px 0 32px' }}>
        <div className="page-container" style={{ maxWidth:760, margin:'0 auto' }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12 }}>Phlox Blog</div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(24px,4vw,40px)', color:'var(--ink)', fontWeight:400, letterSpacing:'-0.02em', marginBottom:12 }}>
            Farmacologia clínica.<br />Em português.
          </h1>
          <p style={{ fontSize:15, color:'var(--ink-3)', lineHeight:1.8 }}>
            Artigos sobre interações, guidelines, decisão terapêutica e farmacologia aplicada. Para profissionais e estudantes.
          </p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth:760, margin:'0 auto' }}>

        {/* Featured */}
        <Link href={`/blog/${ARTICLES[0].slug}`}
          style={{ display:'block', background:'white', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', textDecoration:'none', marginBottom:20, transition:'box-shadow 0.15s' }}
          className="article-card">
          <div style={{ background:ARTICLES[0].color, padding:'32px 28px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(255,255,255,0.15)', padding:'3px 8px', borderRadius:3 }}>
                {ARTICLES[0].category}
              </span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontFamily:'var(--font-mono)' }}>{ARTICLES[0].readTime}</span>
            </div>
            <h2 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(18px,3vw,26px)', color:'white', fontWeight:400, letterSpacing:'-0.01em', lineHeight:1.3 }}>
              {ARTICLES[0].title}
            </h2>
          </div>
          <div style={{ padding:'20px 28px 24px' }}>
            <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.7, marginBottom:14 }}>{ARTICLES[0].excerpt}</p>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {ARTICLES[0].tags.map(t => (
                  <span key={t} style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', background:'var(--bg-2)', border:'1px solid var(--border)', padding:'2px 7px', borderRadius:3 }}>{t}</span>
                ))}
              </div>
              <span style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', flexShrink:0 }}>{ARTICLES[0].date}</span>
            </div>
          </div>
        </Link>

        {/* Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap:12 }}>
          {ARTICLES.slice(1).map(article => (
            <Link key={article.slug} href={`/blog/${article.slug}`}
              style={{ display:'flex', flexDirection:'column', background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', textDecoration:'none', transition:'box-shadow 0.15s' }}
              className="article-card">
              <div style={{ height:6, background:article.color }} />
              <div style={{ padding:'18px 20px 20px', flex:1, display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:article.color, letterSpacing:'0.1em', textTransform:'uppercase' }}>{article.category}</span>
                  <span style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginLeft:'auto' }}>{article.readTime}</span>
                </div>
                <h3 style={{ fontFamily:'var(--font-serif)', fontSize:17, color:'var(--ink)', fontWeight:400, letterSpacing:'-0.01em', lineHeight:1.4, marginBottom:10 }}>{article.title}</h3>
                <p style={{ fontSize:13, color:'var(--ink-4)', lineHeight:1.6, flex:1, marginBottom:14 }}>{article.excerpt.slice(0,120)}...</p>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {article.tags.slice(0,2).map(t => (
                      <span key={t} style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', background:'var(--bg-2)', border:'1px solid var(--border)', padding:'1px 6px', borderRadius:3 }}>{t}</span>
                    ))}
                  </div>
                  <span style={{ fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)', flexShrink:0 }}>{article.date}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop:32, padding:'24px', background:'white', border:'1px solid var(--border)', borderRadius:10, textAlign:'center' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Receber novos artigos</div>
          <p style={{ fontSize:13, color:'var(--ink-4)', marginBottom:16 }}>Um artigo por semana sobre farmacologia clínica aplicada.</p>
          <div style={{ display:'flex', gap:8, maxWidth:400, margin:'0 auto' }}>
            <input type="email" placeholder="o.teu@email.com"
              style={{ flex:1, border:'1.5px solid var(--border)', borderRadius:7, padding:'10px 13px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
            <button style={{ padding:'10px 18px', background:'var(--ink)', color:'white', border:'none', borderRadius:7, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>
              Subscrever
            </button>
          </div>
        </div>
      </div>

      <style>{`.article-card:hover{box-shadow:0 8px 32px rgba(0,0,0,0.08)!important}`}</style>
    </div>
  )
}