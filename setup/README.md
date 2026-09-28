# Connect QA Compass to Supabase

This setup is for the **mzopnroctqeftvankwrv** project. The tables and private roster have been installed: 44 agents and the two auditors below. The Netlify build has the Supabase URL and publishable key. Keep Netlify team protection on while connecting the two sign-ins.

## Who may see the shared analytics?

Start with only the two people in `auditors.json`. Each gets an invited Supabase Auth account mapped to their own `qa001` or `qa002` ID. Both auditors can read the shared audit records, roster, and analytics, but can create, edit, or remove only their own audits. No one is granted access just by entering a name. Additional managers can be added later as `viewer` accounts: they can read shared analytics but cannot paste or save audits. Unknown sign-ins and anonymous visitors get no table rows.

These are the *application* rules. Netlify team login is a separate outer gate; invite each intended viewer there too while the site remains private.

## Existing setup

The project has `qa_agents`, `qa_auditors`, `qa_members`, and `qa_audits` with access rules enabled. The two auditor records are:

| Auditor ID | Name |
| --- | --- |
| `qa001` | Estivenson Guitguiten |
| `qa002` | Joey Bidan Jr. |

These IDs come from the supplied `auditors.json`. They are assigned to sign-ins; auditors do not type them into the website. Do not run the table-creation or roster seed SQL again for login setup.

If the agent roster changes later, use the private roster seed SQL in the Supabase SQL Editor, or run the seed script with the updated two JSON files. The command-line alternative is:

```bash
read -rs -p 'Supabase secret key: ' QA_COMPASS_SECRET; echo
SUPABASE_URL='https://mzopnroctqeftvankwrv.supabase.co' \
SUPABASE_SECRET_KEY="$QA_COMPASS_SECRET" \
node setup/seed-reference-data.mjs /private/path/agents.json /private/path/auditors.json
unset QA_COMPASS_SECRET
```

The script uses the secret key only on your own computer. It upserts `qa_agents` and `qa_auditors`; it does not publish these JSON files to GitHub or Netlify.

On Windows PowerShell, use `$env:SUPABASE_URL='https://mzopnroctqeftvankwrv.supabase.co'`, then `$env:SUPABASE_SECRET_KEY=Read-Host 'Supabase secret key' -MaskInput`, run `node setup/seed-reference-data.mjs C:\private\agents.json C:\private\auditors.json`, and finish with `Remove-Item Env:SUPABASE_SECRET_KEY`.

## Connect the two sign-ins

1. Decide which email address belongs to Estivenson and which belongs to Joey. The names and IDs alone do not say which inbox each uses.
2. In **Authentication → URL Configuration**, set the site URL to `https://qacompass.netlify.app` and add `https://qacompass.netlify.app/**` to allowed redirects.
3. In **Authentication → Users**, invite each auditor at their own email address. Copy the user ID shown for each account.
4. In **SQL Editor**, run this after replacing each placeholder with the matching user ID:

```sql
insert into public.qa_members (auth_user_id, auditor_id, role, active)
values
  ('REPLACE_WITH_QA001_AUTH_UUID', 'qa001', 'auditor', true),
  ('REPLACE_WITH_QA002_AUTH_UUID', 'qa002', 'auditor', true)
on conflict (auth_user_id) do update
set auditor_id = excluded.auditor_id, role = excluded.role, active = excluded.active;
```

The supplied `auditors.json` contains IDs and names, **not** email addresses or user IDs. Match the two invited users deliberately. No user is currently linked in `qa_members`, so sign-in will not reveal audits until this step is complete. To add a manager who may only view analytics, invite them and insert `('THEIR_AUTH_UUID', null, 'viewer', true)` into `qa_members`. To remove access, set `active = false` and also revoke their Netlify team access.

## Open the site

The site at `https://qacompass.netlify.app` is deployed with Supabase configuration. Each auditor must also be allowed through the site's separate Netlify team access screen. Then each enters their invited email in the QA Compass sign-in form, opens the one-time email link, and sees their assigned name and the shared roster. The app saves reviewed audit fields to shared analytics. If the site configuration is ever missing, the app shows an error instead of opening local mode. The secret key is never in the site build.

## Verify before regular use

1. Sign in as `qa001`: confirm the assigned name/ID and roster count, then save one non-sensitive test audit.
2. Sign in as `qa002`: confirm that test appears in analytics, and that this auditor cannot remove it.
3. Test an unlisted account: it should see no roster or analytics and the app should say it is not on the access list.
4. Query `qa_audits` in the SQL Editor and remove the test audit as the project owner when finished. Verify no real call data was used for testing.

The old browser-only archive is not uploaded automatically. After sign-in, the app offers an explicit one-time import of its previously reviewed local records. Direct Microsoft List submission remains a separate integration.
