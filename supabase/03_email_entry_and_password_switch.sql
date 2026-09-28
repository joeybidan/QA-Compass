-- Email-only entry uses a Supabase anonymous browser session. The entered
-- address is self-reported, not mailbox-verified. Use only with trusted users.
-- Enable Anonymous Sign-Ins in Authentication > Sign In / Providers.

alter table public.qa_members drop constraint if exists qa_members_auditor_id_key;
alter table public.qa_members add column if not exists claimed_email text;

create table if not exists public.qa_auth_settings (
  id integer primary key default 1 check (id=1),
  mode text not null default 'email' check (mode in ('email','password'))
);
insert into public.qa_auth_settings(id,mode) values (1,'email')
on conflict (id) do nothing;
alter table public.qa_auth_settings enable row level security;
drop policy if exists "read_auth_mode" on public.qa_auth_settings;
create policy "read_auth_mode" on public.qa_auth_settings for select to anon,authenticated
using (true);
drop policy if exists "managers_change_auth_mode" on public.qa_auth_settings;
create policy "managers_change_auth_mode" on public.qa_auth_settings for update to authenticated
using (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage))
with check (exists(select 1 from public.qa_members m where m.auth_user_id=(select auth.uid()) and m.active and m.can_manage));
revoke all on public.qa_auth_settings from anon,authenticated;
grant select on public.qa_auth_settings to anon,authenticated;
grant update(mode) on public.qa_auth_settings to authenticated;

-- Restrictive policies are ANDed with existing membership policies. When
-- password mode is enabled, anonymous sessions cannot read or change data.
create or replace function public.qa_mode_allows()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce((select mode='email' from public.qa_auth_settings where id=1),false)
    or not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true);
$$;
revoke all on function public.qa_mode_allows() from public,anon;
grant execute on function public.qa_mode_allows() to authenticated;

drop policy if exists "qa_mode_guard" on public.qa_members;
create policy "qa_mode_guard" on public.qa_members as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_auditors;
create policy "qa_mode_guard" on public.qa_auditors as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_agents;
create policy "qa_mode_guard" on public.qa_agents as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_audits;
create policy "qa_mode_guard" on public.qa_audits as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_allowed_emails;
create policy "qa_mode_guard" on public.qa_allowed_emails as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_supervisors;
create policy "qa_mode_guard" on public.qa_supervisors as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());
drop policy if exists "qa_mode_guard" on public.qa_lobs;
create policy "qa_mode_guard" on public.qa_lobs as restrictive for all to authenticated
using (public.qa_mode_allows()) with check (public.qa_mode_allows());

-- Private function checks the browser session and maps only an approved email.
-- No public table read or anonymous database grant is needed for this claim.
create or replace function qa_private.claim_qa_email(p_email text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  approved record;
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null
     or not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)
     or (select mode from public.qa_auth_settings where id=1) <> 'email' then
    raise exception 'Email-only entry is unavailable';
  end if;
  select auditor_id,can_manage into approved
  from public.qa_allowed_emails
  where email=lower(trim(p_email)) and active;
  if not found then
    raise exception 'This Cognizant email is not on the QA Compass list';
  end if;
  insert into public.qa_members(auth_user_id,auditor_id,role,active,can_manage,claimed_email)
  values(current_user_id,approved.auditor_id,'auditor',true,approved.can_manage,lower(trim(p_email)))
  on conflict(auth_user_id) do update
  set auditor_id=excluded.auditor_id,role='auditor',active=true,
      can_manage=excluded.can_manage,claimed_email=excluded.claimed_email;
  return approved.auditor_id;
end;
$$;
revoke all on function qa_private.claim_qa_email(text) from public,anon,authenticated;
grant usage on schema qa_private to authenticated;
grant execute on function qa_private.claim_qa_email(text) to authenticated;

create or replace function public.claim_qa_email(p_email text)
returns text language sql security invoker set search_path = ''
as $$ select qa_private.claim_qa_email(p_email); $$;
revoke all on function public.claim_qa_email(text) from public,anon;
grant execute on function public.claim_qa_email(text) to authenticated;
