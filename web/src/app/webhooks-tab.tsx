"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, XIcon } from "./icons";

interface Webhook {
  id: string;
  url: string;
  events: string[];
}

export function WebhooksTab({ workspace, canWrite }: { workspace: string; canWrite: boolean }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newUrl, setNewUrl] = useState("");

  const apiUrl = useCallback(
    (path: string) => `/api/intercom/${path}${path.includes("?") ? "&" : "?"}workspace=${encodeURIComponent(workspace)}`,
    [workspace],
  );

  const fetchWebhooks = useCallback(async () => {
    const res = await fetch(apiUrl("webhooks"));
    if (!res.ok) return;
    const { webhooks: list } = (await res.json()) as { webhooks: Webhook[] };
    setWebhooks(list);
  }, [apiUrl]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const url = newUrl.trim();
    if (!url) return;
    await fetch(apiUrl("webhooks"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, events: ["broadcast"] }),
    });
    setNewUrl("");
    fetchWebhooks();
  }

  async function handleDelete(id: string) {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    await fetch(apiUrl(`webhooks/${id}`), { method: "DELETE" });
  }

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0 }}>Webhooks</h3>
      <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
        Reçois un appel HTTP à chaque broadcast (événement <code>broadcast</code>).
      </p>

      {canWrite && (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="https://votre-service.com/webhook"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            <PlusIcon size={14} />
            Ajouter
          </button>
        </form>
      )}

      {webhooks.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {webhooks.map((wh) => (
            <div key={wh.id} className="card elev-sm" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, fontFamily: "monospace" }}>{wh.url}</span>
                <span className="tag tag-accent" style={{ width: "fit-content" }}>
                  broadcast
                </span>
              </div>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ minWidth: 44, minHeight: 44 }}
                  onClick={() => handleDelete(wh.id)}
                  aria-label={`Supprimer le webhook ${wh.url}`}
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">Aucun webhook configuré. Ajoute une URL pour recevoir les broadcasts.</p>
      )}
    </div>
  );
}
