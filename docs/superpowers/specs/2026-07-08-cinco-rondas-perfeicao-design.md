# Plano de 5 Rondas — Perfeição para Apresentação

**Objetivo:** deixar o Phlox pronto para o ciclo de aquisição completo, sem dados falsos nem demos:
**Centro de Dia → Famílias → Uso Pessoal → Estudante.** Cada elo tem de estar perfeito, porque
cada um mostra ao seguinte. Tudo pronto a usar a sério, no telemóvel e no computador.

Baseado numa auditoria completa do código (4 varreduras: clínico, cuidador/família, pessoal/estudante,
transversal). Cada achado abaixo tem ficheiro/linha real.

**Princípios (aplicam-se a todas as rondas):**
- **Zero dados falsos/demo** no produto real. `/demo` sai do caminho do utilizador.
- **Começar vazio e limpo:** uma conta nova (centro, família, pessoa, estudante) nunca parece "partida" —
  tem sempre um estado vazio caloroso com o próximo passo claro.
- **Mobile-first:** trabalhadores e famílias usam telemóvel. Cada ecrã testado a 375px.
- **Nunca um beco:** botões nunca "não fazem nada"; limites e gates mostram convite claro, não erro.
- **Verificação:** `npx tsc --noEmit`=0, `check-vocab.mjs`=0, `check-nav.mjs`=0, e teste no browser
  (real, sem dados de exemplo) antes de fechar cada ronda. Restaurar a conta QA no fim.
- **Guard-rails novos** quando um erro é sistémico (ex.: um linter que apanhe links para rotas-redirect).

---

## RONDA 1 — "Pronto para a porta" (o que a apresentação NÃO pode ter)

Tudo o que envergonha numa apresentação ao vivo ou mina a credibilidade. É a ronda mais barata e a de
maior risco se falhar. Sai daqui um site coerente: só lar + centro de dia, sem farmácia/hospital, sem demos.

**1.1 Marketing/copy obsoleto (vende produto arquivado):**
- `app/institucional/page.tsx` — reescrever de raiz: só Centro de Dia + Lar. Remover Farmácia/Hospital/
  Clínica e Ward/Connect/Rounds/PCNE. Preço e proposta talhados a estes dois.
- `app/page.tsx:94` — "Lar, centro de dia, farmácia" → "Lar e Centro de Dia".
- `lib/plans.ts:67-76` — plano Institucional: tagline e features sem "farmácia/balcão/doentes"; realçar
  Centro de Dia (portal de famílias, dia do utente, medicação casa↔centro). Rever também o Pro (menciona
  "Saúde 360°" e "motor clínico" removidos).
- `app/trust/page.tsx` — trocar "Ward/Connect/Rounds" por Painel/MAR/Portal Famílias.
- Varredura final por "farmác|balcão|hospital|Ward|Connect|Rounds|PCNE|149" em páginas públicas.

**1.2 Demos fora do caminho:**
- Remover TODOS os links para `/demo`: `app/centro-de-dia:47,77,108`, `app/onboarding:44`,
  `app/painel/PainelCockpit.tsx:296`. Decisão: manter a pasta `/demo` no repo (arquivada) mas sem entradas
  visíveis — ou substituir os CTAs por "Criar a minha instituição" / "Ver o portal das famílias" (screenshots reais).

**1.3 Links mortos na navegação (redirects em cadeia):**
- `app/onboarding/page.tsx:38` `/study360` → `/study`.
- `components/Header.tsx:264,373` `/aprender` → `/study`.
- **Guard novo** `scripts/check-links.mjs`: falha se algum ficheiro linkar para uma rota que é só-redirect
  (lista: /turno,/saude360,/aprender,/study360,/modo-exame,/oracle,/med-review,/familia360,/food-drug,
  /quality,/carta,/reconciliacao,/rounds,/balcao,/prescription-queue,/agenda,/connect). Corre no mesmo
  sítio que check-vocab/check-nav.

**1.4 Rótulos e coerência:**
- `components/Header.tsx:177` planLabels `clinic:'Clínica'` → `'Institucional'` (bate com plans.ts).
- Varrer `planLabels`/nomes de plano por todo o lado.

