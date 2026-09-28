# QA Compass — Supabase setup

Use the **QA Compass** project (`mzopnroctqeftvankwrv`), not DocuTool.

1. In Supabase, open **QA Compass → SQL Editor → New query**.
2. Open [`01_create_tables.sql`](01_create_tables.sql) on GitHub, copy its whole contents into the query box, and click **Run** once. This creates protected tables for the global roster, auditor names, approved users, and saved audits. No employee rows are included in the public repository.
3. Open the separate **QA_Compass_private_roster_seed.sql** file provided in this chat. Copy all of it into a *new* SQL Editor query and click **Run**. The result should show **44 agents** and **2 auditors**. Keep this private file out of GitHub.
4. Stop there and tell me the result. Linking each auditor to a login email and turning on live sync are separate steps. Do not paste your secret key in SQL or in chat.

`qa001` and `qa002` are labels already present in your uploaded `auditors.json`. The two scripts above do not yet grant anyone access to read saved audits. That happens only after their login accounts are linked in the approved-users table.
