# Guia simples — o que são as integrações e como testá-las

Escrito em português simples, sem termos técnicos. Lê com calma; no fim sabes
explicar isto a um cliente sem pareceres amador.

---

## Primeiro: o que é cada coisa (em palavras simples)

**Notificações de toma** — o telemóvel toca/avisa o utilizador à hora de tomar o
medicamento, mesmo com a app fechada. É um lembrete, como o despertador.

**FHIR** — é uma "língua comum" que os sistemas de saúde usam para falar uns com
os outros. Lê-se "faier". Quando um laboratório ou um hospital quer **enviar
análises** para o Phlox, ou **ir buscar** a ficha de um doente, fala nesta língua.
Não é algo que o utilizador normal veja — é uma porta nas traseiras para outros
programas se ligarem ao teu.

**Webhook do laboratório** — é uma "caixa de correio secreta" que crias para um
laboratório. Dás-lhe o endereço (URL) e, sempre que ele tem um resultado, deixa-o
nessa caixa. O Phlox apanha e mete na ficha do doente certo, sozinho.

**Faturação** — o Phlox emite faturas-recibo e exporta um ficheiro (SAF-T) que o
contabilista ou o programa de faturação do cliente sabe ler.

---

## 1. Notificações de toma — porque é que ainda não tocaram

Há DUAS coisas diferentes:
- **Escolher os horários** → já funciona, e agora podes pôr a **hora exata** que
  quiseres (não só horas predefinidas). Vais a *Os meus medicamentos → Ativar
  lembretes*, escolhes a hora no relógio e carregas em "+ Adicionar".
- **O telemóvel tocar com a app fechada** → isto precisa de uma configuração
  técnica que **só se ativa depois de tu fazeres uma coisa** (ver abaixo). Até lá,
  os horários ficam guardados mas o telemóvel não toca sozinho.

### O que tens de fazer para o telemóvel tocar (uma vez só)
1. No teu computador, na pasta do projeto, corre no terminal:
   ```
   npx web-push generate-vapid-keys
   ```
   Isto dá-te duas "chaves" (uns códigos compridos): uma  **pública** e uma **privada**.

2. Na Vercel (onde o site está alojado): **Settings → Environment Variables** e
   adiciona estas 5 linhas:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = a chave pública
   - `VAPID_PUBLIC_KEY` = a mesma chave pública
   - `VAPID_PRIVATE_KEY` = a chave privada
   - `VAPID_EMAIL` = `mailto:o-teu-email@phloxclinical.com`
   - `CRON_SECRET` = inventa uma palavra-passe qualquer (ex: `phlox-cron-2026-xyz`)

3. Faz **Redeploy** na Vercel (as chaves só passam a valer num novo deploy).

4. Testar: no telemóvel, instala o site como app (no Safari/Chrome: "Adicionar ao
   ecrã principal"). Abre, vai aos lembretes, mete uma hora **2 minutos no futuro**,
   fecha a app, espera. Deve tocar.

> Se ao "Ativar lembretes" aparecer uma caixa amarela a dizer "ainda não estão
> ativadas no servidor", é porque ainda faltam as chaves do passo 2.

**O cron (o "relógio" que verifica de 15 em 15 min) já está configurado** — não
precisas de fazer nada além das chaves.

---

## 2. FHIR — como testar e o que dizer

### Teste 1 (5 segundos): está vivo?
Abre no browser: `https://phloxclinical.com/api/fhir`
→ Agora mostra uma mensagem a explicar o que é e os links (antes dava erro 404 —
já corrigido). Se vês essa mensagem, o servidor está a funcionar.

`https://phloxclinical.com/api/fhir/metadata` mostra a "ficha técnica" (aquele
texto grande que viste). **Não precisas de perceber esse texto** — é para os
programas, não para ti. Só serve para o sistema do laboratório confirmar o que o
teu suporta. Pensa nele como o "menu" do restaurante escrito em código.

### Teste 2: "procurar um doente por nº SNS" — explicado devagar
Isto simula **outro sistema a pedir ao Phlox** "tens este doente?". Precisas de
uma chave de acesso (cria em *Definições → Chaves de API*).

Depois, no terminal do computador, escreves isto (substituindo as duas partes a
maiúsculas):
```
curl -H "Authorization: Bearer A_TUA_CHAVE" "https://phloxclinical.com/api/fhir/Patient?identifier=123456789"
```
- `curl` = um programa que faz pedidos a sites pela linha de comandos.
- `A_TUA_CHAVE` = a chave de API que criaste.
- `123456789` = o nº de SNS do doente que queres procurar.

→ Devolve a ficha do doente (ou vazio se não existir). **Na prática quem faz isto
é o sistema do hospital/laboratório, não tu** — tu só precisas de saber que é
possível e que é seguro (cada chave só vê os doentes da própria conta).

### O que dizer a um cliente/parceiro
> "O Phlox fala FHIR R4. Quem quiser ligar-se vê a ficha técnica em
> `/api/fhir/metadata`. Autenticação por chave de API. Para nos enviarem análises,
> damos uma caixa de correio (webhook) por laboratório."

Não precisas de saber mais do que isto para vender. Se um cliente técnico quiser
detalhes, dizes "ligamos a equipa técnica" — e dizes-me a mim.

---

## 3. Webhook do laboratório — porque dava "405"

O endereço que criaste (`.../api/lab/webhook/k3Ap6...`) é a **caixa de correio do
laboratório**. Ao abri-lo no browser, o browser tenta "ler" a caixa, mas a caixa
só aceita que lá **deixem** coisas — por isso dava o erro 405.

**Já corrigi**: agora, se abrires esse URL, mostra uma mensagem a explicar que é
uma caixa de correio para o laboratório usar (em vez do erro).

### Como se usa de verdade
1. Em *Definições → Integrações → Receção de laboratórios*, crias a integração e
   recebes o URL secreto.
2. **Entregas esse URL ao laboratório.** Eles configuram-no no sistema deles.
3. Quando o laboratório tem um resultado, envia-o para lá, e o Phlox mete-o na
   ficha do doente certo (identifica pelo nº SNS).

Não tens de fazer nada manualmente — é automático depois de entregares o URL.

---

## 4. Faturação

O Phlox **emite faturas-recibo** e **exporta um ficheiro SAF-T** (o formato oficial
português que todos os programas de faturação e os contabilistas sabem ler).

### Como testar
1. Em *Vendas* (farmácia) ou *Faturação* (clínica), regista uma venda/consulta.
2. Confirma que sai a fatura-recibo com o total e o IVA certos.
3. Gera a exportação fiscal (SAF-T). Esse ficheiro é o que entregas ao contabilista.

### O que dizer ao cliente
> "Emitimos faturas e exportamos SAF-T, que o seu contabilista ou programa de
> faturação importa diretamente."

Se um cliente quiser que o Phlox **fale automaticamente** com um programa específico
(Sage, PHC, Sifarma…), isso é um trabalho extra de ligação — diz-me qual e eu faço.

---

## Resumo do que SÓ TU podes fazer
1. **Notificações**: gerar as chaves VAPID + pôr na Vercel + Redeploy (Secção 1).
2. **Migrações de base de dados**: correr no Supabase os ficheiros `supabase/sprint*.sql`
   novos (sprint88, sprint89) — senão algumas funcionalidades novas ficam "mortas".
3. **Deploy**: eu escrevo o código, mas o site só muda quando fazes deploy na Vercel.
   (Por isso é que o input de hora exata "não aparecia" — ainda não estava no site.)

Quando fizeres o passo 1, diz-me e testamos juntos.
