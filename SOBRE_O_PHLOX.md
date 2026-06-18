# O Phlox, explicado de A a Z (para venderes com confiança)

Tudo o que o teu produto faz, para quem é, o que está pronto, o que tem limites, e
como responder às perguntas mais prováveis de um cliente. Lê isto uma vez e
dominas o produto.

---

## O que é o Phlox, numa frase
Uma plataforma de saúde portuguesa com **dois lados**:
1. **Para pessoas** (e quem cuida delas): perceber medicamentos, organizar a saúde,
   lembretes de toma, falar com uma IA de saúde.
2. **Para instituições** (lares, centros de dia, farmácias, clínicas): o software do
   dia-a-dia — medicação, registos, famílias, balcão, stock — talhado a cada tipo.

O mesmo site adapta-se a quem entra: a pessoa escolhe o seu "modo" e vê só o que lhe
interessa.

---

## Os 4 modos (e quem é cada um)
Cada utilizador tem **um modo de experiência**. Define-se no início (onboarding) e
muda-se no menu do perfil.

| Modo | Para quem | Vê o quê |
|---|---|---|
| **Pessoal** | qualquer pessoa | medicação, saúde, IA, scan |
| **Família/Cuidador** | quem cuida de pais/avós | perfis de vários familiares + tudo do pessoal |
| **Estudante** | estudantes de saúde | estudo, quizzes, OSCE, simulador, estágio |
| **Clínico/Institucional** | lares, centros de dia, farmácias, clínicas | o cockpit da instituição + ferramentas profissionais |

---

## Os planos (e o que cada um dá)
IDs internos: `free / student / pro / clinic`. Nomes que o cliente vê:

| Plano | Preço | Para quem | O que tem |
|---|---|---|---|
| **Base** | grátis (com anúncios) | experimentar | essenciais; limites diários apertados (3 scans/dia, 3 perguntas IA/dia, etc.) |
| **Plus** | 3,99€/mês | **estudantes** | estudo SEM limites (flashcards, Arena, AI Tutor, OSCE, Modo Exame, ECGs, análises) |
| **Pro** | 12,99€/mês | **pessoas/cuidadores sérios + profissionais individuais** | tudo sem limites, lembretes push, Scan/IA ilimitados, chat com a medicação, Saúde 360°, partilha, ferramentas clínicas individuais |
| **Institucional** | 149€/mês | **organizações** | espaço da org talhado ao tipo, equipa + utentes ilimitados, dados em tempo real, portal das famílias, relatórios profissionais |

**Como funcionam os limites:** o Base é de propósito apertado para empurrar o Pro.
Os limites são impostos **no servidor** (não se contornam). Quando alguém esgota,
aparece um convite a fazer upgrade.

---

## LADO 1 — Para pessoas e cuidadores

### Medicação
- **Phlox Scan** — tira foto a qualquer coisa de saúde (receita, caixa, análise,
  relatório) e a IA percebe o que é e age. *Limite: 3/dia no Base, ilimitado no Pro.*
- **O que é este medicamento?** — escreves o nome e percebes para que serve, se
  precisa de receita e cuidados. *5/dia no Base.*
- **Os meus medicamentos** — a lista, com **lembretes de toma à hora exata** e
  registo de adesão. *(Os lembretes no telemóvel precisam de configuração — ver
  GUIA_TESTAR_INTEGRACOES.md.)*
- **Verificar interações** — dá-se bem juntar estes medicamentos? *3/dia no Base.*
- **Alimentos a evitar** — o que não misturar com a medicação.
- **Chat com a medicação** — pergunta em português sobre os teus medicamentos.
  *Provadela no Base/Plus, ilimitado no Pro.*

### A minha saúde
- **Tensão, peso, açúcar** — registo e tendências.
- **Como me sinto hoje** — diário de sintomas.
- **Devo ir ao médico?** — triagem + primeiros socorros.
- **Estou em dia?** — rastreios e vacinas em falta (normas DGS).
- **A minha história de saúde** — linha do tempo de medicação, análises, sintomas.
- **Cofre de documentos** — guarda análises/receitas, partilha por código.
- **Saúde 360°** (Pro) — tudo num só painel.
- **Mostrar a minha saúde (QR)** — um código QR para o médico/farmácia ver tudo.
- **Calendário** — eventos, lembretes, e agora junta as tomas de medicação e avisa
  "como correu?" depois de consultas.

### Perceber
- **Phlox AI** — assistente de saúde conversacional. *3 perguntas/dia no Base,
  ilimitado no Pro.* Conhece a tua medicação (se deres permissão).
- **Perceber as minhas análises** — cola os valores, recebe explicação simples.

### Família (cuidador)
- **Perfis da família** — um perfil por familiar de quem cuidas.
- **Família 360°** (Pro) — tudo de quem cuidas num painel: medicação, mensagens,
  sobrecarga do cuidador (escala Zarit).

---

## LADO 2 — Para instituições

