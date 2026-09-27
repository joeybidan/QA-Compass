# QA Compass

A Vite + React QA note parser with editable Microsoft List fields, CSV staging export, auditor identity, a global roster, and shared analytics when Supabase is configured.

## Use

With Supabase configured, an invited auditor signs in by work email. The app derives the auditor ID and name from the protected membership table, loads the global employee roster, and lets the auditor paste and review notes. Saving complete audits sends their reviewed List fields to shared analytics. An invited `viewer` may see the analytics without editing audits. Notes stay in the browser until explicitly saved; only reviewed fields are synced.

The Supabase project supplied for this app was not accessible to the connected account during implementation. See [setup/README.md](setup/README.md) for the exact schema, roster/auditor seeding, membership mapping, Netlify variables, and verification steps. Until configured, the site remains in local testing mode: the auditor enters their ID and name, uploads the roster for that tab, and may save reviewed records to that browser only. Local identity is self-reported. No roster or auditor directory JSON is committed to this public repository.

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