**1.5 Legal/confiança (a instituição escrutina):**
- `lib/legal.ts:14-22` — preencher entidade/NIF/morada reais ou provisórios credíveis (não "(a indicar)").
- Confirmar que o plano Institucional **não mostra anúncios** (AdSense gated OFF p/ clinic) e dizê-lo no legal.
- Rever /terms /privacy /dispositivo-medico /subprocessadores por menções a ferramentas arquivadas.

**1.6 Rede de segurança de produção:**
- Error boundary global com fallback caloroso (não ecrã branco) — se uma API falhar na apresentação.
- (Opcional) cabeçalho CSP básico em next.config.

**Sai:** site público 100% coerente com o produto real (lar+centro de dia), sem demos, sem links mortos,
legal credível. `check-links.mjs` a proteger contra regressões.

---

## RONDA 2 — Centro de Dia à prova de bala (o primeiro cliente)

O centro tem de conseguir: criar conta → começar vazio e limpo → adicionar utentes → viver o dia
(presenças, medicação, registo, atividades, famílias) no telemóvel, sem tropeçar. É o elo que sustenta
todos os outros.

**2.1 Arranque de uma instituição nova (vazio e limpo):**
- Rever `/comecar-instituicao` + `/api/org/setup`: passos claros (tipo → criar org → adicionar 1º utente →
  convidar equipa). Sem dados de exemplo. Cada passo com "porquê" e o próximo passo.
- `/patients` paywall (`page.tsx:232 if(!isPro)`) — garantir que o dono/membro em modo clínico (plano
  efetivo 'clinic', já corrigido) NUNCA vê paywall. Testar o caminho signup→criar org→/patients de fresco.
- Estados vazios de TODAS as páginas clínicas: um centro com 0 utentes vê ecrãs calorosos com CTA, nunca
  "a tabela X não existe". Especial: `/stock:98` (mostrar empty state, não erro de tabela).

**2.2 Adaptação ao tipo (Centro de Dia ≠ Lar):**
- `/mar`: respeitar `hasShifts:false` do centro de dia (institutionConfig:60) — esconder o seletor de
  turnos, usar turno único "dia". Hoje mostra manhã/tarde/noite indevidamente.
- `/mar:200` e `:374` — "doentes" hardcoded → `cfg.personNounPlural` (utentes).
- Varredura final de vocabulário nas páginas clínicas (utente/residente/sala/quarto).

**2.3 Fluxos do dia (fluidez ponta-a-ponta):**
- **Presenças** (cockpit): rever os estados (por chegar / presente / saiu) — hoje só 2 botões; clarificar.
- **Medicação** (/mar): seleção de utente, dar/desmarcar, folha de MAR — mobile-first (cabeçalho sticky
  parte <480, PainelCockpit/mar). Feedback otimista no consumo.
- **Registo do dia** (/care-log): abas (registo/hidratação/atividades) com erro por aba, não branco;
  desfazer o cross-import frágil care-log↔activities (extrair para ficheiros próprios).
- **Atividades**: o envio automático às famílias ao registar tem de ter confirmação/opt-out (evitar spam
  em testes) — `activities:139-144`.
- **Ocorrências**: notificação de gravidade não deve usar `confirm()` cru; modal com editar mensagem antes
  de enviar + sem envio acidental (`incidents:130-147`).

**2.4 Cockpit (a "cara" do dia):**
- Skeletons por bloco em vez de "A carregar…" a bloquear tudo (PainelCockpit:306,352).
- Blocos degradam bem sem dados (family_messages em falta não parte o bloco).
- Modo imprimir "o dia de hoje" para a reunião diária.
- Reflow mobile dos blocos (hero/large) + hub do painel-dono (6 cards apertados <480).

**2.5 Segurança de dados do dia-a-dia:**
- Soft-delete de utentes (active:false + vista de arquivo), não apagar para sempre (`patients:152`).

