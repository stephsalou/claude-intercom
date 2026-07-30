import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at an isolated temp HOME before importing it (module-level
// paths are computed at import time, so this must run first).
process.env.HOME = mkdtempSync(join(tmpdir(), "intercom-test-"));
const store = await import("./store.ts");

test("send/peek/ack round trip", async () => {
  await store.register("aaaa", process.pid, "demo");
  await store.register("bbbb", process.pid, "demo");
  const msg = await store.sendMessage("aaaa", "bbbb", "hello");

  const inbox = await store.peekMessages("bbbb");
  expect(inbox.length).toBe(1);
  expect(inbox[0].message).toBe("hello");

  expect(await store.ackMessage("bbbb", msg.id)).toBe(true);
  expect((await store.peekMessages("bbbb")).length).toBe(0);
});

test("broadcast to all excludes the sender", async () => {
  await store.sendMessage("aaaa", "all", "broadcast", undefined, "demo");
  const inboxB = await store.peekMessages("bbbb");
  expect(inboxB.some((m) => m.message === "broadcast")).toBe(true);
  const inboxA = await store.peekMessages("aaaa");
  expect(inboxA.some((m) => m.message === "broadcast")).toBe(false);
});

test("rejects path traversal in recipient code", async () => {
  await expect(
    store.sendMessage("aaaa", "../../evil", "x"),
  ).rejects.toThrow();
});

test("rejects path traversal in sender code", async () => {
  await expect(
    store.sendMessage("../../evil", "aaaa", "x"),
  ).rejects.toThrow();
});

test("rejects path traversal in message id on ack", async () => {
  await expect(store.ackMessage("aaaa", "../../evil")).rejects.toThrow();
});

test("rejects path traversal in code on peek", async () => {
  await expect(store.peekMessages("../../evil")).rejects.toThrow();
});

test("rejects path traversal in code on register", async () => {
  await expect(
    store.register("../../evil", process.pid, "demo"),
  ).rejects.toThrow();
});
