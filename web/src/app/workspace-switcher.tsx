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

  return (
    <form ref={formRef} action={switchWorkspace}>
      <select
        name="workspace"
        defaultValue={activeWorkspace}
        onChange={() => formRef.current?.requestSubmit()}
        className="input"
        style={{ width: "auto", minWidth: 170, fontFamily: "var(--font-heading)", fontSize: 13 }}
        aria-label="Workspace actif"
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
