# Phlox — Dívida Técnica Crítica

Registo prioritizado de tudo o que está identificado como problema real e ainda
não foi resolvido. Cada item indica **impacto**, **estimativa** e **referência**.
Atacar pelo topo. Atualizar à medida que se completa.

---

## P0 — Bloqueia confiança do utilizador

### ⚠ Quizzes com respostas erradas — MITIGADO (2026-06-01)
- **Onde**: `/arena`, `/exam`, `/cases`, flashcards — tudo AI-gerado, não há banco fixo.
- **O que foi feito**:
  - `lib/quizQuality.ts` centraliza `QUIZ_RULES_PT` (10 regras anti-erro: PT-PT, 1 só correta, mecanismo, referências reais, sem inventar normas DGS).
  - Aplicado a **todos** os endpoints geradores: `/api/study/quiz`, `/api/arena/challenge`, `/api/cases`, `/api/study/flashcards`.
  - `inspectQuestion()` faz sanity-check pós-geração (PT-BR óbvio, opções duplicadas, índice fora de intervalo, etc.) e devolve `quality_flags` para a UI mostrar aviso amarelo "verifica com cuidado".
  - **Sistema de reporte** de erro: tabela `quiz_feedback` (`sprint44_quiz_feedback.sql`) + endpoint `/api/quiz-feedback` + componente reutilizável `<ReportQuizError />`. Está integrado em `/exam` e `/arena`. Cada reporte fica em Supabase para revisão.
- **O que falta**:
  - Aplicar `<ReportQuizError />` a flashcards quando esses tiverem UI dedicada.
  - Criar dashboard interno (Supabase Studio basta inicialmente) para a equipa rever reportes e marcar como `fixed`.
- **Esforço restante**: baixo.

### ✅ Simuladores que não abrem — FIXED (2026-06-01)
- **Causa raiz**: `app/shift/page.tsx` era um redirect circular para `/simulador?mode=shift` (introduzido em ba69ed5 "notifications + redirect" que partiu a página).
- **Fix**: restaurada a página completa do Turno Virtual com 3 doentes, setup (especialidade + dificuldade), fase ativa, resultados; pré-preenchimento via `sessionStorage.phlox_shift_config`; consome `/api/shift/generate` e `/api/shift/evaluate` já existentes.

### ✅ Caso evolutivo demasiado guiado — REFEITO (2026-06-01)
- **Problema**: utilizador só podia escolher botões pré-definidos; doente nunca morria; consequências fracas.
- **O que foi feito**:
  - **Input livre**: nova categoria `free` com input `<FreeActionInput>` — o utilizador pode escrever QUALQUER ação clínica (incluindo absurdas) e a AI simula a consequência real.
  - **Morte do doente** agora é desfecho possível: severidade `deceased`, badge "✟ Doente faleceu" no resultado, score automaticamente ≤25 se evitável.
  - **Consequências reais reforçadas** no prompt da action API: lista explícita de pares ação→consequência fatais (betabloq IV em choque cardiogénico, furosemida em hipovolemia, atrasar adrenalina em anafilaxia, KCl em bólus rápido, etc.).
  - **Mechanism + evidence_note** em cada consequência (porque aconteceu + referência guideline).
  - **Debriefing completo** ao acabar: outcome, missed_opportunities, time_assessment, key_references — agora chama `/api/decisao/end` no fim (antes ficava sem avaliação).
  - **4 casos novos** acrescentados: anafilaxia, AVC isquémico (janela), hipercaliémia com ECG alterado, overdose opioide.

### ✅ /brief não funcionava — FIXED (sessão anterior)
- Causa: `const now = new Date()` na dependência do `useCallback` criava loop infinito.
- Fix: `useState(() => new Date())` para estabilizar a referência.

---

## P1 — Funcionalidade incompleta de alto valor

### ✅ Upload de PDF/PPT com explicação interativa — FEITO (2026-06-01)
- `lib/docExtract.ts` extrai texto no browser (pdf.js via CDN, .docx/.pptx via mini ZIP parser sem deps server).
- `/biblioteca` permite carregar PDF/Word/PPT/colar texto → AI gera resumo, outline, conceitos-chave, 8 perguntas MCQ e 10 flashcards.
- Tudo guardado em `study_documents` (sprint45) — privacidade: o ficheiro original nunca sai do dispositivo.
- Tabs no visualizador: Resumo · Conceitos · Perguntas · Flashcards · Texto original.

### (mantém-se na lista o original para referência) — Upload de PDF/PPT com explicação interativa (ESTUDANTE)
- **Visão**: estudante carrega slides de aula ou PDF do livro, escolhe o objetivo ("explicar para exame", "criar resumo", "fazer quiz"), Phlox processa e gera ferramenta interativa. Documento fica guardado na biblioteca pessoal.
- **Componentes**:
  - Tabela `study_documents` (user_id, filename, kind, parsed_text, summary, created_at)
  - Parser de PDF (pdf-parse no browser ou server) e PPT (pptx-extractor)
  - Endpoint que pega texto + objetivo → gera plano de estudo / quiz / explicação
  - Página `/biblioteca` para organizar
