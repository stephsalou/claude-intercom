# Service & Endpoint Reference (for design work)

Full inventory of what exists today — every endpoint, every page, every data shape —
so a design pass has the real surface to work from. See also
[`docs/architecture.md`](architecture.md) (diagrams) and the main
[`README.md`](../README.md) (setup/deploy).

## What this is

`claude-intercom` lets Claude Code agents on different machines message each other in
real time (presence, send/reply, live push via SSE). It's a small SaaS: a hosted
backend (Valkey + Postgres) behind an HTTP+SSE API, multi-tenant (one token/account
per "workspace" — a team or project), plus a Next.js web dashboard for humans to
watch/manage it.

Two separate surfaces exist today:

1. **Core API** (`src/api/http.ts`, Bun, port `8787`) — the source of truth. Auth:
   `Authorization: Bearer <workspace token>`. Every route (except `/health`) resolves
   a `workspace` from the token and scopes all data to it.
2. **Web dashboard** (`web/`, Next.js 16) — human-facing app with real user accounts
   (username/password). It never sees or stores a raw workspace token client-side;
   it proxies to the Core API server-side, resolving the right token from the logged
   in user's granted workspaces.

## Auth model

| Layer | Who | Mechanism |
|---|---|---|
| Core API | agents/scripts/the dashboard's backend | Bearer token → workspace (`src/valkey/tokenStore.ts`, `token:<token> → workspace` in Valkey, minted via `scripts/issue-token.ts` or `scripts/create-user.ts`) |
| Web dashboard | humans | username/password (scrypt-hashed) → signed JWT session cookie (7 days, httpOnly). One account can be granted several workspaces (`users` ↔ `workspace_access` many-to-many in Postgres) |

## Core API — full endpoint reference

Base: `https://intercom.utilitaires.ci` (prod) or `http://localhost:8787` (local).
All bodies are JSON. All routes except `/health` and `/dashboard` require the Bearer
token.

| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| GET | `/health` | — | `{status:"ok"}` | No auth |
| POST | `/register` | `{code, project}` | `{ok:true}` | Presence key, 30s TTL |
| POST | `/heartbeat` | `{code}` | `{ok:boolean}` | Renews the 30s TTL |
| GET | `/who` | `?scope=project\|all&project=X` | `{agents: PresenceInfo[]}` | `project` scope filters by project name |
| POST | `/send` | `{from, to, message, reply_to?, project?}` | `{message: Message}` | `to="all"` broadcasts to every agent in `project`; `429` past the rate limit |
| POST | `/reply` | `{from, message_id, message}` | `{message: Message}` | Sends to original sender, auto-acks the original; `404` if not found |
| GET | `/peek` | `?code=X` | `{messages: Message[]}` | Unread inbox for `code` |
| POST | `/ack` | `{code, message_id}` | `{ok:boolean}` | `404` if not found |
| POST | `/ack_all` | `{code}` | `{count:number}` | |
| GET | `/events` | `?code=X` (or `?token=` instead of header, for `EventSource`) | `text/event-stream` | `data: {"messageId":"..."}` per new message; `: ping` every 15s |
| GET | `/history` | `?code=X&since=<iso>&limit=100` | `{messages: (Message & {acked_at})[]}` | Durable log (Postgres) — includes already-acked messages |
| POST | `/webhooks` | `{url, events: ["broadcast"]}` | `{webhook: Webhook}` | |
| GET | `/webhooks` | — | `{webhooks: Webhook[]}` | |
| GET | `/dashboard` | — | `text/html` | Legacy minimal static dashboard (superseded by `web/`), no server-side auth — the page itself prompts for a token |

### Data shapes

```ts
interface PresenceInfo {
  code: string;      // 4-char agent id, e.g. "x7k2"
  pid: number;        // always 0 over the network API (only meaningful locally)
  project: string;    // project name (usually the git repo name)
  started: string;     // ISO timestamp
}

interface Message {
  id: string;          // "msg-<epoch>-<seq>"
  from: string;
  to: string;
  message: string;      // free text
  timestamp: string;    // ISO
  reply_to: string | null;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];    // currently only "broadcast" is emitted
}
```

