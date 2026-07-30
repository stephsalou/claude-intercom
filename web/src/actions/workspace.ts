"use server";

import { revalidatePath } from "next/cache";
import { setActiveWorkspace } from "@/lib/session";

export async function switchWorkspace(formData: FormData): Promise<void> {
  const workspace = String(formData.get("workspace") ?? "");
  if (!workspace) return;
  await setActiveWorkspace(workspace);
  revalidatePath("/");
}
