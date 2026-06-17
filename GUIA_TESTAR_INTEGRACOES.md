# Guia prático — testar integrações (push, FHIR, faturação)

Tudo o que precisas para confirmar que as integrações funcionam, passo a passo.
Não precisas de saber programar — só seguir.

---

## 1. Notificações push reais (lembretes de toma)

O código está todo feito (`/api/push/*`, `public/sw.js`, `lib/webPush.ts`). Falta **3 variáveis de ambiente** e **um agendador**. Sem isto, os horários guardam-se mas o telemóvel não toca com a app fechada.

### Passo 1 — gerar as chaves VAPID (uma vez)
No terminal, na pasta do projeto:
```bash
npx web-push generate-vapid-keys
```
Vais receber duas chaves: **Public Key** e **Private Key**.

### Passo 2 — pôr as variáveis no ambiente
No painel da Vercel (Project → Settings → Environment Variables), adiciona:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | a Public Key gerada |
| `VAPID_PUBLIC_KEY` | a mesma Public Key |
| `VAPID_PRIVATE_KEY` | a Private Key gerada |
| `VAPID_EMAIL` | `mailto:o-teu-email@dominio.pt` |
| `CRON_SECRET` | uma palavra-passe aleatória qualquer (ex: gerada com `openssl rand -hex 16`) |

Depois faz **Redeploy** (as env vars só entram num novo deploy).

> ⚠️ A `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tem de existir nos dois sítios (com e sem `NEXT_PUBLIC_`) — uma é lida no browser, a outra no servidor.

### Passo 3 — agendar o cron (JÁ FEITO ✅)
Já adicionei `/api/push/cron` ao `vercel.json` (a cada 15 min). A Vercel passa a
chamá-lo sozinha com o `CRON_SECRET` no header — só precisas de ter o `CRON_SECRET`
nas env vars (Passo 2) e fazer Redeploy. (Se não usas Vercel Cron, qualquer
agendador externo serve — chama `https://oteusite/api/push/cron?secret=O_TEU_CRON_SECRET`.)

### Passo 4 — testar
1. No telemóvel, abre o site **instalado como app** (Adicionar ao ecrã principal) — o iOS só permite push em apps instaladas.
2. Vai a **Os meus medicamentos → Ativar lembretes**, aceita a permissão, define uma hora **2–3 min no futuro**.
3. Fecha a app. Quando o cron correr (≤15 min) e a hora bater, recebes a notificação.
4. **Teste manual imediato** (sem esperar pelo cron): no browser, abre
   `https://oteusite/api/push/cron?secret=O_TEU_CRON_SECRET`
   — devolve `{ sent: N }`. Se `sent ≥ 1`, o push saiu.

### Como saber se está a funcionar (sinais)
- Ao "Ativar lembretes", **não** aparece a mensagem amarela "ainda não estão ativadas no servidor" → as chaves estão bem.
- `/api/push/cron?secret=...` devolve `sent` > 0 quando há tomas devidas.
- Em Supabase, a tabela `push_subscriptions` tem uma linha para o teu utilizador.

---

## 2. Integração FHIR (laboratórios, SPMS, SClínico)

O Phlox **é** um servidor FHIR R4. Outros sistemas falam com ele. Endpoint base: `https://oteusite/api/fhir`.

### Testar em 2 minutos (sem ferramentas)
1. Abre no browser: `https://oteusite/api/fhir/metadata`
   → deve devolver um JSON `CapabilityStatement` (a "ficha técnica" do servidor). Se aparece, o servidor FHIR está vivo.

### Testar a sério (com autenticação)
Precisas de uma **API key** com scope `fhir:read`/`fhir:write` (cria em Definições → as chaves de API) OU do teu token de sessão.

**Procurar um doente por nº SNS** (substitui `CHAVE` e `123456789`):
```bash
curl -H "Authorization: Bearer CHAVE" \
  "https://oteusite/api/fhir/Patient?identifier=123456789"
```
→ devolve um `Bundle` FHIR com o doente (ou vazio). Confirma que **só vês os teus doentes** (a proteção anti-IDOR está ativa).

**Simular um laboratório a enviar resultados** (webhook):
1. Em Definições → Integrações → "Receção de laboratórios", cria uma integração — recebes um **URL de webhook** único.
2. Esse URL aceita um `Bundle` FHIR com `Observation`. Para testar, envia um Bundle de exemplo:
```bash
curl -X POST "URL_DO_WEBHOOK" \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType":"Bundle","type":"collection","entry":[{"resource":{"resourceType":"Observation","status":"final","code":{"text":"Glicemia"},"valueQuantity":{"value":108,"unit":"mg/dL"},"subject":{"identifier":{"value":"123456789"}}}}]}'
```
→ o resultado deve aparecer associado ao doente com aquele SNS.

### O que dizer a um laboratório/parceiro real
"O nosso sistema expõe FHIR R4. CapabilityStatement em `/api/fhir/metadata`. Autenticação por API key (scope `fhir:read`/`fhir:write`) ou OAuth Bearer. Resources: Patient, Encounter, Observation, MedicationRequest, AllergyIntolerance, Immunization. Para nos enviarem resultados, usem o webhook que geramos por laboratório."

---

## 3. Integração com programas de faturação

Hoje o Phlox **emite e exporta** faturação (não está ligado em tempo real ao Sage/PHC/etc.; exporta nos formatos que eles importam).

### Testar a emissão
1. Numa farmácia/clínica, vai a **Vendas** ou **Faturação**, regista uma venda/ato.
2. Confirma que gera **fatura-recibo** e que o total/IVA estão certos.
3. Em Definições → exportações fiscais (ou `/api/fiscal/finalize`), gera a **exportação fiscal** (SAF-T / CSV) — é o ficheiro que entregas ao contabilista ou importas no programa de faturação.

### Como verificar que serve o programa de faturação do cliente
- Pergunta ao cliente que programa usa (Sage, PHC, Moloni, Vendus, Sifarma…) e que **formato de importação** aceita (quase todos aceitam **SAF-T PT** ou CSV).
- Gera a exportação no Phlox e tenta importá-la nesse programa. Se importar sem erros, está ligado.

> Se um cliente exigir **sincronização automática** (não exportação manual), isso é um conector dedicado por programa — diz-me qual e construo o conector específico.

---

## Resumo do que SÓ TU podes fazer (config/deploy)
1. `npx web-push generate-vapid-keys` → pôr as 5 env vars na Vercel → Redeploy.
2. Adicionar o cron ao `vercel.json` → Redeploy.
3. Testar com o telemóvel instalado como app.
4. (FHIR/faturação) testar com os comandos acima ou com um parceiro real.

Quando tiveres feito o passo 1–2, diz-me e confirmo contigo que o push está a sair.
