-- sprint189_mapa_terapeutico.sql
-- ---------------------------------------------------------------------------
-- FERNANDO: CORRER NO SUPABASE (SQL EDITOR). Depois do 187 e do 188.
--
-- O MAPA TERAPÊUTICO PASSA A TER MEMÓRIA, E A FARMÁCIA PASSA A VÊ-LO.
--
-- ── O QUE ACONTECE SEM ISTO ────────────────────────────────────────────────
-- Mudar uma dose sobrescreve a linha da `patient_meds`. Suspender um
-- medicamento apaga o que lá estava. Ninguém sabe quem mudou o quê, quando,
-- nem por indicação de quem — e é a primeira pergunta quando um utente piora.
-- O Ankira faz igual: guarda a última versão e mais nada.
--
-- E a farmácia que prepara a medicação (PIM) não sabe que a dose mudou até
-- alguém lhe telefonar. Se ninguém telefonar, sela a caixa errada.
--
-- ── O QUE ISTO FAZ ─────────────────────────────────────────────────────────
-- 1. Quatro colunas na `patient_meds` para a PROVENIÊNCIA de cada alteração:
--    por indicação de quem (o médico não usa o Phlox, por isso é texto), de
--    que tipo, uma nota, e o instante em que foi dada.
-- 2. A `medicacao_alteracoes`: uma linha por cada alteração, escrita por um
--    GATILHO e não pela aplicação. Não há forma de mudar a medicação sem ficar
--    registado — nem pela ficha, nem pelo importador, nem pelo portal da
--    família, nem por um ecrã que ainda não existe.
--    É só de leitura para toda a gente: ninguém a pode editar nem apagar. Um
--    histórico que se edita não é um histórico.
-- 3. A `partilhas_farmacia`: o endereço secreto com que a farmácia abre o mapa
--    de UM utente, sem conta nenhuma. Revoga-se, não se apaga — fica o registo
--    de a quem foi mostrado (RGPD, art. 15.º/1-c: os destinatários).
--
-- Isto é REGISTO e COMUNICAÇÃO. Não interpreta nada nem recomenda nada — por
-- isso fica fora da Regra 11 do Regulamento (UE) 2017/745.
--
-- Seguro de correr mais do que uma vez.
-- ---------------------------------------------------------------------------

-- ── 1. A proveniência, na própria linha ─────────────────────────────────────
alter table public.patient_meds add column if not exists indicacao_de   text;
alter table public.patient_meds add column if not exists indicacao_tipo text;
alter table public.patient_meds add column if not exists indicacao_nota text;
-- O instante em que ESTA escrita trouxe proveniência. É o que deixa o gatilho
-- distinguir «o mesmo médico voltou a mudar» de «ninguém disse quem mandou»:
-- sem esta coluna, uma alteração sem indicação herdava a indicação da
-- anterior, e o histórico atribuía-a a quem não a fez.
alter table public.patient_meds add column if not exists indicacao_em   timestamptz;

