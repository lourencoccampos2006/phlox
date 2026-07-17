# Auditoria site-wide + limpeza de catálogo — 2026-07-13

Três agentes de investigação (mapa do catálogo, backend, frontend) + aplicação das 6 regras do
Fernando ao catálogo de ferramentas. Guardado aqui porque o relatório original (artifact) não abriu
no lado do Fernando — este ficheiro é a fonte de verdade, atualizado à medida que cada item é resolvido.

Legenda: ✅ resolvido · 🔲 por resolver · 🤔 precisa de decisão do Fernando

---

## 1. O problema estrutural — 3 catálogos paralelos, desligados

- `lib/toolRegistry.ts` — usado por `/inicio` (secção "todas as ferramentas") e `/settings` (ligar/desligar).
- `lib/navigation.ts` — usado por `/tudo` e pela pesquisa (⌘K). Tem entradas duplicadas literais.
- `lib/institutionBlueprint.ts` — a fonte REAL do modo clínico (cockpit, sidebar, hub).

Desligar uma ferramenta em Definições não a esconde de `/tudo` nem da pesquisa. A mesma ferramenta
pode ter nomes diferentes consoante onde se vê. `EXTRA_TOOLS_BY_MODE` e `PERSONA_NAV` são dados mortos
(não lidos por nada). 🔲 **Por resolver**: consolidar num sistema só (toolRegistry.ts para pessoal/
cuidador/estudante + institutionBlueprint.ts para clínico; apagar navigation.ts) — planeado para depois
da limpeza de catálogo, antes da reconstrução do `/inicio`.

---

## 2. Segurança — CRÍTICO

- ✅ **RLS de `organizations` deixava qualquer utilizador autenticado ler qualquer instituição** —
  cláusula `or auth.uid() is not null` anulava a verificação de pertença. Corrigido:
  `supabase/sprint109_fix_org_rls_leak.sql`.
- ✅ **Papel "leitor" conseguia escrever em 9 tabelas partilhadas** (finance_entries, prescription_queue,
  safety_events, pharma_interventions, attendance, patient_vigilance, team_messages, stock_consumption,
  rounds/round_assignments, recurring_activities) — o padrão `noviewer` do sprint101 nunca foi replicado
  nestas. Corrigido: `supabase/sprint110_viewer_bypass_fix.sql`.
- ✅ **Stripe webhook** (`app/api/stripe/webhook/route.ts`) não verificava erros nas atualizações de
  plano — falha silenciosa, Stripe não tentava outra vez. Corrigido: todas as `.update()` verificam erro
  e devolvem 500 se falharem.
- ✅ **Numeração fiscal** (`app/api/fiscal/finalize/route.ts`) tinha fallback não-atómico
  (`count()+1`) que podia colidir sob concorrência — obrigação legal AT. Corrigido: falha em vez de usar
  o fallback (a RPC `next_doc_seq` é atómica, confirmado no código).
- ✅ **Pagamentos e faturação** (`app/api/payments/charge/route.ts`, `app/api/invoicing/emit/route.ts`)
  — atualizações de BD sem verificação de erro antes de responder "ok". Corrigido.
- ✅ **Import de migração** (`app/api/migrar/import/route.ts`) — `try/catch` inútil à volta de uma
  chamada Supabase que nunca lança exceção (`{error}`, não `throw`); erro descartado. Corrigido.

### Resolvido nesta ronda
- ✅ **`orgs/[id]/invite`, `orgs/[id]/members/[memberId]`, `orgs/[id]` (PATCH/DELETE)** — novo helper
  partilhado `lib/orgAuth.ts` (`authedClient` + `requireOrgRole`), usado nas 3 rotas: verificação
  explícita de admin/owner antes de qualquer escrita, resposta 403 limpa em vez de depender só da RLS.
- ✅ **`prescriptions/route.ts`** — valida que o utilizador é membro ativo do `org_id` enviado antes do
  insert (403 claro em vez de depender só da RLS).
- ✅ **`vitals` — validação de gama fisiológica** por campo (hr/bp_sys/bp_dia/spo2/weight/glucose/temp),
  rejeita NaN e valores fora de gama plausível com 400.
- ✅ **5 das 6 rotas de API órfãs apagadas** (`agent-tasks`, `oracle`, `handover`, `preventivo`, `carta`)
  — confirmado zero referências em todo o código antes de apagar. `referral` **deixada de propósito**
  (já tinha uma nota pendente de uma ronda anterior sobre possíveis convites antigos por resgatar —
  precisa da tua confirmação antes de apagar essa).
- ✅ **Fallback silencioso para a chave anon** — `stripe/webhook` e `family-portal` agora falham alto
  (503 claro) em vez de degradar silenciosamente para a chave anon quando a service-role key falta.
- ✅ **2 `console.log` esquecidos** — removido o de `vision/route.ts` (os do `stripe/webhook` eram logs
  de auditoria legítimos — "Upgraded/Downgraded user X" — mantidos de propósito).

### 🔲 Por resolver
- **Helper `authClient`/`sb(req)` duplicado nas ~12 rotas restantes** — só consolidei as 4 que já
  precisava de tocar para os outros fixes; as restantes continuam com a duplicação (não é bug, é
  manutenibilidade — fica para outra ronda).

---

## 3. Frontend — achados

### Resolvido nesta ronda
- ✅ **Todos os botões "×" agora têm `aria-label`** ("Fechar" ou "Eliminar"/"Remover" consoante o
  handler) — 82 ocorrências em 54 ficheiros. Feito com um script (linha a linha, não regex multi-linha —
  a primeira tentativa com regex "gulosa" tinha um bug real que confundia o atributo de um botão com o
  botão vizinho; apanhado e corrigido antes de aplicar, com um segundo script de verificação).
- ✅ **`<div onClick>` a fazer de controlo real** convertidos: `app/census/page.tsx` (célula de quarto),
  `app/timeline/page.tsx` (expandir evento), `app/labs/page.tsx` (dropzone), `app/incidents/page.tsx`
  (linha de ocorrência) — todos com `role="button"`, `tabIndex`, `onKeyDown` (Enter/Espaço).
- ✅ **Botões +/- de stock** — `.stock-adjust-btn` com regra `@media (max-width:768px)` a forçar 44×44px
  em mobile (mantém 28×28 no ambiente denso de secretária/farmácia em ecrã grande).
- ✅ **`<label htmlFor>` ligado ao `id` do input** nos 3 ficheiros que a auditoria apontou como exemplo
  concreto: `app/equipa/page.tsx` (7 pares), `app/stock/page.tsx` (11 pares, incl. os que eram `<span>`
  em vez de `<label>` a mais), `app/sala-espera/page.tsx` (2 pares). **Isto é sistémico em mais ~130
  ficheiros** (568 inputs no total) — os 3 exemplos ficaram corrigidos, o resto fica para uma ronda
  dedicada (arriscado fazer em massa sem ver cada formulário, por causa de ids repetidos em listas).
- ✅ **Vocabulário "paciente"** — verificado a fundo: as 3 ocorrências que restam no código são todas
  legítimas (sinónimos de pesquisa/importação, e uma instrução explícita a dizer à IA para NÃO usar
  "paciente"). A instância original que a auditoria apontou já não existe — parece ter sido corrigida
  antes desta ronda.
- ✅ **2 `console.log` esquecidos** — ver secção de backend acima.

### ⚠️ Achado estrutural, não é um "erro" para corrigir de uma vez
- **As classes partilhadas `.btn`/`.card`/`.chip` (globals.css) têm 0 utilizações em `className="btn"`
  ou `"chip"` em todo o site**, `.card` só em 4 de 255 páginas. Cada página reinventa os seus próprios
  botões/cartões com estilos inline diferentes — é a causa da deriva visual entre páginas. Isto não é um
  bug pontual, é uma decisão de arquitetura (adotar as classes em páginas tocadas vs. aceitar o padrão
  inline e apagar CSS morto). Sinalizado, não resolvido nesta ronda — precisa de decisão, não de correção
  mecânica.

---

## 4. As ferramentas institucionais substanciais — análise

Fernando decidiu: **não ficam como páginas individuais** (nem sequer como redirect) — só aproveitar
código/fluxos para ferramentas já em uso, depois eliminar as páginas. Análise de aproveitamento por
ferramenta nesta secção do relatório de trabalho (ver mensagem de chat correspondente).

---

## 5. Limpeza de catálogo — execução (decisões do Fernando 2026-07-14)

Fernando decidiu por mensagem (não pelo artifact, que não abriu). Execução em curso, atualizado à
medida que avança:

- ✅ **Apagadas** (todas as referências vivas limpas primeiro, sem deixar links mortos):
  `/preparar-consulta`, `/objetivos`, `/consult-prep`, `/comunidade` (+ `/api/comunidade`), `/hive`.
- ✅ **`/traduzir` cortado** — regra 5 (tradução pura, um chat genérico faz o mesmo). `/api/translate`
  também removido (só era usado por essa página).
