-- sprint121_family_profile_editor_role.sql
-- APLICADA em produção via Supabase MCP em 2026-07-29 — este ficheiro fica no
-- repo só como registo (padrão dos sprints anteriores). Idempotente, pode
-- correr de novo sem efeito.
--
-- Gestão a dois (Pro): o convite de partilha de um perfil de família passa a
-- ter um papel — 'viewer' (o que já existia: só ver) ou 'editor' (novo: pode
-- adicionar/editar medicação e registar vitais/sintomas, tal como o dono).
--
-- Aditivo e reversível: NÃO mexe na RLS de family_profiles/family_profile_meds/
-- vitals/symptom_logs (continuam fechadas ao dono — auth.uid() = user_id, tal
-- como antes). O acesso de edição do papel 'editor' passa inteiramente por
-- rotas de API com service-role + verificação explícita por pedido (mesmo
-- padrão já usado em /api/family-share/view e /api/family-help), nunca por
-- abrir a RLS dessas tabelas a um segundo dono. Ver sprint112_family_profile_
-- shares.sql para o raciocínio original desta escolha — mantém-se válido: uma
-- migração de dono-único → co-donos na RLS continua arriscada demais para
-- fazer de uma vez, por isso o "co-dono" aqui é simulado na camada de API,
-- não no esquema.

alter table family_profile_shares
  add column if not exists role text not null default 'viewer';

do $$ begin
  alter table family_profile_shares
    add constraint family_profile_shares_role_check check (role in ('viewer','editor'));
exception when duplicate_object then null; end $$;
