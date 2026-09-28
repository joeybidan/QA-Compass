-- QA Compass directory and email-based invitation mapping.
-- Existing auditor IDs and agents are retained. Run after 01_create_tables.sql.
alter table public.qa_members add column if not exists can_manage boolean not null default false;

create table if not exists public.qa_allowed_emails (
  email text primary key,
  auditor_id text not null unique references public.qa_auditors(id),
  can_manage boolean not null default false,
  active boolean not null default true,
  constraint cognizant_email check (email = lower(email) and email like '%@cognizant.com')
);

create table if not exists public.qa_supervisors (
  name text primary key,
  active boolean not null default true
);

create table if not exists public.qa_lobs (
  name text primary key,
  active boolean not null default true
);

insert into public.qa_supervisors(name)
select distinct trim(supervisor) from public.qa_agents
where trim(supervisor) <> ''
on conflict (name) do nothing;

insert into public.qa_lobs(name)
select distinct trim(lob) from public.qa_agents
where trim(lob) <> ''
on conflict (name) do nothing;

insert into public.qa_allowed_emails(email,auditor_id,can_manage)
values
  ('estivenson.guitguiten@cognizant.com','qa001',true),
  ('joeyjr.bidan@cognizant.com','qa002',true)
on conflict (email) do update
set auditor_id=excluded.auditor_id, can_manage=excluded.can_manage, active=true;

alter table public.qa_allowed_emails enable row level security;
alter table public.qa_supervisors enable row level security;
alter table public.qa_lobs enable row level security;

create schema if not exists qa_private;
revoke all on schema qa_private from public, anon, authenticated;

-- A verified Supabase Auth account gets a membership only if its email was
-- previously approved. This function is not in the public Data API schema.
create or replace function qa_private.link_qa_account(p_user_id uuid,p_email text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists(select 1 from public.qa_allowed_emails a
                where a.email=lower(p_email) and a.active) then
    update public.qa_members set active=false,can_manage=false
    where auth_user_id=p_user_id;
    return;
  end if;
  insert into public.qa_members(auth_user_id,auditor_id,role,active,can_manage)
  select p_user_id, a.auditor_id, 'auditor', true, a.can_manage
  from public.qa_allowed_emails a
  where a.email=lower(p_email) and a.active
  on conflict (auth_user_id) do update
  set auditor_id=excluded.auditor_id, role='auditor',
      active=true, can_manage=excluded.can_manage;
end;
$$;
revoke all on function qa_private.link_qa_account(uuid,text) from public, anon, authenticated;

create or replace function qa_private.link_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform qa_private.link_qa_account(new.id,new.email);
  return new;
end;
$$;
revoke all on function qa_private.link_auth_user() from public, anon, authenticated;
drop trigger if exists qa_link_auth_user on auth.users;
create trigger qa_link_auth_user after insert or update of email on auth.users
for each row execute function qa_private.link_auth_user();

create or replace function qa_private.link_approved_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare existing_user record;
begin
  if new.active then
    for existing_user in select id,email from auth.users where lower(email)=new.email loop
      perform qa_private.link_qa_account(existing_user.id,existing_user.email);
    end loop;
  else
    update public.qa_members set active=false,can_manage=false
    where auditor_id=new.auditor_id;
  end if;
  return new;
end;
$$;
revoke all on function qa_private.link_approved_email() from public, anon, authenticated;
drop trigger if exists qa_link_approved_email on public.qa_allowed_emails;
create trigger qa_link_approved_email after insert or update of auditor_id,can_manage,active on public.qa_allowed_emails
for each row execute function qa_private.link_approved_email();

-- Handle accounts that existed before this migration.
insert into public.qa_members(auth_user_id,auditor_id,role,active,can_manage)
select u.id,a.auditor_id,'auditor',true,a.can_manage
from auth.users u join public.qa_allowed_emails a on a.email=lower(u.email)
where a.active
on conflict (auth_user_id) do update
set auditor_id=excluded.auditor_id,role='auditor',
    active=true,can_manage=excluded.can_manage;

drop policy if exists "admins_read_approved_emails" on public.qa_allowed_emails;
create policy "admins_read_approved_emails" on public.qa_allowed_emails for select to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));
drop policy if exists "admins_add_approved_emails" on public.qa_allowed_emails;
create policy "admins_add_approved_emails" on public.qa_allowed_emails for insert to authenticated
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));

drop policy if exists "admins_add_auditors" on public.qa_auditors;
create policy "admins_add_auditors" on public.qa_auditors for insert to authenticated
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));

drop policy if exists "admins_add_agents" on public.qa_agents;
create policy "admins_add_agents" on public.qa_agents for insert to authenticated
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));
drop policy if exists "admins_update_agents" on public.qa_agents;
create policy "admins_update_agents" on public.qa_agents for update to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage))
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));

drop policy if exists "members_read_supervisors" on public.qa_supervisors;
create policy "members_read_supervisors" on public.qa_supervisors for select to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active));
drop policy if exists "admins_add_supervisors" on public.qa_supervisors;
create policy "admins_add_supervisors" on public.qa_supervisors for insert to authenticated
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));
drop policy if exists "admins_update_supervisors" on public.qa_supervisors;
create policy "admins_update_supervisors" on public.qa_supervisors for update to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage))
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));

drop policy if exists "members_read_lobs" on public.qa_lobs;
create policy "members_read_lobs" on public.qa_lobs for select to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active));
drop policy if exists "admins_add_lobs" on public.qa_lobs;
create policy "admins_add_lobs" on public.qa_lobs for insert to authenticated
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));
drop policy if exists "admins_update_lobs" on public.qa_lobs;
create policy "admins_update_lobs" on public.qa_lobs for update to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage))
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));

revoke all on public.qa_allowed_emails,public.qa_supervisors,public.qa_lobs from anon,authenticated;
grant select,insert on public.qa_allowed_emails to authenticated;
grant select,insert on public.qa_auditors to authenticated;
grant select,insert,update on public.qa_agents to authenticated;
grant select,insert,update on public.qa_supervisors,public.qa_lobs to authenticated;

-- The two inserts succeed together, or neither does. RLS checks the caller.
create or replace function public.add_qa_auditor(p_id text,p_name text,p_email text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.qa_members m
                 where m.auth_user_id=(select auth.uid())
                 and m.active and m.can_manage) then
    raise exception 'Only directory managers can add auditors';
  end if;
  if trim(p_id) !~ '^qa[0-9]{3,}$'
     or trim(p_name) = ''
     or lower(trim(p_email)) not like '%@cognizant.com' then
    raise exception 'Enter a QA ID, name, and Cognizant email';
  end if;
  insert into public.qa_auditors(id,name) values (trim(p_id),trim(p_name));
  insert into public.qa_allowed_emails(email,auditor_id)
  values (lower(trim(p_email)),trim(p_id));
end;
$$;
revoke all on function public.add_qa_auditor(text,text,text) from public,anon;
grant execute on function public.add_qa_auditor(text,text,text) to authenticated;
