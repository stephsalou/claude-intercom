import { resolveToken } from "../valkey/tokenStore.js";

export async function resolveWorkspace(token: string | null): Promise<string | null> {
  if (!token) return null;
  return resolveToken(token);
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (match) return match[1];
  // EventSource can't set custom headers, so SSE connections pass the token in
  // the query string instead.
  return new URL(req.url).searchParams.get("token");
}
