# A peça animada

`phlox-demo.html` é a fonte. `exportar.mjs` transforma-a num ficheiro de vídeo.

## Ver

Abrir `phlox-demo.html` no browser.

| Tecla | O que faz |
|---|---|
| Espaço | reproduzir e pausar |
| `R` | modo de gravação (esconde os comandos) |
| clicar na barra | saltar para qualquer instante |

## Exportar

```bash
node scripts/video/exportar.mjs                    # 30 fps
node scripts/video/exportar.mjs --fps 60           # mais fluido, ficheiro maior
node scripts/video/exportar.mjs --saida C:/x.mp4
```

Precisa do ffmpeg (`winget install Gyan.FFmpeg`).

**Não é gravar o ecrã.** Percorre a linha de tempo instante a instante, manda o
browser desenhar cada fotograma exato, guarda-o, e o ffmpeg junta tudo. Uma
gravação de ecrã fica refém do que a máquina aguentar naquele momento — perde
fotogramas e o resultado muda de vez para vez. Aqui sai idêntico sempre.

## Editar

O conteúdo está todo em constantes no topo do `<script>`: `MEDICAMENTOS`,
`MENSAGENS`, `CAPACIDADES`. Os tempos estão em `CENAS`, em milissegundos.

**Nada de estatísticas inventadas.** Esta cena já teve números como "96% das
tomas registadas na hora certa" e "12 min de papelada em vez de duas horas".
Soavam bem e não tinham medição nenhuma por trás. Um diretor de lar já ouviu
isso a cinco fornecedores, e basta perguntar de onde vem o número para o vídeo
inteiro perder credibilidade. Se um número entrar aqui, tem de haver de onde o
tirar.

## Duas regras técnicas que não parecem importantes e são

**Nada de `transition` nem `animation` do CSS.** Correm em tempo real, não em
tempo de linha. Ao exportar fotograma a fotograma, o mesmo instante daria
imagens diferentes conforme a velocidade da máquina. Todo o movimento é
calculado a partir do relógio, dentro de `desenhar(t)`.

**O palco é fixo em 1920×1080** e escalado para caber na janela. É isso que faz
a exportação sair sempre igual, em vez de depender do tamanho do browser.

## Se for para dar a um profissional

O guião, os tempos e o texto já estão decididos aqui — que é a parte que os
estúdios cobram cara e que costuma ficar mal feita. Levar este ficheiro e o
`.mp4` como referência de tempos.
