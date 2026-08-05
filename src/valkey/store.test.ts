import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

// Requires a reachable Valkey/Redis instance (VALKEY_URL, default localhost:6379).
// Run `docker compose up -d valkey` and expose port 6379 locally before running,
// or run against any local redis/valkey for dev.
const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const presence = reachable ? await import("./presenceStore.ts") : null;
const messages = reachable ? await import("./messageStore.ts") : null;
const history = reachable ? await import("../pg/historyRepo.ts") : null;
const client = reachable ? await import("./client.ts") : null;

test.skipIf(!reachable)("presence register/heartbeat/expire", async () => {
  await presence!.register("t-aaaa", "demo", "ws1");
  const agents = await presence!.listAgents("ws1", "demo");
  expect(agents.some((a) => a.code === "t-aaaa")).toBe(true);
  expect(await presence!.heartbeat("t-aaaa", "ws1")).toBe(true);
  await presence!.unregister("t-aaaa", "ws1");
});

test.skipIf(!reachable)("register/heartbeat carry an optional friendly name, code stays the routing id", async () => {
  await presence!.register("t-named", "demo", "ws1", "frontend-dev");
  let agents = await presence!.listAgents("ws1", "demo");
  let me = agents.find((a) => a.code === "t-named");
  expect(me?.name).toBe("frontend-dev");

  // heartbeat's self-heal path also needs to carry the name through
  await presence!.unregister("t-named", "ws1");
  await presence!.heartbeat("t-named", "ws1", "demo", "frontend-dev");
  agents = await presence!.listAgents("ws1", "demo");
  me = agents.find((a) => a.code === "t-named");
  expect(me?.name).toBe("frontend-dev");

  await presence!.unregister("t-named", "ws1");
});

test.skipIf(!reachable)("heartbeat self-heals after presence already expired/gone", async () => {
  await presence!.unregister("t-ghost", "ws1"); // ensure no stale key
  expect(await presence!.heartbeat("t-ghost", "ws1")).toBe(false); // no project → can't heal
  expect(await presence!.heartbeat("t-ghost", "ws1", "demo")).toBe(true); // heals by re-registering
  const agents = await presence!.listAgents("ws1", "demo");
  expect(agents.some((a) => a.code === "t-ghost")).toBe(true);
  await presence!.unregister("t-ghost", "ws1");
});

test.skipIf(!reachable)("send/peek/ack round trip via streams", async () => {
  await presence!.register("t-aaaa", "demo", "ws1");
  await presence!.register("t-bbbb", "demo", "ws1");
  const msg = await messages!.sendMessage("ws1", "t-aaaa", "t-bbbb", "hello");
  const inbox = await messages!.peekMessages("ws1", "t-bbbb");
  expect(inbox.some((m) => m.id === msg.id && m.message === "hello")).toBe(true);

  expect(await messages!.ackMessage("ws1", "t-bbbb", msg.id)).toBe(true);
  const after = await messages!.peekMessages("ws1", "t-bbbb");
  expect(after.some((m) => m.id === msg.id)).toBe(false);
  await presence!.unregister("t-aaaa", "ws1");
  await presence!.unregister("t-bbbb", "ws1");
});

test.skipIf(!reachable)("ackAll marks acked_at in history, like ackMessage does", async () => {
  await presence!.register("t-cccc", "demo", "ws1");
  await presence!.register("t-dddd", "demo", "ws1");
  const msg = await messages!.sendMessage("ws1", "t-cccc", "t-dddd", "batch");
  const acked = await messages!.ackAll("ws1", "t-dddd");
  expect(acked).toBe(1);

  const rows = await history!.history("ws1", "t-dddd");
  const row = rows.find((r) => r.id === msg.id);
  expect(row?.acked_at).not.toBeNull();

  await presence!.unregister("t-cccc", "ws1");
  await presence!.unregister("t-dddd", "ws1");
});

test.skipIf(!reachable)("messages older than the retention window get trimmed on next write", async () => {
  await presence!.register("t-purge", "demo", "ws1");
  await client!.valkey.del("inbox:ws1:t-purge"); // isolate from any prior run's leftover stream entries
  const oldId = `${Date.now() - messages!.RETENTION_MS - 60_000}-0`;
  await client!.valkey.xadd(
    "inbox:ws1:t-purge",
    oldId,
    "from", "t-old", "to", "t-purge", "message", "ancient", "timestamp", new Date(0).toISOString(), "reply_to", "",
  );
  let inbox = await messages!.peekMessages("ws1", "t-purge");
  expect(inbox.some((m) => m.id === `msg-${oldId}`)).toBe(true);

  await messages!.sendMessage("ws1", "t-other", "t-purge", "fresh"); // triggers MINID trim
  inbox = await messages!.peekMessages("ws1", "t-purge");
  expect(inbox.some((m) => m.id === `msg-${oldId}`)).toBe(false);
  expect(inbox.some((m) => m.message === "fresh")).toBe(true);

  await presence!.unregister("t-purge", "ws1");
});

test.skipIf(!reachable)("rejects path traversal in agent code", async () => {
  await expect(messages!.sendMessage("ws1", "t-aaaa", "../../evil", "x")).rejects.toThrow();
  await expect(presence!.register("../../evil", "demo", "ws1")).rejects.toThrow();
});

test.skipIf(!reachable)("workspaces are isolated from each other", async () => {
  await presence!.register("dup", "demo", "ws1");
  await presence!.register("dup", "demo", "ws2");

  const ws1Agents = await presence!.listAgents("ws1", "demo");
  const ws2Agents = await presence!.listAgents("ws2", "demo");
  expect(ws1Agents.filter((a) => a.code === "dup").length).toBe(1);
  expect(ws2Agents.filter((a) => a.code === "dup").length).toBe(1);

  // a message sent in ws1 to "dup" must not land in ws2's "dup" inbox
  await messages!.sendMessage("ws1", "t-aaaa", "dup", "for ws1 only");
  const ws1Inbox = await messages!.peekMessages("ws1", "dup");
  const ws2Inbox = await messages!.peekMessages("ws2", "dup");
  expect(ws1Inbox.some((m) => m.message === "for ws1 only")).toBe(true);
  expect(ws2Inbox.some((m) => m.message === "for ws1 only")).toBe(false);

  await presence!.unregister("dup", "ws1");
  await presence!.unregister("dup", "ws2");
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
