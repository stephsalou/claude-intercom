import { test, expect } from "bun:test";
import { SQL } from "bun";

const url = process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom";
const probe = new SQL(url);
const reachable = await probe`select 1`
  .then(() => true)
  .catch(() => false);
await probe.close().catch(() => {});

const repo = reachable ? await import("./historyRepo.ts") : null;

function sampleMessage(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    from: "alice",
    to: "bob",
    message: "hello",
    timestamp: new Date().toISOString(),
    reply_to: null,
    ...overrides,
  };
}

test.skipIf(!reachable)("recorded message shows up in history", async () => {
  const msg = sampleMessage("msg-pg-test-1");
  await repo!.recordMessage("ws1", msg);
  const rows = await repo!.history("ws1", "bob");
  expect(rows.some((r) => r.id === msg.id && r.message === "hello")).toBe(true);
});

test.skipIf(!reachable)("acked message stays in history with acked_at set", async () => {
  const msg = sampleMessage("msg-pg-test-2");
  await repo!.recordMessage("ws1", msg);
  await repo!.markAcked("ws1", msg.id);
  const rows = await repo!.history("ws1", "bob");
  const row = rows.find((r) => r.id === msg.id);
  expect(row?.acked_at).not.toBeNull();
});

test.skipIf(!reachable)("history is scoped by workspace", async () => {
  const msg = sampleMessage("msg-pg-test-3");
  await repo!.recordMessage("ws-only-here", msg);
  const rowsElsewhere = await repo!.history("ws-somewhere-else", "bob");
  expect(rowsElsewhere.some((r) => r.id === msg.id)).toBe(false);
});

test.skipIf(!reachable)("purgeOldHistory deletes only rows past the retention window", async () => {
  const RETENTION_MS = 10 * 60 * 60 * 1000;
  const old = sampleMessage("msg-pg-test-old", {
    to: "purge-target",
    timestamp: new Date(Date.now() - RETENTION_MS - 60_000).toISOString(),
  });
  const fresh = sampleMessage("msg-pg-test-fresh", { to: "purge-target" });
  await repo!.recordMessage("ws1", old);
  await repo!.recordMessage("ws1", fresh);

  await repo!.purgeOldHistory(RETENTION_MS);

  const rows = await repo!.history("ws1", "purge-target");
  expect(rows.some((r) => r.id === old.id)).toBe(false);
  expect(rows.some((r) => r.id === fresh.id)).toBe(true);
});

test.skipIf(reachable)("skipped: no reachable Postgres at " + url, () => {});
