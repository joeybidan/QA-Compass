# QA Compass sign-in and team setup

QA Compass uses the Supabase project `mzopnroctqeftvankwrv`. Its shared directory currently has 44 agents, two supervisors, five LOBs, and these approved auditors:

| QA ID | Name | Cognizant email |
| --- | --- | --- |
| qa001 | Guitguiten, Estivenson | estivenson.guitguiten@cognizant.com |
| qa002 | Bidan Jr., Joey | joeyjr.bidan@cognizant.com |

These IDs come from `auditors.json`; auditors never type them into the website. The roster is loaded from Supabase; nobody needs to upload `agents.json`.

## First sign-in

1. Open [QA Compass](https://qacompass.netlify.app).
2. Enter **your own** Cognizant email and click **Send sign-in link**.
3. Open the link sent to that inbox. The site remembers the sign-in on that browser, so the email step is not repeated on each visit.

This is passwordless, with no code to type. A plain email text box by itself cannot prove who owns the address; the link verifies the inbox. The database grants access only to approved email addresses. The site's separate Netlify team sign-in may still appear before QA Compass; both auditors need access there.

The Supabase **Authentication → URL Configuration → Site URL** is already `https://qacompass.netlify.app/` in the supplied screenshot. If an email link opens the wrong destination, add `https://qacompass.netlify.app/**` under **Redirect URLs**. If the site reports that new sign-ups are disabled, enable email sign-ups in **Authentication → Sign In / Providers → Email** for the first sign-in.

## Add people and roster entries

After signing in, choose **Manage team** in the top navigation. Both existing auditors have this permission.

- **Add an auditor:** Enter the next QA ID, their name, and their Cognizant email. The new auditor then uses the same email sign-in link. New auditors can audit but do not get the Manage team permission by default.
- **Add a supervisor or LOB:** Enter its name in the matching section and click Add.
- **Add an agent:** Enter employee ID and name, and choose the supervisor and LOB. Existing agents can be edited, archived, or restored from the roster table.

Changes are saved to Supabase immediately and appear for both auditors. Only accounts approved in the database can read the roster and shared analytics. Each auditor can edit or remove only audits they saved.

New LOB names appear in the review form. If a new LOB has different scorecard rules, choose its scorecard during review; the parser only knows the original teams' automatic scorecard rules. A genuinely new LOB must also be added to the Microsoft List's choices before importing CSV.

The SQL scripts in `supabase/` document the installed tables and policies. Do not run them again for routine additions. Direct Microsoft List submission is a separate integration; CSV remains the staging export.