O Phlox **adapta-se ao tipo de instituição** automaticamente. Diz que tipo é, e o
produto vem inteiro: o vocabulário certo (residente/utente/doente), as ferramentas
certas, o cockpit certo. **Tipos prontos hoje:** Lar/ERPI, Centro de Dia, Farmácia
Comunitária. (Clínica e Centro de Saúde existem mas estão escondidos por agora.)

### O painel (cockpit)
Cada instituição vê o seu `/painel` talhado — com dados reais:
- **Lar/Centro de Dia:** o dia de hoje, presenças, medicação a dar, quem vigiar,
  atividades, famílias, ocorrências.
- **Farmácia:** balcão (receitas a validar + ruturas), vendas do dia, tarefas.

### Ferramentas profissionais (as principais)
- **Utentes/Residentes/Doentes** — fichas, medicação, alertas de risco.
- **MAR (administração de medicação)** — regista cada toma por turno, com alertas de
  segurança (alergias, interações) na hora de dar. **Imprime a folha de MAR** (o
  documento que a Segurança Social audita).
- **Registo do dia** — refeições, humor, hidratação, atividades, feridas (no lar).
  **Imprime o registo de cuidados.**
- **Ocorrências** — quedas, erros, etc., com relatório imprimível.
- **Avaliações** — escalas Barthel, Braden, MNA, Morse, MMSE, com impressão.
- **Portal das famílias** — mensagens, e **"Gerar mensagem do dia"** que escreve
  sozinho como correu o dia (humor, refeições, hidratação, atividades).
- **Stock & validades** — existências, ruturas, prazos, com **relatório de
  encomenda/auditoria**.
- **Balcão / Vendas / Fila de validação de receitas** (farmácia).
- **Agenda** — marcações/consultas.
- **Turno / Passagem de turno** — ronda priorizada por risco.
- **Conformidade / Consentimentos / Documentos** — checklists legais por tipo, RGPD.

### Integrações (o lado técnico)
- **FHIR R4** — o Phlox fala a "língua" dos sistemas de saúde. Laboratórios e
  hospitais podem ligar-se. (Ver GUIA_TESTAR_INTEGRACOES.md.)
- **Receção de laboratórios** — dás uma "caixa de correio" ao laboratório e os
  resultados entram sozinhos na ficha do doente.
- **Faturação** — emite faturas-recibo e exporta SAF-T.

---

## O que está PRONTO vs o que TEM LIMITES (sê honesto, vende melhor)

**Pronto e a funcionar:**
- Todo o lado pessoal (scan, medicamentos, interações, IA, saúde, calendário).
- Cockpits e ferramentas das 3 instituições (lar, centro de dia, farmácia).
- Exports profissionais A4 (MAR, cuidados, ocorrências, stock, avaliações).
- FHIR R4 + receção de laboratórios (seguros).

**Tem limites / precisa de um passo teu:**
- **Notificações push:** o código está feito, mas só tocam depois de pores as chaves
  VAPID (5 min — guia). Até lá, os horários guardam-se mas não toca sozinho.
- **Faturação:** emite e exporta SAF-T; **não** sincroniza automaticamente com Sage/
  PHC/Sifarma (isso seria um conector à parte, sob pedido).
- **Clínica e Centro de Saúde:** construídos mas escondidos — foco nos 3 tipos.

**Como responder se um cliente perguntar algo que não tens:**
> "Nesta versão fazemos X (e mostro). Para Y, é uma adição que conseguimos fazer —
> deixa-me confirmar o prazo." (E dizes-me a mim.) Nunca digas "não sei se funciona".

---

## Perguntas prováveis de um cliente (e a resposta)

**"Os dados estão seguros?"** Sim — cada conta só vê os seus dados (isolamento por
utilizador/organização), e o FHIR tem proteções contra acesso cruzado.

**"Funciona no telemóvel?"** Sim, é web e instala-se como app (adicionar ao ecrã
principal). As notificações funcionam com a app instalada.

**"As famílias veem os meus utentes todos?"** Não — cada família só vê o seu
familiar, por um portal próprio.

**"Posso importar os meus dados?"** Sim — importação por CSV (utentes, stock) e por
foto/documento (medicação via Scan).

**"Quanto custa para o meu lar?"** Plano Institucional, 149€/mês, utentes e equipa
ilimitados.

---

## A tua "lição de casa" técnica (4 coisas)
1. **Deploy:** o site só muda quando fazes deploy na Vercel. Se "não vês" uma
   melhoria, provavelmente falta deploy.
2. **Migrações SQL:** corre no Supabase os ficheiros `supabase/sprint*.sql` mais
   recentes (ex: sprint88, sprint89), senão funcionalidades novas ficam inativas.
3. **Chaves VAPID:** para as notificações tocarem (guia).
4. **Relógio das tomas (cron):** o plano grátis da Vercel só corre crons 1×/dia, por
   isso o "relógio" dos lembretes vive **fora** da Vercel — um agendador gratuito
   (cron-job.org) que bate no Phlox a cada 15 min. Passo a passo no
   GUIA_TESTAR_INTEGRACOES.md. (Sem isto, os lembretes só tocam com a app aberta.)

Domina estes 4 pontos e nunca mais pareces amador a falar do teu próprio produto.
