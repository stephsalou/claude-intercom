"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Send, Check, Users } from "lucide-react";

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
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DashboardClient({ workspace }: { workspace: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<IntercomMessage[]>([]);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());

  const addMessage = useCallback((msg: IntercomMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev].slice(0, 200)));
    setAnnouncement(`New message from ${msg.from} to ${msg.to}`);
  }, []);

  const fetchWho = useCallback(async () => {
    const res = await fetch(`/api/intercom/who?scope=all&workspace=${encodeURIComponent(workspace)}`);
    if (!res.ok) return;
    const { agents: list } = (await res.json()) as { agents: Agent[] };
    setAgents(list);
  }, [workspace]);

  useEffect(() => {
    fetchWho();
    const interval = setInterval(fetchWho, 5000);
    return () => clearInterval(interval);
  }, [fetchWho, workspace]);

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
      const source = new EventSource(
        `/api/intercom/events?code=${encodeURIComponent(code)}&workspace=${encodeURIComponent(workspace)}`,
      );
      source.onmessage = async (event) => {
        try {
          const { messageId } = JSON.parse(event.data) as { messageId: string };
          const res = await fetch(
            `/api/intercom/peek?code=${encodeURIComponent(code)}&workspace=${encodeURIComponent(workspace)}`,
          );
          if (!res.ok) return;
          const { messages: inbox } = (await res.json()) as { messages: IntercomMessage[] };
          const found = inbox.find((m) => m.id === messageId);
          if (found) addMessage(found);
        } catch {
          // malformed SSE payload — ignore, next event will retry
        }
      };
      current.set(code, source);
    }

    return () => {
      // effect re-runs on every agents change; full teardown happens on unmount
    };
  }, [agents, addMessage, workspace]);

  useEffect(() => {
    const sources = sourcesRef.current;
    return () => {
      for (const source of sources.values()) source.close();
      sources.clear();
    };
  }, []);

  async function handleAck(messageId: string, code: string) {
    setAckedIds((prev) => new Set(prev).add(messageId));
    await fetch(`/api/intercom/ack?workspace=${encodeURIComponent(workspace)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, message_id: messageId }),
    }).catch(() => {});
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setSending(true);
    try {
      await fetch(`/api/intercom/send?workspace=${encodeURIComponent(workspace)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "dashboard", to: "all", message, project: workspace }),
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-[280px_1fr]">
      <section aria-labelledby="agents-heading" className="flex flex-col gap-3">
        <h2
          id="agents-heading"
          className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
        >
          <Users size={14} strokeWidth={2} aria-hidden />
          Active agents ({agents.length})
        </h2>

        {agents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted text-pretty">
            No agents connected on <span className="font-medium">{workspace}</span> right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agents.map((agent) => (
              <li
                key={agent.code}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium">
                      {agent.code} <span className="sr-only">(online)</span>
                    </p>
                    <p className="truncate text-xs text-muted">{agent.project}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  {relativeUptime(agent.started)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="feed-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2
            id="feed-heading"
            className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
          >
            <Radio size={14} strokeWidth={2} aria-hidden />
            Live feed
          </h2>
        </div>

        <form onSubmit={handleBroadcast} className="flex gap-2">
          <label htmlFor="broadcast" className="sr-only">
            Broadcast a message to every agent
          </label>
          <input
            id="broadcast"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Broadcast a message to every agent…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send broadcast"
            className="flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-accent-foreground transition-[transform,opacity] active:scale-[0.96] disabled:opacity-50"
          >
            <Send size={16} strokeWidth={2} aria-hidden />
          </button>
        </form>

        <p role="status" className="sr-only">
          {announcement}
        </p>

        <ul className="flex flex-col gap-2">
          {messages.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted text-pretty">
              Messages between agents on <span className="font-medium">{workspace}</span> will appear here
              live.
            </li>
          )}
          {messages.map((msg) => {
            const acked = ackedIds.has(msg.id);
            return (
              <li
                key={msg.id}
                className="animate-message-enter flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
                    <span className="font-mono font-medium text-foreground">{msg.from}</span>
                    <span aria-hidden>→</span>
                    <span className="font-mono">{msg.to}</span>
                    <span className="font-mono tabular-nums">{formatTime(msg.timestamp)}</span>
                  </p>
                  <p className="mt-1 text-sm text-pretty break-words">{msg.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAck(msg.id, msg.to)}
                  disabled={acked}
                  aria-label={acked ? "Acknowledged" : "Acknowledge message"}
                  className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2.5 text-muted transition-[transform,colors] hover:bg-surface-hover active:scale-[0.96] disabled:text-success disabled:opacity-100"
                >
                  <Check size={14} strokeWidth={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
