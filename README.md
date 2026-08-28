<p align="center">
  <img src="public/icons/icon-192.png" width="88" alt="Phlox">
</p>

<h1 align="center">Phlox</h1>

<p align="center">
  Software português para lares e centros de dia — e para quem gere a sua
  medicação, ou a de alguém.<br>
  <sub>Next.js 16 · Supabase · português de Portugal · dados na União Europeia</sub>
</p>

---

São 7h30 num centro de dia em Portugal. Chegam trinta e quatro pessoas. Cada uma
com a sua medicação, os seus horários, e uma família que vai telefonar a meio da
tarde para saber como correu o dia.

O que existe hoje para gerir isto é papel, folhas de Excel, e cadernos que ficam
no gabinete. O Phlox põe a mesma coisa num sítio só: a auxiliar regista a toma no
telemóvel quando a dá, e a filha vê no dela ao fim do dia.

## O que faz

**Para a instituição** — medicação e horários, presenças, sinais vitais,
refeições, atividades, ocorrências. Rondas por turno, stock, faturação e os
relatórios de qualidade que a tutela pede.

**Para as famílias** — um portal onde veem o dia do seu familiar sem terem de
telefonar. O que comeu, se tomou os comprimidos, como esteve.

**Para pessoas** — a mesma base, virada para quem organiza a sua própria
medicação ou a de um pai. Lembretes que tocam, verificação de interações,
registo de sinais vitais, e um relatório em PDF para levar ao médico.

O Phlox é uma ferramenta de organização e apoio. Não é um dispositivo médico e
não substitui uma consulta.

---

## Três decisões que moldaram o código

### Um lar e um centro de dia não são a mesma coisa

Um lar tem quartos e camas, e quem lá vive é residente. Num centro de dia as
pessoas vão para casa ao fim do dia, não há quartos, e chamar-lhes residentes é
sinal de que quem fez o software nunca lá pôs os pés.

Isto podia ter sido resolvido com dois produtos, ou com condicionais espalhadas
pelo código. Em vez disso há um blueprint declarativo — [`lib/institutionBlueprint.ts`](lib/institutionBlueprint.ts)
— que diz, por tipo de instituição, que ferramentas existem e como se chamam as
coisas. Nenhum ecrã escreve "quarto" à mão. Um linter próprio
([`scripts/check-vocab.mjs`](scripts/check-vocab.mjs)) recusa o build se alguém o tentar.

A mesma lógica levou a uma decisão de produto: um centro de dia muitas vezes não
tem profissionais de saúde a tempo inteiro, por isso nada no produto impõe
cadência diária nem linguagem clínica a quem não a tem.

### Uma equipa de agentes que examina o site todos os dias

Todas as manhãs, cinco workflows correm sozinhos. A maior parte do trabalho é
determinística e não gasta um único token: estados HTTP, erros de consola, scroll
com a roda do rato em cada rota, transbordo horizontal, regressão visual por
comparação de píxeis, links partidos, acessibilidade com o axe, Core Web Vitals,
armadilhas de português.

Por cima disso corre uma camada pequena de IA — só para o que nenhuma regra
exprime — que olha para as capturas e responde à pergunta que uma regra não sabe
fazer: *isto parece partido a um humano?* Depois abre um Pull Request com o que
der para corrigir.

A regra que faz isto valer alguma coisa está escrita no código: **o relatório tem
de poder dizer "nada a assinalar", e nunca passa de cinco pontos.** Um agente a
quem se pede "encontra problemas" encontra sempre alguma coisa, e ao quarto dia
de ruído deixa-se de ler o relatório.

E o corretor automático está proibido de editar `scripts/qa-agents/`, `tests/` e
as referências visuais. Um agente que pode mexer nas regras que o avaliam acaba a
"corrigir" um achado desligando a regra que o apanhou.

### O logótipo é um objeto 3D, e tudo o resto deriva dele

