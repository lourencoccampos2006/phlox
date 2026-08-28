# Phlox

Plataforma de saúde portuguesa. Serve dois públicos a partir da mesma base:

- **Instituições** — lares e centros de dia. Medicação, presenças, sinais vitais,
  ocorrências, comunicação com as famílias, faturação.
- **Pessoas** — quem gere a sua própria saúde ou a de um familiar, e estudantes
  da área da saúde.

Feito em português de Portugal, com os dados alojados na União Europeia.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3000
```

Precisa de um `.env.local` com, no mínimo:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # só no servidor, nunca no cliente
CRON_SECRET=...                    # igual ao que está na Vercel
```

As duas primeiras são públicas por natureza — vão no JavaScript que o browser
descarrega. A `SUPABASE_SERVICE_ROLE_KEY` ignora todo o RLS: nunca a importes
num ficheiro que chegue ao browser.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run test:e2e` | testes Playwright (precisa do servidor de pé) |
| `npm run qa` | agentes de QA contra as rotas públicas locais |
| `npm run qa:completo` | o mesmo, com sessão iniciada e rotas privadas |

Verificações que valem a pena correr antes de um commit grande:

```bash
npx tsc --noEmit                     # tipos
node scripts/check-scroll.mjs        # o bug do overflow-x (ver abaixo)
node scripts/check-vocab.mjs         # vocabulário certo por tipo de instituição
node scripts/qa-agents/dependencias.mjs   # vulnerabilidades e chaves expostas
```

---

## Como está organizado

```
app/            rotas (App Router). ~250 page.tsx, das quais ~20 são conteúdo público
components/     componentes partilhados
lib/            lógica de negócio, clientes de dados, motores de regras
  institutionBlueprint.ts   o que cada tipo de instituição vê e como se chamam as coisas
  ptTime.ts                 datas e horas de Portugal — ver "Datas" abaixo
supabase/       143 migrações SQL, por ordem (sprintNN_descricao.sql)
scripts/        ferramentas de linha de comandos e os agentes de QA
tests/e2e/      Playwright: scroll, layout no telemóvel, segurança, fluxo clínico
tests/baselines/  referências visuais do QA — GERADAS NO LINUX DO CI, não localmente
```

### Vocabulário por tipo de instituição

Um centro de dia não tem quartos nem camas, e quem lá vai não é "residente".
Um lar tem. Nada disto pode estar escrito à mão no código: sai sempre de
`lib/institutionBlueprint.ts`. O `scripts/check-vocab.mjs` faz cumprir.

Um centro de dia também **não é um ambiente clínico diário** — muitos não têm
profissionais de saúde a tempo inteiro. Não impor cadência diária nem linguagem
clínica em fluxos institucionais.

---

## Coisas que já partiram isto, e como não voltar a partir

### `overflow-x: hidden` congela o scroll da página

Num elemento normal, `overflow-x: hidden` obriga o `overflow-y` a ser calculado
como `auto` — o elemento passa a ser um contentor de scroll. Se ainda por cima
houver `overscroll-behavior-y: none`, o scroll deixa de chegar à janela e a
página fica congelada. **Usar `overflow-x: clip`**, que não tem este efeito.

Este bug voltou três vezes. O `scripts/check-scroll.mjs` corre no CI para o
apanhar.

**Ao testar scroll, usar `mouse.wheel`, nunca `page.scrollTo()`.** O `scrollTo`
funciona mesmo com a página partida, portanto mascara exatamente o bug que se
está a tentar apanhar.

### `position: sticky` não funciona neste site

Há `overflow-x: hidden` no `body` em todo o lado, o que quebra o `sticky` em
qualquer página. Usar `fixed`/`absolute` com JavaScript.

### Datas

O servidor corre em UTC; os horários que os utilizadores escolhem são hora de
Portugal. Usar `ptDate()` e `ptHHMM()` de `lib/ptTime.ts` para datas de
calendário — nunca `toISOString()`, que falha por uma hora no verão e faz os
lembretes bater ao lado.

### Org-scoping e RLS

Todas as queries a tabelas partilhadas têm de filtrar por `org_id`. Uma
instituição a ver dados de outra é o pior que pode acontecer aqui, e já
aconteceu em oito ferramentas ao mesmo tempo. Políticas de `UPDATE` precisam de
`USING` **e** `WITH CHECK` — sem o segundo, um utilizador reatribui a linha a
outro. Nenhuma conta se pode auto-atribuir `plan`, `org_id` ou papel `clinical`.

### QA visual

Verificar em **viewport real de telemóvel**, nunca com `fullPage` — uma captura
de página inteira esconde exatamente os defeitos de layout que interessam.

---

## Automação

Cinco workflows em `.github/workflows/`:

| Workflow | Quando | O que faz |
|---|---|---|
| `qa-daily.yml` | 06:00 diário | agentes contra produção e contra um build local; relatório; abre issue; e um corretor que abre PR com o que der para corrigir |
| `revisao-pr.yml` | cada PR | três especialistas — segurança, português e voz de marca, design no telemóvel |
| `dependencias.yml` | segundas | `npm audit` + procura de chaves em ficheiros versionados. Zero tokens |
| `e2e-tests.yml` | cada push | a suite Playwright |
| `push-cron.yml` | 15 em 15 min | dispara os lembretes de medicação |

A maior parte do trabalho é determinística e não gasta tokens. A camada de IA
autentica-se com `CLAUDE_CODE_OAUTH_TOKEN` — sai da subscrição, não de créditos
de API — e só é chamada para o que nenhuma regra exprime.

**O corretor automático está proibido de editar `scripts/qa-agents/`, `tests/`,
`.github/workflows/` e as referências visuais.** Um agente que pode mexer nas
regras que o avaliam acaba a "corrigir" um achado desligando a regra que o
apanhou, e a partir daí o relatório fica sempre verde.

### Segredos que o repositório precisa

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`,
`CLAUDE_CODE_OAUTH_TOKEN` (de `claude setup-token`). A `SUPABASE_SERVICE_ROLE_KEY`
**não** está aqui de propósito: ignora todo o RLS e um segredo em Actions fica ao
alcance de qualquer workflow do repositório.

### Referências visuais

Estão em `tests/baselines/` e são versionadas de propósito. Têm de ser geradas
no Linux do CI — corre o `qa-daily` à mão com a opção "Regenerar as referências
visuais". As geradas em Windows dão alarme falso todos os dias, porque o desenho
das letras é diferente.

---

## Base de dados

143 migrações em `supabase/`, aplicadas por ordem e à mão. Não há migrações
automáticas: cria-se o ficheiro `sprintNN_descricao.sql` e corre-se no painel do
Supabase.

Toda a tabela em `public` tem de ter RLS ativo. Uma tabela nova sem RLS é uma
tabela aberta ao mundo assim que a Data API a expuser.

---

## Convenções

- Português de Portugal em tudo o que o utilizador vê, e nos comentários.
- Ícones do conjunto próprio em `components/Icon.tsx`. Nunca emoji na interface.
- Voz de marca em `.claude/skills/phlox-brand-voice/SKILL.md`.
- Zero dados falsos. Sem testemunhos inventados, sem números de exemplo que
  pareçam reais.
