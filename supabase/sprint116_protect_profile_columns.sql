-- sprint116_protect_profile_columns.sql
-- JÁ APLICADO em produção via Supabase MCP em 2026-07-28 — este ficheiro é só
-- o registo/histórico, para o caso de recriar a base de dados de raiz.
-- ATUALIZADO no mesmo dia depois de uma regressão real (ver nota abaixo).
--
-- BUG DE SEGURANÇA GRAVE encontrado por revisão automática 2026-07-28: a
-- policy "Users can update own profile" só restringe QUAL LINHA (auth.uid()=id),
-- RLS não tem granularidade por coluna — qualquer conta autenticada conseguia
-- mudar QUALQUER campo na SUA PRÓPRIA linha via uma chamada direta ao cliente
-- Supabase (bypass total da app, direto do browser): plan='pro' sem pagar,
-- org_role='owner', institution_signup_approved=true (anularia o fix desta
-- noite ao /api/org/setup), experience_mode='clinical', etc.
--
-- Este trigger bloqueia essas colunas específicas para quem escreve como
-- 'authenticated' (o próprio browser do utilizador) — service_role (usado por
-- TODAS as rotas API: stripe webhook, org/setup, invites, reach) continua a
-- escrever livremente, é assim que a app inteira funciona.
--
-- REGRESSÃO corrigida no mesmo dia: a 1ª versão bloqueava QUALQUER entrada em
-- 'clinical' vinda de fora do service-role — mas trocar de modo para quem JÁ
-- é membro real de uma organização (convidado antes) sempre foi um botão
-- normal do cliente (Header.tsx, /inicio ModeChip): a escrita em si é direta
-- ao Supabase, só a decisão de MOSTRAR o botão é que já checava pertença. O
-- trigger não distinguia "conta sem organização nenhuma a tentar
-- auto-atribuir-se" de "membro real só a mudar de vista" — bloqueava os
-- dois, e Fernando ficou sem conseguir abrir o modo institucional com a
-- PRÓPRIA conta (dono real de duas organizações). Corrigido: só bloqueia a
-- entrada em 'clinical' se o utilizador NÃO tiver nenhuma linha ativa em
-- org_members — a mesma condição "inOrg" já usada no resto da app, agora
-- também ao nível da base de dados. Testado ao vivo com um membro real
-- temporário: entrada em clinical → permitida; plan='pro' → continua
-- bloqueado.
--
-- Nota: experience_mode NÃO está bloqueado em geral — mudar entre pessoal/
-- cuidador/estudante continua um botão normal do utilizador. Só a ENTRADA em
-- 'clinical' vindo de outro modo é que tem a verificação de pertença (sair
-- de 'clinical' para outro modo continua sempre livre, é desistir de acesso).
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
    if not exists (
      select 1 from public.org_members
      where user_id = auth.uid() and active = true
    ) then
      raise exception 'O modo institucional só pode ser atribuído por quem convida.';
    end if;
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
