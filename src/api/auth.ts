import { resolveToken } from "../valkey/tokenStore.js";

export async function resolveWorkspace(token: string | null): Promise<string | null> {
  if (!token) return null;
  return resolveToken(token);
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}
