import { randomBytes } from "node:crypto";
import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";
import { listAgents } from "./presenceStore.js";
import type { Message } from "../store.js";

const MAX_STREAM_LEN = 1000;

function fieldsToMessage(id: string, fields: string[]): Message {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return {
    id,
    from: obj.from,
    to: obj.to,
    message: obj.message,
    timestamp: obj.timestamp,
    reply_to: obj.reply_to || null,
  };
}

async function writeToInbox(
  recipient: string,
  from: string,
  message: string,
  replyTo: string | undefined,
): Promise<Message> {
  const timestamp = new Date().toISOString();
  const streamId = await valkey.xadd(
    `inbox:${recipient}`,
    "MAXLEN",
    "~",
    MAX_STREAM_LEN,
    "*",
    "from",
    from,
    "to",
    recipient,
    "message",
    message,
    "timestamp",
    timestamp,
    "reply_to",
    replyTo ?? "",
  );
  const id = `msg-${streamId}`;
  await valkey.publish(`notify:${recipient}`, id);
  return {
    id,
    from,
    to: recipient,
    message,
    timestamp,
    reply_to: replyTo ?? null,
  };
}

function streamIdFromMessageId(messageId: string): string {
  return messageId.startsWith("msg-") ? messageId.slice(4) : messageId;
}

export async function sendMessage(
  from: string,
  to: string,
  message: string,
  replyTo?: string,
  projectOnly?: string,
): Promise<Message> {
  assertSafeId(from, "agent code");

  if (to === "all") {
    const agents = await listAgents(projectOnly);
    const recipients = agents.filter((a) => a.code !== from);
    const sent = await Promise.all(
      recipients.map((a) => writeToInbox(a.code, from, message, replyTo)),
    );
    return (
      sent[0] ?? {
        id: `msg-${randomBytes(6).toString("hex")}`,
        from,
        to: "all",
        message,
        timestamp: new Date().toISOString(),
        reply_to: replyTo ?? null,
      }
    );
  }

  assertSafeId(to, "agent code");
  return writeToInbox(to, from, message, replyTo);
}

export async function peekMessages(code: string): Promise<Message[]> {
  assertSafeId(code, "agent code");
  const entries = await valkey.xrange(`inbox:${code}`, "-", "+");
  return entries
    .map(([id, fields]) => fieldsToMessage(`msg-${id}`, fields))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function ackMessage(code: string, messageId: string): Promise<boolean> {
  assertSafeId(code, "agent code");
  const streamId = streamIdFromMessageId(messageId);
  const deleted = await valkey.xdel(`inbox:${code}`, streamId);
  return deleted === 1;
}

export async function ackAll(code: string): Promise<number> {
  assertSafeId(code, "agent code");
  const messages = await peekMessages(code);
  if (messages.length === 0) return 0;
  const streamIds = messages.map((m) => streamIdFromMessageId(m.id));
  return valkey.xdel(`inbox:${code}`, ...streamIds);
}
