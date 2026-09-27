# Connect QA Compass to Supabase

This setup is for the **mzopnroctqeftvankwrv** project. The connected Supabase account could not access that project when the app was built, so these steps are prepared but have **not** been run against it. Keep Netlify team protection on while configuring it.

## Who may see the shared analytics?

Start with only the two people in `auditors.json`. Each gets an invited Supabase Auth account mapped to their own `qa001` or `qa002` ID. Both auditors can read the shared audit records, roster, and analytics, but can create, edit, or remove only their own audits. No one is granted access just by entering a name. Additional managers can be added later as `viewer` accounts: they can read shared analytics but cannot paste or save audits. Unknown sign-ins and anonymous visitors get no table rows.

These are the *application* rules. Netlify team login is a separate outer gate; invite each intended viewer there too while the site remains private.

## 1. Give the connected account project access

In the Supabase organization that owns the project, add the account used by the Supabase connector as an authorized team member or reconnect the connector with the project-owning account. Verify `mzopnroctqeftvankwrv` appears in its project list. Do not substitute another project merely because it appears in the connector.

## 2. Create the protected tables

Open the project's **SQL Editor** and run [`schema.sql`](schema.sql) once. It enables row level security on all four tables and grants authenticated users only the operations their policies allow. Review the SQL with the project owner before running it. If your project's Data API does not expose new `public` tables automatically, the explicit grants at the bottom provide table privileges, but verify the Data API exposure settings too.

## 3. Seed the two supplied JSON files

On your own machine, from this repository directory, run the seed script with the two uploaded JSON files. Use a temporary shell environment for the **secret key**. Do not place the key in `.env`, `VITE_` variables, GitHub, or chat.

```bash
SUPABASE_URL='https://mzopnroctqeftvankwrv.supabase.co' \
SUPABASE_SECRET_KEY='YOUR_SECRET_KEY' \
node setup/seed-reference-data.mjs /private/path/agents.json /private/path/auditors.json
```

Get the actual project URL and secret key from the project's **Settings → API Keys** page. The script uses the secret key only on your own computer. It upserts `qa_agents` and `qa_auditors`; rerun it when the roster changes. It does not publish these JSON files to GitHub or Netlify.

## 4. Bind real logins to auditor IDs

In **Authentication → Users**, invite each auditor at their own work email address. Copy each Auth user UUID. Run this in the SQL Editor with the actual UUIDs (these are examples, not real IDs):

```sql
insert into public.qa_members (auth_user_id, auditor_id, role, active)
values
  ('REPLACE_WITH_QA001_AUTH_UUID', 'qa001', 'auditor', true),
  ('REPLACE_WITH_QA002_AUTH_UUID', 'qa002', 'auditor', true)
on conflict (auth_user_id) do update
set auditor_id = excluded.auditor_id, role = excluded.role, active = excluded.active;
```

The supplied `auditors.json` contains IDs and names, **not** email addresses or Auth UUIDs. Match the two invited users deliberately. To add a manager who may only view analytics, invite them and insert `('THEIR_AUTH_UUID', null, 'viewer', true)` into `qa_members`. To remove access, set `active = false` and also revoke their Netlify team access. A user already holding a valid token may retain it until expiry; use the Auth dashboard to end sessions when urgent.

## 5. Configure login and site build

In **Authentication → URL Configuration**, set the site URL to `https://qacompass.netlify.app` and allow that redirect. Keep public signups disabled if the project supports invitation-only registration. In Netlify project environment variables, set:

```text
VITE_SUPABASE_URL=https://mzopnroctqeftvankwrv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # from this project
```

The publishable key is designed for browser use; never use a secret or service-role key here. Redeploy the GitHub source. Once configured, the app prompts for a magic link, identifies the auditor from `qa_members`, loads the roster automatically, and saves reviewed audit fields to shared analytics. Unconfigured builds retain the local testing mode.

## 6. Verify before regular use

1. Sign in as `qa001`: confirm the assigned name/ID and roster count, then save one non-sensitive test audit.
2. Sign in as `qa002`: confirm that test appears in analytics, and that this auditor cannot remove it.
3. Test an unlisted account: it should see no roster or analytics and the app should say it is not on the access list.
4. Query `qa_audits` in the SQL Editor and remove the test audit as the project owner when finished. Verify no real call data was used for testing.

The old browser-only archive is not uploaded automatically. After sign-in, the app offers an explicit one-time import of its previously reviewed local records. Direct Microsoft List submission remains a separate integration.
