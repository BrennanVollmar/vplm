Agent Guardrails and Workflow

Scope: Entire repository. These rules guide the coding agent’s behavior when working in this repo.

1) Always log changes to CHANGE_LOG
- After making any code/content change (edits, adds, deletes), append a concise but clear summary to a Markdown file in the `CHANGE_LOG` directory.
- Use a new file per session with this naming exactly: `session-YYYY-MM-DD-HHMM.md` (24h time).
- Include: what changed, why, files touched, validation/build steps, and any follow-ups.

2) Keep the latest session on top
- The most recent chronologically named file in `CHANGE_LOG` holds the most up‑to‑date info.
- When you need historical context, first read the latest file in `CHANGE_LOG` before older ones.

3) Respond to “update memory”
- When the user says "update memory", append a summary of the most recent changes, decisions, or context to the current session’s Markdown file in `CHANGE_LOG`.
- If no current file exists for today, create a new one using the naming convention above and append there.

4) Safety and minimalism
- Prefer minimal, targeted changes that fix the issue at its root.
- Preserve existing style and structure unless the task explicitly calls for refactors.

5) Validation
- After changes, build/test where possible and add outcomes to the session log.

6) Sensitive keys and network
- Do not hardcode secrets.
- Use local storage or environment variables as appropriate.

7) Start server trigger
- When the user says "start server", start the site by running `npm run dev` from the repository root (which proxies to `apps/vplm-portal`). Confirm it is reachable on `https://localhost:5173`.