- ✅ **`/quickcheck` e `/receita` mantidos** — não são wrappers finos: `/quickcheck` é funil de aquisição
  sem conta com UI estruturada (semáforo, guardar, copiar para médico); `/receita` faz OCR real +
  escreve direto na medicação do perfil, o que um chat não replica.
- 🤔 **`/soap`** fica por decidir — estrutura nota em SOAP + sugere códigos ICPC-2. Fronteira entre
  "um chat faz isto" e "profissionais valorizam a codificação". Não cortado unilateralmente.
- ✅ **Cartão de emergência consolidado**: `/passport` escolhido como sobrevivente (o mais completo —
  bilingue, tabela de medicação, perfis de família, cofre). `/cartao-emergencia` e `/health-pass`
  apagados a seguir a reescrever `/passport` com 2 separadores: "Documento" (absorveu o botão
  "descarregar QR" e "desativar cartão" do cartao-emergencia — mesma tabela `emergency_tokens`) e
  "Partilha temporária" (o `/health-pass` inteiro — sessão QR+PIN a expirar, histórico de visitas,
  devoluções do profissional — é um modelo de dados genuinamente diferente, não um duplicado; por isso
  foi reconstruído dentro de `/passport`, não descartado).
- ✅ **`/perfis` fundido em `/familia`** — `/familia` só tinha um formulário mínimo (nome/relação/idade)
  e nunca permitia editar nem apagar; agora tem o formulário completo de `/perfis` (sexo, peso, altura,
  creatinina, condições, alergias, notas) mais os botões Editar/Apagar em cada cartão. Todas as
  referências (`ProfileSelector`, `BottomTabBar`, `/perfil/[id]`, `/monitor`, `/dose-crianca`,
  `experienceMode`, `homeIntelligence`, `navigation`, `robots`) repontadas para `/familia`.
- ✅ **`/agua` + `/pesar` fundidos em `/vitals`** — `/vitals` ganhou uma secção de hidratação completa
  (botões rápidos, barra de progresso, gráfico de 7 dias, meta editável) e o cartão de peso passou a
  abrir um gráfico de tendência de 30 dias com área (era o de `/pesar`). **Correção ao plano original**:
  `/nutricao` NÃO é um duplicado — é a ferramenta CLÍNICA/institucional (vigilância de peso de vários
  utentes num lar/centro, tabela `care_records` com scope de organização), modo completamente diferente
  de `/vitals` (pessoal, auto-registo). Ficou de fora da fusão por não fazer sentido arquitectural.
- ✅ **`/medicamento` e `/labs` melhorados** (não substituídos — já eram substanciais, só ganharam a
  ligação a dados guardados que faltava): `/medicamento` agora sabe se o medicamento já está na tua
  lista (`personal_meds`) e, se sim, verifica interações contra TUDO o que tomas, não só o medicamento
  isolado. `/labs` (que não tinha nenhuma noção de histórico) agora mostra "desde a última análise
  guardada" a partir do `health_vault` — nenhuma destas duas coisas um chat genérico consegue fazer,
  porque não tem acesso aos teus dados guardados.
- ✅ **`/dilutions` + `/iv-calc` + `/escalas` fundidos em `/calculos`** — genuinamente integrados, não só
  cross-links: as 8 escalas (PHQ-9, GAD-7, Morse, Braden, NIHSS, MNA-SF, Dor, APGAR) e as 3 calculadoras
  de fórmula do iv-calc (volume/infusão/reconstituição) tornaram-se entradas reais em
  `lib/clinicalCalcs.ts` (nova categoria `scales`) — pesquisáveis e abertas com o mesmo `CalcRunner`
  genérico que já existia. A base de dados de 10 fármacos IV do `/dilutions` (protocolos de diluição,
  estabilidade, avisos) e a tabela de referência rápida do `/iv-calc` não são "calculadoras" — são
  consulta/referência — por isso viraram um segundo separador "Referência IV" dentro da mesma página
  (`components/calc/IVReference.tsx`), não uma página à parte nem um redirect.
- ✅ **`/protocolos` + `/protocol` fundidos numa página** — eram coisas diferentes (SOPs institucionais
  escritos vs. gerador de protocolo terapêutico por IA por doente), por isso ficaram como 2 separadores
  reais na mesma página (`/protocolos`), não um cross-link — `TherapeuticProtocolGenerator.tsx` tem o
  gerador Pro completo.
- ✅ **`/vaccines` fundido em `/preventivo`** — `/preventivo` já cobria vacinas de rotina (categoria
  determinística `vacina`); o que `/vaccines` tinha a mais (vacinas de viagem por destino, reconciliar
  vacinas já tomadas em texto livre) virou um painel opcional "✈️ Viagem ou caso especial" dentro da
  mesma página, só esse painel usa IA — o resto continua 100% determinístico.
- ✅ **`/compatibility` cortado** — era mesmo um subconjunto de `/iv-compatibility` (só 2 fármacos, 1
  estatuto vs. 2-8 fármacos e 3 vias — Y-site/mistura/seringa). Sem funcionalidade a migrar. Referência
  do Copilot repontada.
- ✅ **`/tutor` reconstruído — absorveu `/estudar-conceito` + `/explica` + `/mnemonicas` + `/exam` +
  `/ficha`** (5 páginas, ~1750 linhas). Passou a ter 4 separadores reais dentro da mesma página: Tutoria
  socrática (o que já existia), Explicar & Mnemónica (recuperou o histórico do `/explica` e a biblioteca
  guardada do `/mnemonicas`, que se tinham perdido na fusão anterior em `/estudar-conceito`), Simulação
  de exame, Ficha de Fármaco. Suporta deep-link `?mode=ficha&drug=X` (usado pelo DrugQuickLook) e
  `?mode=exame`. Componentes extraídos para `components/tutor/*.tsx` para o ficheiro da página não
  ficar gigante.
- ✅ **Ferramenta de equipa única — `/equipa` absorveu `/schedule` + `/equipa-mural` + Phlox Ward
  (`/teams`)** (~2000 linhas). `/equipa` ganhou 3 separadores reais: "Conta & Acesso" (o que já lá
  estava — criar instituição, gerar logins/convites), "Escalas & Turnos" (era `/schedule` inteiro, com
  os seus 4 sub-separadores Estado de serviço/Escalas/Tarefas/Configurar — este último já reutilizava
  `/tarefas-equipa`, mantido), "Mural" (era `/equipa-mural`, + a "Passagem de turno" do Phlox Ward
  adaptada ao nível da equipa em vez de por doente, já que o Ward tinha um modelo de dados de canal por
  doente que não faz sentido fora de uma página própria). `/team` e `/tarefas-equipa` (stubs de redirect
  já existentes) repontados para `/equipa`. Corrigidos de caminho os `href`/`url` de push-notifications
  em 4 ficheiros (`notifyTeam.ts`, `team-messages`, `stock/consume`, `painel-dono`) e o endpoint
  `/api/notifications` (que só emitia alertas do Ward morto) foi reescrito para emitir alertas do Mural.
  **Bug pré-existente encontrado e corrigido de caminho**: 4 sítios ("Horário de Medicação/Inteligente")
  apontavam para `/schedule` (equipa/turnos) quando deviam apontar para `/calendario-meds` (horário de
  toma) — confusão de nomes antiga, não relacionada com esta fusão, corrigida por estar mesmo ao lado.
- ✅ **`/motor-clinico` + `/polypharmacy` fundidos em `/assessments`** — descoberta importante: `/med-review`
  já não era uma página própria, já era um redirect para `/assessments?tab=revisao` de uma ronda anterior
  (R13b), reutilizando `FusionTabs` (componente partilhado já existente para exatamente este padrão).
  Segui o mesmo padrão: `/motor-clinico` e `/polypharmacy` passaram a exportar `MotorClinicoTool`/
  `PolypharmacyTool` (o componente original, intacto) e `/assessments` ganhou 2 separadores novos
  ("Decision Engine", "Polimedicação") a seguir aos 3 que já lá estavam. As rotas antigas continuam a
  redirecionar (só para não partir marcadores/links antigos — o conteúdo real já não vive lá).
- ✅ **`/painel-dono` absorveu `/insights` + `/roi`** — os dois eram análises reais do dono, não
  duplicados um do outro: `/roi` ("Indicadores & Desempenho") são tendências internas de 6 meses
  (receita, atividade, ocorrências, adesão MAR) por tipo de instituição; `/insights` são benchmarks
  anonimizados contra o pool de instituições do mesmo tipo (k-anonymity, Pro). `/painel-dono` ganhou
  2 separadores novos a seguir aos 3 que já tinha (Visão geral/Qualidade/Registos): "Desempenho" (era
  `/roi`, extraído para `components/owner/OwnerPerformance.tsx`) e "Comparar" (era `/insights`, extraído
  para `components/owner/OwnerInsights.tsx`). **Gap de segurança encontrado e corrigido**: `/insights`
  só era bloqueado por plano por ser uma PÁGINA inteira em `PLAN_ROUTES` — a API
  `/api/insights/benchmark` nunca validava o plano de quem pedia (só filtrava o pool). Como deixou de
  ser rota própria, adicionei o gate ao componente (`OwnerInsights` mostra upgrade se plano < pro,
  como o padrão já usado em `TherapeuticProtocolGenerator`) E à API (`getUserPlan` + `planGateResponse`
  se plano < pro) — defesa em profundidade, não só esconder o botão.
