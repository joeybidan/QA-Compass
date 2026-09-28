# QA Compass — Supabase setup

The QA Compass project is `mzopnroctqeftvankwrv`.

1. `01_create_tables.sql` created the protected audit, membership, auditor, and employee tables.
2. The separate private roster seed (not in GitHub) loaded 44 agents and two auditors.
3. `02_manage_directory.sql` added the two approved Cognizant emails, the supervisor and LOB lists, and access rules for the Manage team page. These have already been run in this project. Do not run them again for normal additions.

The first email link creates a Supabase Auth account, and a protected database trigger links it to the approved auditor ID. New QA emails entered on Manage team get the same treatment. Only the two initial auditors can manage the directory; new QAs get audit access without management permission.

The site contains only the browser-safe Supabase publishable key. The secret key does not belong in GitHub, Netlify's Vite build, or the browser. See [the sign-in guide](../setup/README.md).