- **Esforço**: muito alto (parsers + AI + UI + storage).

### 📚 Flashcards SRS (ESTUDANTE)
- **Visão**: mnemónicas e conceitos guardados viram cards com spaced repetition (SM-2 ou FSRS).
- **Componentes**:
  - Tabela `study_cards` (front, back, ease, interval, due_date)
  - Algoritmo SRS
  - Página `/flashcards` com revisão diária
- **Esforço**: médio.

---

## P2 — Limpeza estrutural

### 🧹 Duplicados conhecidos
- `/calc` vs `/calculos` vs `/calculators` — parcialmente clarificado nomes; deciso final: agregar em **dois** (essenciais + farmacocinéticas), redirecionar terceira.
- `/brief` vs `/briefing` — clarificado nomes; decisão: manter separados (são diferentes).
- `/dose-crianca` vs `/doses` vs `/emergency-doses` — auditar e agregar.
- `/drugs` vs `/drug-info` vs `/drug-intelligence` — auditar.
- `/dashboard` (1196L) vs `/dashboard-institucional` (393L) — provavelmente sobreposição massiva.
- `/family` (926L) vs `/familia` (217L) — auditar e unificar.

### 🧹 Página /codes removida da UI
- Já feito; rota mantida para não quebrar mas não promovida.

---

## P3 — Integrações falhadas/em falta

### 📅 Calendário .ics
- **Status**: existe `lib/ics.ts` e botão "📅 Calendário" em `/preparar-consulta`. Utilizador reportou que não funciona.
- **Ação**: testar download + verificar MIME, encoding, validação em validators.icalvalid.cloudieno.de. Corrigir.

### 📥 Google Fit / Samsung Health / WHOOP / Garmin
- Mencionado mas não implementado.
- **Esforço**: cada provider é uma integração separada.

### 💳 Apple Wallet / Google Pay pass real
- Cartão visual em estilo Wallet existe (`/cartao-emergencia`) mas não é um `.pkpass` verdadeiro.
- Para `.pkpass` real precisa de Apple Developer + certificado.

---

## ✅ Ronda 2026-06-01 — 5 melhorias premium por plano (todas entregues)

### Personal
1. `/risco` — perfil de risco com SCORE2 (ESC 2021), ACB, STOPP/Beers automático
2. `/vault` — cofre de saúde com partilha por **código temporário** (8 chars, expira, max-views)
3. `/saude360` — adesão (heatmap 90d), sparklines de análises, smart refill, próximos compromissos
4. `/share/[code]` — visualizador público sem login para destinatários
5. Integração no nav (Saúde 360°, Risco, Cofre como categorias premium)

### Caregiver
1. `/familia360` Inbox — resumo diário por familiar (medicação, vitais, próximos)
2. `/familia360` Reconciliação — diff antes/depois (added/removed/changed/unchanged)
3. `/familia360` Auditor cruzado — duplicações entre familiares
4. `/familia360` Zarit-12 — escala validada de sobrecarga do cuidador com histórico
5. `/familia360` Cofre & partilhas — atalhos para Vault/Passaporte/Preparar consulta

### Student
1. `/biblioteca` (já feita acima) — PDF/PPT → resumo + perguntas + flashcards
2. `/study360` SRS — algoritmo SM-2 (Wozniak 1985) com rating 0–5 e estatísticas
3. `/study360` Plano AI — distribuição semanal por data de exame (`/api/study-plan`)
4. `/study360` Pomodoro — 25/50 min com tracking em `study_sessions`
5. `/study360` Stats — cards maduros, ease médio, % acertos SRS, tempo total

### Clinical
1. `/clinico360` Workflow Pulse — KPIs MAR em tempo real (on-time, omissões, conclusão)
2. `/clinico360` Risk Forecast — ranking de doentes por score STOPP/Beers (rankPatientsByRisk)
3. `/clinico360` Stewardship — top consumo de antibióticos + flags de sobreuso (quinolonas > 25 %, carbapenemes > 10 %)
4. `/clinico360` Benchmark — comparar com targets publicados (ISMP, AHRQ, Surviving Sepsis)
5. `/clinico360` Audit Trail — últimas intervenções farmacêuticas com pesquisa

### Migrações SQL para correr em prod
- `sprint44_quiz_feedback.sql` (ronda anterior)
- `sprint45_study_documents.sql` ← biblioteca
- `sprint46_premium_personal.sql` ← vault, lab_results, med_logs, refill
- `sprint47_premium_caregiver.sql` ← caregiver_burden, med_snapshots
- `sprint48_premium_student.sql` ← study_cards, study_plans, study_sessions

---

## Notas

- O ficheiro existe para evitar promessas vagas. Cada item deve ser atacado um de cada vez, validado, e marcado feito.
- Quando uma melhoria for entregue, mover daqui para o `CHANGELOG` (`/changelog`) com data e nº de versão.
