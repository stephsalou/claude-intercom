import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const webhookStore = reachable ? await import("./webhookStore.ts") : null;
const messages = reachable ? await import("./messageStore.ts") : null;
const presence = reachable ? await import("./presenceStore.ts") : null;
// Webhook registrations accumulate across runs (no TTL) — suffix workspace names
// per run so a previous run's dead-port webhooks don't pollute this one.
const runId = crypto.randomUUID().slice(0, 8);

test.skipIf(!reachable)("broadcast triggers a registered webhook", async () => {
  let received: any = null;
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      received = await req.json();
      return new Response("ok");
    },
  });

  try {
    const workspace = `ws-webhook-1-${runId}`;
    await webhookStore!.registerWebhook(workspace, `http://localhost:${server.port}/hook`, ["broadcast"]);
    await presence!.register("wa", "demo", workspace);
    await presence!.register("wb", "demo", workspace);

    await messages!.sendMessage(workspace, "wa", "all", "hello everyone", undefined, "demo");

    expect(received).not.toBeNull();
    expect(received.event).toBe("broadcast");
    expect(received.payload.from).toBe("wa");
  } finally {
    server.stop(true);
  }
});

test.skipIf(!reachable)("a down webhook does not prevent message delivery", async () => {
  const workspace = `ws-webhook-2-${runId}`;
  await webhookStore!.registerWebhook(workspace, "http://127.0.0.1:1/unreachable", ["broadcast"]);
  await presence!.register("wc", "demo", workspace);
  await presence!.register("wd", "demo", workspace);

  const msg = await messages!.sendMessage(workspace, "wc", "all", "still works", undefined, "demo");
  expect(msg).toBeTruthy();
  const inbox = await messages!.peekMessages(workspace, "wd");
  expect(inbox.some((m) => m.message === "still works")).toBe(true);
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
