# Phlox — Cron Setup (sem Vercel Cron)

O Vercel Hobby não suporta crons frequentes (máximo: 1x/dia). Usamos GitHub Actions como agendador.

## GitHub Actions (já configurado)

O ficheiro `.github/workflows/push-cron.yml` chama `/api/push/cron` a cada 15 minutos.

### Secrets necessários no GitHub

Vai a **GitHub → phlox repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `CRON_SECRET` | O mesmo valor de `CRON_SECRET` no Vercel (ou gera um novo com `openssl rand -hex 32`) |
| `APP_URL` | `https://phlox-pi.vercel.app` (ou o teu domínio) |

Depois de adicionar os secrets, o workflow corre automaticamente a cada 15 minutos.

### Verificar se está a funcionar

GitHub → Actions → "Push Notifications Cron" → ver últimas execuções.

---

## Alternativa: Supabase pg_cron

Se não queres depender do GitHub Actions, usa o pg_cron do Supabase (grátis no tier Pro, disponível no free com extensão manual):

1. No Supabase → Database → Extensions → ativar **pg_cron** e **pg_net**
2. Corre no SQL Editor:

```sql
select cron.schedule(
  'phlox-push-cron',
  '*/15 * * * *',
  $$
    select net.http_get(
      url := 'https://phlox-pi.vercel.app/api/push/cron',
      headers := '{"x-cron-secret": "O_TEU_CRON_SECRET"}'::jsonb
    )
  $$
);
```

3. Para verificar: `select * from cron.job;`
4. Para remover: `select cron.unschedule('phlox-push-cron');`

---

## Alternativa: cron-job.org (serviço externo gratuito)

1. Vai a [cron-job.org](https://cron-job.org) e cria conta gratuita
2. Novo cron job:
   - URL: `https://phlox-pi.vercel.app/api/push/cron`
   - Método: GET
   - Header: `x-cron-secret: O_TEU_CRON_SECRET`
   - Schedule: cada 15 minutos
3. Grátis para até 50 cron jobs com intervalos de 5 minutos

---

## Fallback client-side

Quando o utilizador tem a app aberta em `/mymeds` e as notificações estão ativas, o `lib/clientReminder.ts` verifica a cada 5 minutos se há lembretes pendentes e dispara a notificação diretamente do browser — sem precisar de servidor.

Isto garante que lembretes funcionam mesmo que o cron falhe.
