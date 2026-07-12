# Homepage — jornada 3D do herói até ao livro (2026-07-12)

## Contexto

A v6 do herói (flor 3D procedural + raiz procedural, commits `54ebbe1`/`d7bb408`/`5cc1353`) resolveu os
problemas técnicos (centragem, tilt invertido, eixo de rotação, caule "podre" por estar desfocado, halo
branco da vinheta CSS) mas não chegou ao nível de realismo/artisticidade que o Fernando pediu. Depois de
confirmar que bibliotecas gratuitas de modelos 3D (Poly Pizza, Kenney, Quaternius) só têm assets low-poly
de jogo — inúteis para uma flor realista — mas que o Sketchfab tem modelos reais de Phlox e outras flores
(scans/esculturas fotorrealistas, licença livre, sem paywall), o Fernando desenhou, em várias mensagens
consecutivas, uma visão completa e muito mais ambiciosa: já não é "melhorar a flor do herói", é uma
**jornada 3D contínua desde o herói até um livro**, com edifícios 3D a representar os modos, um mundo de
fundo com história própria, e uma câmara que se comporta como um drone sobre um diorama.

Este documento substitui, para a secção 3D do herói+jornada, o desenho anterior de "flor+fio SVG" (v6).
Depois do livro, a homepage volta a ser conteúdo plano normal (refeito, mas sem 3D) — esse âmbito fica
fora deste documento, é tratado à parte.

## Princípio narrativo

Uma flor Phlox real, fotorrealista, nasce e floresce ao carregar a página. Ao rolar, fecha-se (como um
time-lapse ao contrário) e do seu centro nasce uma raiz que **cresce** visivelmente pela página — nunca
uma pré-visualização do caminho por crescer. A câmara, que começava a ver a flor de frente, recua e
inclina-se até ficar quase por cima, revelando que a raiz sobe de um mundo em miniatura — visto como um
diorama, ligeiramente inclinado (70–80° a partir da horizontal, quase de cima mas não perfeitamente
vertical, para preservar a leitura de volume dos edifícios). A raiz serpenteia, dá voltas sobre si mesma,
atravessa dois edifícios (lar, casa) e termina por tocar num livro — cada paragem é um modo do Phlox,
identificado por um cartão de texto que aparece mesmo antes do caule lá chegar.

## 1 — Câmara e orientação

Um único movimento contínuo de câmara, nunca um corte brusco:

1. **Flor (repouso + engolir)**: câmara de frente/ligeiramente elevada, a mesma framing que já existe hoje
   (posição `[0, 0.15, 4.2]`, fov 34).
2. **Momento de revelação** (durante o "dar uma volta completa, rápida" antes de fechar): a câmara recua e
   inclina-se progressivamente para baixo — é este movimento, não uma rotação da própria flor, que revela
   o caule de lado. Rodar o objeto pareceria "a flor foge da câmara"; mover a câmara lê como "a câmara
   revela o que estava escondido", que é a história certa aqui.
3. **Jornada (raiz + edifícios + livro)**: a inclinação continua a aprofundar-se até ao ângulo de diorama
   (~75°), e a câmara desce ao longo do percurso da raiz à medida que se dá scroll — sempre scroll nativo
   do documento, nunca pinado/intercetado (o mesmo princípio de sempre neste projeto): a câmara 3D reage à
   posição de scroll, a barra de scroll do browser continua a controlar tudo normalmente.

**Nota de guarda-corrente**: este ângulo de diorama é próximo, em técnica de câmara, do diorama isométrico
inspirado em vectrfl.com que foi tentado e **rejeitado** nesta mesma iteração de homepage (commit `5ffd761`
→ rejeitado em `c48db1d`). Essa rejeição foi explicitamente sobre a estética escuro+néon+esferas a orbitar,
não sobre a técnica de câmara em si. Aqui emparelha-se a mesma ideia de câmara com a linguagem visual clara,
botânica, da flor Phlox — deve ler-se como um mundo diferente. Vale a pena rever isto com olhos frescos a
meio da construção para confirmar que não está a deslizar de volta para o que já foi recusado.

## 2 — Sequência do herói

### 2.1 Entrada (ao carregar a página, uma vez, não ligada ao scroll)

A flor emerge de baixo do enquadramento e roda até enfrentar o utilizador — não um "subir" reto, uma curva
elegante de posição + rotação (quaternion) com easing tipo "chegada" (ex. `expo.out`/`back.out` no GSAP).
Ao chegar, entra em repouso: rotação lenta contínua sobre o seu próprio eixo (já existe, eixo Z — plano da
flor, nunca fica de perfil), e um punhado de partículas de pólen — poucas (15–30), minúsculas, quase
impercetíveis, movimento lento tipo deriva (ruído simples), à volta da flor.

