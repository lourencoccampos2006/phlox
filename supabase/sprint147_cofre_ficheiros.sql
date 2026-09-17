-- sprint147_cofre_ficheiros.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FERNANDO: CORRE ISTO NO SUPABASE (SQL EDITOR), depois do sprint146.
--
-- ── O QUE ISTO RESOLVE ──────────────────────────────────────────────────────
-- Três limitações do cofre que se notam logo no primeiro documento a sério.
--
-- 1. **O limite de 3 MB.** O ficheiro era guardado DENTRO da linha da tabela,
--    em base64 — que é ~33% maior que o ficheiro. Um relatório hospitalar
--    digitalizado passa disso à primeira. Agora o ficheiro vai para o Storage
--    (bucket `cofre`, privado) e a linha guarda só o caminho.
--
-- 2. **A pesquisa não encontrava os PDFs.** Ao guardar um ficheiro, o texto
--    nunca era extraído — procurar por uma palavra que está lá dentro não
--    dava nada. Agora o texto é lido no browser (lib/docExtract) e guardado
--    em `body_text`, que é o que a pesquisa lê.
--
-- 3. **A leitura a fundo perdia-se.** Custa tempo e dinheiro, e ao fechar o
--    documento desaparecia. Fica guardada em `analise`.
--
-- Nota: o bucket criado à mão no painel do Supabase só cria a entrada em
-- storage.buckets — não cria as políticas em storage.objects. Sem elas, o
-- upload devolve "new row violates row-level security policy". Por isso estão
-- aqui.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. O bucket ─────────────────────────────────────────────────────────────
-- PRIVADO. Um documento de saúde não pode ter um URL público que quem o
-- adivinhe abre: o acesso é sempre por URL assinado, de curta duração.
insert into storage.buckets (id, name, public)
values ('cofre', 'cofre', false)
on conflict (id) do nothing;

-- Cada pessoa só mexe na sua pasta (o primeiro segmento do caminho é o uid).
do $$ begin
  create policy "cofre_rw_own" on storage.objects for all
    using      (bucket_id = 'cofre' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'cofre' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object or duplicate_table then null; end $$;

-- ── 2. As colunas novas ─────────────────────────────────────────────────────
alter table if exists health_vault
  add column if not exists storage_path text,          -- caminho no bucket `cofre`
  add column if not exists file_name    text,          -- o nome original, para descarregar
  add column if not exists file_type    text,          -- mime, para o visualizador
  add column if not exists file_size    bigint,        -- para mostrar o tamanho
  add column if not exists analise      jsonb,         -- a leitura a fundo, guardada
  add column if not exists analise_em   timestamptz;

comment on column health_vault.storage_path is
  'Caminho no bucket privado `cofre`. Substitui body_url em base64 — sem isto o limite prático era ~3 MB.';
comment on column health_vault.analise is
  'A leitura a fundo (/api/vault/analisar). Guardada para não se pagar duas vezes a mesma análise e para não mudar de resposta.';
