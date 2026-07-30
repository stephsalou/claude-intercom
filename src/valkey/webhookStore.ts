import { randomBytes } from "node:crypto";
import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";

export interface Webhook {
  id: string;
  url: string;
  events: string[];
}

export async function registerWebhook(workspace: string, url: string, events: string[]): Promise<Webhook> {
  assertSafeId(workspace, "workspace");
  const webhook: Webhook = { id: randomBytes(6).toString("hex"), url, events };
  await valkey.hset(`webhooks:${workspace}`, webhook.id, JSON.stringify(webhook));
  return webhook;
}

export async function listWebhooks(workspace: string, event?: string): Promise<Webhook[]> {
  assertSafeId(workspace, "workspace");
  const raw = await valkey.hvals(`webhooks:${workspace}`);
  const hooks: Webhook[] = raw.map((v) => JSON.parse(v)).filter(Boolean);
  return event ? hooks.filter((h) => h.events.includes(event)) : hooks;
}

export async function deleteWebhook(workspace: string, id: string): Promise<boolean> {
  assertSafeId(workspace, "workspace");
  assertSafeId(id, "webhook id");
  const deleted = await valkey.hdel(`webhooks:${workspace}`, id);
  return deleted === 1;
}
