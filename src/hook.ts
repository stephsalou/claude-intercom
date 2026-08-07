import { findMyCodeSync, peekMessagesSync, passesThrottleSync } from "./store.js";
import * as remoteClient from "./mcpClient.js";

// This hook runs before EVERY tool call. In hosted mode each run was a fresh HTTPS
// round-trip to the API: the latency was charged to every Read/Edit/Bash, and the
// request volume from a handful of parallel agents behind one IP is what kept
// tripping the reverse proxy's abuse detection and banning them. Worst case a
// message now surfaces this many ms late — the watcher's SSE stream is what makes
// delivery feel instant, not this. Local mode reads the filesystem, which costs
// nothing, so it stays unthrottled.
const REMOTE_PEEK_THROTTLE_MS = 10_000;

// Read stdin to check if this is an intercom tool call (skip to avoid duplicates)
let input = "";
try {
  input = await Bun.stdin.text();
} catch {}

if (input) {
  try {
    const data = JSON.parse(input);
    if (
      typeof data.tool_name === "string" &&
      data.tool_name.startsWith("mcp__intercom__")
    ) {
      process.exit(0);
    }
  } catch {}
}

// Find which agent code belongs to this Claude Code instance
const code = findMyCodeSync();
if (!code) process.exit(0);

// Check inbox
let messages;
if (remoteClient.isRemote) {
  if (!passesThrottleSync(code, REMOTE_PEEK_THROTTLE_MS)) process.exit(0);
  messages = await remoteClient.peekMessages(code).catch(() => []);
} else {
  messages = peekMessagesSync(code);
}
if (messages.length === 0) process.exit(0);

// Output messages — this gets injected into the agent's context
const lines = messages.map(
  (m) => `  [${m.id}] ${m.from}${m.reply_to ? " (reply)" : ""}: ${m.message}`,
);

console.log(
  `\n📬 INTERCOM [${code}] — ${messages.length} message(s) en attente:\n${lines.join("\n")}\n→ Utilise reply(message_id, message) pour répondre ou ack(message_id) pour accuser réception.\n`,
);

process.exit(0);