- ✅ **`/relatorio` absorveu `/brief` + `/briefing` + `/medico-bolso` + `/plano`** (5 páginas → 1,
  ~1550 linhas) — os 5 eram genuinamente distintos (não duplicados): resumo diário determinístico
  (`/brief`), relatório semanal por IA (o que já lá estava, Pro), companheiro proativo que vigia dados
  e avisa (`/medico-bolso`, grátis), plano de cuidado farmacológico completo adaptado ao modo
  (`/plano`, Plus+), e briefing de preparação de consulta (`/briefing`, Pro). `/relatorio` ganhou 5
  separadores reais: Diário / Relatório Semanal / Médico de Bolso / Plano de Cuidado / Briefing de
  Consulta — componentes extraídos para `components/relatorio/*.tsx`. **Gate de plano corrigido**:
  `/relatorio` era ANTES uma rota inteira bloqueada a Pro em `PLAN_ROUTES` — como passou a ter
  separadores grátis (Diário, Médico de Bolso), o bloqueio por rota teria fechado ferramentas grátis
  a utilizadores free. Removido de `PLAN_ROUTES`; o separador "Relatório Semanal" gate-a-se sozinho com
  `<PlanGate>` (o mesmo componente partilhado usado nas rotas Pro antigas) e ganhou defesa em
  profundidade em `/api/relatorio` (que nunca tinha o próprio check server-side, só confiava no bloqueio
  de rota — corrigido com `getUserPlan`+`planGateResponse`, mesmo padrão aplicado ao `/insights` acima).
  `/briefing` e `/plano` já geriam o seu próprio gate (cliente + API) de rondas anteriores, mantidos
  intactos.
- ✅ **Limpeza de catálogo CONCLUÍDA** — todos os 17 itens do plano feitos. Sweep final de
  referências (nav/registry/palette a todas as páginas apagadas nesta ronda) sem sobras — só ficou
  uma entrada inerte em `robots.ts` (Disallow de `/teams`, uma rota já apagada; inofensivo, um
  Disallow a mais não quebra nada). `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`,
  `check-nav.mjs` e `npm run build` — todos a 0 erros.

### Decisões fechadas em 2026-07-15
- ✅ **`/soap` mantido** — decisão fechada. É a fronteira mais próxima da regra 5 em todo o catálogo
  (estruturar uma nota em SOAP é algo que um chat genérico faz razoavelmente bem), mas a codificação
  ICPC-2 sugerida + a deteção de lacunas de documentação ("a documentar (em falta)") + estar já
  integrado no fluxo clínico sem troca de contexto são diferenciação real, não decorativa. Baixo custo
  de manutenção (102 linhas, zero dependências partilhadas). Mantido.
- ✅ **Referral antigo apagado** — `components/ReferralSection.tsx` já não existia (removido nalguma
  ronda anterior sem deixar rasto na auditoria); confirmei por pesquisa no `changelog` e nos posts do
  blog que a recompensa antiga ("30 dias de Student grátis") NUNCA foi mostrada publicamente — só o
  `/reach` atual (níveis 1/3/5/10 amigos) está documentado no changelog. `app/api/referral/route.ts`
  (órfão, zero consumidores) apagado sem reconciliação necessária.
- ✅ **3→2 catálogos paralelos, o pior removido por completo** — `lib/experienceMode.ts`'s
  `ROUTE_GROUPS` (+ `getAIPersona()` + `getPlanLimits()`) e `lib/navigation.ts`'s `EXTRA_TOOLS_BY_MODE`
  + `PERSONA_NAV` eram DADOS MORTOS confirmados (zero consumidores em todo o código, verificado por
  grep antes de apagar) — `ROUTE_GROUPS` sozinho tinha ~20 links partidos para rotas já apagadas há
  muito (`/oracle`, `/carta`, `/migrar`, `/nota-clinica`, `/link`, `/prescription`, `/adherencia`,
  `/grand-round`, `/progresso`, `/counseling`, `/drug-info`, `/nursing`, `/monitor`, `/integracoes`,
  `/food-drug`, `/residentes`). Apagados por completo. **Efeito colateral bom**: apagar o
  `EXTRA_TOOLS_BY_MODE` removeu uma allowlist que o `check-nav.mjs` usava para dar como "alcançável"
  ferramentas que na verdade NENHUMA UI real mostrava — o script passou a apanhar corretamente que
  `/sintomas` e `/timeline` (ferramentas reais, default no `toolRegistry.ts`) nunca estavam no catálogo
  pesquisável `/tudo`/⌘K. Corrigido a sério: adicionadas à categoria "Saúde" de `NAV_CATEGORIES`.
  Restam **2 sistemas reais** (não 3): `toolRegistry.ts` (visibilidade por modo em `/inicio`+
  `/settings`) e `navigation.ts` `NAV_CATEGORIES` (catálogo pesquisável `/tudo`+⌘K+atalhos do Header),
  mais `institutionBlueprint.ts` para o clínico. **Unificação total num sistema só continua por fazer**
  — é um projecto maior (tocaria /inicio, /settings, /tudo, ⌘K, Header, bottom nav) que decidi não
  arriscar na mesma sessão em que também construí ferramentas Pro novas; os dois catálogos que restam
  já não têm dados mortos nem links partidos, o que era o risco real (confusão/links quebrados), não
  a duplicação de estrutura em si.
- Verificado no fim: `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`, `check-nav.mjs` — 0 erros.

---

## 6. PRO RONDA 3 — ferramentas e funcionalidades novas (EM CURSO, 2026-07-15)

Depois da limpeza de catálogo, Fernando pediu ferramentas NOVAS para o Pro (não aprofundar as
existentes) — brainstorm feito em várias voltas de pergunta/resposta até chegar a 4 ferramentas +
uma espinha de personalização por objetivo:

**Aprovado, âmbito final:**
1. **Objetivo de Saúde** (espinha de personalização) — ✅ FEITO
2. **Índice de Risco Contínuo** (self + familiar) — ✅ FEITO
3. Planos por objetivo (ex: perder peso → dieta+exercício contextualizado) — 🔲 por fazer
4. Funcionalidades avançadas de cuidador (objetivo=cuidador) — 🔲 por fazer (a pensar: playbooks de
   crise personalizados, deteção proativa de burnout do cuidador, coordenação multi-cuidador)
5. Vigia de Preços & Ruturas de medicamentos (+ recalls por lote integrado) — 🔲 por fazer, precisa
   de spike de investigação das fontes INFARMED primeiro (formato de dados muda com o tempo)
6. Detetive de Saúde (correlação temporal causa-efeito) integrado no Médico de Bolso — 🔲 por fazer
   **Descoberta importante**: `/timeline` já tem uma versão manual disto (`/api/timeline/correlations`,
   aba "Para o médico") — não é automático/proativo como o Fernando pediu, mas a base já existe.
7. Rastreio Visual com risco dermatológico ABCDE (visão IA) — 🔲 por fazer

### ✅ Objetivo de Saúde + Índice de Risco Contínuo — feito e verificado

- **`supabase/sprint100_pro_ronda3.sql`** — `profiles.health_goal` (+ `health_goal_detail`) e a tabela
  `risk_snapshots` (snapshot diário, self OU familiar via `profile_id` nullable, dedup por
  utilizador+perfil+dia). **Fernando: este SQL ainda não foi corrido na base de dados — falta correr.**
- **`lib/riskIndex.ts`** (novo) — motor de pontuação PARTILHADO entre self e familiar
  (`computeRiskScore`), extraído do que já existia só para o cuidador em `lib/caregiverWatch.ts`
  (`analyzeFamilyMember` já calculava um score 0-100 — não existia era a versão para a própria pessoa
  nem o histórico persistido/tendência). `lib/caregiverWatch.ts` refatorado para reutilizar este motor
  em vez de ter a fórmula duplicada.
  - `lib/healthAlerts.ts` ganhou `computeSelfRiskScore()`, reaproveitando o MESMO Decision Engine +
  `lib/healthTrends.ts` que já alimentava o `/medico-bolso`, agora também a alimentar o score contínuo.
- **`/api/risk-index`** (novo, GET, `?profile_id=` opcional) — calcula ao ver a página (sem cron:
  compute-on-view + upsert manual do snapshot do dia, já que o índice único usa uma expressão
  `coalesce` que o `onConflict` do supabase-js não referencia diretamente), devolve o score de hoje +
  14 dias de histórico para a tendência.
