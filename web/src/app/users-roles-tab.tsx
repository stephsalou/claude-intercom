"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { inviteMember, changeMemberRole, removeMember, type InviteState } from "@/actions/members";
import { PlusIcon, XIcon } from "./icons";

interface Member {
  userId: number;
  username: string;
  role: "admin" | "membre" | "lecture";
}

const ROLE_DEFS: Record<Member["role"], { label: string; description: string }> = {
  admin: { label: "Administrateur", description: "Gère les workspaces, les webhooks et les rôles des autres utilisateurs." },
  membre: { label: "Membre", description: "Voit le flux, diffuse et répond aux agents. Ne peut pas gérer les utilisateurs." },
  lecture: { label: "Lecture seule", description: "Consulte les agents et les messages, sans pouvoir en envoyer." },
};

const ROLE_OPTIONS = Object.entries(ROLE_DEFS) as [Member["role"], (typeof ROLE_DEFS)[Member["role"]]][];

export function UsersRolesTab({
  workspace,
  isAdmin,
  currentUsername,
}: {
  workspace: string;
  isAdmin: boolean;
  currentUsername: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [newRole, setNewRole] = useState<Member["role"]>("membre");
  const [inviteState, inviteAction, invitePending] = useActionState<InviteState | undefined, FormData>(
    inviteMember,
    undefined,
  );

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/members?workspace=${encodeURIComponent(workspace)}`);
    if (!res.ok) return;
    const { members: list } = (await res.json()) as { members: Member[] };
    setMembers(list);
  }, [workspace]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (!invitePending) fetchMembers();
  }, [invitePending, fetchMembers]);

  async function handleRoleChange(userId: number, role: Member["role"]) {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    await changeMemberRole(userId, role);
  }

  async function handleRemove(userId: number) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    await removeMember(userId);
  }

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h3 style={{ margin: "0 0 4px" }}>Utilisateurs &amp; rôles</h3>
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          Chaque rôle définit ce qu&apos;un membre peut voir et faire sur ce workspace.
        </p>
      </div>

      {isAdmin && (
        <div className="card elev-sm" style={{ gap: 10 }}>
          <form action={inviteAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" name="email" placeholder="email@exemple.com" style={{ flex: 1, minWidth: 200 }} />
            <select
              className="input"
              name="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Member["role"])}
              style={{ width: "auto", minWidth: 150 }}
              aria-label="Rôle du nouvel utilisateur"
            >
              {ROLE_OPTIONS.map(([id, def]) => (
                <option key={id} value={id}>
                  {def.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" disabled={invitePending}>
              <PlusIcon size={14} />
              Inviter
            </button>
          </form>
          {inviteState?.error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>
              {inviteState.error}
            </p>
          )}
          {inviteState?.tempPassword && (
            <p style={{ margin: 0, fontSize: 13 }}>
              Compte créé — mot de passe temporaire à transmettre :{" "}
              <code style={{ fontFamily: "monospace" }}>{inviteState.tempPassword}</code>
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {members.map((m) => {
          const isSelf = m.username === currentUsername;
          return (
            <div
              key={m.userId}
              className="card elev-sm"
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--color-neutral-200)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                    fontFamily: "var(--font-heading)",
                    fontSize: 14,
                  }}
                >
                  {m.username[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.username}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {ROLE_DEFS[m.role].label} · {ROLE_DEFS[m.role].description}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  className="input"
                  style={{ width: "auto", minWidth: 150 }}
                  value={m.role}
                  disabled={!isAdmin || isSelf}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value as Member["role"])}
                  aria-label={`Rôle de ${m.username}`}
                >
                  {ROLE_OPTIONS.map(([id, def]) => (
                    <option key={id} value={id}>
                      {def.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ minWidth: 44, minHeight: 44 }}
                  disabled={!isAdmin || isSelf}
                  onClick={() => handleRemove(m.userId)}
                  aria-label={`Retirer ${m.username}`}
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card elev-sm" style={{ gap: 8 }}>
        <span className="text-muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Permissions par rôle
        </span>
        {ROLE_OPTIONS.map(([id, def]) => (
          <div key={id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span className="tag tag-accent" style={{ width: "fit-content", flex: "none" }}>
              {def.label}
            </span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {def.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
