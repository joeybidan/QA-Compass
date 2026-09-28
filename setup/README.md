# QA Compass sign-in and team setup

QA Compass uses the Supabase project `mzopnroctqeftvankwrv`. The shared directory has 44 agents, two supervisors, five LOBs, and two approved QA emails:

| QA ID | Name | Email |
| --- | --- | --- |
| qa001 | Guitguiten, Estivenson | estivenson.guitguiten@cognizant.com |
| qa002 | Bidan Jr., Joey | joeyjr.bidan@cognizant.com |

## Email entry for tonight's demo

1. In Supabase, open **Authentication → Sign In / Providers → Anonymous Sign-Ins** and turn it **On**, then save. This is one project setting; it does not send an email.
2. Open [QA Compass](https://qacompass.netlify.app), type your approved Cognizant address, then click **Open QA Compass**.
3. Supabase remembers this browser session. The next visit normally goes straight to the workspace. Clearing browser data or signing out creates a new session.

No message is sent to Cognizant. The typed address is self-reported; it is not proof that the visitor owns the inbox. **The production Netlify URL and the repository are public. Anyone who knows an approved email can claim that identity while email mode is on and Anonymous Sign-Ins are enabled.** Treat this as a trusted-team demo setting, and do not paste sensitive call information until a verified sign-in method is enabled.

## Manage team

Both initial QAs can open **Manage team** to add QAs (ID, name, Cognizant email), supervisors, LOBs, and agents. Changes are saved to Supabase; agents do not require a JSON upload. Newly approved QA emails can use the same entry screen. New QAs do not get Manage team access by default.

The **Switch to password mode** button is on Manage team. Before switching, create confirmed Supabase Auth password accounts for every auditor in **Authentication → Users** and check the confirmation box in the app. Password mode blocks anonymous browser sessions at the database, so switching before those accounts exist will lock out the team. A project owner can restore email mode in SQL Editor with `update public.qa_auth_settings set mode='email' where id=1;`. To return to email mode from a password account, use the same Manage team button.

A new LOB appears in the app's review form. If it needs different scorecard rules, choose its scorecard during review; the parser only knows the original teams' automatic rules. Add a genuinely new LOB to the Microsoft List choices before importing CSV. Direct Microsoft List submission remains separate.
