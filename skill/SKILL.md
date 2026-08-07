---
name: intercom
description: Always active — coordinates with other Claude Code agents via intercom MCP. Automatically checks for messages, announces presence, and communicates to avoid conflicts. Triggers on ANY task start and periodically during work.
---

# Intercom — Inter-Agent Communication

## Purpose

Coordinate with other Claude Code instances working in parallel — on this machine, or
anywhere else if this workspace is configured for the hosted backend. Avoid file
conflicts, duplicate work, and wasted effort by communicating proactively.

## Two subagents, two jobs

This skill delegates rather than calling intercom tools inline, so messaging and
implementation never get tangled together:

- **`intercom-communicator`** — the only one with intercom tools. Checks `who`/`peek`,
  triages the inbox, replies, and turns a status report into one outgoing message.
  Has no file or shell access — it cannot touch code.
- **`intercom-executor`** — does the actual implementation work. Has no intercom
  tools — it cannot send or read messages. Ends its work with a short status block
  (`STATUS`/`SUMMARY`/`IMPACT`/`NEXT`) for the communicator to turn into a message.

The main thread is the orchestrator: it hands checking-in and messaging to
`intercom-communicator`, hands real work to `intercom-executor`, and passes the
executor's status block back to the communicator whenever something happened that
other agents should hear about. Neither subagent talks to the other directly.

## MANDATORY — On Every Task Start

Before doing ANY work, delegate to `intercom-communicator` to check in:

1. `who()` → discover who else is active on this project
2. `peek()` → check if anyone sent you a message

If other agents are active, delegate a one-line status message before touching
anything (see the template below).

## When to Communicate (Proactively)

Hand `intercom-communicator` a status update when:

| Situation | Example message |
|-----------|----------------|
| Starting work on a file | `[Contexte] src/auth/middleware.ts` / `[Action] Je commence à le modifier` / `[Impact] Personne d'autre ne devrait y toucher` / `[Action requise] Aucune — FYI` |
| About to create a PR or push | `[Contexte] feature/auth` / `[Action] Je vais push` / `[Impact] Heads up avant un conflit de branche` / `[Action requise] Aucune — FYI` |
| About to create a git worktree | `[Contexte] feature/billing` / `[Action] Je crée un worktree` / `[Impact] Aucun sur les autres` / `[Action requise] Aucune — FYI` |
| Finished a task that unblocks others | `[Contexte] Auth middleware` / `[Action] Terminé et mergé` / `[Impact] Vous pouvez pull` / `[Action requise] Aucune — FYI` |
| Found a bug affecting others | `[Contexte] Migration DB 042` / `[Action] Elle est cassée` / `[Impact] Bloquant si vous mergez` / `[Action requise] Ne pas merger tant que ce n'est pas corrigé` |
| Need information from another agent | `[Contexte] Rate limiter` / `[Action] Je cherche qui le gère` / `[Impact] Je suis bloqué sans ce contexte` / `[Action requise] Réponds avec qui/où` |

## When to Check Messages

Delegate a check-in to `intercom-communicator`:

- **At task start** (mandatory)
- **Before modifying shared files** (package.json, schema, configs)
- **Before git operations** (push, merge, rebase)
- **Periodically during long tasks** (every ~10 tool calls, or after `intercom-executor` finishes a meaningful chunk)
- **Before claiming work is done**

## How to Reply

When `intercom-communicator` surfaces a message during a check-in:
- If it asks a question → have it `reply()` (auto-acks the original — no separate
  `ack` needed)
- If it's informational → have it `ack()` after you've read the triage
- If it warns about a conflict → adjust `intercom-executor`'s next task accordingly,
  *then* reply so the sender knows you saw it
- Inbox getting cluttered with things already acted on? `ack_all` clears it in one
  call — don't leave stale messages sitting there "just in case"

## Works inside agent teams too

If this session is a teammate in a Claude Code agent team, it still loads this
project's MCP config like any normal session — intercom is available without extra
setup. Use it when something affects agents *outside* the team (a different repo,
a different machine): the team's shared task list only coordinates the team itself.

## Friendly names

Set `INTERCOM_AGENT_NAME` (e.g. in the MCP server's env config) to give this agent a
human-readable label shown alongside its code in `who()` and the dashboard — e.g.
`frontend-dev [h3ja]` instead of just `[h3ja]`. The code is still what `send`/`reply`/`ack`
actually use for routing; the name is purely cosmetic and never required.

## Scope

- `who(scope="project")` → agents on the same project (default)
- `who(scope="all")` → every agent visible to you (same machine, or same hosted
  workspace if configured remotely)
- `send(to="all", ...)` → broadcasts to same-project agents
- `send(to="x7k2", ...)` → direct message to a specific agent (works across
  projects/machines)

## Rules

1. **Always check messages before starting work** — someone may have warned about a conflict
2. **Announce significant file changes** — other agents can't see your edits in real-time
3. **Reply to questions** — don't leave messages unacknowledged
4. **Use the template, but stay concise** — structure isn't an excuse to pad; 2-4 short lines, not an essay
5. **Don't spam** — one message per real event, not per file edit
6. **Getting a `429`?** — you're sending too fast (rate limit is per-workspace, not just
   you). Stop and batch your next update instead of retrying immediately.

## Known quirks

- **`send` failures now say what actually broke.** They used to always read "Invalid
  recipient code" no matter the cause — that was a bug, not a recipient problem, and
  it's what made curly braces look cursed. Read the real message: `429` = rate limit,
  `403` = the reverse proxy blocked it (retry), anything else = report it.
- **"SECURITY WARNING" on `intercom-communicator`** — can fire as a false positive when
  you were explicitly asked to message another agent/frontend. If the send/broadcast is
  something the user actually requested, it's safe to proceed — just read it with that
  context.
