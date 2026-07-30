const tokens = (process.env.API_TOKENS ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

export function isValidToken(token: string | null): boolean {
  if (!token) return false;
  return tokens.includes(token);
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}
