# Proposta de limpeza do catálogo — Phlox

Objetivo do Fernando: **10-15 ferramentas por modo**, títulos claros, site fácil de navegar.
Legenda: **MANTER** · **JUNTAR** (funde com outra) · **CORTAR** (arquivar, fica no repo) · **RENOMEAR**.
Diz-me só onde discordas — o resto executo.

---

## 🩺 CLÍNICO — 30 → alvo ~14 (o mais inchado)

**Núcleo do dia (MANTER, 7):**
1. `/patients` — Utentes
2. `/mar` — Medicação a dar
3. `/care-log` — Registo do dia
4. `/ronda-guiada` — Ronda coordenada *(nova, substitui o /turno antigo)*
5. `/radar` — O que merece atenção
6. `/family` — Famílias
7. `/equipa-mural` — Mural da equipa *(novo)*

**Gestão (MANTER, 4):**
8. `/painel-dono` — Gerir instituição (hub: equipa, stock, faturação)
9. `/stock` — Stock & consumíveis *(novo fluxo 1-toque)*
10. `/faturacao` — Faturação
11. `/documentos` — Documentos

**Clínico de apoio (MANTER, 3):**
12. `/assessments` — Avaliações (Braden, MNA…)
13. `/incidents` — Ocorrências
14. `/calculos` — Calculadoras

**Propostas de CORTE/JUNÇÃO (16):**
- `/cockpit` → **CORTAR** (é redirect para /painel, duplicado)
- `/turno` → **CORTAR** (substituído pela nova /ronda-guiada; o Fernando disse que "não tinha nada")
- `/rounds` (ronda farmacêutica) → **CORTAR** do lar/Cd (é de farmácia, arquivada)
- `/reconciliacao` → **CORTAR** (o Fernando já disse: inútil no lar/Cd)
- `/balcao`, `/prescription-queue` → **CORTAR** (farmácia, arquivada)
- `/med-review` → **JUNTAR** em /assessments (ou cortar — decides)
- `/oracle` → **JUNTAR** no Copilot (✦) — é "consulta IA", que o Copilot já faz
- `/carta` (carta de alta) → **CORTAR** do lar/Cd (é hospitalar) OU manter só em clínica se voltares a ligar clínica
- `/food-drug` → **JUNTAR** em /interactions (é o mesmo tema: o que não misturar)
- `/schedule` + `/team` → **JUNTAR** num só "Equipa & escalas" (têm sobreposição)
- `/agenda` → **MANTER** só se fizeres marcações; senão CORTAR no lar/Cd
- `/quality` → **MANTER** ou mover para dentro do /painel-dono (decides)
- `/connect` → **CORTAR** do menu (fica acessível nas Definições)
- `/vigia` → **MANTER** (só lar; é forte) — não conta para o alvo do Cd
- `/migrar` → já está fora do menu (só no onboarding) ✓

---

## 🎓 ESTUDANTE — 13 → alvo ~10 (quase lá; o problema são os "hubs")

**MANTER (as ferramentas REAIS, 7):**
1. `/study` — Estudar (flashcards + quiz) *(agora com tema à escolha)*
2. `/arena` — Competir na Arena
3. `/tutor` — AI Tutor *(tema à escolha)*
4. `/osce` — Treinar OSCE *(agora funciona em todos os cursos + tema à escolha)*
5. `/simulador` (ou `/decisao`) — Caso clínico evolutivo *(tema à escolha)*
6. `/interactions` — Interações
7. `/medicamento` — O que é este medicamento

**Propostas:**
- `/aprender` → **CORTAR** (é um "hub de todas as ferramentas de estudo" = duplica o /tudo e o /inicio)
- `/estagio` → **CORTAR** ou **JUNTAR** (hub de estágios — pouco usado; decides)
- `/modo-exame` → **JUNTAR** dentro de /study (é "plano por exame")
- `/study360` → **CORTAR** (é meta-hub thin; o "onde focar" pode ir para o /inicio do estudante)
- `/anatomia-3d` → **MANTER** (é único e giro — Sketchfab)
- `/ai` → **MANTER** (dúvidas rápidas)

→ Fica: study, arena, tutor, osce, simulador, interactions, medicamento, anatomia-3d, ai = **9** ✓

---

## 🏠 PESSOAL — 17 → alvo ~12

**MANTER (9):**
1. `/mymeds` — Os meus comprimidos
2. `/scan` — Tirar foto a receita/caixa
3. `/interactions` — Os medicamentos dão-se bem?
4. `/medicamento` — O que é este medicamento
5. `/saude-agora` — Não me sinto bem
6. `/sintomas` — Como me sinto hoje
7. `/vitals` — Tensão, peso e açúcar
8. `/timeline` — A minha história de saúde
9. `/ai` — Tirar uma dúvida

**Propostas:**
- `/saude360` → **CORTAR** (junta medicação+análises+vitais que já estão em /timeline e /mymeds — redundante)
- `/medico-bolso` ("O que merece atenção") → **JUNTAR** no /inicio pessoal (é um alerta, não uma ferramenta)
- `/relatorio` (resumo semanal) → **JUNTAR** no /inicio ou CORTAR
- `/food-drug` → **JUNTAR** em /interactions
- `/preventivo` → **MANTER** (rastreios/vacinas — útil e distinto)
- `/labs` → **MANTER** (perceber análises)
- `/vault` → **JUNTAR** com /timeline (documentos fazem parte da história) OU manter
- `/health-pass` → **MANTER** (QR para o médico — distinto)

→ Fica ~12.

---

## 🫂 CUIDADOR — 18 → alvo ~13
Igual ao pessoal + `/familia` (**MANTER**, é o centro) + `/familia360` (**CORTAR** ou **JUNTAR** em /familia — é a mesma coisa com outro nome).

---

## 🏡 /inicio — refazer
- Um ecrã "O que precisa hoje?" por modo, com 3-4 ações grandes (não uma lista de 17).
- Puxar para lá os "alertas" que hoje são ferramentas (/medico-bolso, "onde focar").
- Menos escolhas, mais orientação. Objetivo: ninguém pergunta "e agora?".
