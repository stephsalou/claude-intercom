import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";
import type { PresenceInfo } from "../store.js";

const TTL_SECONDS = 30;

export async function register(code: string, project: string): Promise<void> {
  assertSafeId(code, "agent code");
  const info: PresenceInfo = {
    code,
    pid: 0,
    project,
    started: new Date().toISOString(),
  };
  await valkey.set(`presence:${code}`, JSON.stringify(info), "EX", TTL_SECONDS);
}

export async function heartbeat(code: string): Promise<boolean> {
  assertSafeId(code, "agent code");
  const result = await valkey.expire(`presence:${code}`, TTL_SECONDS);
  return result === 1;
}

export async function unregister(code: string): Promise<void> {
  assertSafeId(code, "agent code");
  await valkey.del(`presence:${code}`);
}

export async function listAgents(projectFilter?: string): Promise<PresenceInfo[]> {
  // ponytail: KEYS blocks on large keyspaces; switch to SCAN if presence keys grow past ~thousands
  const keys = await valkey.keys("presence:*");
  if (keys.length === 0) return [];
  const values = await valkey.mget(...keys);
  const agents: PresenceInfo[] = [];
  for (const value of values) {
    if (!value) continue;
    try {
      const info: PresenceInfo = JSON.parse(value);
      if (!projectFilter || info.project === projectFilter) {
        agents.push(info);
      }
    } catch {}
  }
  return agents;
}
