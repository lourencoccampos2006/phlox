-- sprint94_fix_org_kind.sql
-- BUG: o check de organizations.kind não incluía 'day_care' (centro de dia), por
-- isso criar/renomear um centro de dia dava:
--   new row for relation "organizations" violates check constraint "organizations_kind_check"
-- Atualiza o constraint para os tipos que a app usa hoje (+ mantém os legados).

alter table organizations drop constraint if exists organizations_kind_check;

alter table organizations add constraint organizations_kind_check
  check (kind in (
    'day_care','nursing_home','pharmacy_community','clinic','health_center',
    -- legados (ainda válidos para dados antigos)
    'hospital','pharmacy_hospital','solo','other'
  ));
