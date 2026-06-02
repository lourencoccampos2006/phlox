-- sprint50_capabilities.sql
-- Phlox — Sistema de capabilities granulares por role.
--
-- Catálogo central de capabilities; defaults por role; override por membro.
-- A função has_capability(uid, oid, cap) é o ponto único de verificação no
-- backend (chamada pelas RLS policies das tabelas que precisam de filtro
-- por capability).

create table if not exists capability_catalog (
  key         text primary key,
  category    text not null,
  label       text not null,
  description text,
  level       text not null check (level in ('read','write','admin'))
);

-- Seed do catálogo
insert into capability_catalog (key, category, label, description, level) values
  -- ── Doentes / utentes ─────────────────────────────────────────────────
  ('patients.read',          'patients',     'Ver doentes',                 'Acede a fichas, medicação e histórico',                                  'read'),
  ('patients.write',         'patients',     'Criar e editar doentes',      'Acrescenta novos doentes ou altera dados existentes',                    'write'),
  ('patients.delete',        'patients',     'Eliminar doentes',            'Remove definitivamente (uso raro)',                                      'admin'),
  -- ── Episódios ─────────────────────────────────────────────────────────
  ('episodes.read',          'episodes',     'Ver episódios clínicos',      '',                                                                        'read'),
  ('episodes.write',         'episodes',     'Criar/encerrar episódios',    'Abrir admissão, alta, transferência',                                    'write'),
  -- ── Prescrição ───────────────────────────────────────────────────────
  ('prescription.read',      'prescription', 'Ver prescrições',             '',                                                                        'read'),
  ('prescription.write',     'prescription', 'Prescrever',                  'Médicos e prescritores autorizados',                                     'write'),
  ('prescription.validate',  'prescription', 'Validar prescrição',          'Farmacêuticos validam antes de dispensar',                               'write'),
  -- ── MAR ──────────────────────────────────────────────────────────────
  ('mar.read',               'mar',          'Ver registos MAR',            '',                                                                        'read'),
  ('mar.administer',         'mar',          'Registar administração',      'Enfermeiros e cuidadores autorizados',                                   'write'),
  -- ── Rondas e intervenções farmacêuticas ──────────────────────────────
  ('rounds.read',            'rounds',       'Ver rondas',                  '',                                                                        'read'),
  ('rounds.write',           'rounds',       'Intervenções PCNE',           '',                                                                        'write'),
  -- ── Stock / farmácia ─────────────────────────────────────────────────
  ('stock.read',             'stock',        'Ver stock',                   '',                                                                        'read'),
  ('stock.write',            'stock',        'Movimentar stock',            'Entradas, saídas, transferências',                                       'write'),
  ('stock.purchase',         'stock',        'Encomendar a fornecedores',   '',                                                                        'admin'),
  ('stock.inventory',        'stock',        'Inventário',                  'Contagem física',                                                        'write'),
  -- ── Faturação ────────────────────────────────────────────────────────
  ('billing.read',           'billing',      'Ver faturas',                 '',                                                                        'read'),
  ('billing.write',          'billing',      'Emitir faturas',              '',                                                                        'write'),
  ('billing.fiscal_export',  'billing',      'Exportar SAF-T',              'Acesso ao XML SAF-T para AT',                                            'admin'),
  -- ── POS ──────────────────────────────────────────────────────────────
  ('pos.use',                'pos',          'Usar POS',                    'Vendas e recibos',                                                       'write'),
  -- ── Equipa / RH ──────────────────────────────────────────────────────
  ('team.read',              'team',         'Ver equipa',                  '',                                                                        'read'),
  ('team.manage',            'team',         'Gerir membros',               'Adicionar, remover, alterar funções',                                    'admin'),
  ('team.schedule',          'team',         'Gerir escalas',               '',                                                                        'write'),
  -- ── Qualidade e auditoria ────────────────────────────────────────────
  ('quality.read',           'quality',      'Ver KPIs de qualidade',       '',                                                                        'read'),
  ('quality.write',          'quality',      'Registar eventos qualidade',  '',                                                                        'write'),
  ('audit.read',             'audit',        'Ver audit trail',             '',                                                                        'admin'),
  -- ── Organização ──────────────────────────────────────────────────────
  ('org.admin',              'org',          'Administração da organização', 'Tudo o que diz respeito à identidade, integrações e configuração',     'admin'),
  ('org.billing_settings',   'org',          'Plano e pagamentos',          'Subscrição Phlox da organização',                                        'admin')
  on conflict (key) do nothing;

-- ─── Defaults por role ──────────────────────────────────────────────────────
-- Função que devolve as capabilities default de um role.
create or replace function default_capabilities(role text) returns text[]
language plpgsql immutable as $$
begin
  return case role
    when 'owner' then
      array(select key from capability_catalog)
    when 'admin' then
      array['patients.read','patients.write','patients.delete',
            'episodes.read','episodes.write',
            'prescription.read','prescription.validate',
            'mar.read','rounds.read','rounds.write',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'billing.read','billing.write','billing.fiscal_export','pos.use',
            'team.read','team.manage','team.schedule',
            'quality.read','quality.write','audit.read','org.admin']
    when 'clinician' then
      array['patients.read','patients.write',
            'episodes.read','episodes.write',
            'prescription.read','prescription.write',
            'mar.read','rounds.read','rounds.write',
            'quality.read','team.read']
    when 'pharmacist' then
      array['patients.read',
            'prescription.read','prescription.validate',
            'stock.read','stock.write','stock.purchase','stock.inventory',
            'rounds.read','rounds.write',
            'billing.read','billing.write','pos.use',
            'quality.read','team.read']
    when 'nurse' then
      array['patients.read','patients.write',
            'episodes.read',
            'prescription.read',
            'mar.read','mar.administer',
            'rounds.read',
            'quality.write','team.read']
    when 'assistant' then
      array['patients.read',
            'episodes.read',
            'billing.read','billing.write','pos.use',
            'team.read']
    when 'accountant' then
      array['billing.read','billing.write','billing.fiscal_export',
            'org.billing_settings']
    when 'viewer' then
      array['patients.read','episodes.read','prescription.read',
            'mar.read','rounds.read','stock.read','billing.read',
            'team.read','quality.read']
    when 'student' then
      array['patients.read','prescription.read','mar.read','rounds.read']
    when 'caregiver' then
      array['patients.read','mar.read','mar.administer']
    when 'self' then
      array['patients.read']
    else array[]::text[]
  end;
end;
$$;

-- ─── Capabilities efetivas de um utilizador numa org ────────────────────────
create or replace function user_capabilities(uid uuid, oid uuid) returns text[]
language sql stable as $$
  select coalesce(
    (select capabilities from org_members where user_id = uid and org_id = oid and active = true limit 1),
    default_capabilities(
      (select role from org_members where user_id = uid and org_id = oid and active = true limit 1)
    )
  );
$$;

-- ─── has_capability ─────────────────────────────────────────────────────────
create or replace function has_capability(uid uuid, oid uuid, cap text) returns boolean
language sql stable as $$
  select cap = any(user_capabilities(uid, oid));
$$;
