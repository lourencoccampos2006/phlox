# Guia de negócio — Phlox Clinical (Portugal, antes da primeira receita)

> Guia prático para o Fernando, na situação real: **em Portugal, ainda sem empresa e
> antes de faturar**. O objetivo é dizer o **próximo passo certo** — não tudo de uma
> vez, nem coisas que ainda não fazem sentido.
>
> **Isto não é aconselhamento jurídico nem fiscal.** É um mapa para te orientares e
> saberes que perguntas fazer. Antes de qualquer passo formal (abrir atividade, criar
> empresa, contratos), confirma com um **contabilista certificado** e, para os
> contratos/RGPD, com um **jurista/advogado**. Vale o custo — é barato comparado com um
> erro.

---

## 1. O essencial: o que precisas ANTES de cobrar o primeiro euro

Em Portugal, para receber dinheiro de forma legal por um serviço, precisas de **emitir
uma fatura ou fatura-recibo**. Para isso, há um caminho simples que **não exige criar
empresa**:

1. **Abrir atividade nas Finanças** como trabalhador independente (categoria B do IRS).
   Faz-se no Portal das Finanças, é gratuito, e podes fechar a atividade depois se não
   avançares. Escolhes o código de atividade (CAE/CIRS) adequado a serviços de
   informática / consultoria.
2. **Isenção de IVA (art. 53.º do CIVA):** enquanto o teu volume de negócios anual
   estiver **abaixo do limiar legal** (que sobe quase todos os anos — confirma o valor
   atual com o contabilista), ficas **isento de IVA**. Não cobras IVA, não entregas IVA.
   Simplifica muito o início.
3. **Emitir faturas-recibo** ("recibos verdes") diretamente no Portal das Finanças, ou
   com software de faturação (ver secção 3).

**Conclusão:** podes começar a cobrar **legalmente, sem empresa**, abrindo atividade como
independente. É o passo certo para a tua fase.

> Antes de abrires atividade: pergunta ao contabilista sobre a **isenção do 1.º ano de
> Segurança Social** e sobre as obrigações declarativas, para não seres apanhado de
> surpresa.

---

## 2. Quando (e qual) empresa criar

Não cries empresa "para parecer profissional". Cria empresa quando houver um **gatilho
real**. Os gatilhos típicos:

- **Responsabilidade / risco.** Vais lidar com **dados de saúde de instituições**. Uma
  sociedade (com responsabilidade limitada) separa o teu património pessoal do da empresa.
  Este é, no teu caso, provavelmente **o argumento mais forte**.
- **Volume.** Quando a faturação cresce e ultrapassa o limiar de isenção de IVA, ou quando
  vais ter custos e contratos significativos, a empresa começa a fazer mais sentido fiscal.
- **Credibilidade contratual.** Algumas instituições preferem (ou exigem) contratar uma
  **sociedade com NIF de empresa**, não uma pessoa singular.
- **Sócios / investimento.** Se entrar outra pessoa ou capital, precisas de uma estrutura.

**Qual?** Para um fundador a solo, em Portugal, a escolha habitual é a **Sociedade
Unipessoal por Quotas (Unipessoal, Lda.)**:
- Responsabilidade **limitada** ao capital social (podes começar com capital simbólico).
- Constituição rápida (Empresa na Hora ou online).
- Custos: constituição + **contabilista certificado obrigatório** (mensalidade) + IUC/IES
  e obrigações anuais.

Alternativa mais leve: **Empresário em Nome Individual (ENI)** — mais simples, mas **sem**
separação de patrimónios (responsabilidade ilimitada), o que é arriscado dado o setor.

> **Regra prática para ti:** mantém-te como **independente com atividade aberta** até teres
> o **primeiro cliente institucional recorrente a pagar** (ou faturação a aproximar-se do
> limiar de IVA). Aí, cria a **Unipessoal, Lda.** — sobretudo pela proteção de
> responsabilidade.

---

## 3. Como passar faturas (legalmente)

- **Software de faturação certificado pela AT.** Acima de um certo volume de faturação, a
  lei obriga a usar um **programa de faturação certificado** pela Autoridade Tributária.
  Abaixo desse limiar, podes emitir faturas-recibo no Portal das Finanças. Há várias opções
  certificadas (algumas gratuitas até um número de faturas). **Confirma com o contabilista
  qual usar.** Não inventes faturas em Word/PDF — não são válidas.
- **Para o próprio Phlox:** o produto já tem um módulo de faturação para as **instituições
  faturarem os seus utentes/clientes**. Esse módulo serve os teus clientes; é diferente da
  **tua** faturação a eles. A tua faturação aos clientes (subscrições) é feita pela Stripe
  + a tua faturação certificada.