**Sai:** um centro cria conta, começa do zero, e faz um dia inteiro de trabalho no telemóvel sem uma única
aresta. Vocabulário perfeito, tipo-adaptado, estados vazios calorosos.

---

## RONDA 3 — Famílias e Cuidadores (o elo que a instituição mostra aos familiares)

O centro vai mostrar o portal às famílias. Tem de inspirar confiança a pessoas preocupadas com um idoso,
no telemóvel, sem saberem de tecnologia. E o modo cuidador (gerir a mãe em casa) tem de valer por si.

**3.1 Confiança no portal família (trust-breakers):**
- **Marcar medicação:** o toggle que "desmarca" silenciosamente corrompe o registo da instituição
  (`portal-familia:342`, `family-portal:237`). Pôr confirmação/undo explícito, ou bloquear após o turno.
- **"Medicação em casa"** escondida quando vazia (`portal-familia:329`) → mostrar SEMPRE, com estado vazio
  + sugerir medicação. É a ponte casa↔centro; hoje é invisível no primeiro acesso.
- **Pedir visita** não existe no portal autónomo (só mostra visitas passadas) — adicionar botão a espelhar
  o VisitForm do LinkedResidents.
- **Trocar de utente** no telemóvel está partido (carrossel de avatares, sem voltar) — cabeçalho
  "← Maria (Q2)" (`portal-familia:267`).

**3.2 Tom caloroso (famílias preocupadas):**
- Resumos diários com tom humano, não alarmante: "Tomou 1 de 2 medicamentos" → "Falta registar 1"
  (`family-portal:51-93`).
- Etiquetas de urgência nos sinais do cuidador (🔴 112 / 🟠 médico hoje / 🟡 acompanhar).
- Verificação (código + 4 dígitos): tentativas restantes, cópia clara, e o que fazer se falhar.
- 429 → "aguarde um minuto", não "falha de ligação".

**3.3 Cuidador como produto completo:**
- Onboarding/indicador de modo cuidador (hoje não sabe que está em modo cuidador) + "Modo Cuidador · João (pai)".
- `/familia` renomear "Centro de cuidado" → "A sua família"; separar visualmente local (em casa) de
  institucional (LinkedResidents).
- Garantir que os CTAs do cuidador (/consult-prep, /med-review→/assessments) aceitam contexto cuidador +
  family_profile_id (não assumem instituição).
- Wizard de adicionar familiar (nome→relação→idade→condições/alergias) — melhores sinais de vigilância.
- Guardar o nome do familiar 1x (não repetir input a cada chat — `LinkedResidents:213`).

**3.4 Polido:**
- Cancelar/editar pedido de visita; feedback persistente ao sugerir medicação; auto-scroll só se no fundo;
  skeleton dos home-meds; "há registos a ver" → concreto ("2 dias para acompanhar").

**Sai:** uma família recebe o código, entra no telemóvel, vê o dia do seu familiar com carinho e clareza,
marca a medicação de casa sem medo de estragar nada, e pede uma visita. O cuidador em casa também.

---

## RONDA 4 — Pessoal e Estudante (os elos finais do ciclo)

Se a família gosta, mostra a quem cuida da própria saúde (pessoal) e a filhos/conhecidos a estudar saúde
(estudante). Ambos têm de ser produtos completos e polidos, que alguém pague e recomende.

**4.1 Pessoal — arranque e vazios:**
- Cartão de boas-vindas no `/inicio` quando `hasAnyData===false` (hoje `inicio:185` assume true) com
  primeiros passos ("Adicionar o 1º medicamento", "Registar tensão").
- CTA primário "+" em todos os estados vazios (/mymeds, /vitals, /sintomas, /timeline).
- Handoff `/scan`→`/mymeds`: confirmação + recuperação por sessionStorage (hoje sente-se perdido).
- Limites (scan/interactions/ai): mostrar convite de upgrade limpo, nunca `setErr('limit')` cru
  (`scan:96-97`). Reusar o UpgradePrompt do /interactions.
- `/vitals`: banner "regista 2+ para ver tendências"; `/health-pass`: timeout+cancelar no QR, QR não
  transborda <375px.
