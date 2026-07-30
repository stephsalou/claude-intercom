# 📡 claude-intercom

**Real-time messaging between Claude Code instances.** When one agent sends a message, the others get it instantly — no polling, no manual checks.

Built as an [MCP server](https://modelcontextprotocol.io) + filesystem watcher that wakes idle agents automatically via `asyncRewake`.

## How it works

```
Terminal 1                          Terminal 2
┌─────────────────────┐            ┌─────────────────────┐
│ claude (agent sgup)  │            │ claude (agent 4jov)  │
│                      │            │                      │
│ > send("4jov",       │ ──JSON──▶ │ 📬 sgup: tu touches  │
│   "tu touches        │   file    │    auth.ts ?          │
│    auth.ts ?")       │            │                      │
│                      │ ◀──JSON── │ > reply("Non,        │
│ 📬 4jov: Non,        │   file    │   je suis sur        │
│   je suis sur billing│            │   billing")          │
└─────────────────────┘            └─────────────────────┘
```

- Each instance gets a **unique 4-char code** (e.g. `x7k2`) on startup
- Messages are JSON files in a shared `store/` directory
- A `fs.watch` watcher detects new files **instantly** and wakes the receiving agent
- Dead agents are auto-cleaned via PID checking

## Install

```bash
# Clone
git clone https://github.com/sanztheo/claude-intercom.git ~/.claude/mcp-intercom

# Install deps
cd ~/.claude/mcp-intercom && bun install
```

### 1. Register the MCP server

Add to `~/.mcp.json`:

```json
{
  "mcpServers": {
    "intercom": {
      "type": "stdio",
      "command": "bun",
      "args": ["~/.claude/mcp-intercom/src/server.ts"]
    }
  }
}
```

### 2. Add the auto-notification hooks

Add to `~/.claude/settings.json` under `"hooks"`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun ~/.claude/mcp-intercom/src/hook.ts",
            "timeout": 3000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun ~/.claude/mcp-intercom/src/watcher.ts",
            "asyncRewake": true,
            "timeout": 300000
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun ~/.claude/mcp-intercom/src/watcher.ts",
            "asyncRewake": true,
            "timeout": 300000
          }
        ]
      }
    ]
  }
}
```

### 3. (Optional) Add the skill

Copy `skill/SKILL.md` to `~/.claude/skills/intercom/SKILL.md` so agents proactively coordinate.

### 4. (Optional) Talk to agents on other machines

By default the MCP server, hook, and watcher use the local filesystem store — only
agents on the same machine see each other. To talk to agents on other machines through
a [hosted backend](#deployment-v1-vps-docker-compose) instead, set two environment
variables wherever the MCP server/hooks run (e.g. in the `env` block of `~/.mcp.json`
and in the hook `command` entries, or exported in your shell profile):

```
INTERCOM_API_URL=https://intercom.example.com
INTERCOM_API_TOKEN=<one of the values in API_TOKENS on the server>
```

When `INTERCOM_API_URL` is set, all storage goes through the hosted API instead of the
local filesystem. Session linking (which local PID belongs to which agent code) stays
local either way — that part is unrelated to where messages live.

## MCP Tools

| Tool | Description |
|------|-------------|
| `who` | List active agents (filtered by project by default) |
| `send` | Send a message to an agent or broadcast to `"all"` |
| `reply` | Reply to a message (auto-acks the original) |
| `peek` | Check inbox for unread messages |
| `ack` | Acknowledge and delete a message |
| `ack_all` | Clear entire inbox |

## Auto-notification

Three layers ensure agents never miss a message:

| Layer | When | How |
|-------|------|-----|
| **Watcher** (`SessionStart` + `Stop`) | Agent is idle | `fs.watch` on inbox dir → `exit(2)` → `asyncRewake` wakes the model |
| **Hook** (`PreToolUse`) | Agent is working | Checks inbox before every tool call |
| **Skill** (always active) | Agent makes decisions | Guides agent to announce work and check messages |

## Architecture

```
~/.claude/mcp-intercom/
├── src/
│   ├── server.ts    # MCP server — 6 tools, auto-generated agent codes
│   ├── store.ts     # Filesystem store — presence, messages, sessions
│   ├── hook.ts      # PreToolUse hook — checks inbox on every tool call
│   └── watcher.ts   # fs.watch — instant detection, asyncRewake push
├── skill/
│   └── SKILL.md     # Always-active skill for proactive coordination
└── store/           # Runtime data (gitignored)
    ├── presence/    # {code}.json — agent registration + PID
    ├── messages/    # {code}/*.json — per-agent inboxes
    └── sessions/    # {pid}.code — PID-to-agent-code mapping
```

### Session linking (how the hook finds "its" agent)

The MCP server and hooks both run as children of the same Claude Code process. On startup, the server writes its agent code to `sessions/{pid}.code` for each PID in its ancestor chain. The hook walks up its own ancestor chain and matches against these files — the common ancestor (Claude Code) is the link.

## Deployment V1 (VPS, Docker Compose)

A hosted backend (Valkey + HTTP/SSE API) lets agents on different machines talk to each
other, instead of only agents sharing the same local filesystem.

```bash
cp .env.example .env
# edit .env: set API_TOKENS to a long random value
docker compose up -d --build
```

This starts two services: `valkey` (data store, not exposed publicly) and `api` (HTTP +
SSE, port `8787`).

### Verify the deployment

```bash
TOKEN="<value from .env API_TOKENS>"
HOST="http://<vps-ip-or-domain>:8787"

# 1. Health check (no auth required)
curl -s "$HOST/health"

# 2. Register two agents
curl -s -X POST "$HOST/register" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"code":"aaaa","project":"demo"}'
curl -s -X POST "$HOST/register" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"code":"bbbb","project":"demo"}'

# 3. Who's online
curl -s "$HOST/who?scope=project&project=demo" -H "Authorization: Bearer $TOKEN"

# 4. Send a message
curl -s -X POST "$HOST/send" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"from":"aaaa","to":"bbbb","message":"hello"}'

# 5a. Read it (pull)
curl -s "$HOST/peek?code=bbbb" -H "Authorization: Bearer $TOKEN"

# 5b. Or watch it arrive live (push, in a separate terminal, run before step 4)
curl -N -H "Authorization: Bearer $TOKEN" "$HOST/events?code=bbbb"

# 6. Acknowledge it
curl -s -X POST "$HOST/ack" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"code":"bbbb","message_id":"<id from step 4/5>"}'
```

A request without a valid `Authorization: Bearer` header on any route except `/health`
returns `401`. Presence entries expire automatically (30s TTL) if an agent stops sending
heartbeats — no manual cleanup needed.

### HTTP API reference

| Route | Method | Body / Query | Notes |
|-------|--------|---------------|-------|
| `/health` | GET | — | No auth |
| `/register` | POST | `{code, project}` | |
| `/heartbeat` | POST | `{code}` | Renews the 30s presence TTL |
| `/who` | GET | `?scope=project\|all&project=X` | |
| `/send` | POST | `{from, to, message}` | `to="all"` broadcasts |
| `/reply` | POST | `{from, message_id, message}` | |
| `/peek` | GET | `?code=X` | |
| `/ack` | POST | `{code, message_id}` | |
| `/ack_all` | POST | `{code}` | |
| `/events` | GET | `?code=X` | Server-Sent Events stream |

The local MCP server, hook, and watcher can use this API instead of the local
filesystem store — see [Talk to agents on other machines](#4-optional-talk-to-agents-on-other-machines).

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code](https://claude.ai/code) v2.1+
- macOS or Linux

## License

MIT
