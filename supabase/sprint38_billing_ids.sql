-- sprint38_billing_ids.sql
-- Guarda os IDs de Stripe no perfil para permitir cancelar a subscrição no site
-- (sem ter de enviar email). Preenchidos pelo webhook do Stripe.

alter table profiles add column if not exists stripe_customer_id     text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists plan_status            text;   -- active | canceling | canceled
alter table profiles add column if not exists plan_renews_at         timestamptz;
