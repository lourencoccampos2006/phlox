import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Novidades e atualizações da plataforma Phlox Clinical',
}

const RELEASES = [
  {
    version: '3.1',
    date: '2026-05-31',
    tag: 'Mais recente',
    tagColor: '#0d6e42',
    items: [
      { type: 'new', text: '/reach — convites e referrals: cada utilizador tem o seu código, ambos ganham 1 mês quando o convidado faz upgrade' },
      { type: 'new', text: '/api/pulse (Server-Sent Events) — KPIs ao vivo no cockpit: receita do dia, fila, tarefas. Atualização em tempo real sem polling' },
      { type: 'new', text: 'Signed Documents — documentos assinados (HMAC-SHA256) com URL pública /v/{id} para verificação por qualquer pessoa, sem login necessário' },
      { type: 'improved', text: '/ai — interface redesenhada: header com logo gradient, hero generoso no empty state, bolhas e input mais polidos, nova animação de typing' },
    ],
  },
  {
    version: '3.0',
    date: '2026-05-31',
    tag: null,
    tagColor: '#0d6e42',
    items: [
      { type: 'new', text: '/trust — Trust Center: estado, segurança, RGPD, subprocessadores e descarga de DPA num único sítio' },
      { type: 'new', text: '/trust/dpa — gerador de Contrato de Subcontratante (Art. 28.º RGPD) personalizado por NIF, com cláusulas standard e subprocessadores' },
      { type: 'new', text: '/insights (Pro) — benchmarks anonimizados contra o pool do mesmo tipo de instituição (k-anonymity ≥ 5) com mediana, p25, p75, p90' },
      { type: 'new', text: '/copiloto (Pro) — AI Copilot ancorado no Decision Engine; cada recomendação cita a regra (R1, R7…). Não inventa interações' },
      { type: 'new', text: '/exportar-dados — portabilidade Art. 20.º RGPD: descarrega tudo num JSON estruturado' },
      { type: 'improved', text: 'Rodapé global passa a destacar o Trust Center' },
    ],
  },
  {
    version: '2.9',
    date: '2026-05-30',
    tag: null,
    tagColor: '#0d6e42',
    items: [
      { type: 'new', text: '/status — página pública de estado com verificação em tempo real da base de dados e da autenticação. Indicador vivo no rodapé' },
      { type: 'new', text: '/seguranca — modelo técnico de segurança: TLS 1.3, AES-256 em repouso, RLS por linha, hospedagem na União Europeia, política de backups e retenção' },
      { type: 'improved', text: 'Rodapé com selos de confiança (Hospedado na UE, Stripe, Supabase) e atalhos para Estado, Changelog e Segurança' },
    ],
  },
  {
    version: '2.8',
    date: '2026-05-29',
    tag: null,
    tagColor: '#2563eb',
    items: [
      { type: 'new', text: 'Motor fiscal — ATCUD, QR Code no formato oficial da AT, numeração sequencial atómica por série, cadeia SHA-256 entre documentos, SAF-T (PT) com a estrutura oficial' },
      { type: 'new', text: 'Notas de crédito — estorno do documento com cadeia, em vez de eliminação (exigência fiscal)' },
      { type: 'new', text: 'POS — Ponto de Venda com leitor teclado-wedge, câmara do telemóvel (BarcodeDetector) e pesquisa manual' },
      { type: 'new', text: 'Pagamentos — Referência Multibanco com algoritmo de check-digit oficial (991) e MB WAY com gateway Easypay' },
      { type: 'new', text: 'Conectores de faturação — InvoiceXpress, Moloni, Vendus, KeyInvoice, Jasmin, Sage (CSV)' },
      { type: 'new', text: 'Webhooks de saída assinados (HMAC-SHA256) para venda criada, documento emitido e stock baixo' },
      { type: 'new', text: 'Importação de produtos em massa por CSV — auto-deteta colunas de exports Sifarma e ERP genéricos' },
      { type: 'new', text: 'Plano Institucional disponível em checkout (Stripe) — cancelamento direto no site' },
      { type: 'fixed', text: 'Acesso a ferramentas pagas bloqueado a nível de rota (não bastava esconder o botão)' },
    ],
  },
  {
    version: '2.7',
    date: '2026-05-20',
    tag: null,
    tagColor: '#2563eb',
    items: [
      { type: 'new', text: '/antibiotics — antibioterapia empírica: 1.ª/2.ª linha, cobertura MRSA/ESBL, step-down IV→oral, duração, ajuste renal, stewardship. Baseado em ESCMID/EUCAST 2024, IDSA, DGS PPCIRA' },
      { type: 'new', text: '/stopp-start — análise STOPP/START v3 (2023) + Beers 2023 com seleção de doente, 24 chips de diagnóstico, exportação e 3 painéis por critério' },
      { type: 'new', text: '/polypharmacy — auditoria completa de polimedicação: MPI, duplicações, cascatas de prescrição, carga anticolinérgica (ACB), omissões terapêuticas. Essencial para lares e hospitais' },
      { type: 'new', text: '/counseling — folha de aconselhamento ao doente personalizável: dose, timing, efeitos adversos, armazenamento, grupos especiais — imprimível ou exportável' },
      { type: 'new', text: '/iv-compatibility — compatibilidade IV Y-site, mistura e seringa para até 8 fármacos em paralelo. Trissel\'s 2024, King Guide, Micromedex' },
      { type: 'new', text: '/emergency-doses — calculadora de doses de emergência por peso: PCR, RSI, sedação, vasopressores, antídotos. Cálculo automático de volume' },
      { type: 'new', text: '/electrolytes — protocolos completos de reposição: K, hiperK, Na, Mg, Ca, Fosfato. TBW, correção albumina, velocidades de infusão seguras' },
      { type: 'improved', text: 'Navegação clínica atualizada com todas as novas ferramentas pro: antibioterapia, polimedicação, aconselhamento, IV, emergência, eletrólitos' },
    ],
  },
  {
    version: '2.6',
    date: '2026-05-20',
    tag: null,
    tagColor: '#2563eb',
    items: [
      { type: 'new', text: 'Nova página /nota-clinica — geração de nota SOAP estruturada com IA (tipos: SOAP, Evolução, Alta, Interconsulta)' },
      { type: 'new', text: 'Nova página /drug-info — monografia completa de fármacos: mecanismo, doses renais/hepáticas, interações, RAMs' },
      { type: 'new', text: 'Nova página /handover — passagem de turno automática com resumo por doente gerado por IA' },
      { type: 'new', text: '/turno reescrito: countdown do turno, notas por dose, pesquisa de doentes, timestamps de administração, print' },
      { type: 'new', text: '/mar: administrar todos pendentes com 1 clique, timestamps + registado por por linha, botão print, link para passagem' },
      { type: 'new', text: '/patients: formulário com peso, altura e creatinina; badge GFR em lista; alerta "ALERGIA" visível' },
      { type: 'new', text: '/patients/[id]: badge IRC G1-G5 com cor, indicador de polimedicação, links Ronda e Oracle' },
      { type: 'new', text: '/rounds: pesquisa de doentes, exportação PCNE para CSV, link para nota clínica por doente' },
      { type: 'new', text: '/oracle: botão "Copiar SOAP" para clipboard, seletor de doente registado (pré-preenche dados)' },
      { type: 'new', text: '/adr-report: histórico de análises com localStorage — recarrega análise anterior com 1 clique' },
      { type: 'new', text: '/reconciliacao: botões aceitar/recusar por discrepância, notas por decisão, exportar nota clínica' },
      { type: 'new', text: 'Calculadoras: 3 novos scores — CURB-65 (pneumonia), MEWS (deterioração clínica), Caprini VTE (cirurgia)' },
      { type: 'new', text: 'Navegação clínica atualizada: nota-clinica, drug-info, handover adicionados ao menu e quick actions' },
    ],
  },
  {
    version: '2.5',
    date: '2026-05-20',
    tag: null,
    tagColor: '#059669',
    items: [
      { type: 'new', text: 'Dashboard de família (/familia) — resumo de todos os perfis com risco, STOPP e medicação' },
      { type: 'new', text: '/mymeds totalmente preparado para perfis familiares — dados, adição, remoção e lembretes por perfil' },
      { type: 'new', text: 'Banner de contexto familiar em /mymeds — alergias, condições e aviso STOPP para ≥75 anos' },
      { type: 'new', text: 'Verificação de alergias ao adicionar medicamento a perfil familiar' },
      { type: 'new', text: '/vitals com filtragem real por perfil — sinais vitais separados por perfil familiar (requer migração SQL)' },
      { type: 'new', text: '/schedule carrega corretamente a medicação do perfil familiar selecionado' },
      { type: 'new', text: 'CaregiverHome: cards com risco, alergias, condições, links diretos para meds e vitais' },
      { type: 'new', text: 'CaregiverHome: secção de medicação familiar com botão "Verificar interações" por perfil' },
      { type: 'new', text: 'Botões "Medicamentos" e "Vitais" em /perfis abrem a página com o perfil familiar pré-selecionado' },
      { type: 'new', text: 'Chat em /mymeds usa contexto do perfil familiar (nome, idade, condições, alergias)' },
      { type: 'new', text: '/adr-report pré-preenche idade e sexo do perfil familiar selecionado' },
      { type: 'new', text: '/optimizer carrega medicação do perfil familiar e pré-preenche idade' },
      { type: 'new', text: '/oracle carrega medicação e idade do perfil familiar selecionado' },
      { type: 'new', text: '/calendario-meds carrega medicação do perfil ativo ao iniciar (em vez de apenas ao mudar)' },
      { type: 'new', text: 'Interações: pré-preenchimento via sessionStorage para link rápido do dashboard familiar' },
      { type: 'new', text: 'Nav cuidador atualizada: link para /familia, /schedule, reorganização' },
      { type: 'new', text: 'Ficheiro de migração SQL para coluna profile_id na tabela vitals' },
    ],
  },
  {
    version: '2.4',
    date: '2026-05-20',
    tag: null,
    tagColor: '#059669',
    items: [
      { type: 'new', text: 'Score de saúde pessoal com barra de progresso e streak de adesão' },
      { type: 'new', text: 'Trend arrows nos sinais vitais — comparação com leitura anterior' },
      { type: 'new', text: 'Sistema XP + ligas para modo estudante (Bronze → Diamante)' },
      { type: 'new', text: 'Badges de risco e flags STOPP em doentes (ClinicalHome)' },
      { type: 'new', text: 'Countdown do turno na vista clínica' },
      { type: 'new', text: 'Exportação de dados (JSON + CSV) em Definições' },
      { type: 'new', text: 'Botão de copiar em mensagens da Phlox AI' },
      { type: 'new', text: 'Textarea auto-resize e contador de caracteres no chat AI' },
      { type: 'new', text: 'Barra de adesão de tomas no topo de /mymeds' },
      { type: 'new', text: 'Indicador "Verificar stock" para medicamentos com >25 dias' },
      { type: 'new', text: 'Pré-população de /interactions via ?drugs= URL param' },
      { type: 'new', text: 'Botão Copiar resultado em /interactions' },
      { type: 'new', text: 'PWA manifest com atalhos para interações, AI e mymeds' },
      { type: 'new', text: 'Scroll-to-top automático + ⌘K para ferramentas' },
      { type: 'fix', text: 'Sitemap.xml dinâmico com todas as páginas públicas' },
      { type: 'fix', text: 'aiJSON com extração robusta de JSON e mensagens de erro claras' },
      { type: 'fix', text: 'robots.txt protege rotas autenticadas de indexação' },
      { type: 'fix', text: 'Print styles melhorados para documentos clínicos' },
    ],
  },
  {
    version: '2.3',
    date: '2026-05-10',
    tag: null,
    items: [
      { type: 'new', text: 'Página /inicio totalmente integrada com dados reais (vitais, perfis, doentes)' },
      { type: 'new', text: 'Dropdowns fixados em desktop — não clipam dentro do header' },
      { type: 'new', text: 'BottomTabBar reescrita com tabs por modo, badge de notificações' },
      { type: 'new', text: 'Sugestões de prompt contextuais na AI por modo (clinical, student, caregiver)' },
      { type: 'fix', text: 'Fetch de sinais vitais usa /api/vitals em vez de query direta' },
      { type: 'fix', text: 'CaregiverHome e ClinicalHome com schema correto da base de dados' },
    ],
  },
  {
    version: '2.2',
    date: '2026-04-28',
    tag: null,
    items: [
      { type: 'new', text: 'Chat de medicação em /mymeds com contexto do utilizador' },
      { type: 'new', text: 'Verificação automática de interações ao adicionar medicamento' },
      { type: 'new', text: 'Web Push Notifications para lembretes de toma' },
      { type: 'new', text: 'Scan de receita médica via foto com IA' },
      { type: 'new', text: 'Cartão de emergência com QR code' },
    ],
  },
  {
    version: '2.1',
    date: '2026-04-15',
    tag: null,
    items: [
      { type: 'new', text: 'MAR (Medication Administration Record) para organizações' },
      { type: 'new', text: 'Sistema de Rounds farmacêuticos' },
      { type: 'new', text: 'Perfis familiares com medicação independente' },
      { type: 'new', text: 'Arena de ligas com pontuação competitiva' },
    ],
  },
]

const TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  new:  { label: 'Novo',      color: '#059669', bg: '#d1fae5' },
  fix:  { label: 'Fix',       color: '#2563eb', bg: '#dbeafe' },
  perf: { label: 'Perf',      color: '#7c3aed', bg: '#ede9fe' },
  dep:  { label: 'Depreciado',color: '#d97706', bg: '#fef9c3' },
}

export default function ChangelogPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
            Phlox Clinical
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            Changelog
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6 }}>
            Novidades, correções e melhorias em cada versão da plataforma.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {RELEASES.map(release => (
            <div key={release.version}>
              {/* Version header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 500 }}>
                  v{release.version}
                </div>
                {release.tag && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: release.tagColor, background: `${release.tagColor}18`, border: `1px solid ${release.tagColor}40`, borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {release.tag}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {new Date(release.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {release.items.map((item, i) => {
                  const s = TYPE_STYLE[item.type] || TYPE_STYLE.fix
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 3, padding: '2px 6px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0, marginTop: 2 }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>{item.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
