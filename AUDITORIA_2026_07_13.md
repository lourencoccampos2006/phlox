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

### 🔲 Por fazer (não iniciado)

Cada um destes merece o mesmo cuidado que o Índice de Risco — não foram apressados nesta sessão para
não arriscar qualidade. Ordem sugerida: planos por objetivo (reutiliza o `/api/plano` já existente,
scope moderado) → funcionalidades de cuidador avançadas → Detetive de Saúde integrado (a base de
correlação já existe em `/timeline`, "só" falta tornar proativo/automático e mover para o Médico de
Bolso) → Vigia de Preços (o mais arriscado — depende de fonte de dados externa) → Rastreio Visual
ABCDE (o mais caro — chamadas de visão por IA).
