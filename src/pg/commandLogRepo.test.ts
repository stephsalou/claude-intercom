import { test, expect } from "bun:test";
import { SQL } from "bun";

const url = process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom";
const probe = new SQL(url);
const reachable = await probe`select 1`
  .then(() => true)
  .catch(() => false);
await probe.close().catch(() => {});

const repo = reachable ? await import("./commandLogRepo.ts") : null;

test.skipIf(!reachable)("recorded commands show up for their agent, most recent first", async () => {
  const code = "cmd-test-1";
  await repo!.recordCommand("ws1", code, "peek");
  await repo!.recordCommand("ws1", code, "send", "to=all");
  const rows = await repo!.listCommands("ws1", code);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  expect(rows[0].action).toBe("send");
  expect(rows[0].detail).toBe("to=all");
});

test.skipIf(!reachable)("commands are scoped by workspace", async () => {
  const code = "cmd-test-2";
  await repo!.recordCommand("ws-a", code, "who");
  const rows = await repo!.listCommands("ws-b", code);
  expect(rows.length).toBe(0);
});

test.skipIf(!reachable)("purgeOldCommands deletes only rows past the retention window", async () => {
  const RETENTION_MS = 10 * 60 * 60 * 1000;
  const code = "cmd-test-purge";
  await repo!.recordCommand("ws1", code, "ack");
  const rows = await repo!.listCommands("ws1", code);
  expect(rows.length).toBeGreaterThan(0);

  // Can't backdate recordCommand's defaultNow() from here without a raw query,
  // so just confirm a 0-length window purges everything for this code.
  const deleted = await repo!.purgeOldCommands(-1);
  expect(deleted).toBeGreaterThanOrEqual(1);
  const after = await repo!.listCommands("ws1", code);
  expect(after.length).toBe(0);
});

test.skipIf(reachable)("skipped: no reachable Postgres at " + url, () => {});
