import { valkey } from "./client.js";
import { assertSafeId } from "../safeId.js";

export type Unsubscribe = () => void;

export function onNewMessage(
  workspace: string,
  code: string,
  callback: (messageId: string) => void,
): Unsubscribe {
  assertSafeId(workspace, "workspace");
  assertSafeId(code, "agent code");
  const sub = valkey.duplicate();
  const channel = `notify:${workspace}:${code}`;

  sub.subscribe(channel).catch(() => {});
  sub.on("message", (ch, messageId) => {
    if (ch === channel) callback(messageId);
  });

  return () => {
    sub.disconnect();
  };
}
