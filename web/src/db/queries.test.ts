import { test, expect } from "bun:test";
import postgres from "postgres";

// Requires a reachable Postgres (DATABASE_URL, default localhost:5432). Run
// `docker compose up -d postgres` before running, like src/valkey/store.test.ts.
const url = process.env.DATABASE_URL ?? "postgres://intercom:intercom@localhost:5432/intercom";
const probe = postgres(url, { connect_timeout: 2 });
const reachable = await probe`select 1`
  .then(() => true)
  .catch(() => false);
await probe.end().catch(() => {});

const queries = reachable ? await import("./queries.ts") : null;

test.skipIf(!reachable)("isLastAdmin: true for the sole admin, false otherwise", async () => {
  const ws = `wq-${Date.now()}`;
  const { user: admin } = await queries!.findOrCreateUser(`admin-${ws}`, "x");
  const { user: member } = await queries!.findOrCreateUser(`member-${ws}`, "x");
  await queries!.grantWorkspaceAccess(admin.id, ws, "tok-a", "admin");
  await queries!.grantWorkspaceAccess(member.id, ws, "tok-b", "membre");

  expect(await queries!.isLastAdmin(admin.id, ws)).toBe(true);
  expect(await queries!.isLastAdmin(member.id, ws)).toBe(false);

  await queries!.grantWorkspaceAccess(member.id, ws, "tok-b", "admin");
  expect(await queries!.isLastAdmin(admin.id, ws)).toBe(false);

  await queries!.removeMemberAccess(admin.id, ws);
  await queries!.removeMemberAccess(member.id, ws);
});

test.skipIf(reachable)("skipped: no reachable Postgres at " + url, () => {});
