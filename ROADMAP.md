# Phlox — Roadmap até ao Lançamento Público

> **Estado atual:** Plataforma funcional com +35 ferramentas, 4 modos de experiência (Pessoal, Cuidador, Clínico, Estudante), IA integrada (Groq + Gemini), notificações push, chat com medicação, score de risco clínico, passaporte de saúde com QR e Phlox Link.

---

## Sprint 9 — Qualidade & Polimento (1–2 semanas)

### Crítico antes do lançamento
- [ ] **Testes end-to-end** nas rotas principais: `/interactions`, `/mymeds`, `/passport`, `/link`, `/bula`
- [ ] **Error boundaries** globais — nenhuma página deve quebrar com tela branca
- [ ] **Loading states** consistentes em todas as páginas com dados async
- [ ] **Página 404** e **500** customizadas com design Phlox
- [ ] **Responsividade mobile** — rever breakpoints em `/rounds`, `/mar`, `/turno`
- [ ] **Revisão de acessibilidade** — ARIA labels, contraste, keyboard nav no Command Palette
- [ ] **Rate limiting** verificado em todas as rotas de IA (já implementado na maioria)
- [ ] **Sanitização de input** — rever XSS em campos de texto livre
- [ ] **SEO** — meta tags dinâmicas por página, sitemap.xml, robots.txt completo

### Conteúdo
- [ ] **Termos de Utilização** — `/terms` — incluir disclaimer clínico obrigatório
- [ ] **Política de Privacidade** — `/privacy` — RGPD, processamento de dados de saúde (categoria especial), direito ao esquecimento
- [ ] **Sobre / Missão** — `/about` — história, equipa, missão (página já existe, rever conteúdo)
- [ ] **FAQ** — `/faq` — perguntas frequentes por modo de experiência
- [ ] **Disclaimer clínico** visível em todas as ferramentas de IA

---

## Sprint 10 — Engagement & Retenção (2–3 semanas)

### Loop diário (aumentar retenção D7 e D30)
- [ ] **Streak de adesão** — contador de dias consecutivos com 100% de toma em `/mymeds`
- [ ] **Daily Brief melhorado** — incluir previsão do tempo para saídas, lembretes de renovação de receita
- [ ] **Notificação push diária** — "Bom dia, Fernando. Tens 3 medicamentos hoje." (opt-in)
- [ ] **Widget de adesão semanal** no dashboard — gráfico de barras dos últimos 7 dias
- [ ] **Gamificação leve** — badges de adesão (7 dias, 30 dias, 100 dias) para modo Pessoal e Cuidador

### Onboarding
- [ ] **Wizard de onboarding** na primeira sessão — 4 passos: modo → adicionar med → horário → ativar lembretes
- [ ] **Checklist de setup** no dashboard para novos utilizadores ("5 coisas a fazer")
- [ ] **Tour interativo** nas ferramentas principais (usando Shepherd.js ou similar)
- [ ] **E-mail de boas-vindas** com os 3 primeiros passos personalizados por modo

---

## Sprint 11 — Funcionalidades Premium (3–4 semanas)

### Modo Pessoal/Cuidador
- [ ] **Calendário de medicação** (`/calendario-meds`) — vista semanal/mensal de tomas
- [ ] **Renovação de receita inteligente** — alerta quando stock de medicamento vai acabar
- [ ] **Histórico de saúde** (`/timeline`) — linha do tempo de eventos, medições, medicamentos
- [ ] **Preparar consulta** (`/consult-prep`) — gera lista de perguntas para o médico
- [ ] **Exportação de dados** — PDF do passaporte, CSV de vitais, relatório completo

### Modo Clínico
- [ ] **Carta de alta farmacoterapêutica** (`/carta`) — gerador com AI e assinatura
- [ ] **Lares & Residentes** (`/residentes`) — gestão de múltiplos residentes num lar
- [ ] **Escalas clínicas** (`/escalas`) — PHQ-9, NIHSS, Braden, Morse, MNA (calculadoras interativas)
- [ ] **Relatório mensal de Ronda** — PDF automático com métricas PCNE
- [ ] **Integração SClínico/Sifarma** — importação de prescrições (via CSV/PDF)

