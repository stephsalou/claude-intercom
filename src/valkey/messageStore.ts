import { randomBytes } from "node:crypto";
import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";
import { listAgents } from "./presenceStore.js";
import { recordMessage, markAcked } from "../pg/historyRepo.js";
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
  workspace: string,
  recipient: string,
  from: string,
  message: string,
  replyTo: string | undefined,
): Promise<Message> {
  const timestamp = new Date().toISOString();
  const streamId = await valkey.xadd(
    `inbox:${workspace}:${recipient}`,
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
  await valkey.publish(`notify:${workspace}:${recipient}`, id);
  const msg: Message = {
    id,
    from,
    to: recipient,
    message,
    timestamp,
    reply_to: replyTo ?? null,
  };
  await recordMessage(workspace, msg); // best-effort — errors are logged, not thrown
  return msg;
}

function streamIdFromMessageId(messageId: string): string {
  return messageId.startsWith("msg-") ? messageId.slice(4) : messageId;
}

export async function sendMessage(
  workspace: string,
  from: string,
  to: string,
  message: string,
  replyTo?: string,
  projectOnly?: string,
): Promise<Message> {
  assertSafeId(workspace, "workspace");
  assertSafeId(from, "agent code");

  if (to === "all") {
    const agents = await listAgents(workspace, projectOnly);
    const recipients = agents.filter((a) => a.code !== from);
    const sent = await Promise.all(
      recipients.map((a) => writeToInbox(workspace, a.code, from, message, replyTo)),
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
  return writeToInbox(workspace, to, from, message, replyTo);
}

export async function peekMessages(workspace: string, code: string): Promise<Message[]> {
  assertSafeId(workspace, "workspace");
  assertSafeId(code, "agent code");
  const entries = await valkey.xrange(`inbox:${workspace}:${code}`, "-", "+");
  return entries
    .map(([id, fields]) => fieldsToMessage(`msg-${id}`, fields))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function ackMessage(workspace: string, code: string, messageId: string): Promise<boolean> {
  assertSafeId(workspace, "workspace");
  assertSafeId(code, "agent code");
  const streamId = streamIdFromMessageId(messageId);
  const deleted = await valkey.xdel(`inbox:${workspace}:${code}`, streamId);
  if (deleted === 1) await markAcked(workspace, messageId);
  return deleted === 1;
}

export async function ackAll(workspace: string, code: string): Promise<number> {
  assertSafeId(workspace, "workspace");
  assertSafeId(code, "agent code");
  const messages = await peekMessages(workspace, code);
  if (messages.length === 0) return 0;
  const streamIds = messages.map((m) => streamIdFromMessageId(m.id));
  return valkey.xdel(`inbox:${workspace}:${code}`, ...streamIds);
}