### 2.2 Primeiro scroll — nascimento do texto

Antes do primeiro scroll: só a flor, sem texto. Ao começar a rolar: a flor recua para o fundo, fica
LEVEMENTE desfocada (blur bem mais subtil do que o atual — isto já não é o "atmosférico" da v6, a flor
continua a ser reconhecível, só ligeiramente suavizada), e o texto "Phlox Clinical", numa só linha, nasce
do centro da flor — expande-se a partir de um ponto (escala 0→1 a partir do centro), não aparece já no
sítio. Ocupa cerca de 75% da largura do ecrã (não ~96% como na v6 — mais respiração lateral). Letras
opacas (nunca deixam ver a flor através de si — isto já está garantido, é uma propriedade do preenchimento
sólido, não da vinheta), cor igual/próxima da cor principal do fundo, que nunca é branco puro (já usamos
`--green-light`, mantém-se).

### 2.3 Scroll seguinte — "desflorescer" e nascimento da raiz

O texto recolhe-se de volta para o centro da flor (mesmo movimento de 2.2, invertido). A flor volta para a
frente, dá uma volta completa e rápida (rotação 360° em ~0.4–0.6s), e começa a fechar-se — como um
time-lapse de floração ao contrário. É durante este fecho que a câmara faz o movimento descrito em §1.2,
revelando a vista lateral onde já se vê a base/caule. Do centro da flor fechada nasce a raiz, que passa a
crescer visivelmente (ver §3).

**Decisão de asset**: dado que um modelo 3D descarregado (scan real) é uma malha única sem pétalas
separadas, "desflorescer" pétala-a-pétala não é possível com rigor nesse asset. Resolve-se com escala +
inclinação + a rotação rápida do momento anterior a mascarar a transição (a atenção do olho segue o
movimento geral, não junções de pétalas) — é assim que motion design profissional costuma resolver
transformações orgânicas complexas sem rigging. Caso se encontre no Sketchfab um modelo já ANIMADO de
floração (existe a hipótese real — filtro "Animated" + termos como "flower blooming timelapse"), essa seria
a solução ideal: um único asset tocado ao contrário para fechar e a favor para florescer (ver §5).

## 3 — A raiz: crescimento, forma, mundo de fundo

### 3.1 Mecânica de crescimento

Continua o princípio já estabelecido e funcional da v6 (`RootStem` em `PhloxFlowerScene.tsx`): só o troço
já crescido é geometria real, nunca uma pré-visualização. A curva ganha mais volta sobre si mesma — não só
S-curvas num plano, mas voltas verdadeiramente 3D (variação também em X/Z ao longo do percurso, criando
troços que se sobrepõem em profundidade, como uma cambalhota) — para preencher espaço e dar a sensação de
percurso longo/orgânico, não um traço reto disfarçado.

### 3.2 Animação reativa na ponta

Pedido explícito do Fernando, sem ideia própria ainda — proposta:

- **Brilho suave que viaja com a ponta**: a ponta da raiz emite uma luz quente e suave que ilumina
  ligeiramente o chão/elementos por perto à medida que avança, esmorecendo atrás de si assim que passa.
  Além de bonito, liga-se tematicamente bem a "o Phlox ilumina o caminho".
- **Pequenos rebentos no rasto**: pequenas ervas/rebentos no chão que "acordam"/crescem brevemente na
  vizinhança imediata da ponta enquanto ela passa — reforça a narrativa de crescimento sem introduzir
  elementos alheios à história (nada de borboletas ou coisas decorativas sem ligação).

Proposta: combinar os dois — a ponta tem um brilho suave constante, e deixa um rasto breve de rebentos no
chão. Ambos subtis, nunca competem com os elementos principais (flor, edifícios, livro).

### 3.3 Mundo de fundo — não é cor sólida

O fundo passa a ser um pequeno mundo, não uma cor lisa:

- **Chão com textura**: em vez de `var(--green-light)` plano, uma superfície com curvas de nível subtis
  (estilo mapa topográfico minimalista) — faz sentido especificamente porque a câmara está a ver o mundo
  de cima, e é um toque abstrato que não compete com o resto.
- **Árvores/arbustos 3D dispersos**: estilizados e simples (mesma linguagem visual dos edifícios — ver §4,
  não fotorrealistas), espalhados com moderação para dar contexto de "mundo", nunca a preencher tudo.
