"use client";

import { useRef } from "react";
import { switchWorkspace } from "@/actions/workspace";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
}: {
  workspaces: string[];
  activeWorkspace: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (workspaces.length <= 1) {
    return <span className="text-sm font-medium">{activeWorkspace}</span>;
  }

  return (
    <form ref={formRef} action={switchWorkspace}>
      <select
        name="workspace"
        defaultValue={activeWorkspace}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Active workspace"
      >
        {workspaces.map((ws) => (
          <option key={ws} value={ws}>
            {ws}
          </option>
        ))}
      </select>
    </form>
  );
}
