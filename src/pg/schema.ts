import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  workspace: text("workspace").notNull(),
  fromCode: text("from_code").notNull(),
  toCode: text("to_code").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "string" }).notNull(),
  replyTo: text("reply_to"),
  ackedAt: timestamp("acked_at", { withTimezone: true, mode: "string" }),
});

// Audit trail of tool calls (who/send/reply/peek/ack/ack_all) per agent — distinct
// from `messages`, which only tracks the inter-agent messages themselves.
export const commandLog = pgTable("command_log", {
  id: serial("id").primaryKey(),
  workspace: text("workspace").notNull(),
  code: text("code").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