- **`components/RiskIndexCard.tsx`** (novo) — cartão reutilizável (anel de score + tendência ↑/↓ +
  sparkline de 14 dias + principais fatores), usado em `/timeline` (self, gate Pro) e `/familia` (por
  familiar, gate Pro).
- **`components/HealthGoalPicker.tsx`** + **`lib/healthGoals.ts`** (novos) — seletor do Objetivo de
  Saúde em `/settings` (aba Perfil), componente autónomo (fetch/save próprios, não mexe no form grande
  de settings), só visível a planos Pro/Institucional.
- **Bug encontrado e corrigido de caminho**: `/familia` tinha um link para `/familia360` que — desde a
  Ronda 13b (fusão anterior) — redireciona de volta para `/familia`. Link circular removido.
- Verificado: `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`, `check-nav.mjs`, `npm run build` —
  0 erros.

### ✅ Plano de Perda de Peso (objetivo=lose_weight)

- **`/api/weight-plan`** (POST, Pro) — gera plano de dieta+exercício por IA, CONTEXTUALIZADO à
  medicação/condições reais (efeitos na FC de beta-bloqueadores, risco de hipoglicemia com
  insulina/sulfonilureias no exercício, retenção de líquidos de diuréticos/corticoides — não um
  template genérico).
- **`app/plano-peso/page.tsx`** (nova) — auto-carrega medicação (`personal_meds`) e tendência de peso
  (`vitals`); idade/condições introduzidas ali (tal como o `/relatorio?tab=plano` já fazia — `profiles`
  não guarda idade/condições da própria pessoa, ver bug abaixo). Gate de plano via `PLAN_ROUTES` +
  gate de objetivo próprio (só mostra o formulário se `health_goal==='lose_weight'`, senão convida a
  mudar o objetivo em `/settings`).
- Link direto a partir do `HealthGoalPicker` quando se escolhe "Perder peso".

### ✅ Playbook de Crise (objetivo=caregiving)

- **`supabase/sprint101_crisis_playbook.sql`** — tabela `family_crisis_playbooks` (1 por familiar,
  cacheado por `source_hash` de condições+alergias+medicação — só regenera quando algo muda de facto).
  **Fernando: falta correr este SQL.**
- **`/api/crisis-playbook`** (POST, Pro) — gera 3-5 protocolos "o que fazer se..." REALMENTE ligados
  às condições/medicação do familiar (ex: protocolo de hipoglicemia só se houver insulina/antidiabéticos
  na lista) — não conselhos genéricos.
- **`components/CrisisPlaybookCard.tsx`** — botão explícito em cada cartão de `/familia` (não dispara IA
  sozinho ao abrir a página — mesmo padrão de custo-consciente do `/medico-bolso`), imprimível.
- Coordenação multi-cuidador e deteção proativa de burnout **NÃO construídas** — a primeira é migração
  de esquema (partilhar `family_profiles` entre contas, projeto próprio); a segunda precisaria de
  telemetria de engagement que ainda não existe — sinalizadas para decisão futura, não escondidas.

### ✅ Detetive de Saúde (correlação temporal) — integrado no Médico de Bolso

- **`lib/healthDetective.ts`** (novo) — determinístico (zero custo de IA): cruza a data de início de
  cada medicamento (`personal_meds.started_at`, já existia) com sintomas NOVOS e recorrentes (≥2x) que
  aparecem numa janela de 21 dias a seguir — nunca sintomas já existentes antes do fármaco começar.
  Não afirma causalidade, só assinala coincidência temporal que vale a pena mencionar ao médico.
- **`/api/companion`** (motor do `/medico-bolso`) ganhou esta 3ª lente — passou a pedir
  `started_at` na medicação e o histórico de `symptom_logs`, e junta os resultados aos alertas
  existentes com ícone próprio (🔗) para se distinguir de um alerta normal.
