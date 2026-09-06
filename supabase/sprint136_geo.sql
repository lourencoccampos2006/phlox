-- sprint136_geo.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR).
--
-- Coordenadas para o mapa da rota de transportes. Ficam guardadas na ficha da
-- pessoa: a morada só é convertida em coordenadas UMA vez (app/api/geocode),
-- não a cada abertura da página.
--
-- `geo_source` guarda de onde vieram, e `geo_at` quando. Se a morada mudar, o
-- código limpa as coordenadas e volta a converter — sem isso ficava um ponto
-- no sítio errado para sempre, que num mapa é pior do que ponto nenhum.
--
-- Seguro de correr mais do que uma vez.
-- ─────────────────────────────────────────────────────────────────────────────

alter table patients add column if not exists lat            double precision;
alter table patients add column if not exists lon            double precision;
alter table patients add column if not exists geo_source     text;
alter table patients add column if not exists geo_at         timestamptz;
alter table patients add column if not exists geo_address    text;   -- a morada que deu origem a estas coordenadas

alter table organizations add column if not exists lat       double precision;
alter table organizations add column if not exists lon       double precision;
alter table organizations add column if not exists address   text;

notify pgrst, 'reload schema';
