---
name: codex
description: Hand a coding, review, or investigation task to the OpenAI Codex CLI and report what it did. Use when the user asks for Codex by name, asks for a second opinion or independent cross-check on a change, or wants a well-scoped chunk of work run by a separate agent. Not for tasks that need back-and-forth with the user — Codex cannot ask questions.
---

# Delegating to Codex

## 1. Frame the task

Codex runs non-interactively. Whatever you write is all it gets. A usable
brief names:

- **Goal** — one sentence, concrete.
- **Scope** — the files or areas involved, as repo-relative paths.
- **Constraints** — point it at `AGENTS.md`, plus anything specific to this
  task.
- **Done** — what the result should look like, and how it can be checked.

If the request is too vague to write that down, it is too vague to delegate.
Ask the user, or narrow it yourself, first.

## 2. Choose the mode

| Task | Command |
|---|---|
| Investigate, review, explain, cross-check | `.claude/scripts/codex-run.sh "<brief>"` |
| Actually change files | `.claude/scripts/codex-run.sh --write "<brief>"` |

Read-only is the default and is the right choice more often than not — a
review or an investigation never needs write access. Pick a specific model
with `--model <name>` only when the user asks for one.

Never pass `--dangerously-bypass-approvals-and-sandbox`.

## 3. Run it

Prefer spawning the `codex` subagent so the transcript stays out of your
context; run the script inline only for short read-only questions.

Codex runs take minutes, not seconds. Use a Bash timeout of 600000 ms.
Do not kill and retry a run that is merely slow.

Exit codes worth handling:

- **2** — `codex` is not installed. Report it; do not silently do the work
  yourself under the user's assumption that Codex did.
- **3** — no credentials. Point the user at `docs/CODEX.md`.
- **4** — `api.openai.com` is blocked by this environment's network policy.
  Report the blocked host; never retry a policy denial.

## 4. Verify

Codex's closing summary is a claim about what it did, not proof. After a
`--write` run:

```bash
git diff --stat
git diff
```

Read the diff. Check it against the brief and against `AGENTS.md`. If Codex
overreached, missed part of the task, or described work it did not do, say
so — the discrepancy is the most useful thing you can report.

For anything touching a page's rendering, verify the way `AGENTS.md`
describes: serve the site and look at it.

## 5. Report

Tell the user, in this order: what you asked Codex to do, what changed
(files and a one-line-per-file summary), anything Codex got wrong or left
undone, and what you recommend next. Commits stay with you — Codex never
commits or pushes.
