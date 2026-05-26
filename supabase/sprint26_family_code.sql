-- Sprint 26: Código de acesso da família ao portal (/familia)
-- Permite que um familiar abra o fio de conversa do seu ente querido sem conta Phlox.
-- O acesso é validado server-side (service role) contra este código.
-- Run in Supabase SQL Editor.

alter table patients add column if not exists family_code text;
create unique index if not exists patients_family_code_idx on patients(family_code) where family_code is not null;
