'use client'

// Gerador de DPA — Art. 28.º RGPD. Insere os dados da entidade contratante (Controller)
// e produz um contrato imprimível, com cláusulas standard e a lista atual de
// subprocessadores. Não substitui aconselhamento jurídico mas dá uma base sólida.

import { useState } from 'react'
import Link from 'next/link'

const SUBPROCESSORS = [
  { name: 'Vercel Inc.', purpose: 'Hospedagem da aplicação web', location: 'União Europeia (Frankfurt)', country: 'Alemanha' },
  { name: 'Supabase Inc.', purpose: 'Base de dados Postgres + autenticação', location: 'União Europeia (Frankfurt)', country: 'Alemanha' },
  { name: 'Stripe Payments Europe Ltd.', purpose: 'Processamento de pagamentos de subscrição', location: 'União Europeia (Dublin)', country: 'Irlanda' },
  { name: 'Cloudflare, Inc.', purpose: 'Edge / DNS / proteção DDoS', location: 'União Europeia (vários POPs)', country: 'Multi-EU' },
]

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function DPAGeneratorPage() {
  const [form, setForm] = useState({
    company: '', nif: '', address: '', representative: '', representative_role: '', email: '',
  })

  const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

  function print() {
    const w = window.open('', '_blank', 'width=820,height=900')
    if (!w) return
    const html = buildDPAHTML(form, today)
    w.document.write(html); w.document.close()
    w.focus(); setTimeout(() => w.print(), 350)
  }

  const ready = form.company.trim() && form.nif.trim() && form.representative.trim()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/trust" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>← Trust Center</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>Contrato de Subcontratante (DPA)</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: 0, lineHeight: 1.6 }}>
            Artigo 28.º do RGPD. Preenche os dados da tua entidade e descarrega o contrato pronto a assinar. As cláusulas standard incluem subprocessadores, medidas técnicas e organizativas, e direitos de auditoria.
          </p>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Entidade contratante (Responsável pelo Tratamento)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div><span style={lbl}>Designação da entidade</span><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Ex: Clínica Saúde, Lda." style={inp} autoFocus /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>NIPC / NIF</span><input value={form.nif} onChange={e => setForm({ ...form, nif: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="500000000" style={inp} /></div>
              <div><span style={lbl}>Email institucional</span><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="dpo@minhaorg.pt" style={inp} /></div>
            </div>
            <div><span style={lbl}>Sede</span><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, código-postal, localidade" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Representante legal</span><input value={form.representative} onChange={e => setForm({ ...form, representative: e.target.value })} placeholder="Nome completo" style={inp} /></div>
              <div><span style={lbl}>Cargo</span><input value={form.representative_role} onChange={e => setForm({ ...form, representative_role: e.target.value })} placeholder="Ex: Administrador" style={inp} /></div>
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--ink-2)' }}>Subprocessadores atuais</strong> incluídos automaticamente no contrato:<br />
            {SUBPROCESSORS.map(s => s.name).join(' · ')}.
          </div>

          <button onClick={print} disabled={!ready} style={{ width: '100%', marginTop: 18, padding: 13, background: ready ? '#0d6e42' : 'var(--bg-3)', color: ready ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: ready ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            Gerar e imprimir contrato
          </button>

          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12, lineHeight: 1.55 }}>
            Documento orientador. Adapta ao contexto específico da tua entidade e valida juridicamente.
          </div>
        </div>
      </div>
    </div>
  )
}