- **Descoberta**: `/timeline` já tinha uma versão manual disto (`/api/timeline/correlations`, aba "Para
  o médico", por IA, sob pedido) — mantida como está (mais rica, mas exige um clique); a nova lente do
  Médico de Bolso é o automatismo que faltava, mais leve e sempre ativo.

### ✅ Rastreio Visual com risco ABCDE

- **`supabase/sprint102_skin_lesion_tracking.sql`** — `skin_lesion_tracks` (uma lesão/mancha vigiada)
  + `skin_lesion_photos` (cada foto, com pontuação ABCDE e risco 0-100). **Fernando: falta correr este
  SQL, e falta criar o bucket `skin-lesions` no Supabase Storage** (público, como o `wounds` que já
  existe para `/feridas` — mesmo padrão de upload).
  - **`/api/vision`** (endpoint de visão partilhado, já usado por `/scan`) ganhou um modo novo
  `skin_lesion` — pontua Assimetria/Bordo/Cor/Diâmetro pelos critérios ABCDE reais de rastreio de
  melanoma, e recebe contexto da foto anterior da MESMA lesão para avaliar Evolução de verdade (não só
  uma foto isolada). Gate de plano específico deste modo (as outras modalidades do endpoint continuam
  livres, usadas por `/scan`).
- **`/api/lesion-track`** (novo) — cria/atualiza a track, faz upload da foto (Storage), chama
  `/api/vision` com o contexto da foto anterior, guarda o resultado.
- **`app/rastreio-visual/page.tsx`** (nova) — lista de lesões vigiadas, pontuação e nota de evolução
  por foto, aviso claro de que é apoio informativo, não diagnóstico.

### 🔲 Vigia de Preços & Ruturas — BLOQUEADO, precisa de decisão do Fernando

Antes de construir, investiguei as fontes reais do INFARMED (`WebSearch`/`WebFetch` + inspeção com
Playwright do site Infomed) em vez de assumir que seria um scraper simples, como tinha avisado que
faria. O que encontrei muda a arquitetura possível:

- **Não há API pública nem download em bulk** (CSV/Excel) de preços nem de ruturas — só pesquisa
  individual por medicamento, no site público (`extranet.infarmed.pt/INFOMED-fo`), sem login, "para
  todos os cidadãos".
- **Acesso à base de dados completa exige um "protocolo de cedência de bases de dados" com o INFARMED**
  — isto é uma negociação/acordo formal (possivelmente com custos), não algo que se resolva a programar.
  Não posso iniciar isto por ti — é uma decisão de negócio tua.
- **A pesquisa individual é uma aplicação JSF com sessão e "ViewState"** (confirmado inspecionando o
  tráfego de rede com Playwright ao pesquisar "paracetamol") — não é uma API JSON simples de um pedido
  HTTP; cada consulta exigiria automatizar um browser completo (sessão + estado), não um `fetch()` leve.
  Isso tem custo real de infraestrutura (um serviço de browser headless por consulta) e é frágil
  (a sessão expira, qualquer mudança no site pode partir tudo).

**Recomendação**: dado que a pesquisa é pública e gratuita ("qualquer pessoa pode consultar"), a via
mais segura e barata é um **lookup individual sob pedido** (não um scraper em bulk automático) — quando
vês um medicamento teu, o Phlox consulta ao vivo SÓ esse medicamento (rutura + preço), em vez de copiar
a base de dados toda do INFARMED para os nossos servidores (isso é que parece cair no âmbito da
"cedência de bases de dados"). Mesmo assim, implica automatizar um browser real (custo por consulta),
não é grátis nem instantâneo de construir. Preciso que decidas: (a) avançamos com o lookup individual
sob pedido, aceitando o custo de infraestrutura de browser automatizado por consulta; (b) tentas
formalizar um protocolo de cedência com o INFARMED para acesso a bulk de verdade (mais lento, mais
robusto a prazo); ou (c) cortamos esta ideia do Ronda 3 e ficamos só com Detetive+Vigia-de-Recalls
integrados, o Playbook, o Plano de Peso e o Rastreio Visual.

### Pendente do lado do Fernando (para tudo o que já está construído funcionar)
1. Correr `supabase/sprint101_crisis_playbook.sql` e `supabase/sprint102_skin_lesion_tracking.sql`.
2. Criar o bucket `skin-lesions` no Supabase Storage (público, igual ao `wounds`).
3. Decidir o caminho do Vigia de Preços (ver secção acima).

Verificado no fim (tudo o que está ✅): `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`,
`check-nav.mjs`, `npm run build` — 0 erros em cada passo.

---

## 7. BUG CRÍTICO CORRIGIDO — Stripe não descia o plano quando o pagamento falhava (2026-07-15)

Fernando reportou (e estava certo): quando um pagamento falha, o Stripe entra em Smart Retries
(tenta cobrar de novo durante dias/semanas) — durante esse período a subscrição fica com
`status: 'past_due'`. Confirmei no código:

- **`customer.subscription.updated`** (webhook) atualizava corretamente `plan_status` para
  `'past_due'`, MAS só atualizava a coluna `plan` (o que dá acesso real) quando `status === 'active'`
  — ou seja, `plan` ficava congelado no valor antigo (ex: `'pro'`) enquanto o pagamento continuava a
  falhar. Só descia a `'free'` quando o Stripe desistia de vez e cancelava a subscrição
  (`customer.subscription.deleted`) — semanas depois, dependendo da configuração de retries.
- **Pior**: nem `getUserPlan()` (server, `lib/planGate.ts`) nem `effectivePlan()` (cliente,
  `components/AuthContext.tsx`) — as DUAS funções que decidem o acesso em toda a app — alguma vez
  olhavam para `plan_status`. Mesmo que a coluna `plan` fosse corrigida, nada a usava para bloquear.
- **Resultado real**: um utilizador cujo cartão falhasse mantinha acesso Pro/Institucional completo
  durante todo o ciclo de retries do Stripe, sem pagar.

**Corrigido** (sem tocar na escrita do webhook — `plan` continua a guardar "a que está subscrito",
para restaurar certo quando o pagamento recupera; o ACESSO efetivo é que passa a degradar):
- `lib/planGate.ts`: `getUserPlan()` agora lê também `plan_status` e devolve `'free'` como plano
  efetivo se estiver em `past_due`/`unpaid`/`incomplete`/`incomplete_expired`.
- `components/AuthContext.tsx`: `effectivePlan()` (o espelho do lado do cliente) faz exatamente o
  mesmo — verificado ANTES do override de acesso institucional por organização (que é um direito de
  acesso independente da subscrição pessoal, não deve ser afetado por isto).
- **`components/PaymentIssueBanner.tsx`** (novo) — sem isto, alguém que perdesse o Pro por um cartão
  recusado não fazia ideia porquê. Aviso fixo no topo quando `plan_status` está numa destas situações,
  com link para `/pricing`. Dispensável por sessão (`sessionStorage`, não `localStorage` — reaparece na
  próxima sessão se o problema continuar por resolver).
- Confirmado que `subscription_data[metadata][user_id]` já é propagado corretamente na criação do
  checkout (`app/api/stripe/checkout/route.ts`) — os eventos de subscrição sempre tiveram o `user_id`
  certo; o problema era mesmo só a lógica de acesso ignorar `plan_status`.
- **Nota**: "continuar a tentar" (as retentativas em si) é configurado no painel do Stripe (Smart
  Retries, em Billing → Configurações de faturação) — isso não é código, é uma configuração da conta
  Stripe que vale a pena confirmares que está ativa.
- Verificado: `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`, `check-nav.mjs`, `npm run build` —
  0 erros.

---

## 8. Vigia de Ruturas — feito e VERIFICADO com dados reais em produção (2026-07-15)

Depois de testar (a sério, não em teoria) as duas alternativas anteriores — automatizar a pesquisa ao
vivo do INFARMED (ASP.NET WebForms num iframe cross-origin; cliquei o botão várias vezes num teste real
com Playwright e falhou de forma inconsistente) e ler o PDF trimestral de preços (descarreguei-o e corri
`pdftotext` a sério — é uma imagem digitalizada, zero texto por trás) — encontrei uma terceira via, esta
sim sólida: a **Lista de Notificação Prévia (LNP)**, publicada pelo INFARMED como um ficheiro **Excel
genuíno** (`.xlsx` real, confirmado pelo `Content-Type` do servidor), sem login, trimestral.

**Descoberta do URL — não é fixo, tive de ser resiliente**: os nomes dos ficheiros mudam a cada trimestre
e às vezes nem contêm a palavra "notificação" (o atual chama-se apenas "Lista em vigor a partir de 5 de
julho de 2026"). O que se mantém estável é o ID da PASTA de documentos (`4326055`) — confirmado
comparando a publicação de 2023 com a de 2026, o mesmo ID aparece nas duas. `lib/shortageIngest.ts`
procura por esse ID de pasta primeiro (filtrando por rótulos que começam por "Lista", excluindo
"Infografia"/"Orientações" que vivem na mesma pasta), com um fallback para o nome antigo caso a pasta
alguma vez mude.

**Estrutura da tabela também muda — tratado por nome de coluna, não posição**: a versão de 2023 usava
colunas como "Nome do medicamento"/"DCI"/"Apresentação"; a de 2026 usa "Nome Comercial"/"DCI/Substância
Ativa"/"Tamanho da embalagem". `buildColumnMap` + `findColumn` fazem correspondência por SUBSTRING no
nome da coluna (não índice fixo), para aguentar esta deriva sem se partir silenciosamente — e se a coluna
essencial ("nome comercial"/"nome do medicamento") não for encontrada, a ingestão falha alto (não insere
dados possivelmente desalinhados).

**Testado de ponta a ponta com um script isolado (`npx tsx`) contra o site real do INFARMED, não só em
teoria**: descoberta do URL → download (6.2MB) → parsing → 40 medicamentos reais extraídos corretamente
(Adenoscan, Bactrim, Xarelto, etc., com DCI/dosagem/forma corretos, verificados linha a linha contra o
conteúdo bruto da folha) → teste de correspondência (nome exato "Bactrim" → encontrado; "Aspirina" → não
encontrado, corretamente, não está na lista). Só depois de ver isto a funcionar com dados reais é que
considerei a funcionalidade pronta.

**Arquitetura final**:
- **`lib/shortageIngest.ts`** — descoberta do URL + parsing do Excel (`exceljs`, não `xlsx`/SheetJS — a
  versão do `xlsx` disponível no npm tem uma vulnerabilidade HIGH conhecida por publicarem os patches só
  no CDN deles, não no npm; troquei para `exceljs`, que tem só uma vulnerabilidade MODERADA numa
  dependência interna não relacionada com segurança de dados — `uuid`, usado só para IDs internos).
- **`supabase/sprint103_shortage_watch.sql`** — `infarmed_shortage_list` (dados de referência, leitura
  pública — não é informação pessoal de ninguém) + `infarmed_shortage_sync` (metadados da última
  ingestão, para a UI mostrar "atualizado em X"). **Fernando: falta correr este SQL.**
- **`/api/cron/ingest-shortages`** — protegido por `CRON_SECRET` (mesmo padrão do
  `/api/vigilancia/cron` já existente), corre semanalmente (`vercel.json`, segunda-feira às 6h — a lista
  só muda a cada trimestre, mas correr semanalmente é barato e apanha a mudança cedo). Aborta sem tocar
  nos dados existentes se encontrar menos de 20 linhas (proteção contra descarregar o ficheiro errado).
- **`/api/shortage-watch`** — cruza a medicação do utilizador (ou de um familiar) com a lista ingerida.
  Matching CONSERVADOR: nome exato normalizado = "confirmado"; correspondência parcial (contém/está
  contido) = sinalizado como "parece corresponder", nunca apresentado como certeza.
- **`app/vigia-ruturas/page.tsx`** — por pessoa (própria + cada familiar), mostra cada medicamento com
  ✅/❓/⚠️ consoante o resultado, sempre com a data e fonte da lista visível.
- **Preços/poupança com genérico — NÃO construído nesta ronda**: como já tinha explicado, a tabela de
  preços vem só como imagem digitalizada (precisaria de OCR, risco real de erro num número). Fica de fora
  até haver uma fonte de dados de texto real — prefiro não construir do que arriscar mostrar um preço
  errado.

### Pendente do lado do Fernando (atualizado)
1. Correr `supabase/sprint101_crisis_playbook.sql`, `sprint102_skin_lesion_tracking.sql` e
   `sprint103_shortage_watch.sql`.
2. Criar o bucket `skin-lesions` no Supabase Storage (público, igual ao `wounds`).
3. Confirmar que `CRON_SECRET` está definido nas variáveis de ambiente do Vercel (já devia estar, por
   causa do `/api/vigilancia/cron` existente) e que os Smart Retries do Stripe estão ativos (Billing →
   Configurações).
4. Depois do deploy, correr manualmente `/api/cron/ingest-shortages` uma vez (`curl -H "Authorization:
   Bearer $CRON_SECRET" ...`) para popular a tabela pela primeira vez, sem esperar pela segunda-feira.

**Achado da revisão de segurança automática, corrigido**: a 1ª versão desta rota aceitava o
`CRON_SECRET` também por query string (`?secret=...`), copiado do padrão já existente em
`/api/vigilancia/cron`. Removido — segredos em URLs ficam em logs de servidor, proxies e histórico do
browser. Só cabeçalhos (`Authorization: Bearer` ou `x-cron-secret`) daqui para a frente nesta rota; o
`/api/vigilancia/cron` mais antigo ainda tem o padrão antigo (fora do âmbito desta ronda, não mexido).

Verificado: `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`, `check-nav.mjs`, `npm run build` —
0 erros. Pipeline de ingestão testado à parte contra o site real do INFARMED (não só compilado).

### Pendentes acima — CONFIRMADO já resolvidos (2026-07-16/17)
Verifiquei diretamente (REST API Supabase com a chave anon + `curl` real, sem pedir para correres nada):
`sprint101`/`sprint102`/`sprint103` já estão aplicados em produção (tabelas existem, RLS bloqueia leitura
anon como esperado), o bucket `skin-lesions` existe no Storage, e correu a ingestão real do
`/api/cron/ingest-shortages` contra produção — 40 medicamentos inseridos com sucesso. `CRON_SECRET` já
estava definido e coincide com o valor local. Nada disto ficou pendente do teu lado.

---

## 9. Auditoria de segurança + caça a bugs site-wide (2026-07-17)

Pedido: "verifica se está tudo seguro, depois se não há bugs, e só no fim sugere 20 melhorias." Ordem
seguida à letra — nada da secção 10 foi escrito antes de fechar tudo aqui. Metodologia: revisão direta
minha do código construído nos últimos dias (Ronda 3 + fix Stripe + Vigia de Ruturas) + 2 agentes em
paralelo (auditoria de segurança site-wide, caça a bugs site-wide), cada um instruído a citar `ficheiro:
linha` exato e a não misturar suspeita com confirmado. Tudo o que segue foi corrigido e re-verificado
(`tsc`, `check-links`, `check-vocab`, `check-nav`, `npm run build` — 0 erros no fim de tudo).

### Segurança

- ✅ **IDOR em `/api/shortage-watch`** — consultava `family_profile_meds` por um `profile_id` vindo do
  cliente sem confirmar que pertence ao utilizador autenticado (as rotas irmãs `risk-index` e
  `crisis-playbook`, construídas na mesma ronda, já tinham este check). Não era explorável na prática
  (a RLS de `family_profile_meds` já bloqueia por `user_id` da própria linha), mas corrigido por defesa
  em profundidade — mesmo padrão das outras duas rotas.
- ✅ **`/api/vitals` (GET)** — o comentário dizia "verificar posse via join" mas esse código não existia;
  só a RLS impedia exploração. Adicionado o check explícito (mesmo padrão de `family_profiles.eq('id',
  profileId).eq('user_id', userId)`).
- ✅ **Fuga do segredo de cron por query string em 3 rotas pré-existentes** — `/api/vigilancia/cron`,
  `/api/health-check`, `/api/push/cron` aceitavam `CRON_SECRET` também por `?secret=...` (o mesmo padrão
  que eu próprio tinha copiado por engano na rota nova do Vigia de Ruturas, e já corrigido lá — ver
  secção 8). Segredos em URLs ficam em logs de servidor/proxy/histórico do browser. Removido o fallback
  nas 3, mantendo só `Authorization: Bearer` / `x-cron-secret`.
- ✅ **`/api/weight-plan`** — sem check explícito de `userId` (inofensivo na prática, pedido sem sessão
  já falhava o gate Pro) e sem validação de input — um pedido com corpo vazio gastava uma chamada de IA
  real para gerar um plano sem sentido. Adicionados os dois.
- ✅ **5 componentes com `dangerouslySetInnerHTML` sem escapar HTML** (`app/vigia/page.tsx:251`,
  `app/study/resumos/page.tsx:173`, `app/study/notas/page.tsx:581`, `app/study/biblioteca/page.tsx:174`,
  `app/estagio/[id]/page.tsx:868`) — todos convertem markdown-lite gerado por IA para HTML por
  substituições de string, sem escapar primeiro os caracteres HTML do texto original. Como o texto pode
  ecoar conteúdo livre do utilizador (sintomas, notas, perguntas) dentro da resposta da IA, um `<script>`
  ou atributo malicioso nesse texto passava direto para o DOM. Em `app/study/notas/page.tsx` era mais
  grave ainda — o link `[[nota]]` insere o texto capturado dentro de um atributo `data-link="…"` sem
  escapar aspas, permitindo escapar do atributo e injetar novos atributos/handlers. Corrigido nos 5:
  escapar `&`/`</>`/`"` no texto ANTES de aplicar as transformações markdown (mesmo padrão do `esc()` já
  usado em `lib/print.ts`/`lib/saft.ts`/`CarePlan.tsx`).
- ✅ **2 páginas API sem rate limit** (`app/api/study/flashcards/route.ts`, `app/api/study/quiz/route.ts`)
  — geram conteúdo por IA sem qualquer limite por IP, ao contrário do padrão já estabelecido noutras
  rotas de IA (`exam-generator`). Adicionado `checkRateLimit`/`getIP`/`rateLimitResponse` (mesmo padrão),
  mais um check explícito de autenticação em falta.
- ✅ **`app/api/family/documents/route.ts`** — POST e PUT sem rate limit. Mesma correção.
- Auditoria de RLS confirmou o `sprint110_viewer_bypass_fix.sql` (papel "leitor" bloqueado em 11 tabelas)
  continua intacto, sem regressão.

### Bugs

- ✅ **Assimetria no Índice de Risco Contínuo (self vs. familiar)** — `lib/healthAlerts.ts`'s
  `gatherFindings()` tinha `if (medNames.length < 2) return []`, pensado para só regras de interação
  entre fármacos, mas na prática saltava TODAS as 26 regras do Decision Engine (incluindo regras de
  fármaco único — renal, QTc, idade) sempre que a pessoa tivesse 0 ou 1 medicamento. O caminho paralelo
  do familiar (`lib/caregiverWatch.ts`'s `analyzeFamilyMember`) chama `runRules()` sem este guard — por
  isso o Índice de Risco pessoal subestimava sistematicamente o risco face ao do familiar com os mesmos
  dados. Guard removido, comportamento agora simétrico.
- ✅ **`/vitals` — crash ao falhar a análise por IA** — `analyse()` atribuía a resposta do `fetch`
  diretamente ao estado sem verificar `res.ok`; uma resposta de erro não tem `alerts`, e
  `analysis?.alerts.filter(...)` (o `?.` só protege `analysis` ser nulo, não `.alerts` ser `undefined`
  num objeto de erro truthy) rebentava a página. Corrigido com guard completo (`res.ok` +
  `Array.isArray`) + banner de erro visível em vez de crash silencioso.
- ✅ **`/plano-peso` — crash em respostas de IA incompletas** — `meal_plan`/`exercise_plan`/
  `weekly_milestones` eram desenhados incondicionalmente com `.map()`, ao contrário dos campos irmãos no
  mesmo ficheiro (`medication_considerations`/`red_flags`) que já tinham guard `?.length > 0 &&`.
  Inconsistência minha ao construir a página — corrigida para o mesmo padrão nos 3, mais `plan.macro_split`.
- ✅ **`/api/cron/ingest-shortages` — `last_synced_at` mentia em caso de falha** — o `catch` escrevia a
  hora atual mesmo quando a ingestão falhava, fazendo a UI mostrar "atualizado agora" com dados
  potencialmente vazios ou desatualizados. Corrigido: em falha, preserva `last_synced_at`/
  `source_document`/`row_count` do último sync bem-sucedido, só atualiza `status`/`error_detail`.
- ✅ **Ligações mortas para `/study360?tab=review`/`?tab=stats`** — `/study360` é (desde a Ronda 13b) um
  redirect incondicional para `/study` que ignora qualquer query string, por isso estes links nunca
  chegavam a lado nenhum — incluindo o CTA "Rever N cartões" em destaque (`StudyProgressBar`,
  `homeIntelligence.ts`, `/progresso`, `ExplicarMnemonica.tsx`). Investigado e encontrado o destino REAL
  (`/study/notas`, que já abre no separador "rever" por defeito; `/arena` para estatísticas/progresso) —
  todas as referências repontadas para lá, não só removida a promessa partida.
- ✅ **Armadilha de paywall em rotas que já eram só redirect** — ao investigar o bug acima, encontrei que
  `lib/planRoutes.ts` ainda listava `/study360`, `/saude360` E `/familia360` como rotas bloqueadas por
  plano (Pro/Plus), apesar de as 3 serem hoje só stubs `useEffect`-redirect sem conteúdo próprio. Como o
  `<PlanGate>` do `ClientLayout` corre ANTES do redirect da própria página disparar, um utilizador FREE a
  abrir um link antigo para qualquer uma delas via um ecrã de paywall em vez de ser silenciosamente
  encaminhado para o destino gratuito real — o oposto do que um redirect de compatibilidade deve fazer.
  Removidas as 3 entradas de `PLAN_ROUTES` (as duas últimas não tinham sido sinalizadas pelo agente,
  encontradas por analogia ao investigar a primeira).
- ✅ **`/dashboard?tab=meds` — link morto** (`app/ai/page.tsx` ×2, `app/med-review/page.tsx` ×2) —
  `/dashboard` é um redirect server-side incondicional para `/inicio` que descarta qualquer query string;
  o destino real para adicionar/editar medicação é `/mymeds`. Repontado nos 4 sítios.
- ✅ **`/settings?tab=organizacoes` — link morto** (`components/OrgSwitcher.tsx`) — esse separador foi
  removido de `app/settings/page.tsx` numa ronda anterior (gestão de organização passou a viver só em
  `/organizacao`); o link caía sempre em silêncio no separador Perfil. O botão "Gerir" era além disso
  redundante com o botão "🏥 Abrir hub" (mesmo destino, `/organizacao`) — removido em vez de reapontado.
- 🤔 **Regressão encontrada, não reconstruída: Zarit-12 (sobrecarga do cuidador) órfã** —
  `lib/caregiverScales.ts` tem lógica de pontuação real e correta (escala Zarit-12, Bédard 2001) mas
  **zero consumidores em todo o `.tsx`** — a UI que a usava parece ter-se perdido quando `/familia360`
  foi cortado para um stub de redirect na Ronda 13b. `lib/planRoutes.ts` e
  `components/relatorio/DailyBrief.tsx` ainda prometiam esta avaliação em texto/CTAs. **Decisão tomada**:
  não reconstruir a UI unilateralmente a meio de uma auditoria de bugs (seria criar funcionalidade nova,
  não corrigir uma); corrigi só a promessa falsa — `DailyBrief.tsx` deixou de mencionar Zarit-12 e de
  apontar para `/familia360`, os CTAs de cuidador agora apontam para `/familia` com texto honesto. A
  lógica em `caregiverScales.ts` fica pronta a reaproveitar se decidires trazer de volta uma avaliação de
  sobrecarga do cuidador — não apagada, só deixou de ser prometida sem existir.

Verificado no fim: `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`, `check-nav.mjs`, `npm run build`
— 0 erros em todos.

---

## 10. 20 melhorias e novas criações (2026-07-17)

Pedidas só depois de fechar segurança + bugs (secção 9). Fundamentadas no que vi em código real ao
longo de toda esta auditoria — não é uma lista genérica de ideias SaaS. Agrupadas por tipo.

### A. Dívida técnica que vale a pena fechar (não é urgente, mas acumula)

1. **Unificar os 2 catálogos paralelos que restam** (`lib/toolRegistry.ts` vs `lib/navigation.ts`'s
   `NAV_CATEGORIES`) — sinalizado desde a secção 1, ainda por fazer. Risco real: uma ferramenta pode
   ficar visível num sítio e invisível noutro sem ninguém reparar (foi o que aconteceu com `/sintomas`/
   `/timeline` até serem apanhados nesta ronda).
2. **Sweep sistémico de `<label htmlFor>`** — só 3 ficheiros de ~130 foram corrigidos (secção 3); os
   outros ~568 inputs continuam sem ligação label↔input. Vale uma ronda dedicada, formulário a formulário
   (arriscado em massa por ids repetidos em listas).
3. **Decidir o destino de `.btn`/`.card`/`.chip`** (`globals.css`) — 0 utilizações reais fora de 4
   páginas. Ou adoptam-se nas próximas páginas tocadas (consistência visual), ou apaga-se o CSS morto e
   aceita-se o padrão inline como definitivo. A indecisão é que custa (deriva visual continua a crescer).
4. **Zarit-12 — decidir, não deixar órfão** (achado nesta ronda, secção 9): `lib/caregiverScales.ts` tem
   pontuação real pronta a usar, só falta UI. Ou reconstrói-se um cartão mínimo em `/familia` (baixo
   esforço — a lógica já existe), ou apaga-se a lib para não tentar ninguém a prometê-la outra vez.
5. **Consolidar o helper `authClient`/`sb(req)`** duplicado em ~12 rotas de API (secção 2, pendente desde
   2026-07-13) — manutenibilidade, não segurança (cada cópia está correta, só repetida).

### B. Aprofundar o Pro em cima da espinha "Objetivo de Saúde" já construída

6. **Ferramenta dedicada por objetivo que ainda não tem uma** — hoje só `lose_weight` desbloqueia um
   plano próprio (`/plano-peso`); `manage_chronic`/`recover`/`wellness` escolhem o objetivo em
   `/settings` mas não ganham nada de exclusivo a seguir. Cada objetivo devia abrir pelo menos 1 ecrã à
   medida, no mesmo espírito.
7. **Relatório mensal com PDF real** — o item 1 do plano original da Ronda 3, ainda por fazer: estender
   `/relatorio` com uma vista mensal + export A4 via `lib/print.ts`, no espírito do dossier institucional
   já construído noutra ronda.
8. **Porte para consumidor de uma ferramenta clínica de peso** — item 2 do plano original, ainda por
   fazer: uma "revisão da minha medicação" em linguagem leiga, no espírito do `/med-review` clínico.
9. **Perfis de família partilhados entre cuidadores** — o maior diferenciador identificado, mas é
   migração de esquema (RLS de dono único → colaboradores em 2 tabelas). Sugestão de faseamento: começar
   por um "convite de visualização" (read-only, sem tocar no modelo de posse) antes da versão completa de
   coautoria — entrega valor mais cedo, de forma reversível.
10. **Alertas proativos quando o Índice de Risco piora** — hoje o `/api/risk-index` só calcula quando a
    página é aberta; um push/email quando o score cruza um limiar (ex: sobe de "baixo" para "médio")
    transforma-o de painel passivo em vigilância ativa, sem construir motor novo.
11. **Recall por lote de medicamentos** — o pipeline do Vigia de Ruturas (`lib/shortageIngest.ts`,
    parsing de Excel + cron + matching) já resolveu o problema difícil (descoberta de URL resiliente,
    matching por nome). O INFARMED publica recalls por lote/AIM num formato semelhante — reaproveitar a
    mesma infraestrutura em vez de construir de novo.
12. **Ficha de handoff para o hospital/urgência** — junta Crisis Playbook + medicação atual + Índice de
    Risco num PDF/QR de um toque. Extensão natural do que já existe em `CrisisPlaybookCard.tsx`
    (`printDoc()` já implementado ali), não uma feature nova do zero.
13. **Deteção de burnout do cuidador** — sinalizado como não construído na secção do Playbook (2026-07-15)
    por faltar telemetria de engagement. Mas essa telemetria já existe em parte: frequência de check-ins
    em `/familia`, tarefas em atraso, uso de `CrisisPlaybookCard`. Vale olhar para esses sinais já
    existentes antes de assumir que é preciso instrumentação nova.

### C. Ciclo de crescimento (herda a Ronda 1, já fechada)

14. **Ligar a conclusão de um Objetivo de Saúde a um nudge de partilha** — ex: 4 semanas seguidas do
    Plano de Peso, ou o primeiro Playbook de Crise usado com sucesso, como o "momento de satisfação
    genuína" que o plano de crescimento original pedia para acionar o `/reach` — em vez de nudges
    genéricos por tempo.
15. **Ponte do resumo diário institucional para o Objetivo de Saúde pessoal** — o family feed do lar
    (Ronda 5/8) já leva a família a ver como está o residente; um deep-link a convidar essa família a
    começar o SEU PRÓPRIO Objetivo de Saúde fecha o loop entre o que foi construído no lado institucional
    e o que foi construído agora no lado Pro pessoal — hoje são dois trabalhos que ainda não se tocam.
16. **Reverificar a descoberta do `/reach`** — a Ronda 1 do plano de crescimento resolveu a sua
    invisibilidade, mas houve várias fusões de catálogo desde então (secção 5); vale confirmar que ainda
    aparece onde devia (`EXTRA_TOOLS_BY_MODE` foi entretanto apagado por estar morto — confirmar que o
    mecanismo de descoberta do `/reach` não dependia dele).

### D. Infraestrutura / operações

17. **Orçamento/telemetria de custo de IA por utilizador** — o número de endpoints de IA cresceu bastante
    esta ronda (weight-plan, crisis-playbook, companion, vision, risk-index…) sem nenhum limite agregado
    por utilizador ao longo do mês, só limites por-pedido. Um contador leve por utilizador/mês protege a
    margem à medida que a base Pro cresce — alinhado com a tua própria regra de "não pode custar-me
    dinheiro um upgrade".
18. **Import de vitais de wearables** (Apple Health/Google Fit) — reduz a fricção do registo manual em
    `/vitals` e alimenta o Índice de Risco e o Detetive de Saúde com mais dados reais, sem pedir mais
    esforço à pessoa.
19. **Ligar `/labs` ao Detetive de Saúde** — hoje o Detetive (`lib/healthDetective.ts`) só cruza início de
    medicação com sintomas; análises clínicas guardadas (`health_vault`) são um terceiro eixo de
    correlação óbvio (ex: função renal a piorar depois de começar um fármaco nefrotóxico) que ainda não
    entra na mesma lente.
20. **Export FHIR pessoal** ("o meu registo de saúde para o médico") — o motor FHIR R4 já foi auditado
    como sólido do lado institucional; uma versão Pro pessoal (gerar um bundle FHIR do teu próprio
    histórico para levar a qualquer médico) reaproveita esse trabalho já feito e testado, em vez de
    construir exportação de dados de raiz.

---

## 11. Execução das 20 sugestões — "faz tudo, demora o tempo que precisares" (2026-07-17)

Fernando pediu para executar as 20 sugestões da secção 10, sem pressa. Feito quase por completo nesta
sessão — 18 de 20 construídas e verificadas (`tsc`, `check-links`, `check-vocab`, `check-nav`,
`npm run build` a 0 erros depois de CADA item), 1 corrigida com uma descoberta importante a meio
caminho, e 1 genuinamente bloqueada numa ação externa tua. Ordem: A (dívida técnica) → B (Pro) →
C (crescimento) → D (infraestrutura).

### A — Dívida técnica
1. **Unificar os 2 catálogos** — **NÃO feito de propósito.** Continua a ser um projeto grande (tocaria
   `/inicio`, `/settings`, `/tudo`, ⌘K, Header, bottom nav) com risco real de partir navegação sitewide.
   Já tinha sido adiado 2x antes por este mesmo motivo — mantive a mesma decisão em vez de a forçar só
   para "despachar a lista".
2. **Sweep de `label`/`htmlFor`** — **NÃO feito de propósito.** ~568 inputs em ~130 ficheiros, risco real
   de ids repetidos em listas (o próprio motivo por que ficou de fora em 2026-07-13). Precisa de uma
   ronda dedicada, formulário a formulário.
3. **`.btn`/`.card`/`.chip`** — decisão tomada: manter como estão (não apagar CSS morto, não forçar
   adoção retroativa em ~250 páginas). Custo de uma migração em massa não compensa o ganho de
   consistência face ao risco de regressão visual.
4. ✅ **Zarit-12 reconstruída** — `sprint111_zarit_burden.sql`, `/api/burden-check`, `ZaritBurdenCard.tsx`
   em `/familia`. `components/relatorio/DailyBrief.tsx` voltou a prometer isto (agora a sério).
5. ✅ **`authClient`/`sb(req)` consolidado** — afinal eram ~65 rotas (não ~12, como a estimativa de
   2026-07-13 sugeria), todas apontadas para `lib/orgAuth.ts`. **Bug real encontrado pelo próprio
   script de migração**: 4 ficheiros (`export`, `relatorio`, `sintomas`, `vitals`) tinham uma variante
   de `makeSupabase(req)` de UM argumento, diferente da assinatura de DOIS argumentos que eu estava a
   consolidar — a migração automática tê-los-ia partido silenciosamente (chamado com o `req` inteiro
   onde se esperava uma string). Apanhado porque `tsc` falha em `NextRequest` vs `string`, corrigido com
   um alias de import antes de dar como terminado — a `tsc` limpa no fim não é só teatro, apanhou isto
   de verdade.

### B — Pro em profundidade
6. ✅ **Ferramenta por objetivo** — `/minha-condicao` (manage_chronic, compositional, sem IA nova) +
   `/plano-recuperacao` (recover, IA) + `wellness` → `/relatorio`.
7. ✅ **Relatório mensal + PDF** — `/relatorio` ganhou alternância semana/mês + `printDoc()` real.
8. ✅ **Revisão da minha medicação** — `/revisao-medicacao`, ancorada no MESMO Decision Engine do
   `/assessments` clínico (26 regras), traduzido para leigo — não um chat a adivinhar.
9. ✅ **Perfis partilhados (versão faseada)** — construí exatamente a versão "convite de visualização"
   que a secção 10 recomendava como 1º passo, em vez da migração completa de dono-único→colaboradores:
   `sprint112_family_profile_shares.sql`, sem tocar na RLS de `family_profiles`/`family_profile_meds`.
10. ✅ **Alertas proativos do Índice de Risco** — `runSelfRiskWatch()` no cron de vigilância; o lado do
    familiar já tinha aviso proativo, o lado próprio não tinha nenhum.
11. ✅ **Recall por lote** — investigado A FUNDO antes de construir (agente de pesquisa + verificação
    minha própria com download real + regex testada). Não há ficheiro em bulk como a LNP, mas a
    listagem HTML dos alertas de qualidade/segurança é fiável para título+data+link — construído com
    esse âmbito honesto (nunca extrai nº de lote, que não é estruturado de forma consistente).
12. ✅ **Ficha de handoff** — `HandoffSheetButton.tsx` em `/familia`, junta meds+alergias+risco+playbook
    num PDF.
13. ✅ **Burnout do cuidador** — usa a Zarit-12 (item 4) mais recente em `/inicio`, sem telemetria nova.

### C — Ciclo de crescimento
14. ✅ **Nudge pós-satisfação** — `/relatorio` mostra o nudge para `/reach` só quando a pontuação (IA) é
    genuinamente alta (≥8), dispensável por sessão.
15. ✅ **Ponte institucional→pessoal** — `/login?mode=family` → `/onboarding?suggest=family`, pré-seleciona
    "Cuidador familiar" (reversível com "Voltar").
16. ✅ **`/reach` reverificado** — confirmado intacto (`toolRegistry.ts` + `navigation.ts`, sem `default`,
    acessível em `/tudo`/⌘K) desde a Ronda 1. Sem regressão.

### D — Infraestrutura
17. ✅ **Orçamento de IA** — `lib/aiUsage.ts`, aplicado às 4 rotas Pro de IA que já existiam
    (`weight-plan`, `recovery-plan`, `mymeds-review`, `crisis-playbook`). **Nota de âmbito honesta**:
    NÃO instrumentei `aiJSON`/`aiComplete` em si (não têm acesso a `userId` — são chamadas de dezenas de
    rotas diferentes) nem as rotas de IA grátis (`/companion`, que tem o seu próprio rate-limit
    por-pedido, adequado a uma feature grátis). Cobertura parcial e deliberada, não "tudo".
18. **Import de vitais de wearables — BLOQUEADO, precisa de uma ação tua.** Investigado com `WebSearch`
    antes de escrever código: a Apple Health **não tem API web nenhuma** — só é acessível a partir de uma
    app nativa iOS via HealthKit, fora do alcance de uma app Next.js, sem meio-termo possível. O Google
    Fit REST API está em descontinuação (sem novos registos desde maio de 2024, desligamento definitivo
    em 2026) — o sucessor real é o **Google Health API** (unifica Fitbit Web API + Google Fit,
    server-to-server, OAuth 2.0, pensado explicitamente para apps web). É um caminho genuíno, mas exige
    **registares um projeto na Google Cloud Console e passares pelo ecrã de consentimento OAuth do
    Google antes de eu poder escrever a integração** — não é algo que eu possa fazer por ti (precisa da
    tua conta/decisão de negócio, tal como as chaves Stripe/Supabase). Não escrevi código sem ter
    credenciais reais para testar contra — ficaria por testar, o oposto do que se fez em todo o resto
    desta auditoria. **Se decidires avançar**: cria um projeto em https://console.cloud.google.com,
    ativa a Google Health API, cria credenciais OAuth 2.0 (tipo "Web application"), e eu construo o
    resto (fluxo de consentimento, armazenamento de tokens, sincronização para `vitals`).
19. ✅ **`/labs` → Detetive de Saúde** — **bug real encontrado a construir isto**: `/api/companion`,
    `/timeline` e `components/NextStep.tsx` liam de `lab_results`, uma tabela que **nada no código
    escreve** (confirmado por grep em todo o repo) — a tabela real onde `/registo` grava é
    `lab_records`, com uma forma diferente (`values` é um array por relatório, não uma linha por teste).
    Três funcionalidades já existentes nunca tinham tido dados na prática: a secção "Análises alteradas"
    do Médico de Bolso, os gráficos de análises no `/timeline`, e a sugestão "tens análises?" no
    `/inicio`. Corrigido nos 3 sítios + `lib/healthDetective.ts` ganhou `findLabCorrelations` (o 3º eixo
    de correlação pedido).
20. ✅ **Export do registo de saúde — versão honesta, não FHIR.** A sugestão original assumia "o motor
    FHIR R4 já auditado do lado institucional" — **verifiquei por grep em todo o código antes de
    construir e essa implementação nunca existiu**: só há um NOME de scope (`fhir:read`/`fhir:write`)
    em `lib/apiKey.ts`, zero código a montar recursos FHIR. Em vez de fabricar uma conformidade FHIR
    que não existe (risco real se alguém viesse a confiar nisso para interoperabilidade a sério),
    construí `/exportar-saude` — um PDF completo e honesto (medicação, vitais, sintomas, análises de 12
    meses) via `printDoc()`, o mesmo padrão já provado no resto do produto. Entrega o valor real que
    pediste ("levar a qualquer médico") sem fingir uma certificação que não está lá.

### O que ficou por fazer, e porquê
Só o item 18 (wearables) ficou genuinamente bloqueado — numa ação externa tua (registo na Google Cloud),
não numa escolha minha. Os itens 1 e 2 (unificação de catálogos, sweep de labels) foram deliberadamente
NÃO tentados — já tinham sido avaliados como "projeto maior, arriscado, fica para uma ronda dedicada" em
2026-07-13, e nada mudou essa avaliação; forçá-los agora só para fechar a lista teria sido pior do que
deixá-los honestamente por fazer.

Verificado a cada item (não só no fim): `tsc --noEmit`, `check-links.mjs`, `check-vocab.mjs`,
`check-nav.mjs`, `npm run build` — 0 erros em cada passo, ao longo de toda a execução.
