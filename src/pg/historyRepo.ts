import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "./client.js";
import { messages } from "./schema.js";
import type { Message } from "../store.js";

export async function recordMessage(workspace: string, message: Message): Promise<void> {
  try {
    await db
      .insert(messages)
      .values({
        id: message.id,
        workspace,
        fromCode: message.from,
        toCode: message.to,
        message: message.message,
        timestamp: message.timestamp,
        replyTo: message.reply_to,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("historyRepo.recordMessage failed:", err);
  }
}

export async function markAcked(workspace: string, messageId: string): Promise<void> {
  try {
    await db
      .update(messages)
      .set({ ackedAt: new Date().toISOString() })
      .where(and(eq(messages.id, messageId), eq(messages.workspace, workspace)));
  } catch (err) {
    console.error("historyRepo.markAcked failed:", err);
  }
}

export async function history(
  workspace: string,
  code: string,
  since?: string,
  limit = 100,
): Promise<(Message & { acked_at: string | null })[]> {
  const conditions = [eq(messages.workspace, workspace), eq(messages.toCode, code)];
  if (since) conditions.push(gt(messages.timestamp, since));

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.timestamp))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    from: r.fromCode,
    to: r.toCode,
    message: r.message,
    timestamp: r.timestamp,
    reply_to: r.replyTo,
    acked_at: r.ackedAt,
  }));
}
