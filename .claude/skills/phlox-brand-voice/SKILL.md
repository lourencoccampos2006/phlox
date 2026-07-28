---
name: phlox-brand-voice
description: "Voz de marca e posicionamento do Phlox — para qualquer página pública, copy de produto, email ou texto voltado ao utilizador. Use sempre que escrever ou rever homepage, /pricing, /terms, onboarding, emails, ou qualquer texto que o utilizador vai ler. Regras de tom (profissional, minimalista, sem clichés de IA) e posicionamento (lares e centros de dia, nunca farmácia/clínica/hospital)."
source: phlox (interno)
---

# Voz de marca do Phlox

Decisão de produto (Fernando, 2026-07-27/28): o Phlox institucional serve **exclusivamente
lares e centros de dia**. Não farmácias, não clínicas, não hospitais — mercado deliberadamente
mais pequeno, mas sem os gigantes entrincheirados desses outros mercados (Sifarma, SClínico).

## A regra mais importante

**Nunca justifiques a escolha no texto do produto.** Nunca escrever nada como "não competimos
com o Sifarma" ou "não trabalhamos com farmácias". O utilizador não precisa de saber contra o
que decidimos não competir — só precisa de saber o que o Phlox FAZ. Fala de lares e centros de
dia, ponto. Se uma frase soa a desculpa ou a explicação de uma ausência, corta-a.

## Tom

- **Profissional, minimalista.** Frases curtas. Uma ideia por frase.
- **Concreto, nunca vago.** Diz o que o produto faz, não como o utilizador vai "sentir-se".
- Sem exclamações de venda, sem urgência artificial, sem promessas grandes sem prova.

## O que NUNCA escrever (clichés de IA/genéricos)

Estes padrões saltam à vista como "escrito por IA" e devem ser eliminados sempre que aparecerem:

- **Construções "Não é X — é Y"** (contraste manufaturado). Exemplo real removido:
  *"Não é tradução de fora — as marcas e as regras são as de cá."* — soa a slogan de startup
  genérica, ninguém fala assim. Se precisas de justificar que "é feito para Portugal", mostra-o
  com um facto concreto (nome de instituição, referência a legislação real), não com esta
  fórmula de contraste.
- **Abridores possessivos vazios** ("A sua X, Y."). Exemplo real removido:
  *"A sua saúde, organizada a sério."* — fraco porque não diz nada específico; qualquer app de
  saúde podia usar esta frase. Prefere uma frase que só faça sentido PARA O PHLOX.
- Metáforas de "jornada", "viagem", "transformação".
- "Simplificamos", "revolucionamos", "reinventamos" sem uma prova ao lado.
- Três adjetivos em fila ("rápido, simples e poderoso").
- Emoji como marcador de secção (ver também: o resto do produto já eliminou emoji a favor de
  ícones de linha — texto de marketing segue a mesma regra).

## O que escrever em vez disso

- Uma frase curta que descreva **o que acontece no produto**, não uma emoção.
- Se precisares de prova, usa um número ou um facto real — nunca inventado (zero dados falsos,
  zero testemunhos fabricados — regra permanente do projeto).
- Deixa o produto falar: uma captura de ecrã real, um exemplo de dados genérico (nunca os
  exemplos pessoais do Fernando — ver memória do projeto) vale mais que um adjetivo.

## Posicionamento institucional

- O produto institucional = "para lares e centros de dia". Nunca "para instituições de saúde"
  genericamente (isso reabre a porta a farmácia/clínica/hospital na cabeça de quem lê).
- O modo de conta institucional chama-se **"Instituição"** no produto (não "Clínico" nem
  "Profissional") — é exclusivo de quem é convidado por um lar/centro de dia real, nunca por
  plano pago, nunca auto-selecionável nas Definições.
- Não existe (e não deve existir texto que sugira existir) um plano "para profissionais de
  saúde" isolado — o Phlox não vende a indivíduos que trabalham em saúde fora de uma instituição
  cliente.

## Tokens de marca (para manter consistência visual em qualquer redesign)

- Cor: `--green #0d6e42` (marca), `--ink #16181d`/`#0b1120` (texto), fundo `--bg` branco/quase-branco.
- Tipografia: serifa `Lora`/`var(--font-serif)` para títulos com peso editorial; sans `Syne`/
  `var(--font-sans)` para corpo; mono `JetBrains Mono`/`var(--font-mono)` para etiquetas/dados.
- Acento institucional por tipo: centro de dia = teal `#0d9488`; lar (ERPI) = âmbar `#b45309`
  (`lib/institutionBlueprint.ts`).
- Ícones: só o conjunto de linha próprio (`components/Icon.tsx`) — nunca emoji em UI de produto.
  Em copy de marketing, o mesmo princípio aplica-se ao corpo do texto (emoji como decoração de
  título/marcador é sempre um "não").