- **Mais flores pequenas a florescer** ao longo do caminho (já existe na v6 como SVG 2D; nesta versão
  tornam-se elementos 3D reais — ver §5), com o breve brilho no fim de cada animação de floração já
  pedido pelo Fernando.
- **Pedras/marcações de caminho** pontuais, discretas, só para reforçar a leitura de "trilho num mundo",
  não elementos de destaque.

Tudo num tom desaturado/suave (paleta próxima da já estabelecida — verdes do `--green` scale + o rosa/lilás
da flor), para que os focos reais (flor, edifícios, livro) continuem a dominar visualmente.

## 4 — Edifícios e livro

Construídos por mim, geometria própria (não descarregados) — precisão exata do buraco de passagem da raiz
e das mini-animações vale mais do que realismo fotográfico aqui. **Confirmado pelo Fernando**: estilo
próximo do vectrfl.com — linhas suaves, detalhe real (janelas, telhado com forma própria, molduras),
claramente legível como edifício. Explicitamente REJEITADO: blocos sólidos de primitivas cruas (caixa +
telhado triangular sem mais nada). Isto implica `ExtrudeGeometry` com bevel em vez de `BoxGeometry` nua,
janelas como recortes/insets com moldura própria (não texturas pintadas), telhado como forma extrudida
separada com a sua própria silhueta, e sombreado com contraste suficiente para ler o volume — não apenas
uma cor lisa por face.

Posição: nem os edifícios nem o livro ficam centrados no ecrã — ligeiramente acima do centro, deixando
espaço por baixo para os cartões de texto de cada modo aparecerem em animação simples, timed para
aparecerem um pouco ANTES da raiz chegar ao respetivo edifício/livro (não simultâneo).

### 4.1 Paragem 1 — Lar/Centro de dia

Edifício com uma abertura central por onde a raiz passa literalmente (a raiz atravessa o edifício de um
lado ao outro). Marcado com uma cruz vermelha. Quando a raiz está a atravessar, a cruz faz uma
mini-animação — proposta: um pequeno "salto" + brilho breve (mistura das duas ideias do Fernando,
mais percetível que só rodar).

