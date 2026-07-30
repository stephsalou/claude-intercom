import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
