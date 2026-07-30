import { redirect } from "next/navigation";
import { getSession, getActiveWorkspace } from "@/lib/session";
import { getWorkspacesForUser } from "@/db/queries";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaces = (await getWorkspacesForUser(session.userId)).map((w) => w.workspace);

  if (workspaces.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-medium">No workspace access yet</p>
          <p className="mt-1 text-sm text-muted text-pretty">
            Ask an operator to grant your account access to a workspace.
          </p>
        </div>
      </main>
    );
  }

  // Falls back to the first workspace without persisting a cookie — cookies can only
  // be written from a Server Action or Route Handler, not during a page render. The
  // switcher (a real Server Action) persists the choice once the user picks one.
  const cookieWorkspace = await getActiveWorkspace();
  const activeWorkspace =
    cookieWorkspace && workspaces.includes(cookieWorkspace) ? cookieWorkspace : workspaces[0];

  return (
    <DashboardShell
      username={session.username}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
    />
  );
}
