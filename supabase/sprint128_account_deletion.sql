-- sprint128_account_deletion.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Porquê: o botão "Apagar conta" em /settings hoje só faz signOut() — não apaga
-- nada. A política de privacidade e /seguranca prometem apagamento real
-- ("Cascade DELETE remove todos os dados... em definitivo"). Este ficheiro é o
-- pré-requisito para o endpoint /api/account/delete (app/api/account/delete/
-- route.ts) poder chamar supabase.auth.admin.deleteUser(userId) com segurança.
--
-- O problema: ~113 tabelas já têm "on delete cascade" a partir de auth.users
-- (ex.: patients.user_id, personal_meds.user_id) — essas apagam-se sozinhas,
-- corretamente, porque são DADOS DO PRÓPRIO utilizador.
--
-- Mas ~69 colunas de ATRIBUIÇÃO ("quem fez isto" — recorded_by_id, created_by,
-- assigned_to, dispensed_by, triaged_by, etc.) estão em "on delete no action"
-- (o default do Postgres). Isto significa que a MERA EXISTÊNCIA de um registo
-- assinado por essa pessoa (ex.: um mar_records.recorded_by_id de uma toma que
-- deu a um utente há 3 meses) BLOQUEIA a soft/hard delete do utilizador com um
-- erro de violação de chave estrangeira — e esses registos pertencem ao utente/
-- instituição, não à pessoa que os assinou, por isso NÃO devem ser apagados em
-- cascata quando essa pessoa sai. A correção é "on delete set null": o registo
-- fica, só perde a assinatura de quem o fez.
--
-- Duas colunas de atribuição eram NOT NULL (org_invites.invited_by,
-- prescriptions.prescriber_id) — tornam-se nullable primeiro. A prescriptions já
-- guarda prescriber_name/prescriber_license como snapshot de texto, por isso
-- perder a FK não perde informação legível para o doente.
--
-- Exceção: family_help_requests.created_by passa a CASCADE — é um pedido de
-- ajuda pessoal criado pelo utilizador (conteúdo dele, não um registo clínico
-- de terceiros), por isso faz sentido desaparecer com a conta que o criou.
--
-- Lista gerada por introspeção direta ao catálogo do Postgres (pg_constraint),
-- não por grep aos ficheiros de migração — reflete o estado REAL da base de
-- dados em produção, não o que os ficheiros .sql "deviam" ter feito.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Tornar nullable as 2 colunas que eram NOT NULL.
alter table org_invites alter column invited_by drop not null;
alter table prescriptions alter column prescriber_id drop not null;

-- Único caso de CASCADE: conteúdo pessoal, não registo institucional de terceiros.
alter table family_help_requests drop constraint family_help_requests_created_by_fkey;
alter table family_help_requests add constraint family_help_requests_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;

