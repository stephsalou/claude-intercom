---
name: intercom
description: Always active — coordinates with other Claude Code agents via intercom MCP. Automatically checks for messages, announces presence, and communicates to avoid conflicts. Triggers on ANY task start and periodically during work.
---

# Intercom — Inter-Agent Communication

## Purpose

Coordinate with other Claude Code instances working in parallel — on this machine, or
anywhere else if this workspace is configured for the hosted backend. Avoid file
conflicts, duplicate work, and wasted effort by communicating proactively.

## MANDATORY — On Every Task Start

Before doing ANY work, run these two calls:

1. `mcp__intercom__who()` → discover who else is active on this project
2. `mcp__intercom__peek()` → check if anyone sent you a message

If other agents are active, send a one-line message about what you're about to work on
before touching anything.

## When to Communicate (Proactively)

Send a message (`mcp__intercom__send`) when:

| Situation | Example message |
|-----------|----------------|
| Starting work on a file | `"Je commence à modifier src/auth/middleware.ts"` |
| About to create a PR or push | `"Je vais push sur feature/auth, heads up"` |
| About to create a git worktree | `"Je crée un worktree pour feature/billing"` |
| Finished a task that unblocks others | `"Auth middleware terminé et mergé, vous pouvez pull"` |
| Found a bug or issue affecting others | `"Attention: la migration DB 042 est cassée, ne pas merger"` |
| Need information from another agent | `"Qui gère le rate limiter ? J'ai besoin de contexte"` |

## When to Check Messages

Call `mcp__intercom__peek()`:

- **At task start** (mandatory)
- **Before modifying shared files** (package.json, schema, configs)
- **Before git operations** (push, merge, rebase)
- **Periodically during long tasks** (every ~10 tool calls)
- **Before claiming work is done**

## How to Reply

When you receive a message:
- If it asks a question → `mcp__intercom__reply(message_id, "your answer")` (this
  automatically acknowledges the original — no separate `ack` needed)
- If it's informational and needs no answer → `mcp__intercom__ack(message_id)` after
  reading it
- If it warns about a conflict → adjust your work accordingly, *then* reply so the
  sender knows you saw it
- Inbox getting cluttered with things you've already acted on? `mcp__intercom__ack_all`
  clears it in one call — don't leave stale messages sitting there "just in case"

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
4. **Be concise** — messages are for coordination, not essays
5. **Don't spam** — one announcement per major action, not per file edit
6. **Getting a `429`?** — you're sending too fast (rate limit is per-workspace, not just
   you). Stop and batch your next update instead of retrying immediately.
