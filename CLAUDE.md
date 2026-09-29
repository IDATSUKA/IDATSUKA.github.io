# CLAUDE.md

## Project context

Read **`AGENTS.md`** first — it describes what this repo is, its layout, the
conventions to follow, and how to verify a change. Everything in there applies
to you as well as to Codex.

## Delegating to Codex

The Codex CLI is set up in this repo so that work can be handed to it.

**How to hand off:** spawn the `codex` subagent (`.claude/agents/codex.md`)
with a complete brief. It shells out to `.claude/scripts/codex-run.sh`,
verifies the resulting diff, and reports back. Or run the script directly:

```bash
.claude/scripts/codex-run.sh "<brief>"           # read-only
.claude/scripts/codex-run.sh --write "<brief>"   # may edit the working tree
```

**When delegation is worth it**
- The user asks for Codex by name.
- A second, independent model should cross-check a change or a claim.
- A well-scoped chunk of work can run unattended while you carry on.

**When to just do it yourself**
- A one- or two-file edit you already understand — the handoff costs more
  than the work.
- Anything needing a conversation with the user; Codex cannot ask questions.

**Rules**
- Codex is non-interactive. Its brief must be self-contained: goal, files,
  constraints, and what "done" looks like.
- Default to read-only. Pass `--write` only when the task must change files.
- Never pass `--dangerously-bypass-approvals-and-sandbox`.
- Treat Codex's summary as a claim. Check `git diff` before believing it.
- Codex never commits or pushes. Commits are yours.
- If `codex-run.sh` exits 2 (not installed), 3 (no credentials), or 4
  (`api.openai.com` blocked by the network policy), report that to the user
  rather than silently absorbing the task. Exit 4 is a policy denial — do
  not retry it.

Setup, authentication, and the network requirement are documented in
`docs/CODEX.md`.
