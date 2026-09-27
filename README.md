# QA Compass

A Vite + React audit note parser and review workspace. It copies the provided Microsoft Form field order and dropdown choices, turns notes into editable records, exports a CSV staging file, and charts reviewed audits saved locally in the browser.

## Run locally

```bash
npm ci
npm run dev
```

Load your own `agents.json` using the roster chooser. It must be an array of objects with `agentName`, `eid`, `supervisor`, and `lob`. The roster is kept in tab memory and is not bundled with this public repository or uploaded. Paste the notes, process them, inspect flagged details, and download a CSV. The analytics tab can save complete reviewed records in browser storage for prior month and year views. It supports period, LOB, supervisor, and main/sub-parameter filters, a drilldown to agents and remarks, and top average QA scorers. Use **Clear saved analytics records** to remove those local records.

```bash
npm test
npm run build
```

## Parsing defaults

- `80s`, `80%`, and `80` produce 80; the typo form is flagged for a score check. The last score-shaped line in the audit block is used.
- An absent 11-digit event ID is left blank and does not block CSV export. The original Microsoft Form may still require that field when entered through its own interface.
- A score below 100 with no `Markdown:` line gets `Professionalism / Soft Skills` and `Professional and personable`, with a review flag. The remark records the inferred choice.
- All other caller, LOB, scorecard, sentiment, severe issue, repeat caller, supervisor action, kudos, and markdown mappings follow the supplied rules. Unmapped markdowns require manual parameter selection.

## Data and integration

Parsing and analytics are browser-side. Reviewed audit fields, including auditor remarks and employee identifiers, remain in this browser's local storage until cleared. Do not use a shared browser profile for sensitive audit records. The public site and repository contain no employee roster or sample audit notes. This app does not submit to Microsoft Lists. CSV is a staging export for the approved List workflow.

The supplied Supabase project ID was not accessible to the connected Supabase account during setup, so there is no cloud data sync or authentication integration. To share analytics across devices, grant access to the intended Supabase project and provide the approved sign-in policy; a public anonymous audit table would expose internal data. Microsoft List direct submission additionally needs an authorized Microsoft 365 integration and person-field identity resolution.
