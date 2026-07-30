"use client";

import { useState } from "react";
import { logout } from "@/actions/auth";
import type { Role } from "@/db/queries";
import { LogoMark, LogoutIcon, LockIcon } from "./icons";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { AgentsFluxTab } from "./agents-flux-tab";
import { UsersRolesTab } from "./users-roles-tab";
import { WebhooksTab } from "./webhooks-tab";

type Tab = "agents" | "users" | "webhooks";

export function AppShell({
  username,
  workspaces,
  activeWorkspace,
  role,
}: {
  username: string;
  workspaces: string[];
  activeWorkspace: string | null;
  role: Role | null;
}) {
  const [tab, setTab] = useState<Tab>("agents");
  const hasWorkspace = activeWorkspace !== null;

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          padding: "14px 28px",
          background: "color-mix(in srgb, var(--color-bg) 90%, transparent)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <LogoMark size={16} />
          </div>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>Intercom</span>
        </div>

        {hasWorkspace && <WorkspaceSwitcher workspaces={workspaces} activeWorkspace={activeWorkspace} />}

        {hasWorkspace && (
          <div className="seg" style={{ fontSize: 13 }}>
            <label className="seg-opt">
              <input type="radio" name="viewtab" checked={tab === "agents"} onChange={() => setTab("agents")} />
              Agents &amp; flux
            </label>
            <label className="seg-opt">
              <input type="radio" name="viewtab" checked={tab === "users"} onChange={() => setTab("users")} />
              Utilisateurs
            </label>
            <label className="seg-opt">
              <input type="radio" name="viewtab" checked={tab === "webhooks"} onChange={() => setTab("webhooks")} />
              Webhooks
            </label>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <span className="text-muted" style={{ fontSize: 13 }}>
          {username}
        </span>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary">
            <LogoutIcon />
            Se déconnecter
          </button>
        </form>
      </div>

      {!hasWorkspace && (
        <div
          style={{
            maxWidth: 520,
            margin: "100px auto 0",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: "0 24px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--color-neutral-200)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockIcon size={22} color="var(--color-text)" />
          </div>
          <h2 style={{ margin: 0 }}>Aucun accès à un workspace</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Ton compte n&apos;est rattaché à aucun workspace pour l&apos;instant. Demande à un administrateur de
            t&apos;accorder l&apos;accès à un workspace pour voir les agents et les messages.
          </p>
        </div>
      )}

      {hasWorkspace && (
        <div style={{ padding: 28 }}>
          {tab === "agents" && <AgentsFluxTab workspace={activeWorkspace} canWrite={role !== "lecture"} />}
          {tab === "users" && <UsersRolesTab workspace={activeWorkspace} isAdmin={role === "admin"} currentUsername={username} />}
          {tab === "webhooks" && <WebhooksTab workspace={activeWorkspace} canWrite={role !== "lecture"} />}
        </div>
      )}
    </div>
  );
}
