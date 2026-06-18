# Guia simples — o que são as integrações e como testá-las

Escrito em português simples, sem termos técnicos. Lê com calma; no fim sabes
explicar isto a um cliente sem pareceres amador.

---

> Nota: a integração FHIR (ligação a laboratórios/hospitais) foi **removida** nesta
> fase — não trazia utilidade real para já. Pode voltar quando houver um cliente
> concreto a pedi-la. Este guia foca-se no que importa agora: **notificações** e
> **faturação**.

## Primeiro: o que é cada coisa (em palavras simples)

**Notificações de toma** — o telemóvel/computador avisa o utilizador à hora de
tomar o medicamento. É um lembrete, como o despertador.

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

4. **Ativar o "relógio" que verifica as tomas** (ver secção abaixo — IMPORTANTE no
   plano grátis da Vercel).

5. Testar: no telemóvel, instala o site como app (no Safari/Chrome: "Adicionar ao
   ecrã principal"). Abre, vai aos lembretes, mete uma hora **2 minutos no futuro**,
   fecha a app, espera. Deve tocar.

> Se ao "Ativar lembretes" aparecer uma caixa amarela a dizer "ainda não estão
> ativadas no servidor", é porque ainda faltam as chaves do passo 2.

### O "relógio" das tomas (cron) — no plano grátis da Vercel

⚠️ **O plano grátis (Hobby) da Vercel só deixa os crons correr 1× por dia.** Por
isso é que o deploy dava erro quando tinha um cron de 15 em 15 minutos — removi-o.

Para os lembretes tocarem à hora certa, precisas de um **"relógio" externo
gratuito** que bate no Phlox a cada 10–15 min. O endpoint já existe e está
protegido pela tua `CRON_SECRET`. Opções **100% gratuitas** (escolhe UMA):

**Opção A — cron-job.org (recomendada, a mais simples):**
1. Cria conta grátis em https://cron-job.org
2. "Create cronjob" → URL: `https://phloxclinical.com/api/push/cron?secret=O_TEU_CRON_SECRET`
3. Schedule: "Every 15 minutes". Guarda. Pronto — toca para sempre, de graça.

**Opção B — GitHub Actions (se já tens o código no GitHub):**
Cria `.github/workflows/push-cron.yml`:
```yaml
name: Phlox push reminders
on:
  schedule: [{ cron: '*/15 * * * *' }]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -s "https://phloxclinical.com/api/push/cron?secret=${{ secrets.CRON_SECRET }}"
```
(Põe a `CRON_SECRET` em Settings → Secrets do repositório. Nota: o GitHub às vezes
atrasa alguns minutos — para lembretes de medicação é aceitável.)

**Opção C — UptimeRobot (monitor que também serve de relógio):**
Cria um monitor HTTP gratuito que visita o URL do cron a cada 5 min. Simples, mas
foi pensado para vigiar sites, não para crons — funciona à mesma.

> **Mais barato ainda (sem agendador nenhum):** os lembretes já funcionam **com a
> app aberta** (há um "relógio" dentro da própria app). O agendador externo é só
> para tocar com a app FECHADA. Se quiseres começar sem complicações, podes deixar
> isto para depois e os lembretes funcionam na mesma quando o utilizador tem a app
> aberta.

---

## 2. Faturação

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

## 3. Diagnóstico — "está tudo a funcionar?"

Criei um endereço que te diz, numa lista, **que funcionalidades estão prontas e
quais precisam de uma migração SQL**. É a forma mais rápida de saber se algo está
"partido" ou se só falta correr um ficheiro.

Abre (com o teu CRON_SECRET):
```
https://phloxclinical.com/api/health-check?secret=O_TEU_CRON_SECRET
```
Mostra:
- Se as chaves VAPID estão configuradas (notificações).
- A lista de funcionalidades e, para cada uma, se a base de dados está pronta.
- As que **faltam** (com o nome da migração a correr no Supabase).

> Se uma ferramenta mostra "temporariamente indisponível", quase de certeza é uma
> tabela em falta — este diagnóstico diz-te qual. Corre o `supabase/sprint*.sql`
> correspondente e desaparece.

---

## Resumo do que SÓ TU podes fazer
1. **Notificações**: gerar as chaves VAPID + pôr na Vercel + Redeploy (Secção 1).
2. **Migrações de base de dados**: correr no Supabase os ficheiros `supabase/sprint*.sql`
   novos (sprint88, sprint89) — senão algumas funcionalidades novas ficam "mortas".
3. **Deploy**: eu escrevo o código, mas o site só muda quando fazes deploy na Vercel.
   (Por isso é que o input de hora exata "não aparecia" — ainda não estava no site.)

Quando fizeres o passo 1, diz-me e testamos juntos.
