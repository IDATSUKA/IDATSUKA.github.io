# CLAUDE.md

@AGENTS.md

The block above imports `AGENTS.md`, the shared context that Codex reads
natively. Everything in it — layout, conventions, the `docs/HANDOFF.md`
protocol, the shared skills under `.agents/skills/` — applies to you exactly
as it does to Codex. Only Claude-specific notes live in this file.

## Delegating to Codex

The Codex CLI is set up in this repo so that work can be handed to it. In
Claude Code on the web the SessionStart hook installs it and authenticates
from `OPENAI_API_KEY`.

**How to hand off:** spawn the `codex` subagent (`.claude/agents/codex.md`)
with a complete brief, or use the `/codex` skill. Both shell out to
`.claude/scripts/codex-run.sh`, verify the resulting diff, and report back.
Or run the script directly:

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
  constraints, and what "done" looks like. It reads `AGENTS.md` and
  `docs/HANDOFF.md` on its own, so point it there rather than repeating them.
- Default to read-only. Pass `--write` only when the task must change files.
- Never pass `--dangerously-bypass-approvals-and-sandbox`.
- Treat Codex's summary as a claim. Check `git diff` before believing it.
- Codex never commits or pushes. Commits are yours.
- If `codex-run.sh` exits 2 (not installed), 3 (no credentials), 4
  (`api.openai.com` blocked by the network policy), or 5 (the OpenAI account
  has no API credits), report that to the user rather than silently absorbing
  the task. Exits 4 and 5 are not transient — do not retry them.

Setup, authentication, the network requirement, and how information is
shared between the two agents are documented in `docs/CODEX.md`.