### Modo Estudante
- [ ] **Grand Round** (`/grand-round`) — casos clínicos reais em formato de debate
- [ ] **Modo Exame** (`/exam`) — timer, formato MCQ nacional, análise de erros
- [ ] **Ficha de Fármaco** (`/ficha`) — mecanismo, mnemónica, interações, quiz rápido
- [ ] **Leaderboard global** — ranking nacional de estudantes na Arena
- [ ] **Integração Moodle** — exportar casos/quizzes para LMS universitários

---

## Sprint 12 — Infraestrutura & Escala (2–3 semanas)

- [ ] **Monitorização** — Sentry para erros, PostHog para analytics, Grafana para latência de IA
- [ ] **Cache de IA** — Redis/Upstash para respostas frequentes (interações populares, bulas comuns)
- [ ] **CDN** — imagens e assets estáticos via Cloudflare R2
- [ ] **Backup automático** — Supabase scheduled backups + export para S3
- [ ] **Plano de incidentes** — runbook para falhas de IA, downtime de Supabase, VAPID key rotation
- [ ] **Testes de carga** — simular 500 utilizadores simultâneos nas rotas de IA
- [ ] **DPIA** — Data Protection Impact Assessment (obrigatório para dados de saúde, art. 35 RGPD)
- [ ] **Registo CNPD** — notificação à Comissão Nacional de Proteção de Dados (Portugal)

---

## Sprint 13 — Lançamento Público (semana do lançamento)

### Pré-lançamento (48h antes)
- [ ] **Beta privado** — 50 utilizadores selecionados (farmacêuticos, estudantes de farmácia, cuidadores)
- [ ] **Stress test** final em produção
- [ ] **Rever todos os e-mails transacionais** (confirmação, reset password, boas-vindas)
- [ ] **Página de status** — status.phlox.pt ou similar

### Lançamento
- [ ] **Product Hunt** — lançar às 00:01 PST de uma terça ou quarta-feira
- [ ] **LinkedIn** — posts em PT e EN pelo fundador
- [ ] **Grupos de farmácia** — Farmácias Portuguesas no Facebook, grupos de estudantes de farmácia
- [ ] **Reddit** — r/portugal, r/pharmacy, r/medicine com post genuíno
- [ ] **Universidades de farmácia** — e-mail direto a professores de farmacologia (FFUL, FFUC, UAlg)

### Métricas de sucesso no lançamento
- [ ] 500 utilizadores registados na primeira semana
- [ ] NPS ≥ 8 após 7 dias
- [ ] D7 retention ≥ 35%
- [ ] 0 incidentes de segurança críticos

---

## Pós-lançamento (não antes do lançamento)

> Estas funcionalidades requerem tracção e receita antes de serem justificadas.

- Parcerias com Ordem dos Farmacêuticos e Ordem dos Médicos
- Integração MySNS / Plataforma de Dados de Saúde (PDS)
- Versão nativa iOS/Android (React Native ou Expo)
- API pública para integração com outros sistemas de saúde
- Plano Enterprise para hospitais e grupos farmacêuticos
- Módulo de telemedicina
- Integração com sistemas de dispensa robótica (Consis, BD Rowa)
- Certificação como Dispositivo Médico (MDR 2017/745) — processo longo, 12-18 meses

---

## Critérios de "Pronto para Lançamento" (checklist final)

| Critério | Status |
|---|---|
| Todas as rotas de API têm autenticação | ✅ |
| Rate limiting em rotas de IA | ✅ |
| sprint8.sql com políticas RLS públicas corretas | ✅ |
| Passaporte QR e Phlox Link funcionam sem service role key | ✅ |
| Notificações push funcionais (web) | ✅ |
| Termos + Privacidade publicados | ⬜ |
| Disclaimer clínico em todas as ferramentas de IA | ⬜ |
| DPIA redigido e aprovado | ⬜ |
| Error boundaries em todas as páginas | ⬜ |
| Onboarding wizard | ⬜ |
| Testes E2E nas rotas críticas | ⬜ |
| Performance: LCP < 2.5s em mobile | ⬜ |
| Acessibilidade: WCAG 2.1 AA básico | ⬜ |
| Beta privado concluído | ⬜ |

---

*Atualizado: Maio 2026 — Versão 0.9 (pré-lançamento)*
