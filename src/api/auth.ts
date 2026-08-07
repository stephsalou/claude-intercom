import { resolveToken } from "../valkey/tokenStore.js";

export async function resolveWorkspace(token: string | null): Promise<string | null> {
  if (!token) return null;
  return resolveToken(token);
}

// Header only. There used to be a ?token= fallback "for EventSource", but the sole
// caller was the old static dashboard (deleted) — the watcher and the Next.js proxy
// both send a header. It applied to every route, not just /events, and put live
// credentials in URLs, which land in access logs and referrers.
export function extractBearerToken(req: Request): string | null {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}
