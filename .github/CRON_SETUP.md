# Phlox — os crons

O plano Hobby da Vercel aceita **2 cron jobs, e só uma vez por dia cada um**. O
Phlox precisa de seis, um deles de 15 em 15 minutos. Por isso o `vercel.json`
não tem secção `crons` nenhuma: **o agendador é o GitHub Actions**.

As horas são as mesmas que estavam na Vercel — os dois correm em UTC, portanto
as mesmas expressões dão os mesmos momentos do dia.

## O que corre, e quando

| Quando (UTC) | Rota | O que faz | Ficheiro |
|---|---|---|---|
| `0,15,30,45 * * * *` | `/api/push/cron` | Lembretes de medicação e avisos do MAR por notificação | `push-cron.yml` |
| `0 5 * * *` | `/api/vigilancia/cron` | Vigilância noturna: recalcula o risco de cada pessoa | `crons.yml` |
| `0 6 * * 1` | `/api/cron/ingest-shortages` | Ruturas de medicamentos do INFARMED (semanal) | `crons.yml` |
| `0 7 * * 1` | `/api/cron/ingest-recalls` | Recolhas e alertas de qualidade do INFARMED (semanal) | `crons.yml` |
| `30 7 * * *` | `/api/cron/diario` | O correio da manhã: o que merece atenção, famílias à espera, stock em baixo | `crons.yml` |
| `0 8 * * 1-5` | `/api/cron/caso-do-dia` | Caso clínico do dia por email, dias úteis | `crons.yml` |

Em hora de Portugal soma-se uma hora no verão (UTC+1) e nada no inverno: o
resumo diário das 07:30 UTC chega às 08:30 no verão e às 07:30 no inverno.

## Os dois segredos

**GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Segredo | Valor | Obrigatório |
|---|---|---|
| `CRON_SECRET` | Exatamente o mesmo valor que está na Vercel (Settings → Environment Variables → `CRON_SECRET`). Sem espaços nem quebras de linha. | Sim |
| `APP_URL` | `https://phloxclinical.com` | Não — sem ele usa esse endereço na mesma |

Se o valor não coincidir com o da Vercel, todas as rotas respondem **401** e o
workflow diz-te isso mesmo no registo, em português.

## Testar sem esperar pela hora

**GitHub → Actions → "Crons do Phlox" → Run workflow.** O menu deixa escolher
uma tarefa (`diario`, `caso-do-dia`, `vigilancia`, `ruturas`, `recolhas`) ou
`todos`. O registo mostra o estado HTTP e a resposta de cada rota.

O `push-cron.yml` tem o mesmo botão, sem menu.

Pela linha de comandos dá no mesmo:

```bash
curl -i -H "x-cron-secret: $CRON_SECRET" https://phloxclinical.com/api/cron/diario
```

Todas as seis rotas aceitam `x-cron-secret` ou `Authorization: Bearer`. Nunca
passar o segredo na query string — os URLs ficam em registos de servidor,
proxies e histórico do browser.

## O que verificar quando algo não corre

- **401** — o `CRON_SECRET` do GitHub não é igual ao da Vercel.
- **404** — o deploy não passou, ou o `APP_URL` está errado.
- **503** — falta a `SUPABASE_SERVICE_ROLE_KEY` nas variáveis da Vercel.
- **Nada corre há dias** — o GitHub desliga workflows agendados em repositórios
  sem atividade durante 60 dias (avisa por email antes). Um commit qualquer
  reativa-os. E os agendamentos só correm a partir do ramo principal.
- **Correu tarde** — normal. O GitHub atrasa agendamentos quando está com carga.
  Nenhuma destas tarefas depende do minuto exato.

---

## Alternativas, se um dia não se quiser depender do GitHub

### Supabase pg_cron

1. Supabase → Database → Extensions → ativar **pg_cron** e **pg_net**
2. No SQL Editor, por cada tarefa:

```sql
select cron.schedule(
  'phlox-diario',
  '30 7 * * *',
  $$
    select net.http_get(
      url := 'https://phloxclinical.com/api/cron/diario',
      headers := '{"x-cron-secret": "O_TEU_CRON_SECRET"}'::jsonb
    )
  $$
);
```

Ver com `select * from cron.job;`, remover com `select cron.unschedule('phlox-diario');`.

### cron-job.org

Conta gratuita, até 50 tarefas com intervalos de 5 minutos. Método GET, cabeçalho
`x-cron-secret`.

---

## Rede de segurança do lado do browser

Com a app aberta em `/mymeds` e as notificações ativas, o `lib/clientReminder.ts`
verifica de 5 em 5 minutos se há lembretes pendentes e dispara-os do próprio
browser. É um complemento, não o mecanismo principal: as notificações a sério
saem do `/api/push/cron`, e essas chegam com o browser fechado.