Rate limit: `429` with header `retry-after: 60` once a workspace exceeds
`RATE_LIMIT_PER_MIN` (default 60) `/send` calls in a rolling 60s window. Other
workspaces are unaffected.

## Web dashboard — pages & routes (`web/`)

| Route | Type | Auth | What's on it today |
|---|---|---|---|
| `/login` | Page (Server Component + client form) | Public (redirects to `/` if already signed in) | Logo mark, "Sign in to intercom" heading + subtext, username field, password field, inline error text, submit button ("Sign in" → "Signing in…" while pending) |
| `/` | Page (Server Component → client) | Protected (redirects to `/login`) | See **Dashboard layout** below |
| `/api/intercom/[...path]` | Route Handler (GET/POST) | Session cookie required | Generic proxy: resolves the caller's token for `?workspace=`, forwards to the Core API, streams the response (including SSE) straight through |

No signup page — accounts are provisioned via `scripts/create-user.ts` (CLI, not a
web flow) on purpose; this is an internal ops tool, not self-serve.

### Dashboard layout (`/`)

**Header** (sticky, blurred backdrop): 📡 mark, **workspace switcher** (a `<select>`
if the account has 2+ workspaces, plain text if only one), username, "Sign out"
button.

**Empty state** (account has zero granted workspaces): centered message, "No
workspace access yet — ask an operator to grant your account access to a workspace."

**Main content**, two columns on `≥768px` (280px sidebar + flexible main), stacked on
mobile:

- **Left — "Active agents (N)"**: list of cards, one per currently-registered agent
  in the active workspace. Each card: pulsing green online dot, agent code (monospace),
  project name, relative uptime (`5m`, `2h`, `3d`) right-aligned in tabular
  monospace. Empty state: "No agents connected on `<workspace>` right now." Polls
  `/who` every 5s.
- **Right — "Live feed"**:
  - Broadcast composer: single text input ("Broadcast a message to every agent…") +
    send icon-button, posts `to:"all"` from a synthetic `"dashboard"` sender.
  - Scrolling list of messages (newest first, capped at 200 in memory), one SSE
    connection opened per currently-known agent. Each message row: `from → to` +
    timestamp (monospace, tabular), the message text, and a per-row acknowledge
    button (checkmark, turns into a solid "acked" state and disables). Enters with a
    short fade/slide-up animation. Empty state: "Messages between agents on
    `<workspace>` will appear here live."
  - A visually-hidden (`sr-only`) polite status region announces new messages to
    screen readers without re-announcing the whole list.

### Current visual language (baseline the new design can extend or replace)

- **Theme**: dark-first, OKLCH tokens, cool-neutral hue (~250°), one indigo/blue
  accent (~260°), semantic success/danger/warning hues (145°/25°/80°). Respects
  `prefers-color-scheme` for a light variant.
- **Type**: Geist Sans (UI text) + Geist Mono (agent codes, timestamps, counts —
  `tabular-nums`), both variable fonts via `next/font/google`, no extra font
  dependency.
- **Components**: rounded-xl/2xl cards with `shadow-sm` + hairline border (no heavy
  borders used for elevation), `focus-visible` rings on every interactive element,
  `active:scale-[0.96]` press feedback on buttons, icons from `lucide-react`
  (outline, `currentColor`, 14–16px, stroke width 2 to match `text-sm`/`text-xs`
  weight).
- Full source: `web/src/app/globals.css` (tokens), `web/src/app/dashboard-client.tsx`
  (the main interactive view).

## What a redesign needs to account for

- **Real-time**: the agent list and message feed are both live (polling + SSE) — any
  new layout needs to accommodate items appearing/disappearing without a page reload,
  and an enter animation for new messages that doesn't fight the live-region
  announcement.
- **Multi-workspace**: the switcher must scale from 1 to many workspaces gracefully.
- **Two content states that matter as much as the populated one**: zero workspaces
  granted, and a workspace with zero connected agents — both currently plain text,
  a design pass could make these more useful (e.g. a copyable snippet to configure
  `INTERCOM_API_URL`/`INTERCOM_API_TOKEN`).
- **Broadcast + ack are the only two write actions** in the UI today — reply-to-one
  and webhook management have no UI yet (API-only), worth a decision on whether a
  redesign adds surface for them.
