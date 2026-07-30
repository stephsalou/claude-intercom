import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const tokenStore = reachable ? await import("./tokenStore.ts") : null;

test.skipIf(!reachable)("issued token resolves to its workspace", async () => {
  const token = await tokenStore!.issueToken("acme");
  expect(await tokenStore!.resolveToken(token)).toBe("acme");
});

test.skipIf(!reachable)("revoked token no longer resolves", async () => {
  const token = await tokenStore!.issueToken("acme");
  await tokenStore!.revokeToken(token);
  expect(await tokenStore!.resolveToken(token)).toBeNull();
});

test.skipIf(!reachable)("unknown token resolves to null", async () => {
  expect(await tokenStore!.resolveToken("not-a-real-token")).toBeNull();
});

test.skipIf(!reachable)("two issued tokens are distinct", async () => {
  const a = await tokenStore!.issueToken("acme");
  const b = await tokenStore!.issueToken("acme");
  expect(a).not.toBe(b);
});

test.skipIf(reachable)("skipped: no reachable Valkey at " + url, () => {});
