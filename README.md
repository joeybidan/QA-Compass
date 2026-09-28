# QA Compass

A Vite + React QA note parser with editable Microsoft List fields, CSV staging export, auditor identity, a global roster, shared analytics, and a team directory in Supabase.

## Use

During email-entry mode, an approved auditor types their Cognizant address without receiving an email, password, or OTP. Supabase remembers the browser session. This is a self-reported identity for a trusted-team demo: anyone who knows an approved email can claim it. The app loads the global roster and lets the auditor paste and review notes. Saving complete audits sends their reviewed List fields to shared analytics. The initial two auditors can open **Manage team** to add auditors, agents, supervisors, and LOBs without code changes, or switch to password mode later. Notes stay in the browser until explicitly saved; only reviewed fields are synced.

See [supabase/README.md](supabase/README.md) for the database scripts and [setup/README.md](setup/README.md) for sign-in and verification. The deployed site requires Supabase. No roster or auditor directory JSON is committed to this public repository.

```bash
npm ci
npm run dev
npm test
npm run build
```

The two supplied JSON files are consumed by `setup/seed-reference-data.mjs` using a local secret key, never by the public Vite build. The directory contains names and IDs, not login emails; each auditor must be linked to a separately invited Supabase Auth account.

## Rules and limits

- `80s`, `80%`, and `80` produce 80; a typo form prompts review. The last score-shaped line is used.
- Missing 11-digit Event IDs stay blank and do not block local CSV export. The Microsoft Form may still require this field.
- Below-100 scores with no `Markdown:` line default to `Professionalism / Soft Skills` and `Professional and personable`, with a review flag.
- Other caller, LOB, scorecard, sentiment, severe issue, repeat caller, supervisor action, kudos, and markdown mappings follow the supplied rules. Unmapped markdowns need manual selection.
- Analytics filters month/year, LOB, supervisor, and main/sub-parameter, with agent and remark drilldowns and top average scorers.

CSV remains a staging file. Direct Microsoft List submission needs an authorized Microsoft 365 integration and person-field identity resolution. Avoid sensitive real call data in tests. Netlify's team access protection should remain enabled for this internal app.
