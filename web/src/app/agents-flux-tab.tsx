"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CopyIcon, SendIcon, ReplyIcon, CheckIcon } from "./icons";

interface Agent {
  code: string;
  project: string;
  started: string;
}

interface IntercomMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
  reply_to: string | null;
}

function relativeUptime(started: string): string {
  const ms = Date.now() - new Date(started).getTime();
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}j`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function AgentsFluxTab({ workspace, canWrite }: { workspace: string; canWrite: boolean }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<IntercomMessage[]>([]);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [composeTarget, setComposeTarget] = useState("all");
  const [broadcastText, setBroadcastText] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState(false);
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());

  const apiUrl = useCallback((path: string) => `/api/intercom/${path}${path.includes("?") ? "&" : "?"}workspace=${encodeURIComponent(workspace)}`, [workspace]);

  const addMessage = useCallback((msg: IntercomMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev].slice(0, 200)));
  }, []);

  const fetchWho = useCallback(async () => {
    const res = await fetch(apiUrl("who?scope=all"));
    if (!res.ok) return;
    const { agents: list } = (await res.json()) as { agents: Agent[] };
    setAgents(list);
  }, [apiUrl]);

  useEffect(() => {
    fetchWho();
    const interval = setInterval(fetchWho, 5000);
    return () => clearInterval(interval);
  }, [fetchWho]);

  useEffect(() => {
    const current = sourcesRef.current;
    const codes = new Set(agents.map((a) => a.code));

    for (const [code, source] of current) {
      if (!codes.has(code)) {
        source.close();
        current.delete(code);
      }
    }

    for (const code of codes) {
      if (current.has(code)) continue;
      const source = new EventSource(apiUrl(`events?code=${encodeURIComponent(code)}`));
      source.onmessage = async (event) => {
        try {
          const { messageId } = JSON.parse(event.data) as { messageId: string };
          const res = await fetch(apiUrl(`peek?code=${encodeURIComponent(code)}`));
          if (!res.ok) return;
          const { messages: inbox } = (await res.json()) as { messages: IntercomMessage[] };
          const found = inbox.find((m) => m.id === messageId);
          if (found) {
            addMessage(found);
            setAnnouncement(`Nouveau message de ${found.from}`);
          }
        } catch {
          // malformed SSE payload — ignore, next event will retry
        }
      };
      current.set(code, source);
    }
  }, [agents, addMessage, apiUrl]);

  useEffect(() => {
    const sources = sourcesRef.current;
    return () => {
      for (const source of sources.values()) source.close();
      sources.clear();
    };
  }, []);

  async function handleAck(messageId: string, code: string) {
    setAckedIds((prev) => new Set(prev).add(messageId));
    await fetch(apiUrl("ack"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, message_id: messageId }),
    }).catch(() => {});
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const text = broadcastText.trim();
    if (!text) return;
    const target = composeTarget;
    await fetch(apiUrl("send"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "dashboard", to: target, message: text, project: workspace }),
    });
    setBroadcastText("");
    setAnnouncement(target === "all" ? "Message diffusé à tous les agents" : `Message envoyé à ${target}`);
  }

  async function handleSendReply(msg: IntercomMessage) {
    const text = replyText.trim();
    if (!text) return;
    await fetch(apiUrl("reply"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: msg.to, message_id: msg.id, message: text }),
    });
    setAckedIds((prev) => new Set(prev).add(msg.id));
    setReplyingId(null);
    setReplyText("");
    setAnnouncement(`Réponse envoyée à ${msg.from}`);
  }

  async function handleCopySnippet() {
    const apiOrigin = process.env.NEXT_PUBLIC_INTERCOM_API_URL ?? "https://intercom.example.com";
    const snippet = `INTERCOM_API_URL=${apiOrigin}\nINTERCOM_API_TOKEN=<votre_token>`;
    if (navigator.clipboard) await navigator.clipboard.writeText(snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const composePlaceholder = composeTarget === "all" ? "Diffuser un message à tous les agents…" : `Écrire à ${composeTarget}…`;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 280px", maxWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ margin: 0 }}>Agents actifs ({agents.length})</h3>

        {agents.length > 0 ? (
          agents.map((agent) => (
            <div
              key={agent.code}
              className="card elev-sm"
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "var(--color-accent-2)",
                    animation: "pulse 2s ease-in-out infinite",
                    flex: "none",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                    {agent.code} <span className="sr-only">(en ligne)</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {agent.project}
                  </div>
                </div>
              </div>
              <span className="text-muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                {relativeUptime(agent.started)}
              </span>
            </div>
          ))
        ) : (
          <div className="card elev-sm" style={{ gap: 10, padding: 18 }}>
            <p style={{ margin: 0, fontSize: 13 }}>Aucun agent connecté sur {workspace} pour l&apos;instant.</p>
            <div
              style={{
                background: "var(--color-neutral-100)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
                fontFamily: "monospace",
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span>INTERCOM_API_URL={process.env.NEXT_PUBLIC_INTERCOM_API_URL ?? "https://intercom.example.com"}</span>
              <span>INTERCOM_API_TOKEN=&lt;votre_token&gt;</span>
            </div>
            <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={handleCopySnippet}>
              <CopyIcon size={14} />
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: "2 1 420px", minWidth: 320, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
        <h3 style={{ margin: 0 }}>Flux en direct</h3>

        {canWrite && (
          <form onSubmit={handleSendBroadcast} style={{ display: "flex", gap: 8 }}>
            <select
              className="input"
              style={{ width: "auto", minWidth: 160 }}
              value={composeTarget}
              onChange={(e) => setComposeTarget(e.target.value)}
              aria-label="Destinataire"
            >
              <option value="all">Tous les agents</option>
              {agents.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder={composePlaceholder}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-icon"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label={composeTarget === "all" ? "Diffuser le message" : `Envoyer à ${composeTarget}`}
            >
              <SendIcon />
            </button>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflow: "auto", paddingRight: 4 }}>
          {messages.length > 0 ? (
            messages.map((msg) => {
              const acked = ackedIds.has(msg.id);
              return (
                <div key={msg.id} className="card elev-sm" style={{ animation: "rowIn .25s ease-out", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {msg.from} → {msg.to}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14 }}>{msg.message}</p>
                  {canWrite && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => {
                          setReplyingId(replyingId === msg.id ? null : msg.id);
                          setReplyText("");
                        }}
                      >
                        <ReplyIcon size={13} />
                        Répondre
                      </button>
                      <button
                        type="button"
                        className={`btn ${acked ? "btn-secondary" : "btn-ghost"}`}
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleAck(msg.id, msg.to)}
                        disabled={acked}
                      >
                        <CheckIcon size={13} />
                        {acked ? "Acquitté" : "Acquitter"}
                      </button>
                    </div>
                  )}
                  {replyingId === msg.id && (
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <input
                        className="input"
                        placeholder={`Répondre à ${msg.from}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-primary" onClick={() => handleSendReply(msg)}>
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-muted" style={{ fontSize: 14 }}>
              Les messages entre agents sur {workspace} apparaîtront ici en direct.
            </p>
          )}
        </div>

        <div
          role="status"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            bottom: 0,
          }}
        >
          {announcement}
        </div>
      </div>
    </div>
  );
}
