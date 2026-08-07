import { test, expect } from "bun:test";
import { Redis } from "iovalkey";

const url = process.env.VALKEY_URL ?? "redis://localhost:6379";
const probe = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
const reachable = await probe
  .connect()
  .then(() => true)
  .catch(() => false);
probe.disconnect();

const auth = reachable ? await import("./auth.ts") : null;
const tokenStore = reachable ? await import("../valkey/tokenStore.ts") : null;

test("extractBearerToken reads the Authorization header", async () => {
  const { extractBearerToken } = await import("./auth.ts");
  const req = new Request("http://x", { headers: { authorization: "Bearer abc123" } });
  expect(extractBearerToken(req)).toBe("abc123");
  expect(extractBearerToken(new Request("http://x"))).toBeNull();
});

test("extractBearerToken ignores a ?token= query param — credentials don't belong in URLs", async () => {
  const { extractBearerToken } = await import("./auth.ts");
  expect(extractBearerToken(new Request("http://x/events?code=aaaa&token=abc123"))).toBeNull();
  // and a query param can't override a real header
  const req = new Request("http://x/events?token=from-query", {
    headers: { authorization: "Bearer from-header" },
  });
  expect(extractBearerToken(req)).toBe("from-header");
});

test.skipIf(!reachable)("resolveWorkspace returns the workspace for a valid token", async () => {
  const token = await tokenStore!.issueToken("acme");
  expect(await auth!.resolveWorkspace(token)).toBe("acme");
});

test.skipIf(!reachable)("resolveWorkspace returns null for an unknown token", async () => {
  expect(await auth!.resolveWorkspace("not-a-real-token")).toBeNull();
});

test.skipIf(!reachable)("resolveWorkspace returns null for a null token", async () => {
  expect(await auth!.resolveWorkspace(null)).toBeNull();
});
