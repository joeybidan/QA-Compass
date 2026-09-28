-- Run once in the SQL Editor of the intended QA Compass Supabase project.
-- All rows are private until an administrator links auth.users to qa_members.
create table if not exists public.qa_auditors (
  id text primary key,
  name text not null,
  active boolean not null default true
);

create table if not exists public.qa_members (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  auditor_id text unique references public.qa_auditors(id),
  role text not null check (role in ('auditor','viewer')),
  active boolean not null default true,
  constraint auditor_has_id check (role <> 'auditor' or auditor_id is not null)
);

create table if not exists public.qa_agents (
  eid text primary key,
  agent_name text not null,
  supervisor text not null,
  lob text not null,
  active boolean not null default true
);

create table if not exists public.qa_audits (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id),
  auditor_id text not null references public.qa_auditors(id),
  client_key text not null,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_user_id, client_key)
);
create index if not exists qa_audits_call_date_idx on public.qa_audits ((fields->>'Call Date'));

alter table public.qa_auditors enable row level security;
alter table public.qa_members enable row level security;
alter table public.qa_agents enable row level security;
alter table public.qa_audits enable row level security;

-- Members may read only their own identity mapping. The other policies use
-- that self-visible row to establish membership, without privileged functions.
create policy "members_read_self" on public.qa_members for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "members_read_auditor_directory" on public.qa_auditors for select to authenticated
  using (exists (select 1 from public.qa_members m where m.auth_user_id = (select auth.uid()) and m.active));

create policy "members_read_roster" on public.qa_agents for select to authenticated
  using (exists (select 1 from public.qa_members m where m.auth_user_id = (select auth.uid()) and m.active));

create policy "members_read_shared_audits" on public.qa_audits for select to authenticated
  using (exists (select 1 from public.qa_members m where m.auth_user_id = (select auth.uid()) and m.active));

create policy "auditor_insert_own_audit" on public.qa_audits for insert to authenticated
  with check (author_user_id = (select auth.uid()) and exists (
    select 1 from public.qa_members m where m.auth_user_id = (select auth.uid())
      and m.auditor_id = qa_audits.auditor_id and m.role = 'auditor' and m.active
  ));

create policy "auditor_update_own_audit" on public.qa_audits for update to authenticated
  using (author_user_id = (select auth.uid()) and exists (
    select 1 from public.qa_members m where m.auth_user_id = (select auth.uid())
      and m.auditor_id = qa_audits.auditor_id and m.role = 'auditor' and m.active
  ))
  with check (author_user_id = (select auth.uid()) and exists (
    select 1 from public.qa_members m where m.auth_user_id = (select auth.uid())
      and m.auditor_id = qa_audits.auditor_id and m.role = 'auditor' and m.active
  ));

create policy "auditor_delete_own_audit" on public.qa_audits for delete to authenticated
  using (author_user_id = (select auth.uid()) and exists (
    select 1 from public.qa_members m where m.auth_user_id = (select auth.uid())
      and m.auditor_id = qa_audits.auditor_id and m.role = 'auditor' and m.active
  ));

revoke all on public.qa_auditors, public.qa_members, public.qa_agents, public.qa_audits from anon, authenticated;
grant select on public.qa_auditors, public.qa_members, public.qa_agents to authenticated;
grant select, insert, update, delete on public.qa_audits to authenticated;
