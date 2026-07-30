import { redirect } from "next/navigation";
import { getSession, getActiveWorkspace } from "@/lib/session";
import { getWorkspacesForUser, getMemberRole } from "@/db/queries";
import { AppShell } from "./app-shell";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaces = (await getWorkspacesForUser(session.userId)).map((w) => w.workspace);
  const hasWorkspace = workspaces.length > 0;

  // Falls back to the first workspace without persisting a cookie — cookies can only
  // be written from a Server Action or Route Handler, not during a page render. The
  // switcher (a real Server Action) persists the choice once the user picks one.
  const cookieWorkspace = await getActiveWorkspace();
  const activeWorkspace = hasWorkspace
    ? cookieWorkspace && workspaces.includes(cookieWorkspace)
      ? cookieWorkspace
      : workspaces[0]
    : null;

  const role = activeWorkspace ? await getMemberRole(session.userId, activeWorkspace) : null;

  return (
    <AppShell
      username={session.username}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      role={role}
    />
  );
}
