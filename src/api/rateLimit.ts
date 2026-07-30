import { valkey } from "../valkey/client.js";
import { assertSafeId } from "../safeId.js";

const DEFAULT_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);

export async function isRateLimited(workspace: string, limit = DEFAULT_LIMIT): Promise<boolean> {
  assertSafeId(workspace, "workspace");
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const key = `ratelimit:${workspace}:${minuteBucket}`;
  const count = await valkey.incr(key);
  if (count === 1) await valkey.expire(key, 60);
  return count > limit;
}
