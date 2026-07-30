"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, getActiveWorkspace } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { issueWorkspaceToken } from "@/lib/tokens";
import {
  getMemberRole,
  findOrCreateUser,
  grantWorkspaceAccess,
  updateMemberRole,
  removeMemberAccess,
  type Role,
} from "@/db/queries";

export interface InviteState {
  error?: string;
  tempPassword?: string;
}

async function requireAdmin(): Promise<{ workspace: string } | { error: string }> {
  const session = await getSession();
  const workspace = await getActiveWorkspace();
  if (!session || !workspace) return { error: "Session invalide." };
  const role = await getMemberRole(session.userId, workspace);
  if (role !== "admin") return { error: "Seul un administrateur peut gérer les utilisateurs." };
  return { workspace };
}

export async function inviteMember(
  _prevState: InviteState | undefined,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "membre") as Role;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Saisis une adresse e-mail valide." };
  }

  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  // New accounts get a random temp password shown once to the inviting admin to
  // relay out-of-band (there's no email delivery in this deployment).
  const tempPassword = randomBytes(9).toString("base64url");
  const { user, created } = await findOrCreateUser(email, await hashPassword(tempPassword));

  const token = await issueWorkspaceToken(admin.workspace);
  await grantWorkspaceAccess(user.id, admin.workspace, token, role);
  revalidatePath("/");
  return created ? { tempPassword } : {};
}

export async function changeMemberRole(userId: number, role: Role): Promise<void> {
  const admin = await requireAdmin();
  if ("error" in admin) return;
  await updateMemberRole(userId, admin.workspace, role);
  revalidatePath("/");
}

export async function removeMember(userId: number): Promise<void> {
  const admin = await requireAdmin();
  if ("error" in admin) return;
  await removeMemberAccess(userId, admin.workspace);
  revalidatePath("/");
}