- **O que uma instituição precisa para te pagar:** o teu **NIF**, uma **fatura** com os
  dados corretos, e muitas vezes um **contrato de prestação de serviços** e um **DPA**
  (contrato de tratamento de dados, ver secção 4). Tem isto pronto antes da reunião.

---

## 4. Como ser credível perante instituições

Instituições compram a quem parece sério e seguro. A credibilidade constrói-se com coisas
concretas, não com promessas:

1. **Presença legal clara.** NIF e identificação da entidade visíveis nas políticas
   (privacidade, termos). Enquanto pré-empresa, assume isto com honestidade e completa
   assim que a sociedade existir.
2. **RGPD a sério e visível.** Política de privacidade exata, **lista de subprocessadores**
   pública (já existe em /subprocessadores), e um **DPA (Art. 28.º)** pronto a assinar (o
   Phlox já tem um gerador em /trust/dpa). Uma instituição que trata dados de saúde **vai
   perguntar isto** — e teres a resposta pronta vale ouro.
3. **Contrato de prestação de serviços** simples e claro (objeto, preço, duração,
   confidencialidade, RGPD anexo). Pede a um jurista um modelo reutilizável.
4. **Segurança demonstrável.** Encriptação em trânsito e repouso, controlo de acessos
   (RLS), backups. Tens isto — di-lo de forma simples na conversa e na página de segurança.
5. **Enquadramento honesto de dispositivo médico.** Assume claramente que o Phlox **não é
   um dispositivo médico** (organiza e apoia; o profissional decide). Está em
   /dispositivo-medico. Honestidade aqui aumenta a confiança, não a reduz.
6. **Suporte e fiabilidade.** Um email de suporte que responde, e um SLA simples ("resposta
   em X horas úteis"). As instituições temem ficar sozinhas — mostra que não ficam.
7. **Prova de valor.** Usa o "cofre de valor" e o dossier de conformidade do próprio Phlox
   para mostrar, com os dados deles, o que a plataforma organiza. (Ver PITCH_INSTITUICOES.md.)

---

## 5. Impostos e contabilidade — o mínimo que tens de saber

- **IRS categoria B** (rendimentos de trabalho independente). Há o **regime simplificado**
  (tributa-se uma percentagem do rendimento, sem contabilidade organizada) — adequado a
  quem começa.
- **Retenção na fonte:** ao faturar a empresas/instituições, pode haver retenção de IRS na
  fonte (uma percentagem que o cliente retém e entrega ao Estado por ti). O contabilista
  explica quando se aplica e como declarar.
- **Segurança Social do independente:** há contribuições trimestrais com base no rendimento
  relevante, normalmente com **isenção no primeiro ano** de atividade. Não te esqueças
  disto no planeamento de tesouraria.
- **Contabilista certificado:** **opcional** enquanto independente no regime simplificado;
  **obrigatório** quando crias a sociedade. Mesmo antes, vale a pena uma ou duas consultas.
- **Guarda tudo:** faturas emitidas e recebidas, comprovativos. A organização poupa-te
  problemas e dinheiro no IRS.

---

## 6. Listas de verificação

### Antes da primeira fatura (independente)
- [ ] Atividade aberta nas Finanças (categoria B, CAE/CIRS adequado).
- [ ] Confirmado com contabilista: isenção de IVA (art. 53.º) e isenção de Segurança Social no 1.º ano.
- [ ] Meio de emitir faturas-recibo (Portal das Finanças ou software certificado).
- [ ] NIF pronto a dar ao cliente.
- [ ] Política de privacidade, termos, subprocessadores e DPA prontos (já no produto).
- [ ] Modelo simples de contrato de prestação de serviços.

### Antes de criar a empresa (Unipessoal, Lda.)
- [ ] Há um cliente institucional recorrente a pagar, OU a faturação aproxima-se do limiar de IVA, OU queres proteção de responsabilidade.
- [ ] Contabilista certificado escolhido (vai ser obrigatório).
- [ ] Nome da empresa + CAE + capital social decididos.
- [ ] Conta bancária da empresa.
- [ ] Atualizar as políticas/termos com a entidade legal e o NIF reais.
- [ ] Software de faturação certificado configurado.

---

## 7. Resumo numa frase

**Agora:** abre atividade como independente (isento de IVA), tem as políticas e o DPA
prontos, e começa a faturar legalmente. **Quando tiveres o primeiro cliente institucional
recorrente:** cria uma Unipessoal, Lda. (sobretudo pela proteção de responsabilidade) e
atualiza a parte legal com os dados reais. Em todos os passos formais, confirma com
contabilista e jurista — é barato e evita problemas caros.
