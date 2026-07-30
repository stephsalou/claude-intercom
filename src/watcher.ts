import { watch } from "node:fs";
import { join } from "node:path";
import { findMyCodeSync, peekMessagesSync, type Message } from "./store.js";
import * as remoteClient from "./mcpClient.js";

const HOME = process.env.HOME ?? "~";
const MESSAGES_DIR = join(HOME, ".claude", "mcp-intercom", "store", "messages");

let code: string | null = null;
for (let attempt = 0; attempt < 15; attempt++) {
  code = findMyCodeSync();
  if (code) break;
  await Bun.sleep(2000);
}
if (!code) process.exit(0);

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
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 300_000); // safety timeout: 5 minutes max

  try {
    const res = await fetch(`${apiUrl}/events?code=${encodeURIComponent(code)}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE connect failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      if (chunk.includes("data:") && (await checkAndNotifyRemote())) {
        controller.abort();
        process.exit(2);
      }
    }
    process.exit(0);
  } catch {
    // SSE unavailable (e.g. proxy stripped it) — fall back to polling
    for (let i = 0; i < 150; i++) {
      if (await checkAndNotifyRemote()) process.exit(2);
      await Bun.sleep(2000);
    }
    process.exit(0);
  }
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
