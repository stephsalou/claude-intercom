"use server";

import { redirect } from "next/navigation";
import { getUserByUsername } from "@/db/queries";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Renseigne ton identifiant et ton mot de passe pour continuer." };
  }

  const user = await getUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }

  await createSession(user.id, user.username);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
