import "server-only";
import { randomBytes } from "node:crypto";
import { Redis } from "iovalkey";

const valkey = new Redis(process.env.VALKEY_URL ?? "redis://localhost:6379");

export async function issueWorkspaceToken(workspace: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await valkey.set(`token:${token}`, workspace);
  return token;
}
