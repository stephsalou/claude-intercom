import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { users, workspaceAccess } from "./schema";

export async function getUserByUsername(username: string) {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function getWorkspacesForUser(userId: number) {
  return db
    .select({ workspace: workspaceAccess.workspace })
    .from(workspaceAccess)
    .where(eq(workspaceAccess.userId, userId));
}

export async function getWorkspaceToken(userId: number, workspace: string): Promise<string | null> {
  const rows = await db
    .select({ token: workspaceAccess.token })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspace, workspace)))
    .limit(1);
  return rows[0]?.token ?? null;
}
