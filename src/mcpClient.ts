import type { PresenceInfo, Message } from "./store.js";

const API_URL = (process.env.INTERCOM_API_URL ?? "").replace(/\/$/, "");
const API_TOKEN = process.env.INTERCOM_API_TOKEN ?? "";

export const isRemote = Boolean(API_URL);

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${API_TOKEN}`,
  };
}

async function call(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: headers() });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status} on ${path}`);
  return body;
}

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

export async function register(code: string, _pid: number, project: string): Promise<void> {
  await call("/register", { method: "POST", body: JSON.stringify({ code, project }) });
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      call("/heartbeat", { method: "POST", body: JSON.stringify({ code }) }).catch(() => {});
    }, 15_000);
    heartbeatTimer.unref?.();
  }
}

export function unregisterSync(_code: string): void {
  // No synchronous network call on process exit — presence expires on its own
  // via the API's 30s TTL, so there is nothing that must happen right now.
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}

export async function listAgents(projectFilter?: string): Promise<PresenceInfo[]> {
  const qs = new URLSearchParams({ scope: projectFilter ? "project" : "all" });
  if (projectFilter) qs.set("project", projectFilter);
  const { agents } = await call(`/who?${qs}`);
  return agents;
}

export async function sendMessage(
  from: string,
  to: string,
  message: string,
  replyTo?: string,
  projectOnly?: string,
): Promise<Message> {
  const { message: msg } = await call("/send", {
    method: "POST",
    body: JSON.stringify({ from, to, message, reply_to: replyTo, project: projectOnly }),
  });
  return msg;
}

export async function peekMessages(code: string): Promise<Message[]> {
  const { messages } = await call(`/peek?code=${encodeURIComponent(code)}`);
  return messages;
}

export async function ackMessage(code: string, messageId: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/ack`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ code, message_id: messageId }),
  });
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Invalid message id");
  }
  const body = await res.json().catch(() => ({ ok: false }));
  return Boolean(body.ok);
}

export async function ackAll(code: string): Promise<number> {
  const { count } = await call("/ack_all", { method: "POST", body: JSON.stringify({ code }) });
  return count;
}
