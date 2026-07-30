import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { users, workspaceAccess } from "./schema";

export type Role = "admin" | "membre" | "lecture";

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

export async function getMemberRole(userId: number, workspace: string): Promise<Role | null> {
  const rows = await db
    .select({ role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspace, workspace)))
    .limit(1);
  return (rows[0]?.role as Role) ?? null;
}

export async function getWorkspaceMembers(workspace: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      role: workspaceAccess.role,
    })
    .from(workspaceAccess)
    .innerJoin(users, eq(users.id, workspaceAccess.userId))
    .where(eq(workspaceAccess.workspace, workspace));
}

export async function findOrCreateUser(username: string, passwordHash: string) {
  const existing = await getUserByUsername(username);
  if (existing) return { user: existing, created: false };
  const [user] = await db.insert(users).values({ username, passwordHash }).returning();
  return { user, created: true };
}

export async function grantWorkspaceAccess(
  userId: number,
  workspace: string,
  token: string,
  role: Role,
): Promise<void> {
  await db
    .insert(workspaceAccess)
    .values({ userId, workspace, token, role })
    .onConflictDoUpdate({
      target: [workspaceAccess.userId, workspaceAccess.workspace],
      set: { role },
    });
}

export async function updateMemberRole(userId: number, workspace: string, role: Role): Promise<void> {
  await db
    .update(workspaceAccess)
    .set({ role })
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspace, workspace)));
}

export async function removeMemberAccess(userId: number, workspace: string): Promise<void> {
  await db
    .delete(workspaceAccess)
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspace, workspace)));
}
