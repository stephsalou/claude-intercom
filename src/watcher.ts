import { watch } from "node:fs";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findMyCodeSync, peekMessagesSync, type Message } from "./store.js";
import * as remoteClient from "./mcpClient.js";

const HOME = process.env.HOME ?? "~";
const MESSAGES_DIR = join(HOME, ".claude", "mcp-intercom", "store", "messages");
const SESSIONS_DIR = join(HOME, ".claude", "mcp-intercom", "store", "sessions");

let code: string | null = null;
for (let attempt = 0; attempt < 15; attempt++) {
  code = findMyCodeSync();
  if (code) break;
  await Bun.sleep(2000);
}
if (!code) process.exit(0);

// Every SessionStart/Stop hook trigger spawns a fresh watcher. Without a lock,
// several sessions (or a session that never got a clean Stop event) pile up
// duplicate watchers for the same agent, multiplying request volume against
// the API. Only one watcher runs per agent code at a time — a new one exits
// immediately if the previous one is still alive.
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const lockFile = join(SESSIONS_DIR, `${code}.watcher.lock`);

// `wx` makes the create step atomic — two watchers racing here can't both pass a
// check-then-write (the previous existsSync + writeFileSync was exactly that race).
function acquireLock(): boolean {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      writeFileSync(lockFile, String(process.pid), { flag: "wx" });
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const existingPid = parseInt(readFileSync(lockFile, "utf-8").trim(), 10);
      if (existingPid && isPidAlive(existingPid)) return false;
      // Stale lock left by a watcher that crashed instead of exiting cleanly.
      try {
        unlinkSync(lockFile);
      } catch {}
    }
  }
  return false;
}

mkdirSync(SESSIONS_DIR, { recursive: true });
if (!acquireLock()) process.exit(0);
process.on("exit", () => {
  try {
    unlinkSync(lockFile);
  } catch {}
});

function announce(messages: Message[]): void {
  const lines = messages.map(
    (m) => `  [${m.id}] ${m.from}${m.reply_to ? " (reply)" : ""}: ${m.message}`,
  );
  console.log(
    `\n📬 INTERCOM [${code}] — ${messages.length} message(s):\n${lines.join("\n")}\n→ Utilise mcp__intercom__reply(message_id, message) pour répondre ou mcp__intercom__ack(message_id) pour accuser réception.\n`,
  );
}

if (remoteClient.isRemote) {
  async function checkAndNotifyRemote(): Promise<boolean> {
    const messages = await remoteClient.peekMessages(code!).catch(() => []);
    if (messages.length === 0) return false;
    announce(messages);
    return true;
  }

  if (await checkAndNotifyRemote()) process.exit(2);

  const apiUrl = (process.env.INTERCOM_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.INTERCOM_API_TOKEN ?? "";
  const deadline = Date.now() + 300_000; // safety timeout: 5 minutes max

  // "found" = a message arrived (caller exits). "closed"/"failed" both mean the SSE
  // connection ended without one — the caller decides whether to retry SSE or poll.
  async function trySSE(): Promise<"found" | "closed" | "failed"> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
    try {
      const res = await fetch(`${apiUrl}/events?code=${encodeURIComponent(code)}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return "failed";
      remoteClient.reportMode(code!, "sse");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return "closed";
        const chunk = decoder.decode(value);
        if (chunk.includes("data:") && (await checkAndNotifyRemote())) {
          controller.abort();
          return "found";
        }
      }
    } catch {
      return "failed";
    } finally {
      clearTimeout(timeout);
    }
  }

  // Retries SSE with backoff on every drop instead of committing to polling for the
  // rest of the window — a transient WAF/proxy hiccup should self-heal in seconds,
  // not degrade this agent to slow polling for up to 5 minutes.
  let backoffMs = 2000;
  while (Date.now() < deadline) {
    const result = await trySSE();
    if (result === "found") process.exit(2);
    remoteClient.reportMode(code!, "poll");
    if (await checkAndNotifyRemote()) process.exit(2);
    await Bun.sleep(backoffMs + Math.random() * 1000);
    backoffMs = Math.min(backoffMs * 2, 15_000);
  }
  process.exit(0);
} else {
  const inbox = join(MESSAGES_DIR, code);

  function checkAndNotify(): boolean {
    const messages = peekMessagesSync(code!);
    if (messages.length === 0) return false;
    announce(messages);
    return true;
  }

  // Check immediately in case messages already exist
  if (checkAndNotify()) process.exit(2);

  // Watch inbox directory for new files — instant detection
  try {
    const watcher = watch(inbox, (_event, filename) => {
      if (filename?.endsWith(".json")) {
        if (checkAndNotify()) {
          watcher.close();
          process.exit(2);
        }
      }
    });

    // Safety timeout: 5 minutes max
    setTimeout(() => {
      watcher.close();
      process.exit(0);
    }, 300_000);
  } catch {
    // Inbox dir doesn't exist yet — fall back to polling
    for (let i = 0; i < 150; i++) {
      if (checkAndNotify()) process.exit(2);
      await Bun.sleep(2000);
    }
    process.exit(0);
  }
}
