import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";

export type Unsubscribe = () => void;

export function onNewMessage(code: string, callback: (messageId: string) => void): Unsubscribe {
  assertSafeId(code, "agent code");
  const sub = valkey.duplicate();
  const channel = `notify:${code}`;

  sub.subscribe(channel).catch(() => {});
  sub.on("message", (ch, messageId) => {
    if (ch === channel) callback(messageId);
  });

  return () => {
    sub.disconnect();
  };
}