Cartão: usa vocabulário de "lar"/"centro de dia" no título (herda o texto já existente da v6 — "Centro de
dia e lar").

### 4.2 Paragem 2 — Casa (familiar + pessoal)

Mesmo princípio de abertura central por onde a raiz passa. Mini-animação proposta: uma janela acende-se
com um brilho quente à medida que a raiz passa — simples de construir (um plano emissivo atrás de um
recorte de janela), e liga-se emocionalmente bem ao tema ("uma janela acesa = alguém em casa, alguém que
cuida"). Alternativas consideradas e preteridas: fumo de chaminé (mais complexo, partículas), porta a abrir
(redundante com a mecânica de passagem já usada no edifício 1).

Cartão: título deve usar a palavra "casa" explicitamente (pedido direto do Fernando).

### 4.3 Paragem 3 — Livro (estudante)

Diferente dos edifícios: a raiz não atravessa, apenas encosta. O livro está fechado até a raiz chegar perto
— nesse momento, abre-se (animação de páginas). Aqui termina a parte animada/3D da jornada.

Cartão: vocabulário de estudo/aprendizagem.

## 5 — Flores pequenas ao longo do caminho

Reutiliza a flor procedural já construída (com pétalas separadas e animáveis, ao contrário do modelo
descarregado) — a mesma flor da entrada, mas pequena, a florescer (não a desflorescer) sempre que a raiz
cresce até ao seu ponto. Ao terminar cada animação de floração (rápida mas elegível, ~0.6–0.8s), um breve
brilho momentâneo (pulso de `emissiveIntensity` ou um pequeno flash de luz pontual, fade rápido).

Se se encontrar um modelo Sketchfab já animado de floração (§2.3), pondera-se substituir também estas
flores pequenas pelo mesmo asset, tocado a pequena escala — mas a flor procedural já é uma alternativa
sólida e sob controlo total, não é um bloqueador.

## 6 — Estratégia de assets (resumo)

| Elemento | Origem | Porquê |
|---|---|---|
| Flor do herói | Modelo real descarregado (Sketchfab, Fernando descarrega) | É o único elemento observado de perto, em repouso, tempo suficiente para a falta de realismo doer |
| Raiz/caule | Procedural (já construído) | Precisa de crescer segmento a segmento com o scroll — só é possível com geometria que eu controlo |
| Flores pequenas no caminho | Procedural (já construído, com pétalas animáveis) | Precisa de floração pétala-a-pétala real; modelo descarregado não permite isso |
| Edifícios + livro | Procedural, construído por mim | Preciso de controlo exato do buraco de passagem e das mini-animações; Fernando só pediu "bem pensados", não fotorrealismo |
| Árvores/arbustos/pedras de fundo | Procedural, estilo simples/consistente com os edifícios | Contexto de mundo, nunca foco — não vale a pena gastar tempo a descarregar/testar licenças para elementos secundários |
| Partículas de pólen | Procedural (`drei` `Sparkles` ou sistema de pontos simples) | Trivial de construir, sem necessidade de asset |

## 7 — Motor de animação

Troca do `requestAnimationFrame` + interpolação linear manual (usado na v6) para **GSAP + ScrollTrigger**.
Justificação: a coreografia agora tem uma timeline de entrada (não ligada a scroll), uma timeline principal
com scroll-scrubbing (câmara, flor, raiz), e triggers discretos em pontos específicos (mini-animações dos
edifícios, abertura do livro) — exatamente o que o GSAP/ScrollTrigger foi desenhado para fazer bem, com
easing profissional em vez de `lerp` manual. Continua tudo a ser código que eu escrevo; o Fernando não
opera nenhuma ferramenta.

## 8 — Performance e alternativa reduzida

Este é um cenário WebGL muito mais rico e mais alto (spans do herói até ao livro, não só 100vh) do que a
v6. Precisa de um orçamento de qualidade deliberado desde o início, não como reboco no fim:

- Contagem de polígonos controlada nos elementos procedurais (edifícios/árvores simples, poucos segmentos).
- Partículas e pequenas flores com contagem baixa e culling fora do viewport.
- `dpr` limitado (já assim na v6, `[1, 1.75]`).
- Fallback estático continua a existir para `prefers-reduced-motion` e falha de WebGL — mas desenhado como
  parte do plano principal (uma versão simplificada mas ainda bonita: ex. flor estática + raiz SVG como já
  existe na v6, sem a jornada de edifícios, e os 4 modos apresentados como cartões normais), não uma cópia
  low-effort de recurso.
- Mobile: a avaliar durante a construção se a jornada completa é viável em telemóveis de gama média, ou se
  a versão mobile usa uma câmara mais simples/estática com os mesmos elementos.

## 9 — Fora de âmbito deste documento

- A reconstrução da secção "abaixo do livro" (Como funciona, Manifesto, etc.) — fica como conteúdo plano,
  redesenhado, mas sem 3D. Âmbito próprio, tratado depois desta jornada estar fechada.
- A assinatura do rodapé (mini-animação das letras "Phlox Clinical" a aparecer ao chegar ao fim) — pequena,
  reaproveita a técnica de texto já construída no herói, implementa-se no fim, não precisa de desenho à
  parte.

## 10 — Fases de construção propostas

Dado o tamanho, construir e rever visualmente por fases, não tudo de uma vez às cegas (lição já aprendida
nesta mesma sessão — problemas como o halo branco da vinheta só apareceram e foram apanhados ao rever
screenshots a cada passo):

1. Motor GSAP + timeline de entrada da flor + partículas de pólen.
2. Nascimento/recolha do texto (2.2 + 2.3, sem ainda a raiz).
3. Momento de "desflorescer" + movimento de câmara + início do crescimento da raiz.
4. Mundo de fundo (chão, árvores, flores pequenas, animação da ponta).
5. Edifício 1 (lar) com passagem + mini-animação.
6. Edifício 2 (casa) + livro.
7. Rodapé + polimento geral + verificação mobile/reduced-motion.

Cada fase termina com screenshots reais (scroll incremental, não saltos) antes de avançar para a seguinte.

## Notas em aberto / hipóteses assumidas

- Assumido: a transição de câmara descrita em §1.2 é a leitura certa de "a flor... deve passar para a vista
  de lado" — se o Fernando queria antes o ângulo de diorama desde o primeiro frame, a arquitetura muda
  (câmara nunca "de frente", começa logo inclinada) e isto precisa de revisão antes de construir.
- Assumido: "traços" no pedido do Fernando refere-se a marcas abstratas de chão/textura (interpretado como
  as curvas de nível topográficas em §3.3) — se significava outra coisa (ex. linhas de movimento, trilhos
  desenhados), esclarecer.
- Assumido: a mini-animação da casa (janela a acender) é aceitável — o Fernando disse explicitamente que
  ainda não tinha pensado nisto e pediu ajuda, por isso isto é uma proposta a validar, não um facto.
