# QA Compass — Supabase setup

The project is `mzopnroctqeftvankwrv`. These scripts are installed in order:

1. `01_create_tables.sql` created the protected audit, membership, auditor, and employee tables.
2. A separate private roster seed loaded 44 agents and two auditors. It is not in GitHub.
3. `02_manage_directory.sql` added the two approved Cognizant emails, supervisor and LOB lists, and management policies.
4. `03_email_entry_and_password_switch.sql` added self-reported email entry through a Supabase anonymous browser session and a mode switch that blocks those sessions in password mode.

To use email entry, enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**. No email is sent. The account is tied to that browser, and the typed email is not verified. The production site and GitHub repository are public, so anyone who knows an approved address can claim it in this mode. Do not put sensitive call information into this demo until verified sign-in is enabled.

The site contains only the browser-safe Supabase publishable key. The secret key is not in the frontend. See [sign-in and management instructions](../setup/README.md).