A marca é uma flor de phlox modelada em 3D. No rodapé roda continuamente, em
WebGL, carregada só quando chega ao ecrã. Todos os outros formatos — o ícone da
aplicação, o favicon, a versão para fundos escuros, a versão maskable para
Android — são renderizados a partir da mesma geometria por
[`scripts/logo-2d.mjs`](scripts/logo-2d.mjs). Não há um ficheiro editado à mão em
lado nenhum, o que quer dizer que não podem divergir uns dos outros.

A tipografia do logótipo era carregada com o `TTFLoader` do three.js, que vai
buscar o opentype.js a um CDN em tempo de execução. Num produto de saúde que diz
alojar tudo na União Europeia, isso não entra: o tipo de letra foi convertido
para um subconjunto de cinco glifos, 216KB → 6KB, sem terceiros.

---

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` precisa de, no mínimo:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # só no servidor
CRON_SECRET=...                    # igual ao que está na Vercel
```

As duas primeiras são públicas por natureza — vão no JavaScript que o browser
descarrega. A terceira ignora todo o RLS: nunca a importes num ficheiro que
chegue ao cliente.

| Comando | |
|---|---|
| `npm run build` | build de produção |
| `npm run test:e2e` | Playwright: scroll, layout no telemóvel, segurança, fluxo clínico |
| `npm run qa` | os agentes de QA contra as rotas públicas locais |
| `npm run qa:completo` | o mesmo, com sessão iniciada |
| `node scripts/check-scroll.mjs` | o guarda do bug do `overflow-x` |
| `node scripts/check-vocab.mjs` | vocabulário certo por tipo de instituição |
| `node scripts/qa-agents/dependencias.mjs` | vulnerabilidades e chaves expostas |

## Estrutura

```
app/            rotas (App Router). ~250 páginas, das quais ~25 são conteúdo público
components/     componentes partilhados
lib/
  institutionBlueprint.ts   o que cada tipo de instituição vê, e como se chama
  interactionsEngine.ts     interações medicamentosas (RxNorm/NIH)
  ptTime.ts                 datas e horas de Portugal
  seoRoutes.ts              o que o Google pode ver — fonte única
scripts/
  qa-agents/    a equipa de QA
  video/        a peça animada e o exportador para .mp4
supabase/       143 migrações SQL, por ordem, aplicadas à mão
tests/e2e/      Playwright
```

## Se fores mexer nisto

Quatro coisas que já partiram este projeto mais do que uma vez:

**`overflow-x: hidden` congela o scroll da página.** Num elemento normal, força o
`overflow-y` a ser calculado como `auto` — o elemento passa a ser um contentor de
scroll, e com `overscroll-behavior-y: none` o scroll deixa de chegar à janela.
Usar `overflow-x: clip`. Ao testar, usar `mouse.wheel` e nunca `page.scrollTo()`,
que funciona mesmo com a página partida e mascara o bug.

**O servidor corre em UTC, os horários são de Portugal.** Usar `ptDate()` e
`ptHHMM()` de [`lib/ptTime.ts`](lib/ptTime.ts). Com `toISOString()` os lembretes
batem uma hora ao lado no verão.

**Toda a query a uma tabela partilhada filtra por `org_id`.** Uma instituição a
ver dados de outra é o pior que pode acontecer aqui, e já aconteceu em oito
ferramentas ao mesmo tempo. Políticas de `UPDATE` precisam de `USING` **e**
`WITH CHECK`; sem o segundo, um utilizador reatribui a linha a outro.

**QA visual em viewport real de telemóvel, nunca `fullPage`.** Uma captura de
página inteira esconde exatamente os defeitos de layout que interessam.

## Convenções

Português de Portugal em tudo o que o utilizador vê, e nos comentários. Ícones do
conjunto próprio em [`components/Icon.tsx`](components/Icon.tsx) — nunca emoji na
interface. Zero dados falsos: sem testemunhos inventados, sem estatísticas sem
medição por trás. A voz de marca está em
[`.claude/skills/phlox-brand-voice/SKILL.md`](.claude/skills/phlox-brand-voice/SKILL.md).