- Wizard opcional de arranque (medicação → lembretes com presets 8h/13h/20h).

**4.2 Estudante — coerência de planos e resiliência:**
- **Decisão de gating:** flashcards básicas são Free ou Plus? Hoje o registry diz free mas `/study` mostra
  nudge Plus e cartões desativados — tornar coerente (copy + gate + plans.ts).
- **Resiliência de geração:** /arena com 2 retries + erro claro+botão (como /osce). Leaderboard com refresh.
- **Persistência de sessão:** /osce e /tutor guardam estado em localStorage e oferecem "Retomar"; XP
  proporcional em sessões incompletas (`tutor:162-174`).
- **Curso no arranque:** se `student_area` vazio, escolher curso (personaliza /study, /anatomia-3d).
- Input de tema livre mobile (input+2 botões partem <380); tendência do score (↑↓→); /anatomia-3d filtrar
  ruído do Sketchfab; /labs surgir no /inicio quando há análises.

**4.3 Ambos:**
- Consciência offline (badge) + testes mobile (/mymeds nomes longos, /medicamento, QR).
- Clarificar /simulador vs /decisao.

**Sai:** pessoal e estudante são produtos que arrancam limpos, guiam o primeiro passo, nunca perdem
trabalho, e os gates convidam em vez de bloquear.

---

## RONDA 5 — Endurecimento transversal + criar/melhorar (perfeição absoluta)

A ronda que fecha tudo à prova de bala e acrescenta o que eleva o produto acima de "funciona".

**5.1 Consistência global e qualidade de código:**
- Varredura final de TODAS as 256 páginas: nenhum botão morto, nenhum "indisponível", nenhum TODO/FIXME
  visível, nenhum link para rota removida (o check-links da Ronda 1 apanha; correr em CI mental).
- Error boundaries por área; skeletons consistentes; toasts consistentes.
- Extrair ficheiros grandes/tangled (care-log↔activities, LinkedResidents state) para fronteiras limpas.
- Acessibilidade: labels, foco, tamanhos de toque (famílias idosas e trabalhadores).

**5.2 Push e comunicação (fechar o que ficou a meio):**
- Notificações push entre funcionários a funcionar ponta-a-ponta (VAPID em produção) + preferências.
- Confirmar que os avisos automáticos (stock baixo, atividade, ocorrência) chegam e não fazem spam.

**5.3 Acrescentar valor (novas funcionalidades/fluxos/experiências úteis, não gadgets):**
- Candidatos (a priorizar contigo): relatório mensal do centro pronto a imprimir; "diário do utente"
  cronológico mais rico para a família; onboarding guiado com checklist de progresso; modelos de atividades;
  export PDF da medicação; lembretes com presets; modo apresentação/quiosque para mostrar o portal família.
- **Regra:** cada novidade resolve uma dor real de um dos 4 elos e integra-se com o que já existe (dados
  reais, sem duplicação).

**5.4 Verificação final de aceitação (o ciclo completo):**
- Percorrer o ciclo inteiro numa conta nova, sem dados falsos: criar centro → dia de trabalho → família
  entra e vê → pessoa gere a sua saúde → estudante treina. Cada passo perfeito, mobile e desktop.
- tsc/vocab/nav/links=0. Restaurar QA. Documentar SQL pendente (sprints 104-107 + novos).

**Sai:** produto inteiro à prova de bala, coerente, polido ao botão, com o ciclo de aquisição a fechar.

---

## Ordem e porquê
1. **Ronda 1** primeiro: sem ela, a apresentação envergonha (marketing/demos/links). Barata, alto risco.
2. **Ronda 2** (centro): é o cliente que estou a apresentar; tem de estar perfeito.
3. **Ronda 3** (famílias): é o que o centro mostra a seguir; herda a confiança da 2.
4. **Ronda 4** (pessoal+estudante): os elos finais do ciclo.
5. **Ronda 5**: endurecimento + valor novo, com tudo já coerente por baixo.

Cada ronda é fechável e verificável isoladamente. Guardo memória no fim de cada uma.
