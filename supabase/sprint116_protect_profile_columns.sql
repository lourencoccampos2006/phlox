-- sprint116_protect_profile_columns.sql
-- JÁ APLICADO em produção via Supabase MCP em 2026-07-28 — este ficheiro é só
-- o registo/histórico, para o caso de recriar a base de dados de raiz.
--
-- BUG DE SEGURANÇA GRAVE encontrado por revisão automática 2026-07-28: a
-- policy "Users can update own profile" só restringe QUAL LINHA (auth.uid()=id),
-- RLS não tem granularidade por coluna — qualquer conta autenticada conseguia
-- mudar QUALQUER campo na SUA PRÓPRIA linha via uma chamada direta ao cliente
-- Supabase (bypass total da app, direto do browser): plan='pro' sem pagar,
-- org_role='owner', institution_signup_approved=true (anularia o fix desta
-- noite ao /api/org/setup), experience_mode='clinical', etc. Confirmado com
-- teste real: PATCH direto a profiles com plan='pro' e experience_mode=
-- 'clinical' foram ambos bloqueados depois deste trigger; mudar entre
-- pessoal/cuidador/estudante continuou a funcionar.
--
-- Este trigger bloqueia essas colunas específicas para quem escreve como
-- 'authenticated' (o próprio browser do utilizador) — service_role (usado por
-- TODAS as rotas API: stripe webhook, org/setup, invites, reach) continua a
-- escrever livremente, é assim que a app inteira funciona.
--
-- Nota: experience_mode NÃO está bloqueado em geral — mudar entre pessoal/
-- cuidador/estudante continua um botão normal do utilizador. Só a ENTRADA em
-- 'clinical' vindo de outro modo é que fica proibida (sair de 'clinical'
-- para outro modo continua livre, é desistir de acesso).
create or replace function public.protect_sensitive_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.experience_mode = 'clinical' and old.experience_mode is distinct from 'clinical' then
    raise exception 'O modo institucional só pode ser atribuído por quem convida.';
  end if;
  if new.plan is distinct from old.plan then
    raise exception 'O plano só pode ser alterado pelo sistema de pagamento.';
  end if;
  if new.plan_status is distinct from old.plan_status then
    raise exception 'O estado do plano só pode ser alterado pelo sistema de pagamento.';
  end if;
  if new.org_id is distinct from old.org_id
     or new.org_role is distinct from old.org_role
     or new.active_org_id is distinct from old.active_org_id then
    raise exception 'A organização só pode ser alterada pelo sistema de convites.';
  end if;
  if new.institution_signup_approved is distinct from old.institution_signup_approved then
    raise exception 'Este campo só pode ser alterado pela equipa Phlox.';
  end if;
  if new.reach_bonus_until is distinct from old.reach_bonus_until
     or new.reach_bonus_plan is distinct from old.reach_bonus_plan then
    raise exception 'O bónus só pode ser atribuído pelo sistema.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_sensitive_profile_columns_trigger on public.profiles;
create trigger protect_sensitive_profile_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_sensitive_profile_columns();
