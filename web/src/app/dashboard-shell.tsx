import { logout } from "@/actions/auth";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { DashboardClient } from "./dashboard-client";

export function DashboardShell({
  username,
  workspaces,
  activeWorkspace,
}: {
  username: string;
  workspaces: string[];
  activeWorkspace: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-lg">
            📡
          </span>
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{username}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-[transform,colors] hover:bg-surface-hover active:scale-[0.96]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <DashboardClient key={activeWorkspace} workspace={activeWorkspace} />
    </div>
  );
}