-- Todas as restantes colunas de atribuição: SET NULL (preserva o registo do utente/instituição).
alter table activities drop constraint activities_recorded_by_id_fkey;
alter table activities add constraint activities_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table activity_participations drop constraint activity_participations_recorded_by_id_fkey;
alter table activity_participations add constraint activity_participations_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table agent_tasks drop constraint agent_tasks_assigned_to_fkey;
alter table agent_tasks add constraint agent_tasks_assigned_to_fkey foreign key (assigned_to) references auth.users(id) on delete set null;
alter table agent_tasks drop constraint agent_tasks_resolved_by_fkey;
alter table agent_tasks add constraint agent_tasks_resolved_by_fkey foreign key (resolved_by) references auth.users(id) on delete set null;
alter table appointments drop constraint appointments_recorded_by_id_fkey;
alter table appointments add constraint appointments_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table assessments drop constraint assessments_recorded_by_id_fkey;
alter table assessments add constraint assessments_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table attendance drop constraint attendance_recorded_by_id_fkey;
alter table attendance add constraint attendance_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table automations drop constraint automations_created_by_fkey;
alter table automations add constraint automations_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table billing_entries drop constraint billing_entries_recorded_by_id_fkey;
alter table billing_entries add constraint billing_entries_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table care_checklist_logs drop constraint care_checklist_logs_done_by_id_fkey;
alter table care_checklist_logs add constraint care_checklist_logs_done_by_id_fkey foreign key (done_by_id) references auth.users(id) on delete set null;
alter table care_checklists drop constraint care_checklists_recorded_by_id_fkey;
alter table care_checklists add constraint care_checklists_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table care_records drop constraint care_records_recorded_by_id_fkey;
alter table care_records add constraint care_records_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table clinical_consults drop constraint clinical_consults_to_user_id_fkey;
alter table clinical_consults add constraint clinical_consults_to_user_id_fkey foreign key (to_user_id) references auth.users(id) on delete set null;
alter table crm_activities drop constraint crm_activities_done_by_fkey;
alter table crm_activities add constraint crm_activities_done_by_fkey foreign key (done_by) references auth.users(id) on delete set null;
alter table crm_activities drop constraint crm_activities_created_by_fkey;
alter table crm_activities add constraint crm_activities_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table crm_contacts drop constraint crm_contacts_created_by_fkey;
alter table crm_contacts add constraint crm_contacts_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table crm_contacts drop constraint crm_contacts_owner_user_id_fkey;
alter table crm_contacts add constraint crm_contacts_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete set null;
alter table documents drop constraint documents_recorded_by_id_fkey;
alter table documents add constraint documents_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table encounters drop constraint encounters_recorded_by_id_fkey;
alter table encounters add constraint encounters_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table episodes drop constraint episodes_created_by_fkey;
alter table episodes add constraint episodes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table episodes drop constraint episodes_attending_user_id_fkey;
alter table episodes add constraint episodes_attending_user_id_fkey foreign key (attending_user_id) references auth.users(id) on delete set null;
alter table family_help_requests drop constraint family_help_requests_claimed_by_fkey;
alter table family_help_requests add constraint family_help_requests_claimed_by_fkey foreign key (claimed_by) references auth.users(id) on delete set null;
alter table family_messages drop constraint family_messages_recorded_by_id_fkey;
alter table family_messages add constraint family_messages_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table family_profile_med_logs drop constraint family_profile_med_logs_logged_by_fkey;
alter table family_profile_med_logs add constraint family_profile_med_logs_logged_by_fkey foreign key (logged_by) references auth.users(id) on delete set null;
alter table family_thread_messages drop constraint family_thread_messages_recorded_by_id_fkey;
alter table family_thread_messages add constraint family_thread_messages_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table finance_entries drop constraint finance_entries_recorded_by_id_fkey;
alter table finance_entries add constraint finance_entries_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table goods_receipts drop constraint goods_receipts_received_by_fkey;
alter table goods_receipts add constraint goods_receipts_received_by_fkey foreign key (received_by) references auth.users(id) on delete set null;
alter table grand_round_cases drop constraint grand_round_cases_submitted_user_id_fkey;
alter table grand_round_cases add constraint grand_round_cases_submitted_user_id_fkey foreign key (submitted_user_id) references auth.users(id) on delete set null;
alter table handovers drop constraint handovers_from_user_id_fkey;
alter table handovers add constraint handovers_from_user_id_fkey foreign key (from_user_id) references auth.users(id) on delete set null;
alter table handovers drop constraint handovers_to_user_id_fkey;
alter table handovers add constraint handovers_to_user_id_fkey foreign key (to_user_id) references auth.users(id) on delete set null;
alter table health_checkins drop constraint health_checkins_recorded_by_id_fkey;
alter table health_checkins add constraint health_checkins_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table hydration_logs drop constraint hydration_logs_recorded_by_id_fkey;
alter table hydration_logs add constraint hydration_logs_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table incidents drop constraint incidents_recorded_by_id_fkey;
alter table incidents add constraint incidents_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table lab_integrations drop constraint lab_integrations_created_by_fkey;
alter table lab_integrations add constraint lab_integrations_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table loyalty_transactions drop constraint loyalty_transactions_created_by_fkey;
alter table loyalty_transactions add constraint loyalty_transactions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table mar_records drop constraint mar_records_recorded_by_id_fkey;
alter table mar_records add constraint mar_records_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table org_invites drop constraint org_invites_accepted_by_fkey;
alter table org_invites add constraint org_invites_accepted_by_fkey foreign key (accepted_by) references auth.users(id) on delete set null;
alter table org_members drop constraint org_members_invited_by_fkey;
alter table org_members add constraint org_members_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
alter table patient_meds drop constraint patient_meds_recorded_by_id_fkey;
alter table patient_meds add constraint patient_meds_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table patients drop constraint patients_recorded_by_id_fkey;
alter table patients add constraint patients_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table pharma_interventions drop constraint pharma_interventions_recorded_by_id_fkey;
alter table pharma_interventions add constraint pharma_interventions_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table prescription_items drop constraint prescription_items_dispensed_by_fkey;
alter table prescription_items add constraint prescription_items_dispensed_by_fkey foreign key (dispensed_by) references auth.users(id) on delete set null;
alter table prescription_queue drop constraint prescription_queue_recorded_by_id_fkey;
alter table prescription_queue add constraint prescription_queue_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table purchase_orders drop constraint purchase_orders_created_by_fkey;
alter table purchase_orders add constraint purchase_orders_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table quiz_feedback drop constraint quiz_feedback_reviewed_by_fkey;
alter table quiz_feedback add constraint quiz_feedback_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null;
alter table resident_contacts drop constraint resident_contacts_recorded_by_id_fkey;
alter table resident_contacts add constraint resident_contacts_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table resident_requests drop constraint resident_requests_recorded_by_id_fkey;
alter table resident_requests add constraint resident_requests_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table round_assignments drop constraint round_assignments_attended_by_fkey;
alter table round_assignments add constraint round_assignments_attended_by_fkey foreign key (attended_by) references auth.users(id) on delete set null;
alter table round_assignments drop constraint round_assignments_assigned_to_fkey;
alter table round_assignments add constraint round_assignments_assigned_to_fkey foreign key (assigned_to) references auth.users(id) on delete set null;
alter table rounds drop constraint rounds_created_by_fkey;
alter table rounds add constraint rounds_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table safety_events drop constraint safety_events_recorded_by_id_fkey;
alter table safety_events add constraint safety_events_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table sales drop constraint sales_recorded_by_id_fkey;
alter table sales add constraint sales_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table shift_assignments drop constraint shift_assignments_recorded_by_id_fkey;
alter table shift_assignments add constraint shift_assignments_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table shift_vacancies drop constraint shift_vacancies_recorded_by_id_fkey;
alter table shift_vacancies add constraint shift_vacancies_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table stock_items drop constraint stock_items_recorded_by_id_fkey;
alter table stock_items add constraint stock_items_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table support_services drop constraint support_services_completed_by_id_fkey;
alter table support_services add constraint support_services_completed_by_id_fkey foreign key (completed_by_id) references auth.users(id) on delete set null;
alter table support_services drop constraint support_services_requested_by_id_fkey;
alter table support_services add constraint support_services_requested_by_id_fkey foreign key (requested_by_id) references auth.users(id) on delete set null;
alter table surgeries drop constraint surgeries_surgeon_id_fkey;
alter table surgeries add constraint surgeries_surgeon_id_fkey foreign key (surgeon_id) references auth.users(id) on delete set null;
alter table surgeries drop constraint surgeries_created_by_fkey;
alter table surgeries add constraint surgeries_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table surgeries drop constraint surgeries_anaesthetist_id_fkey;
alter table surgeries add constraint surgeries_anaesthetist_id_fkey foreign key (anaesthetist_id) references auth.users(id) on delete set null;
alter table surgery_team drop constraint surgery_team_user_id_fkey;
alter table surgery_team add constraint surgery_team_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table team_members drop constraint team_members_recorded_by_id_fkey;
alter table team_members add constraint team_members_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table team_messages drop constraint team_messages_author_id_fkey;
alter table team_messages add constraint team_messages_author_id_fkey foreign key (author_id) references auth.users(id) on delete set null;
alter table team_spaces drop constraint team_spaces_created_by_fkey;
alter table team_spaces add constraint team_spaces_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table telemed_sessions drop constraint telemed_sessions_clinician_id_fkey;
alter table telemed_sessions add constraint telemed_sessions_clinician_id_fkey foreign key (clinician_id) references auth.users(id) on delete set null;
alter table triage_assessments drop constraint triage_assessments_triaged_by_fkey;
alter table triage_assessments add constraint triage_assessments_triaged_by_fkey foreign key (triaged_by) references auth.users(id) on delete set null;
alter table triage_assessments drop constraint triage_assessments_seen_by_fkey;
alter table triage_assessments add constraint triage_assessments_seen_by_fkey foreign key (seen_by) references auth.users(id) on delete set null;
alter table visit_requests drop constraint visit_requests_recorded_by_id_fkey;
alter table visit_requests add constraint visit_requests_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table vitals drop constraint vitals_recorded_by_id_fkey;
alter table vitals add constraint vitals_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table waiting_room drop constraint waiting_room_recorded_by_id_fkey;
alter table waiting_room add constraint waiting_room_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table wounds drop constraint wounds_recorded_by_id_fkey;
alter table wounds add constraint wounds_recorded_by_id_fkey foreign key (recorded_by_id) references auth.users(id) on delete set null;
alter table org_invites drop constraint org_invites_invited_by_fkey;
alter table org_invites add constraint org_invites_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
alter table prescriptions drop constraint prescriptions_prescriber_id_fkey;
alter table prescriptions add constraint prescriptions_prescriber_id_fkey foreign key (prescriber_id) references auth.users(id) on delete set null;

-- Registo de auditoria dos apagamentos (RGPD: prova de que o pedido foi processado).
-- Sem FK para auth.users de propósito — tem de sobreviver ao apagamento que regista.
create table if not exists account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null,
  email text not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'completed' check (status in ('completed','failed')),
  error_detail text
);
alter table account_deletions enable row level security;
-- Só o service role escreve/lê isto (é feito a partir do endpoint, nunca do browser).
create policy account_deletions_service_only on account_deletions
  for all to service_role using (true) with check (true);

commit;

-- Verificação pós-aplicação (deve devolver 0 linhas):
-- select conname, confdeltype from pg_constraint con
-- join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
-- join pg_class tc on tc.oid = con.confrelid join pg_namespace tn on tn.oid = tc.relnamespace
-- where con.contype = 'f' and tn.nspname = 'auth' and tc.relname = 'users'
--   and n.nspname = 'public' and con.confdeltype = 'a';
