import { randomBytes } from "node:crypto";
import { valkey } from "./client.js";

export async function issueToken(workspace: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await valkey.set(`token:${token}`, workspace);
  return token;
}

export async function revokeToken(token: string): Promise<void> {
  await valkey.del(`token:${token}`);
}

export async function resolveToken(token: string): Promise<string | null> {
  return valkey.get(`token:${token}`);
}
