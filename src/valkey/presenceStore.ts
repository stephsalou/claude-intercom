import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";
import type { PresenceInfo } from "../store.js";

const TTL_SECONDS = 30;

export async function register(code: string, project: string, workspace: string): Promise<void> {
  assertSafeId(code, "agent code");
  assertSafeId(workspace, "workspace");
  const info: PresenceInfo = {
    code,
    pid: 0,
    project,
    started: new Date().toISOString(),
  };
  await valkey.set(`presence:${workspace}:${code}`, JSON.stringify(info), "EX", TTL_SECONDS);
}

export async function heartbeat(code: string, workspace: string, project?: string): Promise<boolean> {
  assertSafeId(code, "agent code");
  assertSafeId(workspace, "workspace");
  const result = await valkey.expire(`presence:${workspace}:${code}`, TTL_SECONDS);
  if (result === 1) return true;
  // Key already expired (e.g. a prolonged network outage outlasted the 30s TTL) — a
  // plain EXPIRE can never resurrect it, so this agent would stay invisible until its
  // process restarts. Re-register instead, if we know enough to.
  if (!project) return false;
  await register(code, project, workspace);
  return true;
}

export async function unregister(code: string, workspace: string): Promise<void> {
  assertSafeId(code, "agent code");
  assertSafeId(workspace, "workspace");
  await valkey.del(`presence:${workspace}:${code}`);
}

export async function listAgents(workspace: string, projectFilter?: string): Promise<PresenceInfo[]> {
  assertSafeId(workspace, "workspace");
  // ponytail: KEYS blocks on large keyspaces; switch to SCAN if presence keys grow past ~thousands
  const keys = await valkey.keys(`presence:${workspace}:*`);
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
