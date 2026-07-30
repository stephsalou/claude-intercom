# Architecture & Flows

Technical reference for how `claude-intercom` is built, both in local-only mode and
with the hosted V1 backend. See the [README](../README.md) for setup instructions and
the [PRD](../_bmad-output/planning-artifacts/prd-intercom-saas-v1.md) /
[epics](../_bmad-output/implementation-artifacts/epics-intercom-saas-v1.md) for the
product decisions behind this.

## Components

```mermaid
flowchart LR
    subgraph "Machine A"
        A_CC["Claude Code"]
        A_MCP["MCP server\n(src/server.ts)"]
        A_Hook["PreToolUse hook\n(src/hook.ts)"]
        A_Watcher["Watcher\n(src/watcher.ts)"]
    end

    subgraph "Machine B"
        B_CC["Claude Code"]
        B_MCP["MCP server"]
        B_Hook["Hook"]
        B_Watcher["Watcher"]
    end

    subgraph "VPS"
        API["HTTP + SSE API\n(src/api/http.ts)"]
        Valkey[("Valkey\nStreams + TTL + Pub/Sub")]
        BW["BunkerWeb\n(reverse proxy, WAF, TLS)"]
    end

    A_CC -->|tool calls: who/send/reply/peek/ack| A_MCP
    B_CC -->|tool calls| B_MCP

    A_MCP -->|"HTTPS + Bearer token"| BW
    B_MCP -->|"HTTPS + Bearer token"| BW
    A_Watcher -->|SSE /events| BW
    B_Watcher -->|SSE /events| BW
    BW -->|internal overlay network\nhttp://intercom-api:8787| API
    API --> Valkey

    A_Hook -.->|checks inbox before each tool call| A_MCP
    B_Hook -.->|checks inbox before each tool call| B_MCP
```

Local-only mode (no `INTERCOM_API_URL` set) skips the VPS entirely: `src/store.ts`
reads/writes JSON files under `~/.claude/mcp-intercom/store/` and `fs.watch` replaces
the SSE connection. Both modes expose the same 6 MCP tools to Claude Code.

## Sending a message (hosted mode)

```mermaid
sequenceDiagram
    participant AgentA as Agent A (send tool)
    participant API
    participant Valkey
    participant WatcherB as Agent B's watcher (SSE)
    participant AgentB as Agent B (Claude Code)

    AgentA->>API: POST /send {from, to, message}
    API->>API: assertSafeId(from), assertSafeId(to)
    API->>Valkey: XADD inbox:{to} ... (MAXLEN ~1000)
    API->>Valkey: PUBLISH notify:{to} messageId
    API-->>AgentA: 200 {message}

    Valkey-->>API: pub/sub delivers messageId
    API-->>WatcherB: SSE event: data: {messageId}
    WatcherB->>API: GET /peek?code=B (fetch full message)
    API->>Valkey: XRANGE inbox:B - +
    Valkey-->>API: messages
    API-->>WatcherB: {messages}
    WatcherB->>AgentB: print notification, exit(2) -> asyncRewake
    AgentB->>API: (next turn) peek / reply / ack
```

If the SSE connection drops (proxy issue, network blip), the watcher falls back to
polling `/peek` every 2s — the message is never lost since it's durably stored in the
Stream until acknowledged (`XDEL`).

## Presence lifecycle

```mermaid
stateDiagram-v2
    [*] --> Registered: POST /register\n(SET presence:{code} EX 30)
    Registered --> Registered: POST /heartbeat every 15s\n(EXPIRE presence:{code} 30)
    Registered --> Expired: no heartbeat for 30s\n(agent crashed, network lost)
    Registered --> [*]: process exits normally\n(local unregisterSync)
    Expired --> [*]: key auto-deleted by Valkey TTL
```

No manual cleanup process is needed — `who` (`listAgents`) only ever sees keys that
Valkey hasn't expired yet.

## Deployment topology (VPS)

```mermaid
flowchart TB
    subgraph Internet
        Client["Claude Code MCP client"]
        CF["Cloudflare\n(DNS + edge proxy for the domain)"]
    end

    subgraph "VPS — Docker Swarm (single node)"
        BW["BunkerWeb AIO\nports 80/443 published on host\nTLS termination, WAF"]

        subgraph "bunkeraio_default (overlay network)"
            BW
            API2["intercom-api\n(alias on this network)"]
        end

        subgraph "claude-intercom_default (overlay network)"
            API2
            VK["valkey\n(no published port)"]
        end
    end

    Client -->|"HTTPS api.example.com"| CF --> BW
    BW -->|"http://intercom-api:8787\n(internal only, no public port)"| API2
    API2 --> VK
```

`docker-compose.yml` is the base definition (also used for local dev via
`docker-compose.override.yml`, which publishes ports on `localhost`).
`docker-compose.vps.yml` adds the `bunkeraio_default` network join and is applied only
on the VPS via `docker stack deploy -c docker-compose.yml -c docker-compose.vps.yml`.
