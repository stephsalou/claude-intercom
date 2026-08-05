import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "./client.js";
import { commandLog } from "./schema.js";

export interface CommandLogEntry {
  action: string;
  detail: string | null;
  timestamp: string;
}

export async function recordCommand(
  workspace: string,
  code: string,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await db.insert(commandLog).values({ workspace, code, action, detail: detail ?? null });
  } catch (err) {
    console.error("commandLogRepo.recordCommand failed:", err);
  }
}

export async function listCommands(
  workspace: string,
  code: string,
  limit = 100,
): Promise<CommandLogEntry[]> {
  const rows = await db
    .select()
    .from(commandLog)
    .where(and(eq(commandLog.workspace, workspace), eq(commandLog.code, code)))
    .orderBy(desc(commandLog.timestamp))
    .limit(limit);
  return rows.map((r) => ({ action: r.action, detail: r.detail, timestamp: r.timestamp }));
}

// Same retention floor as message history (historyRepo.ts) — kept as one shared
// constant there (messageStore.RETENTION_MS) rather than duplicated here.
export async function purgeOldCommands(retentionMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionMs).toISOString();
  const deleted = await db.delete(commandLog).where(lt(commandLog.timestamp, cutoff)).returning({ id: commandLog.id });
  return deleted.length;
}
