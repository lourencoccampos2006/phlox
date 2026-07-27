-- VERIFICAR_RLS_patients_mar_records.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Achado da auditoria de segurança 2026-07-27: as tabelas `patients` e
-- `mar_records` (utentes + administração de medicação — os dados mais
-- sensíveis de todo o site) não têm NENHUM `CREATE TABLE` nem `ENABLE ROW
-- LEVEL SECURITY` em nenhum ficheiro .sql deste repositório. Todas as outras
-- tabelas de cuidado diário (care_records, incidents, assessments, care_plans,
-- etc.) têm — foram criadas explicitamente em sprint11.sql com RLS. Isto
-- sugere fortemente que `patients`/`mar_records` foram criadas diretamente no
-- painel do Supabase antes de existir o hábito de guardar cada migração em
-- ficheiro — e sprint91_org_sharing_audit.sql já ASSUME que a policy "_own"
-- destas tabelas existe (o comentário do próprio ficheiro diz isso). Mas como
-- não há ficheiro a prová-lo, não posso ter 100% de certeza sem ver a Base de
-- Dados a sério — e não tenho acesso a ela nesta sessão.
--
-- PASSO 1 — corre isto primeiro no SQL Editor do Supabase (SÓ LEITURA,
-- zero risco, não muda nada). Mostra se a RLS está ligada e que políticas
-- existem em cada tabela:

select
  c.relname as tabela,
  c.relrowsecurity as rls_ligada,
  count(p.polname) as numero_de_politicas,
  coalesce(array_agg(p.polname) filter (where p.polname is not null), '{}') as politicas
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relname in ('patients', 'mar_records', 'care_records', 'incidents')
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

-- O que esperar de "bom" (comparando com care_records/incidents, que sabemos
-- que estão corretas): rls_ligada = true, e pelo menos 1 política por tabela
-- (o "_own" original + o "_org_access" do sprint91, se já tiveres corrido essa
-- migração). Se `patients` ou `mar_records` aparecerem com rls_ligada = false,
-- ou zero políticas, ENTÃO corre a PASSO 2 abaixo — senão, não precisas de
-- fazer mais nada, está tudo bem.


-- PASSO 2 — só se o PASSO 1 mostrar rls_ligada = false ou 0 políticas para
-- patients/mar_records. Isto é SEGURO correr mesmo que já estejam corretas
-- (tudo idempotente — "if not exists" / captura o erro de política duplicada
-- e ignora), mas só é preciso se o diagnóstico acima confirmar o problema.

alter table if exists public.patients enable row level security;
alter table if exists public.mar_records enable row level security;

do $$ begin
  create policy "patients_own" on public.patients for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "mar_records_own" on public.mar_records for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Nota: se a tua conta usa organizações (plano Institucional), o sprint91 já
-- devia ter corrido create policy "patients_org_access" / "mar_records_org_access"
-- (usa org_id). Isso NÃO precisa de ser repetido aqui — só a policy "_own" de
-- base é que está em causa. Se este PASSO 2 disser "policy already exists" em
-- vez de correr, é sinal de que já estava tudo bem — nada a fazer.