function buildDPAHTML(f: { company: string; nif: string; address: string; representative: string; representative_role: string; email: string }, today: string): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const C = esc(f.company || '________________________')
  const N = esc(f.nif || '_________')
  const A = esc(f.address || '________________________')
  const R = esc(f.representative || '________________________')
  const RR = esc(f.representative_role || '________________________')
  const E = esc(f.email || '________________________')
  const subRows = SUBPROCESSORS.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.purpose)}</td><td>${esc(s.location)}</td><td>${esc(s.country)}</td></tr>`).join('')

  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>DPA — ${C}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; font-size: 11.5pt; line-height: 1.55; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4mm; letter-spacing: -0.01em; }
  h2 { font-size: 12.5pt; margin: 7mm 0 2mm; border-bottom: 1px solid #999; padding-bottom: 1mm; }
  p { margin: 0 0 3mm; text-align: justify; }
  .subtitle { text-align: center; font-size: 10pt; color: #555; margin-bottom: 8mm; }
  table.parts { width: 100%; border-collapse: collapse; margin: 4mm 0 6mm; }
  table.parts td { vertical-align: top; padding: 2mm 3mm; font-size: 10.5pt; border: 1px solid #bbb; }
  table.parts td.h { background: #f3f4f6; font-weight: bold; width: 28%; }
  table.sub { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 2mm 0 5mm; }
  table.sub th, table.sub td { border: 1px solid #999; padding: 2mm 3mm; text-align: left; }
  table.sub th { background: #f3f4f6; }
  ol { padding-left: 6mm; }
  ol li { margin-bottom: 2mm; }
  .sig { display: flex; gap: 12mm; margin-top: 14mm; }
  .sig > div { flex: 1; border-top: 1px solid #000; padding-top: 2mm; font-size: 10pt; }
  .footer { position: fixed; bottom: 8mm; left: 20mm; right: 20mm; font-size: 8.5pt; color: #777; text-align: center; }
</style></head><body>
<h1>CONTRATO DE SUBCONTRATAÇÃO PARA TRATAMENTO DE DADOS PESSOAIS</h1>
<div class="subtitle">Artigo 28.º do Regulamento (UE) 2016/679 (RGPD) · Lisboa, ${esc(today)}</div>

<h2>Identificação das partes</h2>
<table class="parts">
  <tr><td class="h">Responsável pelo Tratamento (Controlador)</td><td><strong>${C}</strong><br/>NIPC ${N}<br/>${A}<br/>Representado por ${R}, na qualidade de ${RR}<br/>Contacto: ${E}</td></tr>
  <tr><td class="h">Subcontratante (Processador)</td><td><strong>Phlox</strong><br/>Plataforma operada em phloxclinical.com<br/>Aplicação alojada na União Europeia (Vercel · Frankfurt)<br/>Dados em Supabase (Postgres) · União Europeia (Frankfurt)</td></tr>
</table>

<h2>1. Objeto</h2>
<p>O presente contrato regula o tratamento de dados pessoais efetuado pelo Subcontratante, em nome e por conta do Responsável pelo Tratamento, no âmbito da utilização da plataforma Phlox, em conformidade com o disposto no Artigo 28.º do RGPD.</p>

<h2>2. Natureza e finalidade do tratamento</h2>
<p>O tratamento é efetuado para a prestação de serviços de gestão clínica, faturação e ferramentas de apoio à atividade da entidade Responsável, conforme contratado. As categorias de dados incluem dados de identificação, dados de saúde (categoria especial nos termos do Artigo 9.º) e dados de transação/faturação.</p>

<h2>3. Obrigações do Subcontratante</h2>
<ol>
  <li>Tratar os dados apenas mediante instrução documentada do Responsável (incluindo este contrato e a utilização normal da plataforma).</li>
  <li>Assegurar que as pessoas autorizadas a tratar dados estão vinculadas a confidencialidade.</li>
  <li>Aplicar medidas técnicas e organizativas adequadas (Anexo I), incluindo encriptação em trânsito (TLS 1.3) e em repouso (AES-256), políticas de Row-Level Security em base de dados e Audit Trail criptograficamente encadeado.</li>
  <li>Respeitar as condições para contratação de outros subcontratantes (Cláusula 5).</li>
  <li>Apoiar o Responsável no cumprimento dos pedidos dos titulares (acesso, retificação, apagamento, portabilidade, oposição).</li>
  <li>Apoiar o Responsável no cumprimento dos Artigos 32.º a 36.º (segurança, notificação de violações, avaliação de impacto).</li>
  <li>Eliminar ou devolver todos os dados ao Responsável no fim da prestação dos serviços, salvo obrigação legal de conservação.</li>
  <li>Disponibilizar ao Responsável as informações necessárias para demonstrar o cumprimento das obrigações estabelecidas no Artigo 28.º, e permitir e contribuir para auditorias.</li>
</ol>

<h2>4. Notificação de violação de dados</h2>
<p>O Subcontratante notifica o Responsável sem demora indevida (em qualquer caso em prazo não superior a 48 horas) após ter conhecimento de uma violação de dados pessoais, prestando informação suficiente para que o Responsável possa cumprir a sua obrigação de notificação à autoridade de controlo (CNPD) no prazo de 72 horas, nos termos do Artigo 33.º.</p>

<h2>5. Subprocessadores autorizados</h2>
<p>O Responsável autoriza o recurso aos subprocessadores indicados abaixo, com os quais o Subcontratante mantém contratos que asseguram garantias equivalentes às previstas neste contrato. Qualquer alteração será comunicada ao Responsável com antecedência razoável, podendo este opor-se por escrito.</p>
<table class="sub">
  <thead><tr><th>Subprocessador</th><th>Finalidade</th><th>Localização</th><th>País</th></tr></thead>
  <tbody>${subRows}</tbody>
</table>

<h2>6. Transferências internacionais</h2>
<p>Os dados são tratados na União Europeia. Não existem transferências para países terceiros sem decisão de adequação ou garantias adequadas nos termos do Capítulo V do RGPD.</p>

<h2>7. Direitos de auditoria</h2>
<p>O Responsável poderá auditar o cumprimento das obrigações deste contrato, em condições razoáveis de tempo e modo, mediante aviso prévio de 30 dias. O Subcontratante poderá satisfazer este direito disponibilizando relatórios de auditoria independente atualizados (quando existam) e a documentação técnica relevante.</p>

<h2>8. Vigência e cessação</h2>
<p>O presente contrato vigora enquanto subsistir o contrato de prestação de serviços entre as partes. Em caso de cessação, o Subcontratante elimina ou devolve os dados nos termos da Cláusula 3.7, salvo obrigação legal de conservação.</p>

<h2>9. Lei aplicável e foro</h2>
<p>Este contrato rege-se pela lei portuguesa. Para qualquer litígio é competente o foro da comarca da sede do Responsável, com renúncia a qualquer outro.</p>

<h2>Anexo I — Medidas técnicas e organizativas</h2>
<ol>
  <li>Encriptação em trânsito (TLS 1.3, HSTS) e em repouso (AES-256).</li>
  <li>Autenticação centralizada com Supabase Auth. 2FA disponível em conta. SSO empresarial (SAML/OIDC) disponível no plano Institucional.</li>
  <li>Autorização por Row-Level Security em todas as tabelas com dados clínicos: o Postgres recusa devolver registos a um utilizador que não seja o respetivo titular.</li>
  <li>Audit Trail com cadeia SHA-256 — cada evento sensível referencia o hash do anterior. Adulteração detetável criptograficamente.</li>
  <li>Backups diários automáticos e Point-in-Time Recovery (PITR) até 7 dias na base de dados.</li>
  <li>Segregação de ambientes (produção, pré-produção). Segredos isolados em variáveis de ambiente cifradas (Vercel).</li>
  <li>Procedimento interno de resposta a incidentes; notificação ao Responsável em 48h e à CNPD em 72h por força do RGPD.</li>
</ol>

<div class="sig">
  <div>O Responsável pelo Tratamento<br/><br/>______________________________<br/>${R} — ${RR}<br/>${C} · NIPC ${N}</div>
  <div>O Subcontratante<br/><br/>______________________________<br/>Phlox</div>
</div>

<div class="footer">Documento gerado pelo Phlox Trust Center. Versão eletrónica disponível em phloxclinical.com/trust</div>
</body></html>`
}