-- ── 2. O histórico ──────────────────────────────────────────────────────────
create table if not exists public.medicacao_alteracoes (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references public.organizations(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete set null,
  recorded_by_id     uuid references auth.users(id) on delete set null,
  -- O nome de quem mudou, no instante em que mudou. Lido depois, a pessoa pode
  -- já ter saído da casa — e o registo tem de continuar a dizer quem foi.
  alterado_por_nome  text,
  patient_id         uuid not null references public.patients(id) on delete cascade,
  -- Sem chave estrangeira, de propósito: um medicamento apagado da ficha não
  -- pode levar consigo o registo de que existiu.
  med_id             uuid,
  med_nome           text not null,
  tipo               text not null check (tipo in ('nova','alterada','suspensa','retomada','removida')),
  antes              jsonb,
  depois             jsonb,
  indicacao_de       text,
  indicacao_tipo     text,
  indicacao_nota     text,
  -- Quando a farmácia carregou em «recebido». Escrito só pela rota pública,
  -- com a chave de serviço.
  vista_farmacia_em  timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists medicacao_alteracoes_utente on public.medicacao_alteracoes (patient_id, created_at desc);
create index if not exists medicacao_alteracoes_org    on public.medicacao_alteracoes (org_id, created_at desc);

alter table public.medicacao_alteracoes enable row level security;

drop policy if exists medicacao_alteracoes_ler on public.medicacao_alteracoes;
create policy medicacao_alteracoes_ler on public.medicacao_alteracoes for select using (
  (org_id is null and user_id = auth.uid())
  or org_id in (
    select m.org_id from public.org_members m
     where m.user_id = auth.uid() and m.active = true
       and 'medicacao.ver' = any(coalesce(m.capabilities, public.default_capabilities(m.role)))
  )
);
-- Sem políticas de escrita, de propósito: quem escreve é o gatilho, que corre
-- com os direitos do dono da função. Pela API ninguém insere, muda ou apaga.

-- ── 3. O gatilho ────────────────────────────────────────────────────────────
create or replace function public.registar_alteracao_medicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo   text;
  v_linha  public.patient_meds;
  v_com    boolean;
  v_nome   text;
  v_ignora text[] := array['indicacao_de','indicacao_tipo','indicacao_nota','indicacao_em','recorded_by_id','updated_at'];
begin
  if tg_op = 'INSERT' then
    v_tipo := 'nova'; v_linha := new; v_com := new.indicacao_em is not null;
  elsif tg_op = 'DELETE' then
    -- Apagar um utente apaga-lhe a medicação em cascata. Registar essas linhas
    -- apontaria para um utente que já não existe, e a chave estrangeira
    -- deitava abaixo o apagamento inteiro.
    if not exists (select 1 from public.patients p where p.id = old.patient_id) then
      return old;
    end if;
    v_tipo := 'removida'; v_linha := old; v_com := false;
  else
    v_linha := new;
    v_com := new.indicacao_em is distinct from old.indicacao_em;
    if coalesce(old.active, true) and not coalesce(new.active, true) then
      v_tipo := 'suspensa';
    elsif not coalesce(old.active, true) and coalesce(new.active, true) then
      v_tipo := 'retomada';
    else
      -- Uma escrita que não muda nada do que conta não é uma alteração.
      if (to_jsonb(old) - v_ignora) = (to_jsonb(new) - v_ignora) then
        return new;
      end if;
      v_tipo := 'alterada';
    end if;
  end if;

  select p.name into v_nome from public.profiles p where p.id = auth.uid();

  insert into public.medicacao_alteracoes (
    org_id, user_id, recorded_by_id, alterado_por_nome, patient_id, med_id, med_nome, tipo,
    antes, depois, indicacao_de, indicacao_tipo, indicacao_nota)
  values (
    v_linha.org_id, v_linha.user_id, auth.uid(), v_nome, v_linha.patient_id, v_linha.id,
    coalesce(v_linha.name, '—'), v_tipo,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    case when v_com then v_linha.indicacao_de end,
    case when v_com then v_linha.indicacao_tipo end,
    case when v_com then v_linha.indicacao_nota end);

  return coalesce(new, old);
end;
$$;

drop trigger if exists patient_meds_historico on public.patient_meds;
create trigger patient_meds_historico
  after insert or update or delete on public.patient_meds
  for each row execute function public.registar_alteracao_medicacao();

-- ── 4. A partilha com a farmácia ────────────────────────────────────────────
create table if not exists public.partilhas_farmacia (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references public.organizations(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  recorded_by_id    uuid references auth.users(id) on delete set null,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  -- 64 caracteres hexadecimais de dois uuid aleatórios: 244 bits de acaso.
  -- Gerado AQUI e não no browser, para ninguém poder escolher um fraco.
  token             text not null unique
                    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  farmacia_nome     text not null,
  farmacia_email    text,
  criada_em         timestamptz not null default now(),
  revogada_em       timestamptz,
  ultima_visita_em  timestamptz,
  visitas           integer not null default 0,
  ultimo_aviso_em   timestamptz
);
create index if not exists partilhas_farmacia_utente
  on public.partilhas_farmacia (patient_id) where revogada_em is null;

alter table public.partilhas_farmacia enable row level security;

drop policy if exists partilhas_farmacia_ler on public.partilhas_farmacia;
create policy partilhas_farmacia_ler on public.partilhas_farmacia for select using (
  (org_id is null and user_id = auth.uid())
  or org_id in (
    select m.org_id from public.org_members m
     where m.user_id = auth.uid() and m.active = true
       and 'medicacao.ver' = any(coalesce(m.capabilities, public.default_capabilities(m.role)))
  )
);

-- Criar e revogar pede MEXER na medicação: partilhar o mapa de alguém com uma
-- farmácia é comunicar dados de saúde a um terceiro.
--
-- ── O UTENTE TEM DE SER DA CASA DA LINHA (corrigido antes de correr) ──────
-- A primeira versão só verificava que quem cria pertence à casa escrita em
-- `org_id`. Não verificava que o `patient_id` era dessa casa. Um membro de
-- uma casa podia criar uma partilha com o `org_id` dele e o `patient_id` de
-- um utente de OUTRA casa, ler o token (a política de leitura deixa-o), e a
-- rota pública servia-lhe a medicação, as alergias e a data de nascimento
-- dessa pessoa. Agora o utente tem de ser da mesma casa — ou, numa conta
-- pessoal, da própria pessoa.
--
-- As colunas da linha nova vão qualificadas com o nome da tabela: dentro do
-- `exists`, um `org_id` sem prefixo seria o da `patients`.
drop policy if exists partilhas_farmacia_criar on public.partilhas_farmacia;
create policy partilhas_farmacia_criar on public.partilhas_farmacia for insert with check (
  exists (
    select 1 from public.patients p
     where p.id = partilhas_farmacia.patient_id
       and (
         (    p.org_id is null and partilhas_farmacia.org_id is null
          and p.user_id = auth.uid() and partilhas_farmacia.user_id = auth.uid())
         or ( p.org_id is not null and p.org_id = partilhas_farmacia.org_id
          and p.org_id in (
            select m.org_id from public.org_members m
             where m.user_id = auth.uid() and m.active = true
               and 'medicacao.editar' = any(coalesce(m.capabilities, public.default_capabilities(m.role)))))
       )
  )
);

-- Mudar: as mesmas condições, antes e depois. O gatilho em baixo garante o
-- resto — que o que identifica a partilha não muda depois de criada.
drop policy if exists partilhas_farmacia_mudar on public.partilhas_farmacia;
create policy partilhas_farmacia_mudar on public.partilhas_farmacia for update
using (
  (org_id is null and user_id = auth.uid())
  or org_id in (
    select m.org_id from public.org_members m
     where m.user_id = auth.uid() and m.active = true
       and 'medicacao.editar' = any(coalesce(m.capabilities, public.default_capabilities(m.role)))
  )
)
with check (
  (org_id is null and user_id = auth.uid())
  or org_id in (
    select m.org_id from public.org_members m
     where m.user_id = auth.uid() and m.active = true
       and 'medicacao.editar' = any(coalesce(m.capabilities, public.default_capabilities(m.role)))
  )
);
-- Sem política de apagar: revoga-se. O registo de a quem se mostrou fica.

-- ── O que não muda depois de criada ─────────────────────────────────────────
-- Uma partilha é «este utente, esta casa, este endereço». Deixar mudar o
-- `patient_id` reabria por atualização o buraco que a política de criação
-- fecha; deixar mudar o `token` deixava alguém escolher um endereço fraco; e
-- tirar o `revogada_em` reabria uma ligação que a casa fechou. Para dar
-- acesso outra vez cria-se uma ligação nova, com endereço novo.
create or replace function public.partilha_farmacia_imutavel()
returns trigger
language plpgsql
as $$
begin
  if new.patient_id is distinct from old.patient_id
     or new.org_id is distinct from old.org_id
     or new.user_id is distinct from old.user_id
     or new.token is distinct from old.token
     or new.criada_em is distinct from old.criada_em then
    raise exception 'Uma partilha com a farmácia não muda de utente, de casa nem de endereço. Revogue-a e crie outra.';
  end if;
  if old.revogada_em is not null and new.revogada_em is distinct from old.revogada_em then
    raise exception 'Uma ligação revogada não se reabre. Crie uma ligação nova.';
  end if;
  return new;
end;
$$;

drop trigger if exists partilhas_farmacia_imutavel on public.partilhas_farmacia;
create trigger partilhas_farmacia_imutavel
  before update on public.partilhas_farmacia
  for each row execute function public.partilha_farmacia_imutavel();

-- ── Verificar ───────────────────────────────────────────────────────────────
--   select tipo, med_nome, indicacao_de, created_at from medicacao_alteracoes
--    order by created_at desc limit 10;

notify pgrst, 'reload schema';
